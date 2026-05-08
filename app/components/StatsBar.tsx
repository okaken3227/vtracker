type Stat = { label: string; value: string; sub?: string };

export default function StatsBar({ stats }: { stats: Stat[] }) {
  return (
    <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
      {stats.map((s) => (
        <div
          key={s.label}
          className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm"
        >
          <p className="text-xs text-gray-400">{s.label}</p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-gray-900">{s.value}</p>
          {s.sub && <p className="mt-0.5 text-xs text-gray-400">{s.sub}</p>}
        </div>
      ))}
    </div>
  );
}
