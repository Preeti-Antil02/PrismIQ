"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { Loader2, AlertCircle, ArrowRight, ShieldCheck } from "lucide-react";
import "@/app/public-website.css";

export default function LoginPage() {
  const router = useRouter();
  const { login, user } = useAuth();

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // If already logged in, redirect
  React.useEffect(() => {
    if (user) {
      router.push("/app");
    }
  }, [user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError("Please enter both email and password.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { onboarding_complete } = await login(email.trim(), password);
      if (onboarding_complete) {
        router.push("/app");
      } else {
        router.push("/onboarding");
      }
    } catch (err: any) {
      setError(err.message || "Failed to sign in. Please verify your credentials.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFillDemo = () => {
    setEmail("demo@prismiq.ai");
    setPassword("password123");
    setError(null);
  };

  return (
    <div
      className="public-site min-h-screen flex flex-col justify-between"
      style={{
        background:
          "radial-gradient(circle at 10% 12%, rgba(139,114,255,0.14), transparent 28rem), radial-gradient(circle at 90% 18%, rgba(114,215,232,0.15), transparent 30rem), radial-gradient(circle at 50% 60%, rgba(244,168,202,0.08), transparent 34rem), #fbfaf8",
      }}
    >
      {/* Top Header */}
      <header className="w-full max-w-5xl mx-auto px-6 py-8 flex items-center justify-between">
        <Link href="/" className="ps-brand flex items-center gap-2.5">
          <svg className="ps-brandLogo" viewBox="0 0 42 42" aria-label="PrismIQ logo">
            <defs>
              <linearGradient id="loginA" x1="0" y1="0" x2="1" y2="1">
                <stop stopColor="#5A72FF" />
                <stop offset=".52" stopColor="#8B4DFF" />
                <stop offset="1" stopColor="#FF83C8" />
              </linearGradient>
              <linearGradient id="loginB" x1="0" y1="1" x2="1" y2="0">
                <stop stopColor="#62DDF2" />
                <stop offset=".55" stopColor="#7264FF" />
                <stop offset="1" stopColor="#FFB18F" />
              </linearGradient>
            </defs>
            <path d="M21 3 37 31 21 39 5 31Z" fill="url(#loginA)" opacity=".95" />
            <path d="M21 3 21 39 5 31Z" fill="url(#loginB)" opacity=".88" />
            <path d="M21 3 37 31 21 26Z" fill="#9D8CFF" opacity=".72" />
            <path d="M21 26 37 31 21 39Z" fill="#FF72C2" opacity=".58" />
            <path d="M21 8 21 26 13 29Z" fill="#FFFFFF" opacity=".45" />
          </svg>
          <span className="font-extrabold text-lg tracking-tight text-[#17171b]">PrismIQ</span>
        </Link>

        <Link
          href="/"
          className="text-xs font-semibold text-[#595a63] hover:text-[#17171b] transition-colors"
        >
          ← Back to home
        </Link>
      </header>

      {/* Main Card Container */}
      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-[440px] bg-white/90 backdrop-blur-xl border border-[rgba(20,20,30,0.08)] shadow-[0_24px_60px_rgba(36,28,68,0.08)] rounded-2xl p-8 sm:p-10 space-y-7">
          {/* Card Header */}
          <div className="space-y-2 text-center">
            <span className="ps-eyebrow mb-2">
              <span className="ps-dot" /> Authenticated Workspace
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#17171b]">
              Welcome back
            </h1>
            <p className="text-xs sm:text-sm text-[#70717a]">
              Sign in to access your competitive intelligence feed
            </p>
          </div>

          {/* Quick Demo Pill */}
          <div className="flex items-center justify-between bg-[#f4f3f0] rounded-xl px-3.5 py-2.5 border border-[rgba(20,20,30,0.06)]">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-purple-600" />
              <span className="text-[11px] font-medium text-[#575861]">Need a test account?</span>
            </div>
            <button
              type="button"
              onClick={handleFillDemo}
              className="text-[11px] font-bold text-purple-600 hover:text-purple-700 underline underline-offset-2 transition-colors cursor-pointer"
            >
              Fill demo credentials
            </button>
          </div>

          {/* Error Banner */}
          {error && (
            <div
              role="alert"
              className="flex items-start gap-3 p-3.5 bg-red-50/90 border border-red-200/80 rounded-xl text-xs text-red-700 animate-in fade-in duration-200"
            >
              <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <label htmlFor="login-email" className="block text-xs font-bold text-[#323338]">
                Work Email
              </label>
              <input
                id="login-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                disabled={isLoading}
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-[rgba(20,20,30,0.14)] rounded-xl text-[#17171b] placeholder:text-[#9ea0a8] focus:outline-none focus:border-[#7c3aed] focus:ring-3 focus:ring-[#7c3aed]/15 transition-all disabled:opacity-60"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="login-password" className="block text-xs font-bold text-[#323338]">
                  Password
                </label>
              </div>
              <input
                id="login-password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={isLoading}
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-[rgba(20,20,30,0.14)] rounded-xl text-[#17171b] placeholder:text-[#9ea0a8] focus:outline-none focus:border-[#7c3aed] focus:ring-3 focus:ring-[#7c3aed]/15 transition-all disabled:opacity-60"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 py-3 px-4 rounded-xl text-white font-bold text-sm tracking-wide transition-all shadow-[0_10px_25px_rgba(124,58,237,0.28)] hover:shadow-[0_14px_30px_rgba(124,58,237,0.36)] hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60 disabled:pointer-events-none flex items-center justify-center gap-2 cursor-pointer"
              style={{
                background: "linear-gradient(110deg, #3b82f6, #7c3aed 50%, #ec4899)",
              }}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* Bottom Switch Link */}
          <div className="text-center pt-2 border-t border-[rgba(20,20,30,0.06)]">
            <p className="text-xs text-[#70717a]">
              Don&apos;t have an account?{" "}
              <Link
                href="/signup"
                className="font-bold text-[#7c3aed] hover:text-[#6d28d9] transition-colors"
              >
                Sign up free →
              </Link>
            </p>
          </div>
        </div>
      </main>

      {/* Subtle Footer */}
      <footer className="w-full max-w-5xl mx-auto px-6 py-6 text-center text-xs text-[#9ea0a8]">
        PrismIQ Autonomous Competitive Intelligence &bull; Row-Level Security Protected
      </footer>
    </div>
  );
}
