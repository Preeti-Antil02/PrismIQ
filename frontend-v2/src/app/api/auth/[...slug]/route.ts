import { NextRequest, NextResponse } from "next/server";
import { getProxyAuthHeaders } from "@/lib/batch2Proxy";

const BACKEND_BASE = (
  process.env.BACKEND_API_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "http://127.0.0.1:8000"
).replace(/\/+$/, "");

async function authProxy(req: NextRequest, context: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await context.params;
  const path = slug.join("/");
  const url = new URL(`/api/auth/${path}`, BACKEND_BASE);

  req.nextUrl.searchParams.forEach((val, key) => {
    url.searchParams.set(key, val);
  });

  const headers: Record<string, string> = {
    ...(path === "login" || path === "signup" ? {} : getProxyAuthHeaders(req)),
    "Content-Type": "application/json",
  };

  const init: RequestInit = {
    method: req.method,
    headers,
    cache: "no-store",
  };

  if (["POST", "PATCH", "PUT"].includes(req.method)) {
    try {
      const body = await req.text();
      if (body) {
        init.body = body;
      }
    } catch {
      // No body
    }
  }

  try {
    const res = await fetch(url.toString(), init);
    const text = await res.text();
    try {
      const json = JSON.parse(text);
      return NextResponse.json(json, { status: res.status });
    } catch {
      return new NextResponse(text, { status: res.status });
    }
  } catch (err: any) {
    return NextResponse.json(
      { error: `Auth proxy connection failed: ${err.message}` },
      { status: 502 }
    );
  }
}

export const GET = authProxy;
export const POST = authProxy;
