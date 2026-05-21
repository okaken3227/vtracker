"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { Channel, Group } from "@/lib/types";
import { GRAPH_COLORS } from "@/lib/chartConfig";

type Metric = "viewers" | "sc" | "subs";
type PresetDays = 7 | 30 | 90;

type ChartDataPoint = Record<string, string | number | null>;

function getDateRange(presetDays: PresetDays | null, customFrom: string, customTo: string): { fromIso: string; toIso: string } {
  const nowMs = Date.now();
  if (presetDays !== null) {
    return {
      fromIso: new Date(nowMs - presetDays * 24 * 60 * 60 * 1000).toISOString(),
      toIso: new Date(nowMs).toISOString(),
    };
  }
  const from = customFrom ? new Date(customFrom).toISOString() : new Date(nowMs - 7 * 24 * 60 * 60 * 1000).toISOString();
  const to = customTo ? new Date(customTo + "T23:59:59").toISOString() : new Date(nowMs).toISOString();
  return { fromIso: from, toIso: to };
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
}: {
  channels: Channel[];
  groups: Group[];
}) {
  const [selectedChannelIds, setSelectedChannelIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [metric, setMetric] = useState<Metric>("viewers");
  const [presetDays, setPresetDays] = useState<PresetDays | null>(7);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [loading, setLoading] = useState(false);

  // Chart data states
  const [viewerChartData, setViewerChartData] = useState<ChartDataPoint[]>([]);
  const [scBarData, setScBarData] = useState<{ name: string; value: number; channelId: string }[]>([]);
  const [subsChartData, setSubsChartData] = useState<ChartDataPoint[]>([]);

  const groupMap = new Map(groups.map((g) => [g.id, g]));

  function getGroup(channel: Channel): Group | undefined {
    if (!channel.group_id) return undefined;
    const g = groupMap.get(channel.group_id);
    if (!g) return undefined;
    if (g.parent_group_id) return groupMap.get(g.parent_group_id) ?? g;
    return g;
  }

  // Filtered channels for search
  const filteredChannels = searchQuery.trim()
    ? channels.filter(
        (c) =>
          c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (c.custom_url ?? "").toLowerCase().includes(searchQuery.toLowerCase())
      )
    : channels;

  const channelMap = new Map(channels.map((c) => [c.channel_id, c]));

  function toggleChannel(channelId: string) {
    setSelectedChannelIds((prev) => {
      if (prev.includes(channelId)) return prev.filter((id) => id !== channelId);
      if (prev.length >= 10) return prev; // max 10
      return [...prev, channelId];
    });
  }

  function removeChannel(channelId: string) {
    setSelectedChannelIds((prev) => prev.filter((id) => id !== channelId));
  }

  const fetchData = useCallback(async () => {
    if (selectedChannelIds.length === 0) return;
    setLoading(true);

    const { fromIso, toIso } = getDateRange(presetDays, customFrom, customTo);
    const params = new URLSearchParams({
      type: metric,
      channelIds: selectedChannelIds.join(","),
      from: fromIso,
      to: toIso,
    });

    try {
      const res = await fetch(`/api/compare-data?${params}`);
      const json = await res.json() as { data: unknown[] };

      if (metric === "viewers") {
        setViewerChartData(json.data as ChartDataPoint[]);
      } else if (metric === "sc") {
        const raw = json.data as { channelId: string; value: number }[];
        const barData = selectedChannelIds
          .map((channelId) => ({
            name: channelMap.get(channelId)?.name ?? channelId,
            value: raw.find((d) => d.channelId === channelId)?.value ?? 0,
            channelId,
          }))
          .sort((a, b) => b.value - a.value);
        setScBarData(barData);
      } else {
        setSubsChartData(json.data as ChartDataPoint[]);
      }
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  }, [selectedChannelIds, metric, presetDays, customFrom, customTo, channelMap]);

  useEffect(() => {
    if (selectedChannelIds.length === 0) return;
    fetchData();
  }, [fetchData]);

  const METRIC_LABELS: Record<Metric, string> = {
    viewers: "同接推移",
    sc: "スパチャ",
    subs: "登録者推移",
  };

  return (
    <div>
      {/* Breadcrumb + Header */}
      <div className="mb-6">
        <div className="mb-1 flex items-center gap-2 text-xs text-gray-400">
          <Link href="/" className="hover:text-violet-600 transition-colors">ホーム</Link>
          <span>›</span>
          <span>比較</span>
        </div>
        <h1 className="text-xl font-bold text-gray-900">チャンネル比較</h1>
        <p className="mt-0.5 text-xs text-gray-400">最大10チャンネルを選択して比較できます</p>
      </div>

      {/* Channel selector */}
      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-gray-700">チャンネルを選択</h2>

        {/* Selected channel chips */}
        {selectedChannelIds.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {selectedChannelIds.map((channelId, idx) => {
              const ch = channelMap.get(channelId);
              const color = GRAPH_COLORS[idx % GRAPH_COLORS.length];
              return (
                <span
                  key={channelId}
                  className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium"
                  style={{ borderColor: color, color, backgroundColor: `${color}18` }}
                >
                  {ch?.icon_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={ch.icon_url} alt="" className="h-4 w-4 rounded-full object-cover" />
                  )}
                  <span className="max-w-[120px] truncate">{ch?.name ?? channelId}</span>
                  <button
                    onClick={() => removeChannel(channelId)}
                    className="ml-0.5 opacity-60 hover:opacity-100 transition-opacity"
                    aria-label="削除"
                  >
                    ×
                  </button>
                </span>
              );
            })}
          </div>
        )}

        {/* Search input */}
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="チャンネル名で検索..."
          className="mb-3 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-violet-400 transition-colors"
        />

        {/* Channel list */}
        <div className="max-h-56 overflow-y-auto rounded-lg border border-gray-100 divide-y divide-gray-50">
          {filteredChannels.slice(0, 100).map((ch) => {
            const isSelected = selectedChannelIds.includes(ch.channel_id);
            const idx = selectedChannelIds.indexOf(ch.channel_id);
            const color = idx >= 0 ? GRAPH_COLORS[idx % GRAPH_COLORS.length] : undefined;
            const group = getGroup(ch);
            const disabled = !isSelected && selectedChannelIds.length >= 10;

            return (
              <button
                key={ch.channel_id}
                onClick={() => !disabled && toggleChannel(ch.channel_id)}
                disabled={disabled}
                className={`flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors ${
                  isSelected ? "bg-violet-50" : disabled ? "opacity-40 cursor-not-allowed" : "hover:bg-gray-50"
                }`}
              >
                {/* Checkbox */}
                <span
                  className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border-2 text-white transition-colors"
                  style={
                    isSelected && color
                      ? { borderColor: color, backgroundColor: color }
                      : { borderColor: "#d1d5db" }
                  }
                >
                  {isSelected && (
                    <svg viewBox="0 0 10 10" className="h-2.5 w-2.5">
                      <path d="M1.5 5l2.5 2.5 5-4.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>

                {/* Avatar */}
                {ch.icon_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={ch.icon_url} alt={ch.name} className="h-8 w-8 flex-shrink-0 rounded-full object-cover" />
                ) : (
                  <div
                    className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                    style={{ backgroundColor: group?.color ?? "#6b7280" }}
                  >
                    {ch.name[0]}
                  </div>
                )}

                {/* Name + group */}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-800">{ch.name}</p>
                  {group && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <span
                        className="inline-block h-1.5 w-1.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: group.color }}
                      />
                      <span className="text-xs text-gray-400 truncate">{group.name}</span>
                    </div>
                  )}
                </div>

                {/* Subscriber count */}
                <span className="flex-shrink-0 text-xs text-gray-400">
                  {ch.subscriber_count >= 10000
                    ? `${(ch.subscriber_count / 10000).toFixed(0)}万`
                    : ch.subscriber_count.toLocaleString()}人
                </span>
              </button>
            );
          })}

          {filteredChannels.length === 0 && (
            <p className="p-4 text-center text-xs text-gray-400">チャンネルが見つかりません</p>
          )}
        </div>
      </div>

      {/* Date range selector */}
      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-gray-700">期間</h2>
        <div className="flex flex-wrap items-center gap-2">
          {([7, 30, 90] as PresetDays[]).map((days) => (
            <button
              key={days}
              onClick={() => { setPresetDays(days); setCustomFrom(""); setCustomTo(""); }}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                presetDays === days
                  ? "bg-violet-600 text-white"
                  : "border border-gray-200 bg-white text-gray-500 hover:border-violet-300 hover:text-violet-600"
              }`}
            >
              過去{days}日
            </button>
          ))}
          <span className="text-xs text-gray-400">または</span>
          <input
            type="date"
            value={customFrom}
            onChange={(e) => { setCustomFrom(e.target.value); setPresetDays(null); }}
            className="rounded-lg border border-gray-200 px-2 py-1 text-xs outline-none focus:border-violet-400"
          />
          <span className="text-xs text-gray-400">〜</span>
          <input
            type="date"
            value={customTo}
            onChange={(e) => { setCustomTo(e.target.value); setPresetDays(null); }}
            className="rounded-lg border border-gray-200 px-2 py-1 text-xs outline-none focus:border-violet-400"
          />
        </div>
      </div>

      {/* Metric tabs */}
      <div className="mb-4 flex gap-1">
        {(["viewers", "sc", "subs"] as Metric[]).map((m) => (
          <button
            key={m}
            onClick={() => setMetric(m)}
            className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
              metric === m
                ? "bg-violet-600 text-white"
                : "border border-gray-200 bg-white text-gray-500 hover:border-violet-300 hover:text-violet-600"
            }`}
          >
            {METRIC_LABELS[m]}
          </button>
        ))}
      </div>

      {/* Chart / Data area */}
      {selectedChannelIds.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 py-24 text-center text-sm text-gray-400">
          チャンネルを選択してください
        </div>
      ) : loading ? (
        <div className="rounded-2xl border border-dashed border-gray-200 py-24 text-center text-sm text-gray-400">
          データを読み込み中...
        </div>
      ) : metric === "viewers" ? (
        <ViewersChart data={viewerChartData} channelIds={selectedChannelIds} channelMap={channelMap} />
      ) : metric === "sc" ? (
        <SCView data={scBarData} channelIds={selectedChannelIds} channelMap={channelMap} />
      ) : (
        <SubsChart data={subsChartData} channelIds={selectedChannelIds} channelMap={channelMap} />
      )}
    </div>
  );
}

