"use client";

/**
 * Health factor gauge — the signature visual element of StellarLend.
 *
 * Renders an arc gauge from 0% to 250%+ where:
 *  - >= 150% (1.5x)  -> healthy, aquamarine
 *  - 100-150%        -> caution, amber
 *  - < 100% / null   -> at risk of liquidation, coral
 *
 * `ratio` is the health factor as a plain number (e.g. 1.85 for 185%),
 * or `null` if the user has no debt (rendered as "Safe — no debt").
 */
export function HealthGauge({ ratio }: { ratio: number | null }) {
  const size = 200;
  const stroke = 14;
  const radius = (size - stroke) / 2;
  const center = size / 2;

  // Map ratio to a 0..1 progress value across a display range of 0% to 250%.
  const displayMax = 2.5;
  const clamped = ratio === null ? displayMax : Math.min(Math.max(ratio, 0), displayMax);
  const progress = clamped / displayMax;

  // Arc spans 270 degrees, starting at 135deg (bottom-left) going clockwise.
  const startAngle = 135;
  const sweep = 270;
  const angle = startAngle + sweep * progress;

  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const point = (deg: number) => ({
    x: center + radius * Math.cos(toRad(deg)),
    y: center + radius * Math.sin(toRad(deg)),
  });

  const start = point(startAngle);
  const end = point(angle);
  const trackEnd = point(startAngle + sweep);

  const largeArc = sweep * progress > 180 ? 1 : 0;
  const trackLargeArc = sweep > 180 ? 1 : 0;

  let color = "var(--accent)";
  let label = "Healthy";
  if (ratio !== null) {
    if (ratio < 1.0) {
      color = "var(--danger)";
      label = "At risk";
    } else if (ratio < 1.5) {
      color = "var(--warn)";
      label = "Caution";
    }
  } else {
    label = "No debt";
  }

  const displayValue =
    ratio === null ? "—" : ratio >= 9.995 ? "9.99x+" : `${ratio.toFixed(2)}x`;

  return (
    <div className="flex flex-col items-center">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={`Health factor ${displayValue}, status: ${label}`}
      >
        {/* Track */}
        <path
          d={`M ${start.x} ${start.y} A ${radius} ${radius} 0 ${trackLargeArc} 1 ${trackEnd.x} ${trackEnd.y}`}
          fill="none"
          stroke="var(--line)"
          strokeWidth={stroke}
          strokeLinecap="round"
        />
        {/* Progress */}
        <path
          d={`M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y}`}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          style={{ transition: "stroke 300ms ease, d 400ms ease" }}
        />
        {/* Liquidation threshold marker at 1.0x (40% of sweep) */}
        {(() => {
          const markAngle = startAngle + sweep * (1.0 / displayMax);
          const p = point(markAngle);
          return (
            <circle cx={p.x} cy={p.y} r={3} fill="var(--ink-2)" />
          );
        })()}
        <text
          x={center}
          y={center - 6}
          textAnchor="middle"
          fontFamily="var(--font-display)"
          fontSize="34"
          fontWeight="600"
          fill="var(--ink-0)"
        >
          {displayValue}
        </text>
        <text
          x={center}
          y={center + 22}
          textAnchor="middle"
          fontFamily="var(--font-mono)"
          fontSize="12"
          letterSpacing="0.1em"
          fill={color}
        >
          {label.toUpperCase()}
        </text>
      </svg>
      <p className="mt-2 text-xs text-ink-2 font-mono">
        Liquidation at <span className="text-ink-1">1.00x</span>
      </p>
    </div>
  );
}
