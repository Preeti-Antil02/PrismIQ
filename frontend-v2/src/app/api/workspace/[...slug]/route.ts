import { NextRequest, NextResponse } from "next/server";
import { getClientAuthToken, createTenantToken, isTokenExpired, DEFAULT_TENANT_ID } from "@/lib/auth";

const BACKEND_BASE = (
  process.env.BACKEND_API_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "http://127.0.0.1:8000"
).replace(/\/+$/, "");

async function proxy(req: NextRequest, context: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await context.params;
  const path = slug.join("/");
  const incomingAuth = req.headers.get("authorization");
  let token = incomingAuth ? incomingAuth.replace(/^Bearer\s+/i, "") : getClientAuthToken();

  // If token is missing, malformed, or expired, auto-renew for the tenant
  if (!token || token === "null" || token === "undefined" || isTokenExpired(token)) {
    let tenantId = DEFAULT_TENANT_ID;
    if (token && token.includes(".")) {
      try {
        const payloadJson = Buffer.from(token.split(".")[1], "base64url").toString("utf-8");
        const payload = JSON.parse(payloadJson);
        if (payload.sub) {
          tenantId = payload.sub;
        }
      } catch {
        // use default tenant id
      }
    }
    token = createTenantToken(tenantId);
  }

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
    Authorization: `Bearer ${token}`,
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

    // Auto-heal on 401 Token Expired: renew and retry once
    if (res.status === 401 && (text.includes("Token has expired") || text.includes("expired"))) {
      let tenantId = DEFAULT_TENANT_ID;
      if (token && token.includes(".")) {
        try {
          const payloadJson = Buffer.from(token.split(".")[1], "base64url").toString("utf-8");
          const payload = JSON.parse(payloadJson);
          if (payload.sub) {
            tenantId = payload.sub;
          }
        } catch {}
      }
      const freshToken = createTenantToken(tenantId);
      headers.Authorization = `Bearer ${freshToken}`;
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
