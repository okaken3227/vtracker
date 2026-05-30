import type { Metadata } from "next";
import Link from "next/link";
import { unstable_cache } from "next/cache";
import { supabase } from "@/lib/supabase/client";
import type { Channel, Group } from "@/lib/types";
import { getJstMidnightMs } from "@/lib/jst";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "ランキング",
  description: "VTuberの同接・スパチャ・登録者数ランキング。今日・今週・今月のVTuberランキングを確認できます。",
};

type Period = "today" | "week" | "month";
type Metric = "viewers" | "sc" | "subs";

type GraphPointRow = { video_id: string; concurrent_viewers: number };
type SCRow = { video_id: string; amount_jpy: number | null };
type VideoRow = { video_id: string; channel_id: string };
type RankingEntry = { channel: Channel; value: number; videoId?: string };

function getPeriodRange(period: Period): { fromIso: string; toIso: string } {
  const nowMs = Date.now();
  const jstMidnightMs = getJstMidnightMs();

  if (period === "today") {
    return {
      fromIso: new Date(jstMidnightMs).toISOString(),
      toIso: new Date(nowMs).toISOString(),
    };
  } else if (period === "week") {
    return {
      fromIso: new Date(nowMs - 7 * 24 * 60 * 60 * 1000).toISOString(),
      toIso: new Date(nowMs).toISOString(),
    };
  } else {
    return {
      fromIso: new Date(nowMs - 30 * 24 * 60 * 60 * 1000).toISOString(),
      toIso: new Date(nowMs).toISOString(),
    };
  }
}

function formatValue(value: number, metric: Metric): string {
  if (metric === "sc") {
    if (value >= 100_000_000) return `¥${(value / 100_000_000).toFixed(1)}億`;
    if (value >= 10_000) return `¥${(value / 10_000).toFixed(1)}万`;
    return `¥${value.toLocaleString()}`;
  }
  if (metric === "subs") {
    if (value >= 10_000) return `${(value / 10_000).toFixed(1)}万人`;
    return `${value.toLocaleString()}人`;
  }
  // viewers
  return `${value.toLocaleString()} 人`;
}

const fetchCachedViewerPoints = unstable_cache(
  async (fromIso: string, toIso: string) => {
    const { data } = await supabase
      .from("live_graph_points")
      .select("video_id, concurrent_viewers")
      .gte("recorded_at", fromIso)
      .lte("recorded_at", toIso)
      .limit(50000);
    return (data ?? []) as GraphPointRow[];
  },
  ["ranking-viewer-points"],
  { revalidate: 300 },
);

const fetchCachedSCRows = unstable_cache(
  async (fromIso: string, toIso: string) => {
    const { data } = await supabase
      .from("superchats")
      .select("video_id, amount_jpy")
      .gte("published_at", fromIso)
      .lte("published_at", toIso)
      .not("amount_jpy", "is", null)
      .limit(100000);
    return (data ?? []) as SCRow[];
  },
  ["ranking-sc-rows"],
  { revalidate: 300 },
);

const fetchCachedChannelsGroups = unstable_cache(
  async () => {
    const [chRes, grRes] = await Promise.all([
      supabase.from("channels").select("*").order("subscriber_count", { ascending: false }),
      supabase.from("groups").select("*").order("sort_order", { ascending: true, nullsFirst: false }).order("name"),
    ]);
    return {
      channels: (chRes.data ?? []) as Channel[],
      groups: (grRes.data ?? []) as Group[],
    };
  },
  ["ranking-channels-groups"],
  { revalidate: 120 },
);

