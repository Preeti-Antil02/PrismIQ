import { NextRequest, NextResponse } from "next/server";
import { getClientAuthToken } from "@/lib/auth";

const BACKEND_BASE = (
  process.env.BACKEND_API_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "http://127.0.0.1:8000"
).replace(/\/+$/, "");

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const company = searchParams.get("company");
  const category = searchParams.get("category");
  const channel = searchParams.get("channel");
  const tenantId = searchParams.get("tenant_id") || searchParams.get("tenantId") || req.headers.get("x-tenant-id");

  const query = new URLSearchParams();
  if (company && company !== "ALL") query.set("company", company);
  if (category && category !== "ALL") query.set("category", category);
  if (channel && channel !== "ALL") query.set("channel", channel);
  if (tenantId) query.set("tenant_id", tenantId);

  const qs = query.toString() ? `?${query.toString()}` : "";
  const backendUrl = `${BACKEND_BASE}/signals/correlations${qs}`;

  const incomingAuth = req.headers.get("authorization");
  const token = incomingAuth ? incomingAuth.replace(/^Bearer\s+/i, "") : getClientAuthToken(tenantId || undefined);

  try {
    const res = await fetch(backendUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        ...(tenantId ? { "X-Tenant-ID": tenantId } : {}),
      },
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
