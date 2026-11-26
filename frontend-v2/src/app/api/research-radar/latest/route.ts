import { NextRequest, NextResponse } from "next/server";
import { getProxyAuthHeaders } from "@/lib/batch2Proxy";

const BACKEND_BASE = (
  process.env.BACKEND_API_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "http://127.0.0.1:8000"
).replace(/\/+$/, "");

export async function GET(req: NextRequest) {
  const backendUrl = new URL(`${BACKEND_BASE}/research-radar/latest`);
  req.nextUrl.searchParams.forEach((val, key) => {
    backendUrl.searchParams.set(key, val);
  });

  try {
    const res = await fetch(backendUrl.toString(), {
      headers: getProxyAuthHeaders(req),
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: `Backend returned ${res.status}: ${text}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json(
      { error: `Backend proxy connection failed: ${err.message}` },
      { status: 502 }
    );
  }
}