async function fetchViewersRanking(
  fromIso: string,
  toIso: string,
  channelMap: Map<string, Channel>,
): Promise<RankingEntry[]> {
  const peakByVideo = new Map<string, number>();
  for (const p of await fetchCachedViewerPoints(fromIso, toIso)) {
    const cur = peakByVideo.get(p.video_id) ?? 0;
    if (p.concurrent_viewers > cur) peakByVideo.set(p.video_id, p.concurrent_viewers);
  }

  if (peakByVideo.size === 0) return [];

  const videoIds = Array.from(peakByVideo.keys());
  const { data: videos } = await supabase
    .from("videos")
    .select("video_id, channel_id")
    .in("video_id", videoIds);

  const videoRows = (videos ?? []) as VideoRow[];
  // channel_id -> { peak, videoId }
  const channelBest = new Map<string, { peak: number; videoId: string }>();

  for (const v of videoRows) {
    const peak = peakByVideo.get(v.video_id) ?? 0;
    const cur = channelBest.get(v.channel_id);
    if (!cur || peak > cur.peak) channelBest.set(v.channel_id, { peak, videoId: v.video_id });
  }

  const results: RankingEntry[] = [];
  for (const [channelId, { peak, videoId }] of channelBest) {
    const channel = channelMap.get(channelId);
    if (channel) results.push({ channel, value: peak, videoId });
  }

  return results.sort((a, b) => b.value - a.value).slice(0, 50);
}

async function fetchSCRanking(
  fromIso: string,
  toIso: string,
  channelMap: Map<string, Channel>,
): Promise<{ channel: Channel; value: number }[]> {
  const scRows = await fetchCachedSCRows(fromIso, toIso);

  if (scRows.length === 0) return [];

  // Sum by video_id
  const scByVideo = new Map<string, number>();
  for (const sc of scRows) {
    const jpy = sc.amount_jpy ?? 0;
    scByVideo.set(sc.video_id, (scByVideo.get(sc.video_id) ?? 0) + jpy);
  }

  // Get video -> channel mapping
  const videoIds = Array.from(scByVideo.keys());
  const { data: videos } = await supabase
    .from("videos")
    .select("video_id, channel_id")
    .in("video_id", videoIds);

  const videoRows = (videos ?? []) as VideoRow[];
  const scByChannel = new Map<string, number>();

  for (const v of videoRows) {
    const sc = scByVideo.get(v.video_id) ?? 0;
    scByChannel.set(v.channel_id, (scByChannel.get(v.channel_id) ?? 0) + sc);
  }

  const results: { channel: Channel; value: number }[] = [];
  for (const [channelId, total] of scByChannel) {
    const channel = channelMap.get(channelId);
    if (channel && total > 0) results.push({ channel, value: total });
  }

  return results.sort((a, b) => b.value - a.value).slice(0, 50);
}

function fetchSubsRanking(channels: Channel[]): { channel: Channel; value: number }[] {
  return [...channels]
    .filter((c) => c.subscriber_count > 0)
    .sort((a, b) => b.subscriber_count - a.subscriber_count)
    .slice(0, 50)
    .map((c) => ({ channel: c, value: c.subscriber_count }));
}

const PERIOD_LABELS: Record<Period, string> = {
  today: "今日",
  week: "今週",
  month: "今月",
};

const METRIC_LABELS: Record<Metric, string> = {
  viewers: "同接ピーク",
  sc: "スパチャ",
  subs: "登録者数",
};

