export function truncateAddress(address: string | undefined | null, chars = 4): string {
  if (!address) return "—";
  if (address.length <= chars * 2 + 2) return address;
  return `${address.slice(0, chars + 2)}…${address.slice(-chars)}`;
}

export function weiToGen(wei: string | number | bigint | undefined | null, maxDecimals = 4): string {
  if (wei === undefined || wei === null) return "0";
  try {
    const value = typeof wei === "bigint" ? wei : BigInt(wei);
    const divisor = 10n ** 18n;
    const whole = value / divisor;
    const remainder = value % divisor;
    if (remainder === 0n) return whole.toString();
    const decimals = remainder.toString().padStart(18, "0").slice(0, maxDecimals).replace(/0+$/, "");
    return decimals ? `${whole}.${decimals}` : whole.toString();
  } catch {
    return "0";
  }
}

export function genToWei(gen: string): bigint {
  const trimmed = gen.trim();
  if (!trimmed) return 0n;
  const [whole, frac = ""] = trimmed.split(".");
  const fracPadded = (frac + "0".repeat(18)).slice(0, 18);
  const wholeBig = BigInt(whole || "0") * 10n ** 18n;
  const fracBig = BigInt(fracPadded || "0");
  return wholeBig + fracBig;
}

export function formatTs(ts: number | string | undefined | null): string {
  if (!ts) return "—";
  const num = typeof ts === "string" ? Number(ts) : ts;
  if (!num) return "—";
  const date = new Date(num * 1000);
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function relativeTime(ts: number | string | undefined | null): string {
  if (!ts) return "—";
  const num = typeof ts === "string" ? Number(ts) : ts;
  if (!num) return "—";
  const diffSec = num - Math.floor(Date.now() / 1000);
  const abs = Math.abs(diffSec);
  const future = diffSec > 0;
  const units: [number, string][] = [
    [60, "second"],
    [60, "minute"],
    [24, "hour"],
    [30, "day"],
    [12, "month"],
    [Number.POSITIVE_INFINITY, "year"],
  ];
  let value = abs;
  let unit = "second";
  for (const [step, name] of units) {
    if (value < step) {
      unit = name;
      break;
    }
    value = Math.floor(value / step);
    unit = name;
  }
  const plural = value === 1 ? "" : "s";
  return future ? `in ${value} ${unit}${plural}` : `${value} ${unit}${plural} ago`;
}

export function bpsToPercent(bps: number | string | undefined | null): string {
  if (bps === undefined || bps === null) return "0%";
  const num = Number(bps);
  return `${(num / 100).toFixed(num % 100 === 0 ? 0 : 2)}%`;
}

export function durationLabel(seconds: number): string {
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)} hr`;
  return `${Math.round(seconds / 86400)} day${seconds >= 172800 ? "s" : ""}`;
}
