"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
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
  active, payload, label, streams, coordinate, chartRect,
}: {
  active?: boolean;
  payload?: { dataKey: string; value: number; color: string }[];
  label?: number;
  streams: StreamInfo[];
  coordinate?: { x: number; y: number };
  chartRect: DOMRect | null;
}) {
  if (!active || !payload?.length || typeof document === "undefined") return null;
  const streamMap = Object.fromEntries(streams.map((s) => [s.videoId, s]));

  const W = 156;
  const off = 10;
  const margin = 8;
  const pageX = (chartRect?.left ?? 0) + (coordinate?.x ?? 0);
  const pageY = (chartRect?.top ?? 0) + (coordinate?.y ?? 0);
  const screenW = window.innerWidth;

  let left = pageX + off;
  if (left + W > screenW - margin) left = pageX - off - W;
  left = Math.max(margin, Math.min(left, screenW - W - margin));
  const top = Math.max(margin, pageY - 80);

  return createPortal(
    <div
      style={{ position: "fixed", left, top, width: W, zIndex: 9999, pointerEvents: "none" }}
      className="rounded-xl border border-gray-100 bg-white/95 p-2 text-sm shadow-xl backdrop-blur-sm"
    >
      <p className="mb-1 text-[10px] font-medium text-gray-400">{tToHHMM(label ?? 0)}</p>
      <div className="max-h-[200px] overflow-y-auto">
        {payload
          .filter((p) => p.value !== undefined)
          .sort((a, b) => b.value - a.value)
          .map((entry) => {
            const s = streamMap[entry.dataKey];
            const isPeak = s?.peakT === label;
            return (
              <div key={entry.dataKey} className="flex items-center gap-1.5 py-0.5">
                {s?.iconUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.iconUrl} alt={s.channelName} className="h-4 w-4 flex-shrink-0 rounded-full object-cover" />
                ) : (
                  <span style={{ backgroundColor: entry.color }} className="h-1.5 w-1.5 flex-shrink-0 rounded-full" />
                )}
                <span className="min-w-0 flex-1 truncate text-[10px] text-gray-600">{s?.channelName ?? entry.dataKey}</span>
                {isPeak && <span className="text-[10px]">👑</span>}
                <span className="flex-shrink-0 font-mono text-[10px] font-bold" style={{ color: entry.color }}>
                  {entry.value.toLocaleString()}
                </span>
              </div>
            );
          })}
      </div>
    </div>,
    document.body
  );
}

const RANK_STYLES = [
  "bg-amber-400 text-white",
  "bg-gray-300 text-gray-700",
  "bg-amber-700/80 text-white",
];

const Y_MAX_PRESETS = [
  { label: "1K", value: 1000 },
  { label: "5K", value: 5000 },
  { label: "1万", value: 10000 },
  { label: "5万", value: 50000 },
  { label: "10万", value: 100000 },
];

