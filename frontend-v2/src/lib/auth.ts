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

export function setStoredAuth(token: string, user: AuthUser): void {
  if (typeof window === "undefined") return;
  localStorage.setItem("prismiq_tenant_token", token);
  localStorage.setItem("prismiq_user", JSON.stringify(user));
}

export function clearStoredAuth(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem("prismiq_tenant_token");
  localStorage.removeItem("prismiq_user");
  localStorage.removeItem("prismiq_onboarding_state");
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
  // 1. If explicit tenantId provided, always construct token for that specific tenant
  if (tenantId) {
    const tid = isValidUuid(tenantId) ? tenantId : DEFAULT_TENANT_ID;
    return createTenantToken(tid);
  }

  // 2. In browser environment, ensure stored token matches active tenant ID and is unexpired
  if (typeof window !== "undefined") {
    let activeTenantId = localStorage.getItem("prismiq_active_tenant_id");
    if (!isValidUuid(activeTenantId)) {
      activeTenantId = DEFAULT_TENANT_ID;
      localStorage.setItem("prismiq_active_tenant_id", DEFAULT_TENANT_ID);
    }
    const stored = localStorage.getItem("prismiq_tenant_token");

    if (activeTenantId && stored) {
      if (!isTokenExpired(stored)) {
        try {
          const parts = stored.split(".");
          if (parts.length === 3) {
            const payloadJson = window.atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"));
            const payload = JSON.parse(payloadJson);
            if (payload.sub === activeTenantId && isValidUuid(payload.sub)) {
              return stored;
            }
          }
        } catch {
          // Corrupted or unparseable token, regenerate below
        }
      }

      // Token and active tenant are out of sync or expired: regenerate token for activeTenantId
      const freshToken = createTenantToken(activeTenantId);
      localStorage.setItem("prismiq_tenant_token", freshToken);
      return freshToken;
    }

    if (activeTenantId) {
      const freshToken = createTenantToken(activeTenantId);
      localStorage.setItem("prismiq_tenant_token", freshToken);
      return freshToken;
    }

    if (stored) {
      let subFromStored: string | undefined;
      try {
        const parts = stored.split(".");
        if (parts.length === 3) {
          const payloadJson = window.atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"));
          const payload = JSON.parse(payloadJson);
          subFromStored = payload.sub;
        }
      } catch {
        // ignore
      }

      if (!isTokenExpired(stored) && subFromStored) {
        localStorage.setItem("prismiq_active_tenant_id", subFromStored);
        return stored;
      }

      const tenantToUse = subFromStored || DEFAULT_TENANT_ID;
      const freshToken = createTenantToken(tenantToUse);
      localStorage.setItem("prismiq_tenant_token", freshToken);
      localStorage.setItem("prismiq_active_tenant_id", tenantToUse);
      return freshToken;
    }
  }

  const defaultFreshToken = createTenantToken(DEFAULT_TENANT_ID);
  if (typeof window !== "undefined") {
    localStorage.setItem("prismiq_tenant_token", defaultFreshToken);
    localStorage.setItem("prismiq_active_tenant_id", DEFAULT_TENANT_ID);
  }
  return defaultFreshToken;
}


