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

export function isRealUser(user: AuthUser | null): boolean {
  if (!user || !user.email) return false;
  // Temporary or auto-generated tenant user has an email like 8553449a@prismiq.ai or name "Tenant User" / "New Workspace"
  if (user.email.endsWith("@prismiq.ai") && /^[0-9a-f]{8}@prismiq\.ai$/i.test(user.email)) {
    return false;
  }
  return true;
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
  const tid = user.tenant_id || user.id;
  if (tid) {
    localStorage.setItem("prismiq_active_tenant_id", tid);
  }
}

export function clearStoredAuth(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem("prismiq_tenant_token");
  localStorage.removeItem("prismiq_user");
  localStorage.removeItem("prismiq_active_tenant_id");
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
  // In browser environment, check stored token and active tenant
  if (typeof window !== "undefined") {
    const activeTenantId = tenantId || localStorage.getItem("prismiq_active_tenant_id");
    const stored = localStorage.getItem("prismiq_tenant_token");

    if (stored) {
      try {
        const parts = stored.split(".");
        if (parts.length === 3) {
          const payloadJson = window.atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"));
          const payload = JSON.parse(payloadJson);
          // If active tenant matches or no active tenant override specified, use the genuine stored token
          if (!activeTenantId || payload.sub === activeTenantId) {
            if (payload.sub && !localStorage.getItem("prismiq_active_tenant_id")) {
              localStorage.setItem("prismiq_active_tenant_id", payload.sub);
            }
            return stored;
          }
        }
      } catch {
        // Corrupted or unparseable token, regenerate below
      }
    }

    if (activeTenantId) {
      const freshToken = createTenantToken(activeTenantId);
      localStorage.setItem("prismiq_tenant_token", freshToken);
      localStorage.setItem("prismiq_active_tenant_id", activeTenantId);
      return freshToken;
    }
  }

  const tid = tenantId || DEFAULT_TENANT_ID;
  return createTenantToken(tid);
}


