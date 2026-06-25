const DECIMALS = 7;
const UNIT = 10n ** BigInt(DECIMALS);

/** Converts a stroop/atom-style bigint amount (7 decimals) to a display number. */
export function fromUnits(amount: bigint): number {
  return Number(amount) / Number(UNIT);
}

/** Converts a human-entered decimal string to a 7-decimal bigint. */
export function toUnits(amount: string): bigint {
  const trimmed = amount.trim();
  if (!trimmed) return 0n;
  const [whole, frac = ""] = trimmed.split(".");
  const fracPadded = (frac + "0".repeat(DECIMALS)).slice(0, DECIMALS);
  const wholeBig = BigInt(whole || "0");
  const fracBig = BigInt(fracPadded || "0");
  return wholeBig * UNIT + fracBig;
}

export function formatAmount(amount: bigint, opts: { decimals?: number } = {}): string {
  const { decimals = 2 } = opts;
  return fromUnits(amount).toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatBps(bps: bigint): string {
  return (Number(bps) / 100).toFixed(2) + "%";
}

export function shortenAddress(address: string, chars = 4): string {
  if (address.length <= chars * 2 + 3) return address;
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}
