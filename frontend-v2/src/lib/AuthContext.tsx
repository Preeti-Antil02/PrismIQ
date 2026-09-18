"use client";

import * as React from "react";
import {
  type AuthUser,
  getStoredUser,
  setStoredAuth,
  clearStoredAuth,
} from "./auth";

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  signup: (email: string, password: string, fullName?: string) => Promise<{ onboarding_complete: boolean }>;
  login: (email: string, password: string) => Promise<{ onboarding_complete: boolean }>;
  logout: () => void;
  checkOnboardingStatus: () => Promise<boolean>;
}

const AuthContext = React.createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<AuthUser | null>(null);
  const [token, setToken] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState<boolean>(true);

  // Initialize from localStorage on mount
  React.useEffect(() => {
    try {
      const storedToken = localStorage.getItem("prismiq_tenant_token");
      const storedUser = getStoredUser();

      if (storedToken && storedUser) {
        setUser(storedUser);
        setToken(storedToken);
      }
    } catch {
      // Storage access error
    } finally {
      setIsLoading(false);
    }
  }, []);

  const signup = async (email: string, password: string, fullName?: string) => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, full_name: fullName }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || errData.error || `Signup failed (${res.status})`);
      }

      const data = await res.json();
      setStoredAuth(data.token, data.user);
      setUser(data.user);
      setToken(data.token);

      return { onboarding_complete: Boolean(data.onboarding_complete) };
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || errData.error || "Invalid email or password");
      }

      const data = await res.json();
      setStoredAuth(data.token, data.user);
      setUser(data.user);
      setToken(data.token);

      return { onboarding_complete: Boolean(data.onboarding_complete) };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    clearStoredAuth();
    setUser(null);
    setToken(null);
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
  };

  const checkOnboardingStatus = async (): Promise<boolean> => {
    try {
      const currentToken = token || localStorage.getItem("prismiq_tenant_token");
      if (!currentToken) return false;

      const res = await fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${currentToken}` },
      });

      if (res.ok) {
        const data = await res.json();
        return Boolean(data.onboarding_complete);
      }
      return false;
    } catch {
      return false;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        signup,
        login,
        logout,
        checkOnboardingStatus,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
