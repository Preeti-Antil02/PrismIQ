import { NextRequest, NextResponse } from "next/server";
import { getClientAuthToken } from "@/lib/auth";

const BACKEND_BASE = (
  process.env.BACKEND_API_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "http://127.0.0.1:8000"
).replace(/\/+$/, "");

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ itemId: string; actionId: string }> }
) {
  const { itemId, actionId } = await context.params;
  const incomingAuth = req.headers.get("authorization");
  const tenantHeader = req.headers.get("x-tenant-id");
  const token = incomingAuth ? incomingAuth.replace(/^Bearer\s+/i, "") : getClientAuthToken(tenantHeader || undefined);

  try {
    const body = await req.json();
    const backendUrl = `${BACKEND_BASE}/decision-support/${encodeURIComponent(itemId)}/actions/${encodeURIComponent(actionId)}`;

    const res = await fetch(backendUrl, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(tenantHeader ? { "X-Tenant-ID": tenantHeader } : {}),
      },
      body: JSON.stringify(body),
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
      { error: `Backend action proxy connection failed: ${err.message}` },
      { status: 502 }
    );
  }
}
