/**
 * Tenant Auth & Token Helpers for PrismIQ
 */

export const DEFAULT_TENANT_ID =
  process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID || "c8f13b91-46ef-4682-9975-f85764d8a12e";

export function getClientAuthToken(tenantId: string = DEFAULT_TENANT_ID): string {
  // If stored in localStorage, prefer that
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem("prismiq_tenant_token");
    if (stored) return stored;
  }

  // Construct well-formed JWT with sub = tenantId
  const header = { alg: "HS256", typ: "JWT" };
  const payload = {
    sub: tenantId,
    aud: "authenticated",
    role: "authenticated",
    email: `${tenantId.slice(0, 8)}@prismiq.ai`,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 86400, // 24 hours
  };

  const b64Url = (obj: unknown) => {
    const json = JSON.stringify(obj);
    if (typeof window !== "undefined" && window.btoa) {
      return window.btoa(json).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
    }
    return Buffer.from(json).toString("base64url");
  };

  return `${b64Url(header)}.${b64Url(payload)}.devsignature`;
}
