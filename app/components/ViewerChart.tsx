"use client";

import { useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceDot, ResponsiveContainer,
  type MouseHandlerDataParam,
} from "recharts";
import Link from "next/link";
import type { StreamInfo } from "@/lib/buildChart";

export type { StreamInfo };

type ChartPoint = { t: number } & Record<string, number>;
type Props = { data: ChartPoint[]; streams: StreamInfo[] };

function tToHHMM(t: number): string {
  const h = Math.floor(t / 60);
  const m = t % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

function formatK(v: number) {
  return v.toLocaleString();
}

function CustomTooltip({
  active, payload, label, streams, coordinate, viewBox,
}: {
  active?: boolean;
  payload?: { dataKey: string; value: number; color: string }[];
  label?: number;
  streams: StreamInfo[];
  coordinate?: { x: number; y: number };
  viewBox?: { x: number; y: number; width: number; height: number };
}) {
  if (!active || !payload?.length) return null;
  const streamMap = Object.fromEntries(streams.map((s) => [s.videoId, s]));
  const cx = coordinate?.x ?? 0;
  const cw = (viewBox?.width ?? 0) + (viewBox?.x ?? 0);
  const flipLeft = cw > 0 && cx > cw * 0.62;

  return (
    <div
      style={{ transform: flipLeft ? "translateX(calc(-100% - 16px))" : "translateX(16px)" }}
      className="min-w-[200px] rounded-xl border border-gray-100 bg-white/95 p-3 text-sm shadow-xl backdrop-blur-sm"
    >
      <p className="mb-2 text-xs font-medium text-gray-400">{tToHHMM(label ?? 0)}</p>
      {payload
        .filter((p) => p.value !== undefined)
        .sort((a, b) => b.value - a.value)
        .map((entry) => {
          const s = streamMap[entry.dataKey];
          const isPeak = s?.peakT === label;
          return (
            <div key={entry.dataKey} className="flex items-center gap-2 py-0.5">
              {s?.iconUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.iconUrl} alt={s.channelName} className="h-5 w-5 flex-shrink-0 rounded-full object-cover" />
              ) : (
                <span style={{ backgroundColor: entry.color }} className="h-2 w-2 flex-shrink-0 rounded-full" />
              )}
              <span className="min-w-0 flex-1 truncate text-xs text-gray-600">{s?.channelName ?? entry.dataKey}</span>
              {isPeak && <span className="text-xs">👑</span>}
              <span className="flex-shrink-0 font-mono text-xs font-bold" style={{ color: entry.color }}>
                {entry.value.toLocaleString()}
              </span>
            </div>
          );
        })}
    </div>
  );
}

const RANK_STYLES = [
  "bg-amber-400 text-white",
  "bg-gray-300 text-gray-700",
  "bg-amber-700/80 text-white",
];

const Y_MAX_PRESETS = [
  { label: "5K", value: 5000 },
  { label: "1万", value: 10000 },
  { label: "5万", value: 50000 },
  { label: "10万", value: 100000 },
];

const Y_MIN_PRESETS = [
  { label: "1K", value: 1000 },
  { label: "5K", value: 5000 },
  { label: "1万", value: 10000 },
];

type PeakSortKey = "peak" | "time" | "sc";

const PEAK_SORT_LABELS: Record<PeakSortKey, string> = {
  peak: "同接数",
  time: "時刻",
  sc: "スパチャ",
};

