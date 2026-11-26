import { NextRequest, NextResponse } from "next/server";
import { getProxyAuthHeaders, resolveProxyTenantId } from "@/lib/batch2Proxy";
import { getTenantBaselineData, KNOWN_TENANT_IDS } from "@/lib/tenantBaselines";

const BACKEND_BASE = (
  process.env.BACKEND_API_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "http://127.0.0.1:8000"
).replace(/\/+$/, "");

const DEMO_IDS = new Set<string>(Object.values(KNOWN_TENANT_IDS));

export async function GET(req: NextRequest) {
  const tenantId = resolveProxyTenantId(req);
  const authHeaders = getProxyAuthHeaders(req);

  const backendUrl = new URL(`${BACKEND_BASE}/briefs`);
  req.nextUrl.searchParams.forEach((val, key) => {
    backendUrl.searchParams.set(key, val);
  });

  try {
    const res = await fetch(backendUrl.toString(), {
      headers: authHeaders,
      cache: "no-store",
    });

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data?.briefs)) {
        return NextResponse.json(data);
      }
    }
  } catch {
    // Fall through cleanly
  }

  if (tenantId && DEMO_IDS.has(tenantId)) {
    return NextResponse.json({ briefs: getTenantBaselineData(tenantId).briefs });
  }
  return NextResponse.json({ briefs: [] });
}

