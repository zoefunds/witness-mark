// WitnessMark mark: a notarization / wax-seal stamp motif — a circular seal
// with a checkmark ligature cut through it, evoking "witnessed and marked."
// Renders crisply from 16px (favicon) up to nav-header scale.
export function LogoMark({ className = "", size = 28 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <circle cx="16" cy="16" r="15" fill="#0F172A" />
      <circle cx="16" cy="16" r="15" stroke="#0F172A" strokeWidth="1" />
      <circle cx="16" cy="16" r="11.5" stroke="#F8FAFC" strokeWidth="1.25" strokeDasharray="1.5 2.6" />
      <path
        d="M10 16.5L14 20.5L22.5 11.5"
        stroke="#F8FAFC"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <LogoMark size={26} />
      <span className="font-semibold tracking-tight text-on-surface" style={{ fontSize: "1.05rem" }}>
        WITNESSMARK
      </span>
    </span>
  );
}