function PeakRanking({ streams, animRev: outerRev = 0 }: { streams: StreamInfo[]; animRev?: number }) {
  const [sort, setSort] = useState<PeakSortKey>("peak");
  const [animRev, setAnimRev] = useState(0);

  const hasSC = streams.some((s) => (s.totalSCJPY ?? 0) > 0);

  function applySort(key: PeakSortKey) {
    if (key === sort) return;
    setSort(key);
    setAnimRev((r) => r + 1);
  }

  const sorted = [...streams].sort((a, b) => {
    if (sort === "sc") return (b.totalSCJPY ?? 0) - (a.totalSCJPY ?? 0);
    if (sort === "time") return a.peakT - b.peakT;
    return b.peakViewers - a.peakViewers;
  });

  return (
    <div className="mt-6">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Peak Viewers</p>
        <div className="flex items-center gap-1">
          {(Object.keys(PEAK_SORT_LABELS) as PeakSortKey[])
            .filter((key) => key !== "sc" || hasSC)
            .map((key) => (
              <button
                key={key}
                onClick={() => applySort(key)}
                className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                  sort === key
                    ? "bg-violet-600 text-white"
                    : "border border-gray-200 bg-white text-gray-500 hover:border-violet-300 hover:text-violet-600"
                }`}
              >
                {PEAK_SORT_LABELS[key]}
              </button>
            ))}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {sorted.map((s, i) => (
          <div
            key={`${s.videoId}-${animRev}-${outerRev}`}
            style={{
              animation: "sort-in 0.22s ease both",
              animationDelay: `${i * 50}ms`,
            }}
          >
            <Link
              href={`/live/${s.videoId}`}
              className="group flex items-center gap-3 overflow-hidden rounded-xl border border-gray-100 bg-white p-3 shadow-sm transition-all hover:border-gray-200 hover:shadow-md"
            >
              <div className="w-1 self-stretch flex-shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
              <div
                className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${RANK_STYLES[i] ?? "bg-gray-100 text-gray-400"}`}
              >
                {i === 0 ? "★" : i + 1}
              </div>
              {s.iconUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.iconUrl} alt={s.channelName} className="h-8 w-8 flex-shrink-0 rounded-full object-cover ring-2 ring-white" />
              ) : (
                <div className="h-8 w-8 flex-shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-gray-900">{s.channelName}</p>
                <p className="truncate text-xs text-gray-400">{s.videoTitle}</p>
                <p className="mt-0.5 text-xs text-gray-300">ピーク {tToHHMM(s.peakT)}</p>
              </div>
              <div className="flex-shrink-0 text-right">
                <p className="text-xl font-black leading-none tracking-tight" style={{ color: s.color }}>
                  {formatK(s.peakViewers)}
                </p>
                <p className="mt-0.5 text-xs text-gray-300">人</p>
                {(s.totalSCJPY ?? 0) > 0 && (
                  <p className="mt-1 text-xs font-semibold text-amber-500">
                    ¥{s.totalSCJPY!.toLocaleString()}
                  </p>
                )}
              </div>
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ViewerChart({ data, streams }: Props) {
  const [filterGroup, setFilterGroup] = useState<string | null>(null);
  const [filterAnimRev, setFilterAnimRev] = useState(0);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [yMax, setYMax] = useState<number | null>(null);
  const [yMin, setYMin] = useState<number | null>(null);

  const groupEntries = Array.from(
    new Map(
      streams
        .filter((s) => s.groupName)
        .map((s) => [s.groupName!, { name: s.groupName!, color: s.groupColor ?? "#6b7280" }])
    ).values()
  ).sort((a, b) => a.name.localeCompare(b.name, "ja"));

  function applyGroupFilter(group: string | null) {
    setFilterGroup(group);
    setFilterAnimRev((r) => r + 1);
  }

  function toggleId(id: string) {
    setHiddenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const groupFiltered = filterGroup
    ? streams.filter((s) => s.groupName === filterGroup)
    : streams;

  const visibleStreams = groupFiltered.filter((s) => !hiddenIds.has(s.videoId));

  const chartData = visibleStreams.length > 0
    ? data.filter((row) => visibleStreams.some((s) => row[s.videoId] != null))
    : data;

  const lastHoveredVideoId = { current: "" };

  const handleChartClick = (chartData: MouseHandlerDataParam) => {
    const key = typeof chartData.activeDataKey === "string" ? chartData.activeDataKey : "";
    const videoId = (key && streams.some((s) => s.videoId === key)) ? key : lastHoveredVideoId.current;
    if (!videoId) return;
    window.location.href = `/live/${videoId}`;
  };

  return (
    <div>
      {/* グループフィルター */}
      {groupEntries.length > 1 && (
        <div className="mb-3 flex flex-wrap items-center gap-1">
          <button
            onClick={() => applyGroupFilter(null)}
            className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
              filterGroup === null
                ? "bg-gray-800 text-white"
                : "border border-gray-200 bg-white text-gray-500 hover:border-gray-400"
            }`}
          >
            すべて
          </button>
          {groupEntries.map((g) => (
            <button
              key={g.name}
              onClick={() => applyGroupFilter(filterGroup === g.name ? null : g.name)}
              style={filterGroup === g.name ? { backgroundColor: g.color, borderColor: g.color } : {}}
              className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                filterGroup === g.name
                  ? "text-white"
                  : "border-gray-200 bg-white text-gray-500 hover:border-gray-400"
              }`}
            >
              {g.name}
            </button>
          ))}
        </div>
      )}

      {/* チャンネルトグル凡例 */}
      {groupFiltered.length > 1 && (
        <div className="mb-3 flex flex-wrap gap-x-1 gap-y-1">
          {groupFiltered.map((s) => {
            const hidden = hiddenIds.has(s.videoId);
            return (
              <button
                key={s.videoId}
                onClick={() => toggleId(s.videoId)}
                title={hidden ? "表示する" : "非表示にする"}
                className={`flex items-center gap-1.5 rounded-md px-2 py-1 transition-all hover:bg-gray-50 ${hidden ? "opacity-30" : ""}`}
              >
                {s.iconUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.iconUrl} alt={s.channelName} className={`h-4 w-4 flex-shrink-0 rounded-full object-cover ${hidden ? "grayscale" : ""}`} />
                ) : (
                  <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: hidden ? "#d1d5db" : s.color }} />
                )}
                <span className={`whitespace-nowrap text-xs ${hidden ? "text-gray-400 line-through" : "text-gray-600"}`}>
                  {s.channelName}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Y軸スケールコントロール */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
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

      <ResponsiveContainer width="100%" height={400}>
        <LineChart
          data={chartData}
          onClick={handleChartClick}
          style={{ cursor: "pointer" }}
          margin={{ top: 20, right: 24, bottom: 8, left: 8 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
          <XAxis
            dataKey="t"
            tickFormatter={(v) => tToHHMM(Number(v))}
            tick={{ fill: "#9ca3af", fontSize: 11 }}
            axisLine={{ stroke: "#e5e7eb" }}
            tickLine={false}
          />
          <YAxis
            tickFormatter={formatK}
            tick={{ fill: "#9ca3af", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={64}
            domain={[yMin ?? 0, yMax ?? "auto"]}
            allowDataOverflow={false}
          />
          <Tooltip
            content={(props) => {
              const p = props as unknown as {
                active?: boolean;
                payload?: { dataKey: string; value: number; color: string }[];
                label?: number;
                coordinate?: { x: number; y: number };
                viewBox?: { x: number; y: number; width: number; height: number };
              };
              if (p.active && p.payload?.[0]?.dataKey) {
                lastHoveredVideoId.current = p.payload[0].dataKey;
              }
              return (
                <CustomTooltip
                  active={p.active}
                  payload={p.payload}
                  label={p.label}
                  streams={visibleStreams}
                  coordinate={p.coordinate}
                  viewBox={p.viewBox}
                />
              );
            }}
            isAnimationActive={false}
          />

          {visibleStreams.map((s) => (
            <Line
              key={s.videoId}
              type="monotone"
              dataKey={s.videoId}
              stroke={s.color}
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 5, strokeWidth: 0 }}
              connectNulls
            />
          ))}

          {visibleStreams.map((s) => (
            <ReferenceDot
              key={`peak-${s.videoId}`}
              x={s.peakT}
              y={s.peakViewers}
              r={5}
              fill={s.color}
              stroke="white"
              strokeWidth={2}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>

      {visibleStreams.length > 0 && <PeakRanking streams={visibleStreams} animRev={filterAnimRev} />}
    </div>
  );
}
