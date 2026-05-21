"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import {
  LineChart, Line, BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import type { Channel, Group } from "@/lib/types";
import { GRAPH_COLORS } from "@/lib/chartConfig";

type Metric = "viewers" | "sc" | "subs";
type PresetDays = 1 | 3 | 7;
type ChartDataPoint = Record<string, string | number | null>;

const MAX_CHANNELS = 10;
const AUTO_LIVE_LIMIT = 8;
const AUTO_DEFAULT_LIMIT = 5;

function getDateRange(days: PresetDays | null): { fromIso: string; toIso: string } {
  const toIso = new Date().toISOString();
  if (!days) return { fromIso: "", toIso };
  return { fromIso: new Date(Date.now() - days * 86400000).toISOString(), toIso };
}

function formatK(v: number): string {
  if (v >= 10000) return `${(v / 10000).toFixed(0)}万`;
  if (v >= 1000) return `${(v / 1000).toFixed(1)}K`;
  return String(v);
}
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" });
}
function formatSC(v: number): string {
  if (v >= 1_000_000) return `¥${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 10_000) return `¥${(v / 10_000).toFixed(1)}万`;
  return `¥${v.toLocaleString()}`;
}

export default function CompareClient({
  channels,
  groups,
  liveChannelIds,
}: {
  channels: Channel[];
  groups: Group[];
  liveChannelIds: string[];
}) {
  const liveSet = new Set(liveChannelIds);
  const channelMap = new Map(channels.map((c) => [c.channel_id, c]));
  const groupMap = new Map(groups.map((g) => [g.id, g]));

  function getGroup(ch: Channel): Group | undefined {
    if (!ch.group_id) return undefined;
    const g = groupMap.get(ch.group_id);
    if (!g) return undefined;
    return g.parent_group_id ? groupMap.get(g.parent_group_id) ?? g : g;
  }

  const [metric, setMetric] = useState<Metric>("viewers");
  const [presetDays, setPresetDays] = useState<PresetDays | null>(1);
  // selectedIds: all channels to fetch (order = color assignment)
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  // hiddenIds: toggled off in chart (still fetched)
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [loading, setLoading] = useState(false);
  const [loadingPct, setLoadingPct] = useState(0);
  const pctTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [viewerData, setViewerData] = useState<ChartDataPoint[]>([]);
  const [scData, setScData] = useState<{ channelId: string; value: number }[]>([]);
  const [subsData, setSubsData] = useState<ChartDataPoint[]>([]);

  // Auto-select on metric change
  useEffect(() => {
    let defaults: string[];
    if (metric === "viewers") {
      defaults = liveChannelIds.slice(0, AUTO_LIVE_LIMIT);
    } else {
      defaults = channels
        .filter((c) => c.subscriber_count > 0)
        .sort((a, b) => b.subscriber_count - a.subscriber_count)
        .slice(0, AUTO_DEFAULT_LIMIT)
        .map((c) => c.channel_id);
    }
    setSelectedIds(defaults);
    setHiddenIds(new Set());
    setViewerData([]);
    setScData([]);
    setSubsData([]);
  }, [metric]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchData = useCallback(async () => {
    if (selectedIds.length === 0) return;
    setLoading(true);
    setLoadingPct(0);
    if (pctTimerRef.current) clearInterval(pctTimerRef.current);
    pctTimerRef.current = setInterval(() => {
      setLoadingPct((p) => (p < 85 ? p + 4 : p));
    }, 100);

    const effectiveDays = metric === "viewers" ? 1 : presetDays;
    const { fromIso, toIso } = getDateRange(effectiveDays);
    const params = new URLSearchParams({
      type: metric,
      channelIds: selectedIds.join(","),
      from: fromIso,
      to: toIso,
    });

    try {
      const res = await fetch(`/api/compare-data?${params}`);
      const json = await res.json() as { data: unknown[] };
      if (metric === "viewers") setViewerData(json.data as ChartDataPoint[]);
      else if (metric === "sc") setScData(json.data as { channelId: string; value: number }[]);
      else setSubsData(json.data as ChartDataPoint[]);
    } catch { /* silent */ } finally {
      if (pctTimerRef.current) clearInterval(pctTimerRef.current);
      setLoadingPct(100);
      setTimeout(() => { setLoading(false); setLoadingPct(0); }, 700);
    }
  }, [selectedIds, metric, presetDays]);

  useEffect(() => {
    if (selectedIds.length > 0) fetchData();
  }, [fetchData]);

  // Auto-refresh for live viewers
  useEffect(() => {
    if (metric !== "viewers") return;
    const timer = setInterval(fetchData, 60000);
    return () => clearInterval(timer);
  }, [metric, fetchData]);

  function toggleHide(channelId: string) {
    setHiddenIds((prev) => {
      const next = new Set(prev);
      if (next.has(channelId)) next.delete(channelId);
      else next.add(channelId);
      return next;
    });
  }

  function addChannel(channelId: string) {
    if (selectedIds.includes(channelId) || selectedIds.length >= MAX_CHANNELS) return;
    setSelectedIds((prev) => [...prev, channelId]);
    setShowSearch(false);
    setSearchQuery("");
  }

  function removeChannel(channelId: string) {
    setSelectedIds((prev) => prev.filter((id) => id !== channelId));
    setHiddenIds((prev) => { const next = new Set(prev); next.delete(channelId); return next; });
  }

  const visibleIds = selectedIds.filter((id) => !hiddenIds.has(id));

  const searchResults = searchQuery.trim()
    ? channels
        .filter(
          (c) =>
            !selectedIds.includes(c.channel_id) &&
            (c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
              (c.custom_url ?? "").toLowerCase().includes(searchQuery.toLowerCase()))
        )
        .slice(0, 20)
    : [];

  const METRIC_LABELS: Record<Metric, string> = {
    viewers: "同接（ライブ中）",
    sc: "スパチャ",
    subs: "登録者推移",
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-5">
        <div className="mb-1 flex items-center gap-2 text-xs text-gray-400">
          <Link href="/" className="hover:text-violet-600 transition-colors">ホーム</Link>
          <span>›</span>
          <span>比較</span>
        </div>
        <h1 className="text-xl font-bold text-gray-900">チャンネル比較</h1>
      </div>

      {/* Metric tabs */}
      <div className="mb-4 flex gap-1.5">
        {(["viewers", "sc", "subs"] as Metric[]).map((m) => (
          <button
            key={m}
            onClick={() => setMetric(m)}
            className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
              metric === m
                ? "bg-violet-600 text-white shadow-sm"
                : "border border-gray-200 bg-white text-gray-500 hover:border-violet-300 hover:text-violet-600"
            }`}
          >
            {METRIC_LABELS[m]}
          </button>
        ))}
      </div>

      {/* Controls row: period (sc/subs) + live badge (viewers) */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {metric === "viewers" ? (
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
            <span>{liveChannelIds.length}配信中 · 60秒ごとに自動更新</span>
          </div>
        ) : (
          <>
            <span className="text-xs text-gray-400">期間</span>
            {([1, 3, 7] as PresetDays[]).map((days) => (
              <button
                key={days}
                onClick={() => setPresetDays(days)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  presetDays === days
                    ? "bg-violet-600 text-white"
                    : "border border-gray-200 bg-white text-gray-500 hover:border-violet-300 hover:text-violet-600"
                }`}
              >
                {days}日
              </button>
            ))}
            <button
              onClick={() => setPresetDays(null)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                presetDays === null
                  ? "bg-violet-600 text-white"
                  : "border border-gray-200 bg-white text-gray-500 hover:border-violet-300 hover:text-violet-600"
              }`}
            >
              全期間
            </button>
          </>
        )}
      </div>

      {/* Channel chips + add button */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {selectedIds.map((channelId, idx) => {
          const ch = channelMap.get(channelId);
          const color = GRAPH_COLORS[idx % GRAPH_COLORS.length];
          const hidden = hiddenIds.has(channelId);
          return (
            <div
              key={channelId}
              className="flex items-center gap-1.5 rounded-full border py-1 pl-1.5 pr-2 transition-all"
              style={{
                borderColor: hidden ? "#e5e7eb" : color,
                backgroundColor: hidden ? "transparent" : `${color}18`,
              }}
            >
              {ch?.icon_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={ch.icon_url} alt="" className="h-5 w-5 flex-shrink-0 rounded-full object-cover" />
              ) : (
                <span className="h-5 w-5 flex-shrink-0 rounded-full" style={{ backgroundColor: hidden ? "#d1d5db" : color }} />
              )}
              {/* クリックで表示/非表示トグル */}
              <button
                onClick={() => toggleHide(channelId)}
                className={`max-w-[110px] truncate text-xs font-medium transition-colors ${
                  hidden ? "text-gray-300 line-through" : ""
                }`}
                style={hidden ? {} : { color }}
                title={hidden ? "クリックで表示" : "クリックで非表示"}
              >
                {ch?.name ?? channelId}
              </button>
              <button
                onClick={() => removeChannel(channelId)}
                className="ml-0.5 flex-shrink-0 text-[11px] text-gray-300 hover:text-gray-500 transition-colors"
                aria-label="削除"
              >
                ×
              </button>
            </div>
          );
        })}

        {/* 追加ボタン */}
        {selectedIds.length < MAX_CHANNELS && (
          <div className="relative">
            <button
              onClick={() => setShowSearch((v) => !v)}
              className="flex items-center gap-1 rounded-full border border-dashed border-gray-300 px-3 py-1 text-xs text-gray-400 hover:border-violet-400 hover:text-violet-500 transition-colors"
            >
              + 追加
            </button>
            {showSearch && (
              <>
                {/* オーバーレイ */}
                <div className="fixed inset-0 z-10" onClick={() => { setShowSearch(false); setSearchQuery(""); }} />
                <div className="absolute left-0 top-full z-20 mt-1.5 w-72 rounded-xl border border-gray-200 bg-white shadow-xl">
                  <input
                    autoFocus
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="チャンネル名で検索..."
                    className="w-full rounded-t-xl border-b border-gray-100 px-3 py-2.5 text-sm outline-none"
                  />
                  <div className="max-h-52 overflow-y-auto rounded-b-xl">
                    {searchResults.length === 0 ? (
                      <p className="p-4 text-center text-xs text-gray-400">
                        {searchQuery ? "見つかりません" : "チャンネル名を入力"}
                      </p>
                    ) : (
                      searchResults.map((ch) => {
                        const group = getGroup(ch);
                        const isLive = liveSet.has(ch.channel_id);
                        return (
                          <button
                            key={ch.channel_id}
                            onClick={() => addChannel(ch.channel_id)}
                            className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left hover:bg-gray-50 transition-colors"
                          >
                            {ch.icon_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={ch.icon_url} alt="" className="h-8 w-8 flex-shrink-0 rounded-full object-cover" />
                            ) : (
                              <span
                                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                                style={{ backgroundColor: group?.color ?? "#6b7280" }}
                              >
                                {ch.name[0]}
                              </span>
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-gray-800">{ch.name}</p>
                              {group && <p className="truncate text-[10px] text-gray-400">{group.name}</p>}
                            </div>
                            {isLive && (
                              <span className="flex-shrink-0 h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Chart area */}
      {loading ? (
        <div className="rounded-2xl border border-gray-100 bg-white p-10 shadow-sm">
          <p className="mb-4 text-center text-sm font-medium text-gray-500">データを読み込み中...</p>
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-violet-500 transition-all duration-500"
              style={{ width: `${loadingPct}%` }}
            />
          </div>
          <p className="mt-2 text-center text-xs text-gray-400">{loadingPct}%</p>
        </div>
      ) : selectedIds.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 py-24 text-center text-sm text-gray-400">
          {metric === "viewers" && liveChannelIds.length === 0
            ? "現在ライブ中の配信はありません"
            : "チャンネルを追加してください"}
        </div>
      ) : metric === "viewers" ? (
        <ViewersChart data={viewerData} visibleIds={visibleIds} selectedIds={selectedIds} channelMap={channelMap} />
      ) : metric === "sc" ? (
        <SCView data={scData} visibleIds={visibleIds} selectedIds={selectedIds} channelMap={channelMap} />
      ) : (
        <SubsChart data={subsData} visibleIds={visibleIds} selectedIds={selectedIds} channelMap={channelMap} />
      )}
    </div>
  );
}

function ViewersChart({
  data,
  visibleIds,
  selectedIds,
  channelMap,
}: {
  data: ChartDataPoint[];
  visibleIds: string[];
  selectedIds: string[];
  channelMap: Map<string, Channel>;
}) {
  if (data.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-200 py-24 text-center text-sm text-gray-400">
        この期間の同接データがありません
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
          <XAxis
            dataKey="t"
            tickFormatter={(v) =>
              new Date(String(v)).toLocaleString("ja-JP", {
                timeZone: "Asia/Tokyo",
                month: "numeric",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })
            }
            tick={{ fill: "#9ca3af", fontSize: 10 }}
            axisLine={{ stroke: "#e5e7eb" }}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tickFormatter={(v) => formatK(Number(v))}
            tick={{ fill: "#9ca3af", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={48}
          />
          <Tooltip
            formatter={(value, name) => [
              `${Number(value).toLocaleString()}人`,
              channelMap.get(String(name))?.name ?? String(name),
            ]}
            labelFormatter={(v) =>
              new Date(String(v)).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })
            }
            contentStyle={{ background: "white", border: "1px solid #e5e7eb", borderRadius: "10px", fontSize: "12px" }}
          />
          {selectedIds.map((channelId, idx) => (
            <Line
              key={channelId}
              type="monotone"
              dataKey={channelId}
              stroke={GRAPH_COLORS[idx % GRAPH_COLORS.length]}
              strokeWidth={visibleIds.includes(channelId) ? 2 : 0}
              dot={false}
              activeDot={visibleIds.includes(channelId) ? { r: 4, strokeWidth: 0 } : false}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function SCView({
  data,
  visibleIds,
  selectedIds,
  channelMap,
}: {
  data: { channelId: string; value: number }[];
  visibleIds: string[];
  selectedIds: string[];
  channelMap: Map<string, Channel>;
}) {
  const barData = visibleIds.map((channelId) => {
    const idx = selectedIds.indexOf(channelId);
    return {
      channelId,
      name: channelMap.get(channelId)?.name ?? channelId,
      value: data.find((d) => d.channelId === channelId)?.value ?? 0,
      color: GRAPH_COLORS[idx % GRAPH_COLORS.length],
    };
  }).sort((a, b) => b.value - a.value);

  if (barData.length === 0 || barData.every((d) => d.value === 0)) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-200 py-24 text-center text-sm text-gray-400">
        この期間のスパチャデータがありません
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={barData} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
            <XAxis dataKey="name" tick={{ fill: "#9ca3af", fontSize: 10 }} axisLine={{ stroke: "#e5e7eb" }} tickLine={false} />
            <YAxis
              tickFormatter={(v) => formatSC(Number(v)).replace("¥", "")}
              tick={{ fill: "#9ca3af", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              width={52}
            />
            <Tooltip
              formatter={(v) => [formatSC(Number(v)), "スパチャ"]}
              contentStyle={{ background: "white", border: "1px solid #e5e7eb", borderRadius: "10px", fontSize: "12px" }}
            />
            <Bar dataKey="value" radius={[6, 6, 0, 0]}>
              {barData.map((d, i) => <Cell key={i} fill={d.color} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden">
        <div className="divide-y divide-gray-100">
          {barData.map((row, i) => {
            const ch = channelMap.get(row.channelId);
            return (
              <div key={row.channelId} className="flex items-center gap-3 px-4 py-3">
                <span className="w-5 flex-shrink-0 text-center text-xs font-bold text-gray-300">{i + 1}</span>
                {ch?.icon_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={ch.icon_url} alt={ch.name} className="h-8 w-8 flex-shrink-0 rounded-full object-cover" />
                )}
                <div className="flex min-w-0 flex-1 items-center gap-1.5">
                  <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: row.color }} />
                  <span className="truncate text-sm font-medium text-gray-800">{row.name}</span>
                </div>
                <span className="flex-shrink-0 text-sm font-bold text-violet-600">{formatSC(row.value)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SubsChart({
  data,
  visibleIds,
  selectedIds,
  channelMap,
}: {
  data: ChartDataPoint[];
  visibleIds: string[];
  selectedIds: string[];
  channelMap: Map<string, Channel>;
}) {
  if (data.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-200 py-24 text-center text-sm text-gray-400">
        この期間の登録者データがありません
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
          <XAxis
            dataKey="t"
            tickFormatter={(v) => formatDate(String(v))}
            tick={{ fill: "#9ca3af", fontSize: 10 }}
            axisLine={{ stroke: "#e5e7eb" }}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tickFormatter={(v) => formatK(Number(v))}
            tick={{ fill: "#9ca3af", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={48}
          />
          <Tooltip
            formatter={(value, name) => [
              `${Number(value).toLocaleString()}人`,
              channelMap.get(String(name))?.name ?? String(name),
            ]}
            labelFormatter={(v) => formatDate(String(v))}
            contentStyle={{ background: "white", border: "1px solid #e5e7eb", borderRadius: "10px", fontSize: "12px" }}
          />
          {selectedIds.map((channelId, idx) => (
            <Line
              key={channelId}
              type="monotone"
              dataKey={channelId}
              stroke={GRAPH_COLORS[idx % GRAPH_COLORS.length]}
              strokeWidth={visibleIds.includes(channelId) ? 2 : 0}
              dot={false}
              activeDot={visibleIds.includes(channelId) ? { r: 4, strokeWidth: 0 } : false}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
