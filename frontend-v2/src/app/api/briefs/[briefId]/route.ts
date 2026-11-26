import { NextRequest, NextResponse } from "next/server";
import { getProxyAuthHeaders, resolveProxyTenantId } from "@/lib/batch2Proxy";
import { getTenantBaselineData, KNOWN_TENANT_IDS } from "@/lib/tenantBaselines";

const BACKEND_BASE = (
  process.env.BACKEND_API_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "http://127.0.0.1:8000"
).replace(/\/+$/, "");

const DEMO_IDS = new Set<string>(Object.values(KNOWN_TENANT_IDS));

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ briefId: string }> }
) {
  const { briefId } = await params;
  const tenantId = resolveProxyTenantId(request);
  const authHeaders = getProxyAuthHeaders(request);

  const backendUrl = new URL(`${BACKEND_BASE}/briefs/${encodeURIComponent(briefId)}`);
  request.nextUrl.searchParams.forEach((val, key) => {
    backendUrl.searchParams.set(key, val);
  });

  try {
    const res = await fetch(backendUrl.toString(), {
      headers: authHeaders,
      cache: "no-store",
    });

    if (res.ok) {
      const data = await res.json();
      if (data && typeof data.content === "string") {
        return NextResponse.json(data);
      }
    } else if (res.status === 404 && (!tenantId || !DEMO_IDS.has(tenantId))) {
      return NextResponse.json({ detail: `Brief '${briefId}' not found.` }, { status: 404 });
    }
  } catch {
    // Fall through only for known demo tenants
  }

  if (tenantId && DEMO_IDS.has(tenantId)) {
    const baseline = getTenantBaselineData(tenantId);
    if (
      briefId === baseline.latestBrief.id ||
      briefId === "latest" ||
      briefId === "data_latest" ||
      briefId === "published_latest"
    ) {
      return NextResponse.json(baseline.latestBrief);
    }
  }

  return NextResponse.json({ detail: `Brief '${briefId}' not found.` }, { status: 404 });
}