export default async function RankingPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const period = (["today", "week", "month"].includes(String(sp.period)) ? sp.period : "today") as Period;
  const metric = (["viewers", "sc", "subs"].includes(String(sp.metric)) ? sp.metric : "viewers") as Metric;

  const { channels, groups } = await fetchCachedChannelsGroups();
  const channelMap = new Map(channels.map((c) => [c.channel_id, c]));
  const groupMap = new Map(groups.map((g) => [g.id, g]));

  const { fromIso, toIso } = getPeriodRange(period);

  let ranking: RankingEntry[] = [];

  if (metric === "viewers") {
    ranking = await fetchViewersRanking(fromIso, toIso, channelMap);
  } else if (metric === "sc") {
    ranking = await fetchSCRanking(fromIso, toIso, channelMap);
  } else {
    ranking = fetchSubsRanking(channels);
  }

  function getGroup(channel: Channel): Group | undefined {
    if (!channel.group_id) return undefined;
    const g = groupMap.get(channel.group_id);
    if (!g) return undefined;
    if (g.parent_group_id) return groupMap.get(g.parent_group_id) ?? g;
    return g;
  }

  return (
    <div>
      {/* Breadcrumb + Header */}
      <div className="mb-6">
        <div className="mb-1 flex items-center gap-2 text-xs text-gray-400">
          <Link href="/" className="hover:text-violet-600 transition-colors">ホーム</Link>
          <span>›</span>
          <span>ランキング</span>
        </div>
        <h1 className="section-title text-xl font-bold text-gray-900">VTuberランキング</h1>
        <p className="mt-2 text-sm leading-relaxed text-gray-600">
          VTuberの<span className="font-medium">同時接続数（同接）・スーパーチャット金額・チャンネル登録者数</span>のランキングを期間別に表示します。
          今日・今週・今月の単位で、いま盛り上がっているVTuberや勢いのあるチャンネルを発見できます。
        </p>
      </div>

      {/* Period selector */}
      <div className="mb-4 flex items-center gap-2">
        <span className="text-xs text-gray-500 font-medium">期間</span>
        <div className="flex gap-1">
          {(["today", "week", "month"] as Period[]).map((p) => (
            <Link
              key={p}
              href={`/ranking?period=${p}&metric=${metric}`}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${
                period === p
                  ? "bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-sm"
                  : "border border-gray-200 bg-white/80 text-gray-500 hover:border-violet-200 hover:text-violet-600"
              }`}
            >
              {PERIOD_LABELS[p]}
            </Link>
          ))}
        </div>
      </div>

      {/* Metric selector */}
      <div className="mb-6 flex items-center gap-2">
        <span className="text-xs text-gray-500 font-medium">指標</span>
        <div className="flex gap-1">
          {(["viewers", "sc", "subs"] as Metric[]).map((m) => (
            <Link
              key={m}
              href={`/ranking?period=${period}&metric=${m}`}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${
                metric === m
                  ? "bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-sm"
                  : "border border-gray-200 bg-white/80 text-gray-500 hover:border-violet-200 hover:text-violet-600"
              }`}
            >
              {METRIC_LABELS[m]}
            </Link>
          ))}
        </div>
      </div>

      {/* Ranking list */}
      {ranking.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 py-24 text-center text-sm text-gray-400">
          この期間のデータがありません
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-violet-100/60 bg-white/90 shadow-[0_2px_12px_-2px_rgba(109,40,217,0.10)] backdrop-blur-sm">
          <div className="divide-y divide-gray-50">
            {ranking.map(({ channel, value, videoId }, i) => {
              const group = getGroup(channel);
              const rank = i + 1;
              const rankStyle =
                rank === 1
                  ? "bg-gradient-to-br from-amber-400 to-yellow-500 text-white shadow-[0_2px_6px_rgba(245,158,11,0.4)]"
                  : rank === 2
                  ? "bg-gradient-to-br from-gray-300 to-slate-400 text-white shadow-sm"
                  : rank === 3
                  ? "bg-gradient-to-br from-amber-700 to-orange-800 text-white shadow-sm"
                  : "bg-gray-100/80 text-gray-400";
              const href = metric === "viewers" && videoId
                ? `/live/${videoId}`
                : `/channel/${channel.channel_id}`;

              return (
                <Link
                  key={channel.channel_id}
                  href={href}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-violet-50/50"
                >
                  {/* Rank badge */}
                  <div
                    className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${rankStyle}`}
                  >
                    {rank <= 3 ? (rank === 1 ? "★" : rank) : rank}
                  </div>

                  {/* Avatar */}
                  {channel.icon_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={channel.icon_url}
                      alt={channel.name}
                      className="h-9 w-9 flex-shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <div
                      className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                      style={{ backgroundColor: group?.color ?? "#6b7280" }}
                    >
                      {channel.name[0]}
                    </div>
                  )}

                  {/* Name + group */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-gray-900">{channel.name}</p>
                    {group && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <span
                          className="inline-block h-2 w-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: group.color }}
                        />
                        <span className="text-xs text-gray-400 truncate">{group.name}</span>
                      </div>
                    )}
                  </div>

                  {/* Value */}
                  <span className="flex-shrink-0 text-sm font-bold text-violet-600">
                    {formatValue(value, metric)}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
