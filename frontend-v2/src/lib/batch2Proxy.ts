import { NextRequest, NextResponse } from "next/server";
import {
  createTenantToken,
  DEFAULT_TENANT_ID,
  extractTokenSub,
  isTokenExpired,
  isValidUuid,
} from "@/lib/auth";

const BACKEND_BASE = (
  process.env.BACKEND_API_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "http://127.0.0.1:8000"
).replace(/\/+$/, "");

/**
 * Resolve tenant-scoped Authorization and X-Tenant-ID proxy headers from an incoming
 * NextRequest without silently clobbering requested tenants with Meesho (DEFAULT_TENANT_ID).
 */
export function resolveProxyTenantId(req: NextRequest, bodyTenantId?: string): string | undefined {
  const candidates = [
    bodyTenantId,
    req.headers.get("x-tenant-id"),
    req.nextUrl.searchParams.get("tenant_id"),
    req.nextUrl.searchParams.get("tenantId"),
  ];
  const validParam = candidates.find((c) => typeof c === "string" && isValidUuid(c));
  if (validParam) return validParam.trim();

  const incomingAuth = req.headers.get("authorization");
  const rawToken = incomingAuth ? incomingAuth.replace(/^Bearer\s+/i, "").trim() : "";
  const sub = extractTokenSub(rawToken);
  return sub && isValidUuid(sub) ? sub : undefined;
}

export function getProxyAuthHeaders(
  req: NextRequest,
  bodyTenantId?: string
): Record<string, string> {
  const explicitCandidates = [
    bodyTenantId,
    req.headers.get("x-tenant-id"),
    req.nextUrl.searchParams.get("tenant_id"),
    req.nextUrl.searchParams.get("tenantId"),
  ];
  const explicitValid = explicitCandidates.find((c) => typeof c === "string" && isValidUuid(c));
  const requestedTenant = explicitValid ? explicitValid.trim() : undefined;

  const incomingAuth = req.headers.get("authorization");
  let token = incomingAuth ? incomingAuth.replace(/^Bearer\s+/i, "").trim() : "";
  if (token === "null" || token === "undefined") {
    token = "";
  }

  const tokenSub = extractTokenSub(token);
  const isDevJwt = Boolean(token && token.endsWith(".devsignature"));

  if (
    !token ||
    isTokenExpired(token) ||
    (requestedTenant && isDevJwt && tokenSub !== requestedTenant)
  ) {
    const targetTenant =
      requestedTenant ||
      (tokenSub && isValidUuid(tokenSub) ? tokenSub : DEFAULT_TENANT_ID);
    token = createTenantToken(targetTenant);
  }

  const resolvedTenant =
    requestedTenant ||
    (extractTokenSub(token) && isValidUuid(extractTokenSub(token))
      ? extractTokenSub(token)!
      : undefined);

  return {
    Authorization: `Bearer ${token}`,
    ...(resolvedTenant ? { "X-Tenant-ID": resolvedTenant } : {}),
  };
}

export function createBatch2Proxy(apiPrefix: string) {
  async function handle(req: NextRequest, context?: { params: Promise<{ slug?: string[] }> }) {
    let subpath = "";
    if (context && context.params) {
      const { slug } = await context.params;
      if (slug && slug.length > 0) {
        subpath = "/" + slug.join("/");
      }
    }

    const authHeaders = getProxyAuthHeaders(req);

    const targetUrl = new URL(`/api/${apiPrefix}${subpath}`, BACKEND_BASE);
    req.nextUrl.searchParams.forEach((val, key) => {
      targetUrl.searchParams.set(key, val);
    });

    const headers: Record<string, string> = {
      ...authHeaders,
    };

    const contentType = req.headers.get("content-type");
    if (contentType) {
      headers["Content-Type"] = contentType;
    }

    const init: RequestInit = {
      method: req.method,
      headers,
      cache: "no-store",
    };

    if (["POST", "PUT", "PATCH"].includes(req.method)) {
      try {
        if (contentType && contentType.includes("multipart/form-data")) {
          init.body = await req.formData();
        } else {
          init.body = await req.text();
        }
      } catch {
        // no body or body read failed
      }
    }

    try {
      const res = await fetch(targetUrl.toString(), init);
      const resText = await res.text();
      let resJson: any;
      try {
        resJson = JSON.parse(resText);
      } catch {
        return new NextResponse(resText, {
          status: res.status,
          headers: { "Content-Type": res.headers.get("Content-Type") || "text/plain" },
        });
      }

      return NextResponse.json(resJson, { status: res.status });
    } catch (err: any) {
      return NextResponse.json(
        { error: `Backend proxy connection failed: ${err.message}` },
        { status: 502 }
      );
    }
  }

  return {
    GET: handle,
    POST: handle,
    PATCH: handle,
    PUT: handle,
    DELETE: handle,
  };
}
