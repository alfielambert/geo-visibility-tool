import { ReactNode } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface MetricCardProps {
  title: string;
  value?: string | number;
  subtitle?: string;
  icon?: ReactNode;
  children?: ReactNode;
  /** Raw numeric delta (e.g. +0.05 for a 5pp increase in rate). */
  delta?: number | null;
  /** How to format the delta for display. "points" = raw number, "pct" = multiply by 100 and add "pp" */
  deltaFormat?: "points" | "pct";
  /** If true, a negative delta is good (e.g. volatility going down) */
  invertColor?: boolean;
}

export function MetricCard({
  title,
  value,
  subtitle,
  icon,
  children,
  delta,
  deltaFormat = "points",
  invertColor = false,
}: MetricCardProps) {
  const hasDelta = delta !== null && delta !== undefined;
  const isPositive = hasDelta && delta > 0;
  const isNegative = hasDelta && delta < 0;
  const isNeutral = hasDelta && delta === 0;

  // Determine color: green = good, red = bad
  const isGood = invertColor ? isNegative : isPositive;
  const isBad = invertColor ? isPositive : isNegative;

  const deltaColor = isGood
    ? "text-green-400"
    : isBad
      ? "text-red-400"
      : "text-slate-500";

  const formatDelta = () => {
    if (!hasDelta) return null;
    const abs = Math.abs(delta);
    const sign = delta > 0 ? "+" : delta < 0 ? "-" : "";

    if (deltaFormat === "pct") {
      const val = abs * 100;
      if (val < 0.5) return `${sign}${val.toFixed(1)}pp`;
      return `${sign}${Math.round(val)}pp`;
    }
    // points
    if (abs < 0.1) return `${sign}${abs.toFixed(2)}`;
    return `${sign}${abs.toFixed(1)}`;
  };

  return (
    <div className="card">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <p className="text-label">{title}</p>
          <div className="flex items-baseline gap-3 mt-2">
            {value !== undefined && (
              <p className="text-3xl font-bold text-slate-50">{value}</p>
            )}
            {hasDelta && !isNeutral && (
              <span className={`flex items-center gap-1 text-sm font-medium ${deltaColor}`}>
                {isPositive ? (
                  <TrendingUp className="w-3.5 h-3.5" />
                ) : isNegative ? (
                  <TrendingDown className="w-3.5 h-3.5" />
                ) : (
                  <Minus className="w-3.5 h-3.5" />
                )}
                {formatDelta()}
              </span>
            )}
            {hasDelta && isNeutral && (
              <span className="flex items-center gap-1 text-sm text-slate-500">
                <Minus className="w-3.5 h-3.5" />
                no change
              </span>
            )}
          </div>
          {subtitle && (
            <p className="text-sm text-slate-400 mt-1">{subtitle}</p>
          )}
        </div>
        {icon && <div className="text-slate-500">{icon}</div>}
      </div>
      {children}
    </div>
  );
}
