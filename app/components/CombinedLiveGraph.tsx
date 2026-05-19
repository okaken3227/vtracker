"use client";

import { useState } from "react";
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid,
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

function computeStats(data: Record<string, number | string | null>[], lines: LineConfig[]) {
  const keys = lines.map((l) => l.key);
  const currentByKey: Record<string, number> = {};

  for (let i = data.length - 1; i >= 0; i--) {
    const row = data[i];
    for (const key of keys) {
      if (currentByKey[key] === undefined && row[key] != null) {
        currentByKey[key] = row[key] as number;
      }
    }
    if (Object.keys(currentByKey).length === keys.length) break;
  }

  const currentTotal = Object.values(currentByKey).reduce((s, v) => s + v, 0);

  let peakTotal = 0;
  for (const row of data) {
    const rowTotal = keys.reduce((s, k) => s + ((row[k] as number | null) ?? 0), 0);
    if (rowTotal > peakTotal) peakTotal = rowTotal;
  }

  return { currentTotal, peakTotal, currentByKey };
}

type TooltipPayload = { dataKey: string; value: number; color: string };

function CustomTooltip({
  active,
  payload,
  label,
  lines,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
  lines: LineConfig[];
}) {
  if (!active || !payload?.length) return null;

  const seen = new Set<string>();
  const deduped = (payload as TooltipPayload[])
    .filter((p) => p.value != null && lines.some((l) => l.key === p.dataKey))
    .filter((p) => { if (seen.has(p.dataKey)) return false; seen.add(p.dataKey); return true; })
    .sort((a, b) => b.value - a.value);

  if (!deduped.length) return null;
  const total = deduped.reduce((s, p) => s + p.value, 0);

  return (
    <div className="min-w-[160px] rounded-xl border border-gray-200 bg-white p-3 shadow-lg" style={{ fontSize: 12 }}>
      <p className="mb-2 text-[11px] text-gray-400">{label}</p>
      {deduped.map((entry) => {
        const line = lines.find((l) => l.key === entry.dataKey);
        const color = line?.color ?? entry.color;
        return (
          <div key={entry.dataKey} className="flex items-center gap-2 py-0.5">
            {line?.iconUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={line.iconUrl} alt={line.channelName} className="h-5 w-5 flex-shrink-0 rounded-full object-cover" />
            ) : (
              <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ backgroundColor: color }} />
            )}
            <span className="min-w-0 flex-1 truncate text-gray-600">{line?.channelName ?? entry.dataKey}</span>
            <span className="flex-shrink-0 font-mono font-bold" style={{ color }}>
              {entry.value.toLocaleString()}人
            </span>
          </div>
        );
      })}
      {deduped.length > 1 && (
        <div className="mt-1.5 flex items-center justify-between border-t border-gray-100 pt-1.5">
          <span className="text-[11px] text-gray-400">合計</span>
          <span className="font-mono text-[11px] font-bold text-gray-700">{total.toLocaleString()}人</span>
        </div>
      )}
    </div>
  );
}

const Y_MAX_PRESETS: { label: string; value: number }[] = [
  { label: "1K", value: 1000 },
  { label: "5K", value: 5000 },
  { label: "1万", value: 10000 },
  { label: "5万", value: 50000 },
  { label: "10万", value: 100000 },
];

const Y_MIN_PRESETS: { label: string; value: number }[] = [
  { label: "10", value: 10 },
  { label: "100", value: 100 },
  { label: "1K", value: 1000 },
  { label: "5K", value: 5000 },
  { label: "1万", value: 10000 },
];

