import Link from "next/link";
import { LogoMark } from "./Logo";

export function Footer() {
  return (
    <footer className="border-t border-outline-variant bg-surface-container-lowest">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-6 px-4 py-10 sm:px-8 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-3">
          <LogoMark size={24} />
          <div>
            <p className="text-sm font-semibold text-on-surface">WITNESSMARK</p>
            <p className="mt-1 max-w-xs text-sm text-on-surface-variant">
              Make promises that survive contact with reality.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-8 text-sm sm:grid-cols-3">
          <div className="flex flex-col gap-2">
            <span className="label-caps">Protocol</span>
            <Link href="/promises" className="text-on-surface-variant hover:text-on-surface">Promises</Link>
            <Link href="/promises/new" className="text-on-surface-variant hover:text-on-surface">Create a promise</Link>
            <Link href="/dashboard" className="text-on-surface-variant hover:text-on-surface">Dashboard</Link>
          </div>
          <div className="flex flex-col gap-2">
            <span className="label-caps">Account</span>
            <Link href="/wallet" className="text-on-surface-variant hover:text-on-surface">Wallet</Link>
          </div>
        </div>
      </div>
      <div className="border-t border-outline-variant px-4 py-4 text-center text-xs text-on-surface-variant sm:px-8">
        Adjudicated by GenLayer Intelligent Contracts. Not legal advice; use at your own risk.
      </div>
    </footer>
  );
}
