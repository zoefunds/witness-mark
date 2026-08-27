"use client";

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
  return (
    <header className="sticky top-0 z-30 border-b border-outline-variant bg-surface-container-lowest/95 backdrop-blur">
      <div className="mx-auto flex max-w-[1280px] items-center justify-between px-4 py-3 sm:px-8">
        <Link href="/" className="focus-ring rounded-md">
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
        </div>
      </div>
    </header>
  );
}
