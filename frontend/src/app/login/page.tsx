"use client";

import { ArrowRight, Mail } from "lucide-react";
import { signIn } from "next-auth/react";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <section className="w-full max-w-sm rounded-lg border border-gray-200 bg-white p-8 shadow-panel">
        <div className="mb-7 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-brand text-white">
            <Mail size={20} />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-950">ReachInbox Scheduler</h1>
            <p className="text-sm text-gray-500">Sign in to continue</p>
          </div>
        </div>

        <button
          onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-gray-950 px-4 text-sm font-medium text-white transition hover:bg-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-950 focus-visible:ring-offset-2"
        >
          Continue with Google
          <ArrowRight size={16} />
        </button>
      </section>
    </main>
  );
}
