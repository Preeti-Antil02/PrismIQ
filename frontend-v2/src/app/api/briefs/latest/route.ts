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

  const backendUrl = new URL(`${BACKEND_BASE}/briefs/latest`);
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
      if (data && typeof data.content === "string" && data.content.length > 100) {
        const lower = data.content.toLowerCase();
        // Ensure the brief matches this tenant's target company or tracked competitors
        const isMatch =
          lower.includes(targetComp) ||
          baseline.competitors.some((c) => lower.includes(c.toLowerCase()));
        if (isMatch) {
          return NextResponse.json(data);
        }
      }
    }
  } catch {
    // Fall through to authentic baseline brief
  }

  return NextResponse.json(baseline.latestBrief);
}

