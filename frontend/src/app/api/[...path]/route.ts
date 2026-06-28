import { NextRequest, NextResponse } from "next/server";

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

  const headers = new Headers(req.headers);

  // backend側には Render の host として渡す
  headers.set("host", new URL(normalizedApiBaseUrl).host);

  const body =
    req.method === "GET" || req.method === "HEAD" ? undefined : await req.text();

  const backendRes = await fetch(targetUrl, {
    method: req.method,
    headers,
    body,
    redirect: "manual",
  });

  return new NextResponse(backendRes.body, {
    status: backendRes.status,
    headers: backendRes.headers,
  });
}

export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
export const DELETE = proxy;