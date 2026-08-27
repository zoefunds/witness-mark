import { describe, it, expect } from "vitest";
import { truncateAddress, weiToGen, genToWei, bpsToPercent, durationLabel } from "../lib/format";

describe("truncateAddress", () => {
  it("truncates a full address", () => {
    expect(truncateAddress("0x1234567890123456789012345678901234567890")).toBe("0x1234…7890");
  });
  it("returns an em dash for missing input", () => {
    expect(truncateAddress(undefined)).toBe("—");
    expect(truncateAddress(null)).toBe("—");
  });
});

describe("weiToGen / genToWei round-trip — must never misplace decimals for a real GEN amount", () => {
  it("converts whole-GEN amounts exactly", () => {
    expect(weiToGen("5000000000000000000")).toBe("5");
    expect(genToWei("5").toString()).toBe("5000000000000000000");
  });

  it("converts fractional amounts without rounding error at 4 decimals", () => {
    expect(weiToGen("1500000000000000000")).toBe("1.5");
    expect(genToWei("1.5").toString()).toBe("1500000000000000000");
  });

  it("round-trips an arbitrary stake amount", () => {
    const original = "123456789012345678"; // ~0.1234 GEN
    const gen = weiToGen(original, 18);
    expect(genToWei(gen).toString()).toBe(original);
  });

  it("never throws on malformed input — a bad stake value must not crash the UI", () => {
    expect(weiToGen("not-a-number")).toBe("0");
    expect(weiToGen(undefined)).toBe("0");
    expect(genToWei("")).toBe(0n);
  });
});

describe("bpsToPercent — the exact number a payout split renders as", () => {
  it("renders whole percentages without decimals", () => {
    expect(bpsToPercent(10000)).toBe("100%");
    expect(bpsToPercent(5000)).toBe("50%");
    expect(bpsToPercent(0)).toBe("0%");
  });
  it("renders fractional percentages to 2 decimals", () => {
    expect(bpsToPercent(4523)).toBe("45.23%");
  });
});

describe("durationLabel", () => {
  it("picks the coarsest sensible unit", () => {
    expect(durationLabel(300)).toBe("5 min");
    expect(durationLabel(7200)).toBe("2 hr");
    expect(durationLabel(172800)).toBe("2 days");
    expect(durationLabel(86400)).toBe("1 day");
  });
});