export default function CombinedLiveGraph({
  data,
  lines,
  graphHeight = 280,
}: {
  data: Record<string, number | string | null>[];
  lines: LineConfig[];
  graphHeight?: number;
}) {
  const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(new Set());
  const [yMax, setYMax] = useState<number | null>(null);
  const [yMin, setYMin] = useState<number | null>(null);

  function toggleKey(key: string) {
    setHiddenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  if (data.length < 2 || lines.length === 0) return null;

  const visibleLines = lines.filter((l) => !hiddenKeys.has(l.key));
  const { currentTotal, peakTotal, currentByKey } = computeStats(data, visibleLines);

  // Trim X-axis to rows where at least one visible line has data
  const trimmed = visibleLines.length > 0
    ? data.filter((row) => visibleLines.some((l) => row[l.key] != null))
    : data;

  // Clamp values to [yMin, yMax] so lines never render outside the axis bounds
  const chartData = (yMin !== null || yMax !== null)
    ? trimmed.map((row) => {
        const next = { ...row };
        for (const l of visibleLines) {
          const v = next[l.key];
          if (typeof v === "number") {
            let c = v;
            if (yMax !== null) c = Math.min(c, yMax);
            if (yMin !== null) c = Math.max(c, yMin);
            next[l.key] = c;
          }
        }
        return next;
      })
    : trimmed;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">

      {/* ── 統計ヘッダー ── */}
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
          <span className="text-xs font-semibold text-gray-700">同時視聴者数</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-[10px] font-medium uppercase tracking-wide text-gray-400">Now</div>
            <div className="font-mono text-lg font-bold leading-none text-gray-900">
              {currentTotal > 0 ? currentTotal.toLocaleString() : "—"}
            </div>
          </div>
          <div className="h-8 w-px bg-gray-100" />
          <div className="text-right">
            <div className="text-[10px] font-medium uppercase tracking-wide text-gray-400">Peak</div>
            <div className="font-mono text-lg font-bold leading-none text-gray-400">
              {peakTotal > 0 ? peakTotal.toLocaleString() : "—"}
            </div>
          </div>
        </div>
      </div>

      {/* ── スケールコントロール ── */}
      <div className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1.5">
        {/* 自動リセット */}
        <button
          onClick={() => { setYMax(null); setYMin(null); }}
          className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium transition-all border ${
            yMax === null && yMin === null
              ? "border-gray-300 bg-white text-gray-900 shadow-sm"
              : "border-gray-200 text-gray-400 hover:text-gray-600"
          }`}
        >
          自動
        </button>
        {/* Y軸上限プリセット */}
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-gray-400">最大</span>
          <div className="flex items-center gap-0.5 rounded-full bg-gray-100 p-0.5">
            {Y_MAX_PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => setYMax(yMax === p.value ? null : p.value)}
                className={`rounded-full px-2 py-0.5 text-[10px] font-medium transition-all ${
                  yMax === p.value
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        {/* Y軸下限プリセット */}
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-gray-400">最小</span>
          <div className="flex items-center gap-0.5 rounded-full bg-gray-100 p-0.5">
            {Y_MIN_PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => setYMin(yMin === p.value ? null : p.value)}
                className={`rounded-full px-2 py-0.5 text-[10px] font-medium transition-all ${
                  yMin === p.value
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── チャート ── */}
      <ResponsiveContainer width="100%" height={graphHeight}>
        <ComposedChart data={chartData} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
          <defs>
            {lines.map(({ key, color }) => (
              <linearGradient key={key} id={`grad-${key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.18} />
                <stop offset="85%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>

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
            domain={[yMin ?? 0, yMax ?? "auto"]}
            allowDataOverflow
          />
          <Tooltip
            content={(props) => (
              <CustomTooltip
                active={(props as unknown as { active?: boolean }).active}
                payload={(props as unknown as { payload?: TooltipPayload[] }).payload}
                label={(props as unknown as { label?: string }).label}
                lines={lines}
              />
            )}
            isAnimationActive={false}
          />

          {/* グラデーション塗り（ライン背面） */}
          {visibleLines.map(({ key }) => (
            <Area
              key={`area-${key}`}
              type="monotone"
              dataKey={key}
              fill={`url(#grad-${key})`}
              stroke="none"
              connectNulls
              isAnimationActive={false}
            />
          ))}

          {/* ライン（前面） */}
          {visibleLines.map(({ key, color }) => (
            <Line
              key={key}
              type="monotone"
              dataKey={key}
              stroke={color}
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 5, fill: color, strokeWidth: 0 }}
              connectNulls
              isAnimationActive={false}
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>

      {/* ── 凡例（視聴者数付き・クリックでトグル） ── */}
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1.5 border-t border-gray-100 pt-2.5">
        {lines.map(({ key, channelName, color, iconUrl }) => {
          const hidden = hiddenKeys.has(key);
          const current = currentByKey[key];
          return (
            <div key={key} className="flex items-center gap-0.5">
              <button
                onClick={() => toggleKey(key)}
                title={hidden ? "表示する" : "非表示にする"}
                className={`flex items-center gap-1.5 rounded-md px-1.5 py-0.5 transition-all hover:bg-gray-50 ${hidden ? "opacity-30" : ""}`}
              >
                {iconUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={iconUrl} alt={channelName} className={`h-4 w-4 flex-shrink-0 rounded-full object-cover ${hidden ? "grayscale" : ""}`} />
                ) : (
                  <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: hidden ? "#d1d5db" : color }} />
                )}
                <span className={`whitespace-nowrap text-xs ${hidden ? "text-gray-400 line-through" : "text-gray-600"}`}>{channelName}</span>
                {!hidden && current != null && (
                  <span className="font-mono text-xs font-bold" style={{ color }}>{current.toLocaleString()}</span>
                )}
              </button>
              {!hidden && (
                <a href={`/live/${key}`} title="詳細を見る" className="text-gray-300 transition-colors hover:text-gray-500 text-xs leading-none">↗</a>
              )}
            </div>
          );
        })}
      </div>

    </div>
  );
}
