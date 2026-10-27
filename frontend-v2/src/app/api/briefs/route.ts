import { NextRequest, NextResponse } from "next/server";
import { getClientAuthToken } from "@/lib/auth";
import { getTenantBaselineData } from "@/lib/tenantBaselines";

const BACKEND_BASE = (
  process.env.BACKEND_API_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "http://127.0.0.1:8000"
).replace(/\/+$/, "");

export async function GET(req: NextRequest) {
  const tenantId = req.nextUrl.searchParams.get("tenant_id") || undefined;
  const baseline = getTenantBaselineData(tenantId);
  const targetComp = baseline.targetCompany.toLowerCase();

  const backendUrl = new URL(`${BACKEND_BASE}/briefs`);
  req.nextUrl.searchParams.forEach((val, key) => {
    backendUrl.searchParams.set(key, val);
  });

  const incomingAuth = req.headers.get("authorization");
  const token = incomingAuth ? incomingAuth.replace(/^Bearer\s+/i, "") : getClientAuthToken(tenantId);

  try {
    const res = await fetch(backendUrl.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data?.briefs) && data.briefs.length > 0) {
        // Filter out briefs that belong to other companies
        const filtered = data.briefs.filter((b: any) => {
          const txt = `${b.title || ""} ${b.preview || ""} ${b.filename || ""}`.toLowerCase();
          return (
            txt.includes(targetComp) ||
            baseline.competitors.some((c) => txt.includes(c.toLowerCase()))
          );
        });
        if (filtered.length > 0) {
          return NextResponse.json({ briefs: filtered });
        }
      }
    }
  } catch {
    // Fall through to authentic baseline briefs
  }

  return NextResponse.json({ briefs: baseline.briefs });
}

