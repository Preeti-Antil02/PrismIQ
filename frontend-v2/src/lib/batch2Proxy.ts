import { NextRequest, NextResponse } from "next/server";
import { getClientAuthToken, createTenantToken, isTokenExpired, DEFAULT_TENANT_ID } from "@/lib/auth";

const BACKEND_BASE = (
  process.env.BACKEND_API_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "http://127.0.0.1:8000"
).replace(/\/+$/, "");

export function createBatch2Proxy(apiPrefix: string) {
  async function handle(req: NextRequest, context?: { params: Promise<{ slug?: string[] }> }) {
    let subpath = "";
    if (context && context.params) {
      const { slug } = await context.params;
      if (slug && slug.length > 0) {
        subpath = "/" + slug.join("/");
      }
    }

    const incomingAuth = req.headers.get("authorization");
    let token = incomingAuth ? incomingAuth.replace(/^Bearer\s+/i, "") : getClientAuthToken();

    if (!token || token === "null" || token === "undefined" || isTokenExpired(token)) {
      let tenantId = DEFAULT_TENANT_ID;
      if (token && token.includes(".")) {
        try {
          const parts = token.split(".");
          const payloadJson = parts.length > 1 ? Buffer.from(parts[1], "base64url").toString("utf-8") : "{}";
          const payload = JSON.parse(payloadJson);
          if (payload.sub) tenantId = payload.sub;
        } catch {
          // fallback to DEFAULT_TENANT_ID
        }
      }
      token = createTenantToken(tenantId);
    }

    const targetUrl = new URL(`/api/${apiPrefix}${subpath}`, BACKEND_BASE);
    req.nextUrl.searchParams.forEach((val, key) => {
      targetUrl.searchParams.set(key, val);
    });

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
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
