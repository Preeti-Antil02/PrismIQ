"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { Loader2, AlertCircle, ArrowRight, Check } from "lucide-react";
import "@/app/public-website.css";

export default function SignupPage() {
  const router = useRouter();
  const { signup, user } = useAuth();

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [fullName, setFullName] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // If already authenticated, redirect
  React.useEffect(() => {
    if (user) {
      router.push("/onboarding");
    }
  }, [user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      setError("Please enter a valid work email address.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await signup(cleanEmail, password, fullName.trim() || undefined);
      router.push("/onboarding");
    } catch (err: any) {
      setError(err.message || "Failed to create account. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="public-site min-h-screen flex flex-col justify-between"
      style={{
        background:
          "radial-gradient(circle at 8% 10%, rgba(139,114,255,0.15), transparent 30rem), radial-gradient(circle at 92% 16%, rgba(114,215,232,0.15), transparent 30rem), radial-gradient(circle at 50% 65%, rgba(244,168,202,0.09), transparent 34rem), #fbfaf8",
      }}
    >
      {/* Top Header */}
      <header className="w-full max-w-5xl mx-auto px-6 py-8 flex items-center justify-between">
        <Link href="/" className="ps-brand flex items-center gap-2.5">
          <svg className="ps-brandLogo" viewBox="0 0 42 42" aria-label="PrismIQ logo">
            <defs>
              <linearGradient id="signupA" x1="0" y1="0" x2="1" y2="1">
                <stop stopColor="#5A72FF" />
                <stop offset=".52" stopColor="#8B4DFF" />
                <stop offset="1" stopColor="#FF83C8" />
              </linearGradient>
              <linearGradient id="signupB" x1="0" y1="1" x2="1" y2="0">
                <stop stopColor="#62DDF2" />
                <stop offset=".55" stopColor="#7264FF" />
                <stop offset="1" stopColor="#FFB18F" />
              </linearGradient>
            </defs>
            <path d="M21 3 37 31 21 39 5 31Z" fill="url(#signupA)" opacity=".95" />
            <path d="M21 3 21 39 5 31Z" fill="url(#signupB)" opacity=".88" />
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
        <div className="w-full max-w-[460px] bg-white/90 backdrop-blur-xl border border-[rgba(20,20,30,0.08)] shadow-[0_24px_60px_rgba(36,28,68,0.08)] rounded-2xl p-8 sm:p-10 space-y-6">
          {/* Card Header */}
          <div className="space-y-2 text-center">
            <span className="ps-eyebrow mb-2">
              <span className="ps-dot" /> Free Workspace Setup
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#17171b]">
              Create your workspace
            </h1>
            <p className="text-xs sm:text-sm text-[#70717a]">
              Start mapping your competitive landscape with continuous intelligence
            </p>
          </div>

          {/* Value Bullet Points */}
          <div className="space-y-1.5 py-1 text-xs text-[#575861]">
            <div className="flex items-center gap-2">
              <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
              <span>Autonomous competitor discovery on your core domain</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
              <span>Multi-tenant Row-Level Security isolation</span>
            </div>
          </div>

          {/* Error Banner */}
          {error && (
            <div
              role="alert"
              className="flex items-start gap-3 p-3.5 bg-red-50/90 border border-red-200/80 rounded-xl text-xs text-red-700 animate-in fade-in duration-200"
            >
              <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
              <div className="leading-relaxed flex-1">
                <span>{error}</span>
                {error.includes("already exists") && (
                  <div className="mt-1 font-bold">
                    <Link href="/login" className="text-purple-700 underline">
                      Sign in to your existing account →
                    </Link>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <label htmlFor="signup-email" className="block text-xs font-bold text-[#323338]">
                Work Email <span className="text-red-500">*</span>
              </label>
              <input
                id="signup-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                disabled={isLoading}
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-[rgba(20,20,30,0.14)] rounded-xl text-[#17171b] placeholder:text-[#9ea0a8] focus:outline-none focus:border-[#7c3aed] focus:ring-3 focus:ring-[#7c3aed]/15 transition-all disabled:opacity-60"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="signup-name" className="block text-xs font-bold text-[#323338]">
                Full Name or Team Name <span className="text-xs font-normal text-[#70717a]">(optional)</span>
              </label>
              <input
                id="signup-name"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Jane Doe"
                disabled={isLoading}
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-[rgba(20,20,30,0.14)] rounded-xl text-[#17171b] placeholder:text-[#9ea0a8] focus:outline-none focus:border-[#7c3aed] focus:ring-3 focus:ring-[#7c3aed]/15 transition-all disabled:opacity-60"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="signup-password" className="block text-xs font-bold text-[#323338]">
                Password <span className="text-red-500">*</span>
              </label>
              <input
                id="signup-password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
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
                  <span>Creating your workspace...</span>
                </>
              ) : (
                <>
                  <span>Get Started Free</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* Bottom Switch Link */}
          <div className="text-center pt-2 border-t border-[rgba(20,20,30,0.06)]">
            <p className="text-xs text-[#70717a]">
              Already have an account?{" "}
              <Link
                href="/login"
                className="font-bold text-[#7c3aed] hover:text-[#6d28d9] transition-colors"
              >
                Sign in →
              </Link>
            </p>
          </div>
        </div>
      </main>

      {/* Subtle Footer */}
      <footer className="w-full max-w-5xl mx-auto px-6 py-6 text-center text-xs text-[#9ea0a8]">
        By signing up, you create an isolated tenant workspace protected by PostgreSQL RLS.
      </footer>
    </div>
  );
}
