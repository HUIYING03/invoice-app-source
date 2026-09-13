"use client";

import Link from "next/link";
import type { ReactNode } from "react";

export default function AppHeader({
  title,
  subtitle,
  back,
  action,
}: {
  title: string;
  subtitle?: string;
  back?: { href: string; label: string };
  action?: ReactNode;
}) {
  return (
    <header className="no-print sticky top-0 z-20 border-b border-line bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
        {back && (
          <Link
            href={back.href}
            aria-label={back.label}
            className="-ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-canvas"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
            >
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </Link>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold">{title}</h1>
          {subtitle && <p className="truncate text-xs text-muted">{subtitle}</p>}
        </div>
        {action}
      </div>
    </header>
  );
}
