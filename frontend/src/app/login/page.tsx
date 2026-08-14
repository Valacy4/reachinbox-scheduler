"use client";

import { signIn } from "next-auth/react";
import type { FormEvent } from "react";

// Figma-aligned Login Page
export default function LoginPage() {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void signIn("google", { callbackUrl: "/dashboard" });
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-4 py-12 font-sans">
      <div className="w-full max-w-[480px] rounded-2xl border border-gray-100 bg-white p-8 sm:p-10 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.05)]">
        <h1 className="mb-8 text-center text-3xl font-semibold tracking-tight text-gray-900">
          Login
        </h1>

        <button
          type="button"
          onClick={() => void signIn("google", { callbackUrl: "/dashboard" })}
          className="flex h-12 w-full items-center justify-center gap-3 rounded-lg bg-[#E9F7EF] px-4 text-sm font-medium text-gray-800 transition hover:bg-[#DDF2E6] focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          Login with Google
        </button>

        <div className="my-6 flex items-center gap-3">
          <div className="h-[1px] flex-1 bg-gray-200" />
          <span className="text-xs text-gray-400">or sign up through email</span>
          <div className="h-[1px] flex-1 bg-gray-200" />
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <input
              type="email"
              className="h-12 w-full rounded-lg border-0 bg-[#F4F6F8] px-4 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition focus:bg-white focus:ring-2 focus:ring-emerald-500"
              placeholder="Email ID"
              autoComplete="email"
            />
          </div>
          <div>
            <input
              type="password"
              className="h-12 w-full rounded-lg border-0 bg-[#F4F6F8] px-4 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition focus:bg-white focus:ring-2 focus:ring-emerald-500"
              placeholder="Password"
              autoComplete="current-password"
            />
          </div>
          <button
            type="submit"
            className="mt-6 flex h-12 w-full items-center justify-center rounded-lg bg-[#00B050] px-4 text-sm font-medium text-white transition hover:bg-[#009E47] focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-1"
          >
            Login
          </button>
        </form>
      </div>
    </main>
  );
}
