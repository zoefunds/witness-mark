import { type ReactNode, type ButtonHTMLAttributes, type AnchorHTMLAttributes } from "react";
import Link from "next/link";
import clsx from "clsx";
import { STATUS_EXPLANATIONS, STATUS_TONE_CLASSES, type PromiseStatus } from "@/lib/constants";
import { weiToGen } from "@/lib/format";

export function Card({ className = "", children }: { className?: string; children: ReactNode }) {
  return <div className={clsx("card", className)}>{children}</div>;
}

export function CardHeader({
  title,
  meta,
  className = "",
}: {
  title: string;
  meta?: ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx("flex items-center justify-between border-b border-outline-variant px-5 py-3", className)}>
      <span className="label-caps">{title}</span>
      {meta ? <span className="font-mono-data text-xs text-on-surface-variant">{meta}</span> : null}
    </div>
  );
}

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-primary text-on-primary hover:bg-primary-container disabled:bg-outline-variant disabled:text-on-surface-variant",
  secondary: "bg-secondary text-on-secondary hover:opacity-90 disabled:bg-outline-variant disabled:text-on-surface-variant",
  outline: "border border-outline-variant text-on-surface hover:bg-surface-container disabled:opacity-50",
  ghost: "text-on-surface hover:bg-surface-container disabled:opacity-50",
  danger: "bg-error text-on-error hover:opacity-90 disabled:bg-outline-variant disabled:text-on-surface-variant",
};

export function Button({
  variant = "primary",
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      className={clsx(
        "focus-ring inline-flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed",
        variantClasses[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function LinkButton({
  variant = "primary",
  className = "",
  children,
  href,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & { variant?: ButtonVariant; href: string }) {
  return (
    <Link
      href={href}
      className={clsx(
        "focus-ring inline-flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-semibold transition-colors",
        variantClasses[variant],
        className,
      )}
      {...props}
    >
      {children}
    </Link>
  );
}

const dotToneClasses: Record<string, string> = {
  neutral: "bg-on-surface-variant",
  pending: "bg-tertiary",
  success: "bg-secondary",
  warning: "bg-tertiary",
  error: "bg-error",
};

export function StatusBadge({ status, className = "" }: { status: string; className?: string }) {
  const info = STATUS_EXPLANATIONS[status as PromiseStatus];
  const tone = info?.tone ?? "neutral";
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
        STATUS_TONE_CLASSES[tone],
        className,
      )}
    >
      <span className={clsx("h-1.5 w-1.5 rounded-full", dotToneClasses[tone])} aria-hidden="true" />
      {info?.label ?? status}
    </span>
  );
}

export function StakedChip({ wei, label = "Staked" }: { wei: string | number; label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-md bg-tertiary-container px-3 py-1.5">
      <span className="label-caps text-on-tertiary-container">{label}</span>
      <span className="font-mono-data text-sm font-semibold text-on-tertiary-container">{weiToGen(wei)} GEN</span>
    </span>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-outline-variant bg-surface-container-low px-6 py-16 text-center">
      <p className="text-sm font-semibold text-on-surface">{title}</p>
      {description ? <p className="max-w-sm text-sm text-on-surface-variant">{description}</p> : null}
      {action}
    </div>
  );
}

export function ErrorState({ title = "Something went wrong", description }: { title?: string; description?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-error-container bg-error-container/40 px-6 py-10 text-center">
      <p className="text-sm font-semibold text-on-error-container">{title}</p>
      {description ? <p className="max-w-md text-sm text-on-error-container">{description}</p> : null}
    </div>
  );
}

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <svg className={clsx("animate-spin", className)} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path className="opacity-90" d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-semibold text-on-surface">
        {label}
      </label>
      {children}
      {hint && !error ? <p className="text-xs text-on-surface-variant">{hint}</p> : null}
      {error ? (
        <p className="text-xs font-medium text-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export const inputClasses =
  "focus-ring w-full rounded-md border border-outline-variant bg-surface-container-lowest px-3.5 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant shadow-[inset_0_1px_2px_rgba(15,23,42,0.04)] disabled:opacity-50";
