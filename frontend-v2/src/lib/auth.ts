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

export function isAuthenticated(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(localStorage.getItem("prismiq_tenant_token"));
}

export function createTenantToken(tenantId: string, email?: string): string {
  const tid = tenantId || DEFAULT_TENANT_ID;
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
    return createTenantToken(tenantId);
  }

  // 2. In browser environment, ensure stored token matches active tenant ID
  if (typeof window !== "undefined") {
    const activeTenantId = localStorage.getItem("prismiq_active_tenant_id");
    const stored = localStorage.getItem("prismiq_tenant_token");

    if (activeTenantId && stored) {
      try {
        const parts = stored.split(".");
        if (parts.length === 3) {
          const payloadJson = window.atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"));
          const payload = JSON.parse(payloadJson);
          if (payload.sub === activeTenantId) {
            return stored;
          }
        }
      } catch {
        // Corrupted or unparseable token, regenerate below
      }

      // Token and active tenant are out of sync: regenerate token for activeTenantId
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
      try {
        const parts = stored.split(".");
        if (parts.length === 3) {
          const payloadJson = window.atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"));
          const payload = JSON.parse(payloadJson);
          if (payload.sub) {
            localStorage.setItem("prismiq_active_tenant_id", payload.sub);
          }
        }
      } catch {
        // ignore
      }
      return stored;
    }
  }

  return createTenantToken(DEFAULT_TENANT_ID);
}


