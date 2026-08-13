"use client";

import { LogOut, Mail } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { Button } from "./ui/Button";

export function Header() {
  const { data: session } = useSession();

  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="flex h-16 items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-brand text-white">
            <Mail size={18} />
          </div>
          <div>
            <h1 className="text-base font-semibold text-gray-950">ReachInbox Scheduler</h1>
            <p className="text-xs text-gray-500">Email job dashboard</p>
          </div>
        </div>

        {session?.user ? (
          <div className="flex items-center gap-3">
            {session.user.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={session.user.image}
                alt={session.user.name ?? "User avatar"}
                className="h-9 w-9 rounded-full border border-gray-200"
              />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-sm font-semibold text-gray-700">
                {(session.user.name ?? session.user.email ?? "U").slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="hidden text-right leading-tight sm:block">
              <div className="text-sm font-medium text-gray-950">{session.user.name}</div>
              <div className="text-xs text-gray-500">{session.user.email}</div>
            </div>
            <Button variant="secondary" onClick={() => signOut({ callbackUrl: "/login" })} aria-label="Logout">
              <LogOut size={16} />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        ) : null}
      </div>
    </header>
  );
}
