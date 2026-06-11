import type { Metadata } from "next";
import Link from "next/link";
import { unstable_cache } from "next/cache";
import { supabase } from "@/lib/supabase/client";
import type { Channel, Group } from "@/lib/types";
import { getJstMidnightMs } from "@/lib/jst";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "VTuberランキング | 同接・スパチャ・登録者数",
  description:
    "VTuberの同接ピーク・スーパーチャット金額・チャンネル登録者数のランキング。今日・今週・今月の3期間で、にじさんじ・ホロライブ・ぶいすぽっ！など人気VTuberの勢いを比較できます。",
  alternates: { canonical: "/ranking" },
};

const METRIC_DESCRIPTIONS: Record<Metric, string> = {
  viewers:
    "同接ピーク（同時接続数の最大値）は、配信中にもっとも多くの視聴者が集まった瞬間の人数です。配信全体の盛り上がりを示す代表的な指標として広く使われています。vtrackerでは、サンプリングして記録した値の中で最大のものをピーク値として扱っています。",
  sc:
    "スーパーチャット（スパチャ）はYouTubeの投げ銭機能で、視聴者がチャット欄に金額付きメッセージを送れる仕組みです。海外通貨で送られたスパチャは、配信時点の為替レートで日本円に換算した合計金額を表示しています。",
  subs:
    "チャンネル登録者数（YouTubeの場合）またはフォロワー数（Twitchの場合）です。配信者の累計人気を示す基礎指標で、vtrackerでは時系列で履歴を保持しています。",
};

const PERIOD_DESCRIPTIONS: Record<Period, string> = {
  today: "本日0時（日本時間）から現在までの集計です。ライブ配信の進行に伴ってリアルタイムに更新されます。",
  week: "現在から過去7日間の集計です。週単位で勢いのあるVTuberを見つけたい場合に適しています。",
  month: "現在から過去30日間の集計です。月単位での総合的な人気度・盛り上がりを比較できます。",
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

      {/* Metric description */}
      <div className="mb-6 rounded-xl border border-violet-100/60 bg-violet-50/40 p-4 text-xs leading-relaxed text-gray-600">
        <p className="mb-1.5">
          <span className="font-semibold text-gray-800">「{PERIOD_LABELS[period]} × {METRIC_LABELS[metric]}」のランキング</span>
        </p>
        <p className="mb-2">{PERIOD_DESCRIPTIONS[period]}</p>
        <p>{METRIC_DESCRIPTIONS[metric]}</p>
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

      {/* 解説セクション */}
      <section className="mt-12 border-t border-gray-100 pt-10 text-sm leading-relaxed text-gray-600">
        <h2 className="mb-4 text-lg font-bold text-gray-900">VTuberランキングの見方</h2>
        <div className="space-y-4">
          <p>
            vtrackerのランキングは、VTuber（バーチャルYouTuber）の活動を「視聴者の動き」「課金支援」「累計人気」の
            3つの観点から数値化し、期間別に並び替えたものです。にじさんじ・ホロライブ・ぶいすぽっ！などの
            大手事務所所属VTuberから、個人勢まで幅広く対象としています。
          </p>

          <div>
            <h3 className="mb-1 font-semibold text-gray-800">同接ピークランキング</h3>
            <p>
              配信中に記録した同時接続数の最大値で順位を決定します。
              同接ピークは「その瞬間に何人が同じ配信を見ていたか」を示す指標で、
              配信の盛り上がりや話題性を測る代表的な数値です。
              vtrackerでは、配信中におよそ1分間隔で取得した値の最大値を採用しています。
            </p>
          </div>

          <div>
            <h3 className="mb-1 font-semibold text-gray-800">スパチャランキング</h3>
            <p>
              対象期間内に行われた配信におけるスーパーチャット金額の合計で順位を決定します。
              海外視聴者からのドル・ユーロ・ウォン・台湾ドル等のスパチャは、
              配信時点の為替レートで日本円に換算して合算しています。
              スパチャは視聴者からの直接的な応援を示すため、熱量の高いコミュニティを持つVTuberが
              上位に入りやすい傾向があります。
            </p>
          </div>

          <div>
            <h3 className="mb-1 font-semibold text-gray-800">登録者数ランキング</h3>
            <p>
              現時点でのチャンネル登録者数（YouTube）またはフォロワー数（Twitch）で順位を決定します。
              累計の人気度・知名度を示す基礎指標で、長期的な活動の積み重ねが反映されます。
              新人VTuberの伸びを定点観測したい場合は、チャンネルページの「登録者推移グラフ」も
              合わせてご確認ください。
            </p>
          </div>

          <div>
            <h3 className="mb-1 font-semibold text-gray-800">期間の区切り方</h3>
            <p>
              「今日」は日本時間（JST）の0時を区切りとして集計します。
              「今週」「今月」はそれぞれ「現在から過去7日間」「現在から過去30日間」の集計で、
              曜日や月初の区切りとは独立しています。これは「直近の勢い」をなるべくリアルタイムに
              反映するためです。
            </p>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap gap-3 text-sm">
          <Link href="/" className="text-violet-600 hover:underline">ホームへ</Link>
          <span className="text-gray-200">·</span>
          <Link href="/groups" className="text-violet-600 hover:underline">グループ一覧</Link>
          <span className="text-gray-200">·</span>
          <Link href="/compare" className="text-violet-600 hover:underline">チャンネル比較</Link>
          <span className="text-gray-200">·</span>
          <Link href="/about" className="text-violet-600 hover:underline">サービスについて</Link>
        </div>
      </section>
    </div>
  );
}
