"use client";

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";

function formatK(v: number) {
  if (v >= 10000) return `${(v / 10000).toFixed(0)}万`;
  if (v >= 1000) return `${(v / 1000).toFixed(0)}K`;
  return String(v);
}

export type LineConfig = {
  key: string;
  channelName: string;
  color: string;
  videoId: string;
  iconUrl?: string;
};

function Graph({ data, lines }: { data: Record<string, number | string | null>[]; lines: LineConfig[] }) {
  return (
    <LineChart data={data} margin={{ top: 12, right: 16, bottom: 8, left: 8 }}>
      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
      <XAxis
        dataKey="t"
        tick={{ fill: "#9ca3af", fontSize: 11 }}
        axisLine={{ stroke: "#e5e7eb" }}
        tickLine={false}
      />
      <YAxis
        tickFormatter={formatK}
        tick={{ fill: "#9ca3af", fontSize: 11 }}
        axisLine={false}
        tickLine={false}
        width={44}
      />
      <Tooltip
        content={(props) => {
          const { active, payload, label } = props as unknown as {
            active?: boolean;
            payload?: { dataKey: string; value: number; color: string }[];
            label?: string;
          };
          if (!active || !payload?.length) return null;
          const sorted = [...payload].filter((p) => p.value != null).sort((a, b) => b.value - a.value);
          return (
            <div className="min-w-[160px] rounded-xl border border-gray-200 bg-white p-3 shadow-lg" style={{ fontSize: 12 }}>
              <p className="mb-2 text-xs text-gray-400">{label}</p>
              {sorted.map((entry) => {
                const line = lines.find((l) => l.key === entry.dataKey);
                return (
                  <div key={entry.dataKey} className="flex items-center gap-2 py-0.5">
                    {line?.iconUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={line.iconUrl} alt={line.channelName} className="h-5 w-5 flex-shrink-0 rounded-full object-cover" />
                    ) : (
                      <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ backgroundColor: entry.color }} />
                    )}
                    <span className="min-w-0 flex-1 truncate text-gray-600">{line?.channelName ?? entry.dataKey}</span>
                    <span className="flex-shrink-0 font-mono font-bold" style={{ color: entry.color }}>
                      {entry.value.toLocaleString()}人
                    </span>
                  </div>
                );
              })}
            </div>
          );
        }}
        isAnimationActive={false}
      />
      {lines.map(({ key, color }) => (
        <Line
          key={key}
          type="monotone"
          dataKey={key}
          stroke={color}
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 5, fill: color, strokeWidth: 0 }}
          connectNulls
        />
      ))}
    </LineChart>
  );
}

function Legend({ lines }: { lines: LineConfig[] }) {
  return (
    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-gray-100 pt-3">
      {lines.map(({ key, channelName, color }) => (
        <a key={key} href={`/live/${key}`} className="flex items-center gap-1.5 transition-opacity hover:opacity-70">
          <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: color }} />
          <span className="text-xs text-gray-600">{channelName}</span>
        </a>
      ))}
    </div>
  );
}

export default function CombinedLiveGraph({
  data,
  lines,
  fillParent = false,
}: {
  data: Record<string, number | string | null>[];
  lines: LineConfig[];
  fillParent?: boolean;
}) {
  if (data.length < 2 || lines.length === 0) return null;

  if (fillParent) {
    /*
     * flex-1 な親の中では height:"100%" が解決されないブラウザがある。
     * relative + absolute inset-0 で明示的な境界を作り ResizeObserver に
     * 正しいピクセル高さを渡すことで、モバイル含め確実に描画する。
     */
    return (
      <div className="flex h-full flex-col rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="relative min-h-0 flex-1">
          <div className="absolute inset-0">
            <ResponsiveContainer width="100%" height="100%">
              <Graph data={data} lines={lines} />
            </ResponsiveContainer>
          </div>
        </div>
        <Legend lines={lines} />
      </div>
    );
  }

  /* デフォルト: 固定高さ */
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <ResponsiveContainer width="100%" height={360}>
        <Graph data={data} lines={lines} />
      </ResponsiveContainer>
      <Legend lines={lines} />
    </div>
  );
}