const Y_MIN_PRESETS = [
  { label: "10", value: 10 },
  { label: "100", value: 100 },
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

const RANKING_LIMIT = 8;

function PeakRanking({ streams, animRev: outerRev = 0 }: { streams: StreamInfo[]; animRev?: number }) {
  const [sort, setSort] = useState<PeakSortKey>("peak");
  const [animRev, setAnimRev] = useState(0);
  const [listExpanded, setListExpanded] = useState(false);

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

  const visible = listExpanded ? sorted : sorted.slice(0, RANKING_LIMIT);
  const hiddenCount = sorted.length - RANKING_LIMIT;

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
        {visible.map((s, i) => (
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
      {hiddenCount > 0 && (
        <button
          onClick={() => setListExpanded((v) => !v)}
          className="mt-2 w-full rounded-xl border border-gray-100 py-2 text-xs text-gray-400 hover:text-violet-600 transition-colors"
        >
          {listExpanded ? "▲ 折りたたむ" : `▼ さらに${hiddenCount}件`}
        </button>
      )}
    </div>
  );
}

export default function ViewerChart({ data, streams }: Props) {
  const [filterGroup, setFilterGroup] = useState<string | null>(null);
  const [filterAnimRev, setFilterAnimRev] = useState(0);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [yMax, setYMax] = useState<number | null>(null);
  const [yMin, setYMin] = useState<number | null>(null);
  const [legendExpanded, setLegendExpanded] = useState(false);
  const [iconMode, setIconMode] = useState(false);
  const [isMobile, setIsMobile] = useState(true);
  const [tooltipVisible, setTooltipVisible] = useState(true);
  const chartContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIconMode(localStorage.getItem("legendIconMode") === "true");
    const mq = window.matchMedia("(min-width: 640px)");
    setIsMobile(!mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(!e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (chartContainerRef.current && !chartContainerRef.current.contains(e.target as Node)) {
        setTooltipVisible(false);
        setTimeout(() => setTooltipVisible(true), 100);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function toggleIconMode() {
    setIconMode((v) => {
      const next = !v;
      localStorage.setItem("legendIconMode", String(next));
      return next;
    });
  }

  const legendLimit = isMobile ? 8 : 12;

  const sortByOrder = (a: number | null | undefined, b: number | null | undefined, fallback: () => number) => {
    if (a != null && b != null) return a - b;
    if (a != null) return -1;
    if (b != null) return 1;
    return fallback();
  };

  // フィルターボタン: 各ストリームの「最上位グループ」を集める
  // サブグループに属する場合は parentGroupName を使用、直属なら groupName
  const topGroupMap = new Map<string, { name: string; color: string; sortOrder: number | null }>();
  for (const s of streams) {
    if (s.parentGroupName) {
      if (!topGroupMap.has(s.parentGroupName)) {
        topGroupMap.set(s.parentGroupName, {
          name: s.parentGroupName,
          color: s.parentGroupColor ?? "#6b7280",
          sortOrder: s.parentGroupSortOrder,
        });
      }
    } else if (s.groupName) {
      if (!topGroupMap.has(s.groupName)) {
        topGroupMap.set(s.groupName, {
          name: s.groupName,
          color: s.groupColor ?? "#6b7280",
          sortOrder: s.groupSortOrder,
        });
      }
    }
  }
  const sortedGroupEntries = Array.from(topGroupMap.values())
    .sort((a, b) => sortByOrder(a.sortOrder, b.sortOrder, () => a.name.localeCompare(b.name, "ja")));

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

  // 親グループを選ぶと直属チャンネル + 全サブグループのチャンネルを含む
  const groupFiltered = filterGroup
    ? streams.filter((s) => s.groupName === filterGroup || s.parentGroupName === filterGroup)
    : streams;

  const visibleStreams = groupFiltered.filter((s) => !hiddenIds.has(s.videoId));

  const chartData = data;

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
      {sortedGroupEntries.length > 1 && (
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
          {sortedGroupEntries.map((g) => {
            const isActive = filterGroup === g.name;
            return (
              <button
                key={g.name}
                onClick={() => applyGroupFilter(isActive ? null : g.name)}
                style={isActive ? { backgroundColor: g.color, borderColor: g.color } : {}}
                className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                  isActive
                    ? "text-white"
                    : "border-gray-200 bg-white text-gray-500 hover:border-gray-400"
                }`}
              >
                {g.name}
              </button>
            );
          })}
        </div>
      )}

      {/* チャンネルトグル凡例 */}
      {groupFiltered.length > 1 && (
        <div className="mb-3">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[10px] text-gray-400">配信者 · タップで表示切替</span>
            <button
              onClick={toggleIconMode}
              className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium transition-colors ${
                iconMode
                  ? "bg-violet-600 text-white"
                  : "border border-gray-200 text-gray-400 hover:border-violet-300 hover:text-violet-600"
              }`}
            >
              アイコン
            </button>
          </div>

          {iconMode ? (
            <div className="flex flex-wrap gap-1.5">
              {groupFiltered.map((s) => {
                const hidden = hiddenIds.has(s.videoId);
                return (
                  <button
                    key={s.videoId}
                    onClick={() => toggleId(s.videoId)}
                    title={s.channelName}
                    className={`rounded-full transition-all ${hidden ? "opacity-30 grayscale" : ""}`}
                  >
                    {s.iconUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={s.iconUrl} alt={s.channelName} className="h-7 w-7 rounded-full object-cover" />
                    ) : (
                      <span
                        className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold text-white"
                        style={{ backgroundColor: hidden ? "#d1d5db" : s.color }}
                      >
                        {s.channelName.charAt(0)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-y-1 sm:flex-row sm:flex-wrap sm:gap-x-1">
                {(legendExpanded ? groupFiltered : groupFiltered.slice(0, legendLimit)).map((s) => {
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
              {groupFiltered.length > legendLimit && (
                <button
                  onClick={() => setLegendExpanded((v) => !v)}
                  className="mt-1 text-xs text-gray-400 hover:text-violet-600 transition-colors"
                >
                  {legendExpanded ? "▲ 折りたたむ" : `▼ さらに${groupFiltered.length - legendLimit}件`}
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* Y軸スケールコントロール */}
      <div className="mb-3 flex flex-col gap-1">
        <div className="flex items-center gap-1.5">
          <span className="w-6 shrink-0 text-right text-[10px] text-gray-400">最大</span>
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
          <button
            onClick={() => { setYMax(null); setYMin(null); }}
            className={`ml-auto shrink-0 rounded-full px-3 py-0.5 text-[10px] font-medium transition-all ${
              yMax === null && yMin === null
                ? "bg-gray-800 text-white shadow-sm"
                : "bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-600"
            }`}
          >
            自動
          </button>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-6 shrink-0 text-right text-[10px] text-gray-400">最小</span>
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

      <div ref={chartContainerRef} className="relative">
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
            allowDataOverflow
          />
          {tooltipVisible && (
            <Tooltip
              content={(props) => {
                const p = props as unknown as {
                  active?: boolean;
                  payload?: { dataKey: string; value: number; color: string }[];
                  label?: number;
                  coordinate?: { x: number; y: number };
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
                    chartRect={chartContainerRef.current?.getBoundingClientRect() ?? null}
                  />
                );
              }}
              isAnimationActive={false}
            />
          )}

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
      </div>

{visibleStreams.length > 0 && <PeakRanking streams={visibleStreams} animRev={filterAnimRev} />}
    </div>
  );
}
