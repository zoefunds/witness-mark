"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { Logo } from "./Logo";
import { ConnectButton } from "./ConnectButton";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/promises", label: "Promises" },
  { href: "/promises/new", label: "New promise" },
];

export function NavHeader() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 border-b border-outline-variant bg-surface-container-lowest/95 backdrop-blur">
      <div className="mx-auto flex max-w-[1280px] items-center justify-between px-4 py-3 sm:px-8">
        <Link href="/" className="focus-ring rounded-md" onClick={() => setMobileOpen(false)}>
          <Logo />
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={clsx(
                "focus-ring rounded-md px-3 py-2 text-sm font-medium transition-colors",
                pathname?.startsWith(link.href)
                  ? "bg-surface-container text-on-surface"
                  : "text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface",
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <ConnectButton />
          {/*
            Below md, the links nav above is hidden with no replacement --
            this button + panel is that replacement. Found missing during
            a mobile QA pass (2026-08-27): Dashboard/Promises/New promise
            were completely unreachable on a mobile viewport, with no
            hamburger menu at all.
          */}
          <button
            type="button"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav-panel"
            onClick={() => setMobileOpen((v) => !v)}
            className="focus-ring flex h-9 w-9 items-center justify-center rounded-md border border-outline-variant text-on-surface md:hidden"
          >
            <span className="sr-only">{mobileOpen ? "Close menu" : "Open menu"}</span>
            {mobileOpen ? (
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            )}
          </button>
        </div>
      </div>
      {mobileOpen ? (
        <nav id="mobile-nav-panel" className="border-t border-outline-variant px-4 py-2 md:hidden">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className={clsx(
                "focus-ring block rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                pathname?.startsWith(link.href)
                  ? "bg-surface-container text-on-surface"
                  : "text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface",
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      ) : null}
    </header>
  );
}
