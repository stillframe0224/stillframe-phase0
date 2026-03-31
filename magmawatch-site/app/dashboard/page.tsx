import dashboardData from "@/data/dashboard.json";

type DashboardRow = {
  topic: string;
  region: string;
  heat: number;
  delta7d: number;
  persistence: number;
  spread: number;
  suppression: number;
  suppressionDelta7d: number;
  signal: string;
  anomaly: boolean;
};

type DashboardData = {
  asOf: string;
  updatedAt: string;
  rows: DashboardRow[];
};

function HeatBar({ value }: { value: number }) {
  const pct = Math.min(100, Math.max(0, value));
  const color =
    pct >= 80
      ? "bg-red"
      : pct >= 60
        ? "bg-ember"
        : pct >= 40
          ? "bg-amber"
          : "bg-ash-400";
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-2 rounded-full bg-surface-3 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-mono tabular-nums">{value}</span>
    </div>
  );
}

function SpreadDots({ count }: { count: number }) {
  const max = 5;
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: max }, (_, i) => (
        <span
          key={i}
          className={`inline-block w-2 h-2 rounded-full ${
            i < count ? "bg-ember" : "bg-surface-3"
          }`}
        />
      ))}
    </div>
  );
}

function Delta({ value, percent }: { value: number; percent?: boolean }) {
  const sign = value > 0 ? "+" : "";
  const display = percent ? `${sign}${(value * 100).toFixed(0)}%` : `${sign}${value}`;
  const color =
    value > 0 ? "text-red" : value < 0 ? "text-emerald-500" : "text-ash-400";
  return <span className={`font-mono text-xs tabular-nums ${color}`}>{display}</span>;
}

function SignalBadge({ signal }: { signal: string }) {
  const styles: Record<string, string> = {
    accelerating: "text-red bg-red/10 ring-red/20",
    spike: "text-amber bg-amber/10 ring-amber/20",
    emerging: "text-ember bg-ember/10 ring-ember/20",
    sustained: "text-glow bg-glow/10 ring-glow/20",
    steady: "text-ash-200 bg-ash-600/20 ring-ash-600/20",
    cooling: "text-emerald-400 bg-emerald-400/10 ring-emerald-400/20",
  };
  const cls = styles[signal] ?? styles.steady;
  return (
    <span
      className={`inline-block px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider rounded ring-1 ${cls}`}
    >
      {signal}
    </span>
  );
}

export default function DashboardPage() {
  const data = dashboardData as DashboardData;
  const updated = new Date(data.updatedAt);
  const formattedDate = updated.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tokyo",
  });

  return (
    <main className="min-h-screen py-8 px-4 md:px-6">
      <div className="max-w-[1200px] mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-baseline gap-3 mb-1">
            <a href="/" className="hover:opacity-80 transition-opacity">
              <h1 className="text-2xl md:text-3xl">
                <span className="font-serif italic text-ember">Magma</span>
                <span className="font-serif text-ash-200">Watch</span>
              </h1>
            </a>
            <span className="text-xs font-mono text-ash-400 tracking-wider uppercase">
              Dashboard
            </span>
          </div>
          <div className="section-divider mb-4" />
          <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-ash-400">
            <span>
              Period: <span className="text-ash-200">{data.asOf}</span>
            </span>
            <span>
              Updated: <span className="text-ash-200">{formattedDate}</span>
            </span>
            <span>
              Topics: <span className="text-ash-200">{data.rows.length}</span>
            </span>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-lg card-ring">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-surface-2 text-left text-[11px] font-mono uppercase tracking-wider text-ash-400">
                <th className="px-3 py-3 sticky left-0 bg-surface-2 z-10">Topic</th>
                <th className="px-3 py-3">Region</th>
                <th className="px-3 py-3">Heat</th>
                <th className="px-3 py-3">Δ7d</th>
                <th className="px-3 py-3">Persist.</th>
                <th className="px-3 py-3">Spread</th>
                <th className="px-3 py-3">Suppr.</th>
                <th className="px-3 py-3">Δ7d</th>
                <th className="px-3 py-3">Signal</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row, i) => (
                <tr
                  key={i}
                  className={`border-t border-surface-3 transition-colors hover:bg-surface-2/60 ${
                    row.anomaly
                      ? "bg-red/[0.06] hover:bg-red/[0.10]"
                      : i % 2 === 0
                        ? "bg-surface/40"
                        : "bg-transparent"
                  }`}
                >
                  <td className="px-3 py-2.5 sticky left-0 bg-inherit z-10 font-medium text-ash-100 max-w-[200px]">
                    <div className="flex items-center gap-2">
                      {row.anomaly && (
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-red animate-pulse flex-shrink-0" />
                      )}
                      <span className="truncate">{row.topic}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-xs">{row.region}</td>
                  <td className="px-3 py-2.5">
                    <HeatBar value={row.heat} />
                  </td>
                  <td className="px-3 py-2.5">
                    <Delta value={row.delta7d} />
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs tabular-nums">
                    {(row.persistence * 100).toFixed(0)}%
                  </td>
                  <td className="px-3 py-2.5">
                    <SpreadDots count={row.spread} />
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs tabular-nums">
                    {(row.suppression * 100).toFixed(0)}%
                  </td>
                  <td className="px-3 py-2.5">
                    <Delta value={row.suppressionDelta7d} percent />
                  </td>
                  <td className="px-3 py-2.5">
                    <SignalBadge signal={row.signal} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div className="mt-6 flex flex-wrap gap-6 text-[10px] font-mono text-ash-400">
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-red animate-pulse" />
            Anomaly
          </div>
          <div className="flex items-center gap-1.5">
            Heat:
            <span className="inline-block w-3 h-2 rounded-sm bg-red" />
            80+
            <span className="inline-block w-3 h-2 rounded-sm bg-ember" />
            60+
            <span className="inline-block w-3 h-2 rounded-sm bg-amber" />
            40+
          </div>
          <div className="flex items-center gap-1.5">
            Spread:
            <span className="inline-block w-2 h-2 rounded-full bg-ember" />
            = 1 platform
          </div>
          <div>
            Signal: accelerating · spike · emerging · sustained · steady · cooling
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 pt-4 text-center">
          <div className="section-divider mb-4" />
          <p className="text-[10px] font-mono text-ash-600 tracking-wide">
            POWERED BY ICE — INFLUENCE CHANGE ENGINE
          </p>
        </div>
      </div>
    </main>
  );
}