function ViewersChart({
  data,
  channelIds,
  channelMap,
}: {
  data: ChartDataPoint[];
  channelIds: string[];
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
      <h3 className="mb-4 text-sm font-semibold text-gray-700">同接推移</h3>
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
          <XAxis
            dataKey="t"
            tickFormatter={(v) =>
              new Date(String(v)).toLocaleDateString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })
            }
            tick={{ fill: "#9ca3af", fontSize: 10 }}
            axisLine={{ stroke: "#e5e7eb" }}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tickFormatter={formatK}
            tick={{ fill: "#9ca3af", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={52}
          />
          <Tooltip
            formatter={(value, name) => [
              `${Number(value).toLocaleString()}人`,
              channelMap.get(String(name))?.name ?? String(name),
            ]}
            labelFormatter={(label) =>
              new Date(String(label)).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })
            }
            contentStyle={{
              background: "white",
              border: "1px solid #e5e7eb",
              borderRadius: "10px",
              fontSize: "12px",
            }}
          />
          <Legend
            formatter={(value) => channelMap.get(String(value))?.name ?? String(value)}
          />
          {channelIds.map((channelId, idx) => (
            <Line
              key={channelId}
              type="monotone"
              dataKey={channelId}
              stroke={GRAPH_COLORS[idx % GRAPH_COLORS.length]}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
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
  channelIds,
  channelMap,
}: {
  data: { name: string; value: number; channelId: string }[];
  channelIds: string[];
  channelMap: Map<string, Channel>;
}) {
  if (data.length === 0 || data.every((d) => d.value === 0)) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-200 py-24 text-center text-sm text-gray-400">
        この期間のスパチャデータがありません
      </div>
    );
  }

  const barData = channelIds.map((channelId, idx) => ({
    name: channelMap.get(channelId)?.name ?? channelId,
    value: data.find((d) => d.channelId === channelId)?.value ?? 0,
    color: GRAPH_COLORS[idx % GRAPH_COLORS.length],
  }));

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold text-gray-700">スパチャ合計</h3>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={barData} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fill: "#9ca3af", fontSize: 11 }}
              axisLine={{ stroke: "#e5e7eb" }}
              tickLine={false}
            />
            <YAxis
              tickFormatter={(v) => formatSC(Number(v)).replace("¥", "")}
              tick={{ fill: "#9ca3af", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              width={56}
            />
            <Tooltip
              formatter={(value) => [formatSC(Number(value)), "スパチャ"]}
              contentStyle={{
                background: "white",
                border: "1px solid #e5e7eb",
                borderRadius: "10px",
                fontSize: "12px",
              }}
            />
            <Bar dataKey="value" radius={[6, 6, 0, 0]}>
              {barData.map((entry, idx) => (
                <Cell key={`cell-${idx}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden">
        <div className="divide-y divide-gray-100">
          {barData
            .sort((a, b) => b.value - a.value)
            .map((row, i) => {
              const channelId = channelIds.find((id) => channelMap.get(id)?.name === row.name) ?? "";
              const ch = channelMap.get(channelId);
              return (
                <div key={row.name} className="flex items-center gap-3 px-4 py-3">
                  <span className="w-5 flex-shrink-0 text-center text-xs font-bold text-gray-400">{i + 1}</span>
                  {ch?.icon_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={ch.icon_url} alt={ch.name} className="h-8 w-8 flex-shrink-0 rounded-full object-cover" />
                  )}
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: row.color }} />
                    <span className="truncate text-sm font-medium text-gray-800">{row.name}</span>
                  </div>
                  <span className="flex-shrink-0 text-sm font-bold text-violet-600">
                    {formatSC(row.value)}
                  </span>
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
  channelIds,
  channelMap,
}: {
  data: ChartDataPoint[];
  channelIds: string[];
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
      <h3 className="mb-4 text-sm font-semibold text-gray-700">登録者数推移</h3>
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
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
            tickFormatter={formatK}
            tick={{ fill: "#9ca3af", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={52}
          />
          <Tooltip
            formatter={(value, name) => [
              `${Number(value).toLocaleString()}人`,
              channelMap.get(String(name))?.name ?? String(name),
            ]}
            labelFormatter={(label) => formatDate(String(label))}
            contentStyle={{
              background: "white",
              border: "1px solid #e5e7eb",
              borderRadius: "10px",
              fontSize: "12px",
            }}
          />
          <Legend
            formatter={(value) => channelMap.get(String(value))?.name ?? String(value)}
          />
          {channelIds.map((channelId, idx) => (
            <Line
              key={channelId}
              type="monotone"
              dataKey={channelId}
              stroke={GRAPH_COLORS[idx % GRAPH_COLORS.length]}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
