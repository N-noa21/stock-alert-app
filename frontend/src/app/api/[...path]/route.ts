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

async function proxy(req: NextRequest, context: Context) {
  const { path } = await context.params;
  const targetUrl = `${normalizedApiBaseUrl}/${path.join("/")}${req.nextUrl.search}`;

  const headers = new Headers();

  const contentType = req.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);

  const authorization = req.headers.get("authorization");
  if (authorization) headers.set("authorization", authorization);

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

  return new NextResponse(responseText, {
    status: backendRes.status,
    headers: responseHeaders,
  });
}

export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
export const DELETE = proxy;