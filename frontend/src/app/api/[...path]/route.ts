import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

if (!API_BASE_URL) {
  throw new Error("NEXT_PUBLIC_API_BASE_URL is not set");
}

const normalizedApiBaseUrl = API_BASE_URL.replace(/\/$/, "");

type Context = {
  params: Promise<{
    path: string[];
  }>;
};

function extractTokenFromSetCookie(setCookie: string): string | null {
  const match = setCookie.match(/token=([^;]*)/);
  if (!match) return null;

  const token = match[1];
  return token.length > 0 ? token : null;
}

async function proxy(req: NextRequest, context: Context) {
  const { path } = await context.params;

  const targetUrl = `${normalizedApiBaseUrl}/${path.join("/")}${req.nextUrl.search}`;

  const headers = new Headers();

  const contentType = req.headers.get("content-type");
  if (contentType) {
    headers.set("content-type", contentType);
  }

  // frontend 側に保存されている token cookie を backend に渡す
  const tokenCookie = req.cookies.get("token")?.value;
  if (tokenCookie) {
    headers.set("cookie", `token=${tokenCookie}`);
  }

  const body =
    req.method === "GET" || req.method === "HEAD" ? undefined : await req.text();

  const backendRes = await fetch(targetUrl, {
    method: req.method,
    headers,
    body,
    cache: "no-store",
  });

  const responseText = await backendRes.text();

  const responseHeaders = new Headers();

  const responseContentType = backendRes.headers.get("content-type");
  if (responseContentType) {
    responseHeaders.set("content-type", responseContentType);
  }

  const response = new NextResponse(responseText, {
    status: backendRes.status,
    headers: responseHeaders,
  });

  const backendSetCookie = backendRes.headers.get("set-cookie");

  if (backendSetCookie) {
    const token = extractTokenFromSetCookie(backendSetCookie);

    if (token) {
      response.cookies.set("token", token, {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 7,
      });
    } else {
      response.cookies.delete("token");
    }
  }

  return response;
}

export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
export const DELETE = proxy;