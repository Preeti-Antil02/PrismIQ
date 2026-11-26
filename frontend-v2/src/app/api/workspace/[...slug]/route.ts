import { NextRequest, NextResponse } from "next/server";
import { createTenantToken, DEFAULT_TENANT_ID } from "@/lib/auth";
import { getProxyAuthHeaders, resolveProxyTenantId } from "@/lib/batch2Proxy";

const BACKEND_BASE = (
  process.env.BACKEND_API_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "http://127.0.0.1:8000"
).replace(/\/+$/, "");

async function proxy(req: NextRequest, context: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await context.params;
  const path = slug.join("/");
  const authHeaders = getProxyAuthHeaders(req);

  // Route mapping from /api/workspace/... to FastAPI backend
  let backendPath: string;
  if (path === "topics" || path.startsWith("topics/")) {
    backendPath = path.replace(/^topics/, "/research-radar/topics");
  } else if (path === "discover") {
    backendPath = "/api/onboarding/discover";
  } else if (path === "confirm") {
    backendPath = "/api/onboarding/confirm";
  } else if (path === "watchlist" && req.method === "GET") {
    backendPath = "/tracked-companies";
  } else {
    backendPath = `/workspace/${path}`;
  }

  const url = new URL(backendPath, BACKEND_BASE);
  // Forward search parameters
  req.nextUrl.searchParams.forEach((val, key) => {
    url.searchParams.set(key, val);
  });

  const headers: Record<string, string> = {
    ...authHeaders,
    "Content-Type": "application/json",
  };

  const init: RequestInit = {
    method: req.method,
    headers,
    cache: "no-store",
    signal: AbortSignal.timeout(120000),
  };

  if (["POST", "PATCH", "PUT"].includes(req.method)) {
    try {
      const body = await req.text();
      if (body) {
        init.body = body;
      }
    } catch {
      // No request body
    }
  }

  try {
    let res = await fetch(url.toString(), init);
    let text = await res.text();

    // Auto-heal on 401 Token Expired: renew and retry once for the resolved tenant
    if (res.status === 401 && (text.includes("Token has expired") || text.includes("expired"))) {
      const tenantId = resolveProxyTenantId(req) || DEFAULT_TENANT_ID;
      const freshToken = createTenantToken(tenantId);
      headers.Authorization = `Bearer ${freshToken}`;
      headers["X-Tenant-ID"] = tenantId;
      res = await fetch(url.toString(), init);
      text = await res.text();
    }

    try {
      const json = JSON.parse(text);
      return NextResponse.json(json, { status: res.status });
    } catch {
      return new NextResponse(text, { status: res.status });
    }
  } catch (err: any) {
    return NextResponse.json(
      { error: `Backend proxy connection failed: ${err.message}` },
      { status: 502 }
    );
  }
}

export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
