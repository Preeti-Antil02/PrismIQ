/**
 * Tenant Auth & Token Helpers for PrismIQ
 */

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  tenant_id?: string;
}

export const DEFAULT_TENANT_ID =
  process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID || "8553449a-c998-4727-be01-9aeb724038cb";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUuid(id?: string | null): boolean {
  return Boolean(id && UUID_REGEX.test(id.trim()));
}

export function getStoredUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("prismiq_user");
    if (raw) return JSON.parse(raw);
  } catch {
    // Malformed JSON
  }
  return null;
}

export function extractTokenSub(token?: string | null): string | null {
  if (!token || typeof token !== "string") return null;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payloadJson =
      typeof window !== "undefined" && window.atob
        ? window.atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"))
        : Buffer.from(parts[1], "base64url").toString("utf-8");
    const payload = JSON.parse(payloadJson);
    return typeof payload?.sub === "string" && payload.sub.trim() ? payload.sub.trim() : null;
  } catch {
    return null;
  }
}

export function setStoredAuth(token: string, user: AuthUser): void {
  if (typeof window === "undefined") return;
  localStorage.setItem("prismiq_tenant_token", token);
  localStorage.setItem("prismiq_user", JSON.stringify(user));
  const resolvedTid = isValidUuid(user?.tenant_id)
    ? user.tenant_id!.trim()
    : isValidUuid(user?.id)
    ? user.id.trim()
    : extractTokenSub(token);
  if (resolvedTid && isValidUuid(resolvedTid)) {
    localStorage.setItem("prismiq_active_tenant_id", resolvedTid);
  }
}

export function clearStoredAuth(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem("prismiq_tenant_token");
  localStorage.removeItem("prismiq_user");
  localStorage.removeItem("prismiq_onboarding_state");
  localStorage.removeItem("prismiq_active_tenant_id");
  localStorage.removeItem("prismiq_target_company");
}

export function isTokenExpired(token?: string | null): boolean {
  if (!token || typeof token !== "string") return true;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return true;
    const payloadJson =
      typeof window !== "undefined" && window.atob
        ? window.atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"))
        : Buffer.from(parts[1], "base64url").toString("utf-8");
    const payload = JSON.parse(payloadJson);
    if (!payload.exp || typeof payload.exp !== "number") return false;
    // Buffer with 60 seconds clock skew
    const nowSeconds = Math.floor(Date.now() / 1000);
    return payload.exp <= nowSeconds + 60;
  } catch {
    return true;
  }
}

export function isAuthenticated(): boolean {
  if (typeof window === "undefined") return false;
  const token = localStorage.getItem("prismiq_tenant_token");
  return Boolean(token && !isTokenExpired(token));
}

export function createTenantToken(tenantId: string, email?: string): string {
  const tid = isValidUuid(tenantId) ? tenantId.trim() : DEFAULT_TENANT_ID;
  if (!tid) return "";

  const header = { alg: "HS256", typ: "JWT" };
  const payload = {
    sub: tid,
    aud: "authenticated",
    role: "authenticated",
    email: email || `${tid.slice(0, 8)}@prismiq.ai`,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 86400 * 7,
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

export function getClientAuthToken(tenantId?: string): string {
  const emailHint = getStoredUser()?.email;

  // 1. If explicit tenantId provided, return matching stored token or construct token for that tenant
  if (tenantId) {
    const tid = isValidUuid(tenantId) ? tenantId.trim() : DEFAULT_TENANT_ID;
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("prismiq_tenant_token");
      if (stored && !isTokenExpired(stored) && extractTokenSub(stored) === tid) {
        return stored;
      }
      const token = createTenantToken(tid, emailHint);
      const rawActive = localStorage.getItem("prismiq_active_tenant_id");
      if (!rawActive || rawActive === tid) {
        localStorage.setItem("prismiq_active_tenant_id", tid);
        localStorage.setItem("prismiq_tenant_token", token);
      }
      return token;
    }
    return createTenantToken(tid);
  }

  // 2. In browser environment, preserve real/active tenant token without clobbering on missing key
  if (typeof window !== "undefined") {
    const rawActive = localStorage.getItem("prismiq_active_tenant_id");
    const activeTenantId = isValidUuid(rawActive) ? rawActive!.trim() : null;
    const stored = localStorage.getItem("prismiq_tenant_token");
    const subFromStored = extractTokenSub(stored);

    if (activeTenantId) {
      if (stored && !isTokenExpired(stored)) {
        if (subFromStored === activeTenantId) {
          return stored;
        }
        // Only overwrite out-of-sync dev tokens; preserve signed external JWTs while X-Tenant-ID carries workspace
        if (!stored.endsWith(".devsignature")) {
          return stored;
        }
      }
      const freshToken = createTenantToken(activeTenantId, emailHint);
      localStorage.setItem("prismiq_tenant_token", freshToken);
      return freshToken;
    }

    if (stored) {
      if (!isTokenExpired(stored) && subFromStored && isValidUuid(subFromStored)) {
        localStorage.setItem("prismiq_active_tenant_id", subFromStored);
        return stored;
      }
      const tenantToUse = subFromStored && isValidUuid(subFromStored) ? subFromStored : DEFAULT_TENANT_ID;
      const freshToken = createTenantToken(tenantToUse, emailHint);
      localStorage.setItem("prismiq_tenant_token", freshToken);
      localStorage.setItem("prismiq_active_tenant_id", tenantToUse);
      return freshToken;
    }
  }

  const defaultFreshToken = createTenantToken(DEFAULT_TENANT_ID, emailHint);
  if (typeof window !== "undefined") {
    localStorage.setItem("prismiq_tenant_token", defaultFreshToken);
    localStorage.setItem("prismiq_active_tenant_id", DEFAULT_TENANT_ID);
  }
  return defaultFreshToken;
}


