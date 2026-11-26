import { NextRequest, NextResponse } from "next/server";
import { getProxyAuthHeaders } from "@/lib/batch2Proxy";

const BACKEND_BASE = (
  process.env.BACKEND_API_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "http://127.0.0.1:8000"
).replace(/\/+$/, "");

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const company = searchParams.get("company");
  const impact = searchParams.get("impact");
  const category = searchParams.get("category");

  const query = new URLSearchParams();
  if (company) query.set("company", company);
  if (impact) query.set("impact", impact);
  if (category) query.set("category", category);
  const tid = searchParams.get("tenant_id");
  if (tid) query.set("tenant_id", tid);

  const qs = query.toString() ? `?${query.toString()}` : "";
  const backendUrl = `${BACKEND_BASE}/changes/detection${qs}`;

  try {
    const res = await fetch(backendUrl, {
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
