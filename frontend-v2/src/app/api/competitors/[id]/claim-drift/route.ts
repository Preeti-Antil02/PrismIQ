import { NextRequest, NextResponse } from "next/server";
import { getClientAuthToken } from "@/lib/auth";

const BACKEND_BASE = (
  process.env.BACKEND_API_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "http://127.0.0.1:8000"
).replace(/\/+$/, "");

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const { searchParams } = new URL(req.url);
  const review_status = searchParams.get("review_status");
  const drift_type = searchParams.get("drift_type");
  const limit = searchParams.get("limit") || "50";
  const offset = searchParams.get("offset") || "0";

  const query = new URLSearchParams({ limit, offset });
  if (review_status) query.set("review_status", review_status);
  if (drift_type) query.set("drift_type", drift_type);

  const incomingAuth = req.headers.get("authorization");
  const token = incomingAuth ? incomingAuth.replace(/^Bearer\s+/i, "") : getClientAuthToken();

  const url = `${BACKEND_BASE}/api/competitors/${encodeURIComponent(id)}/claim-drift?${query.toString()}`;

  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
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
