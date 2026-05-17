import { supabase } from "@/lib/supabase/client";
import type { Channel, Video, Superchat, Group } from "@/lib/types";
import { getJstMidnightMs } from "@/lib/jst";
import VideoCard from "./components/VideoCard";
import Marquee from "./components/Marquee";
import ChannelAvatar from "./components/ChannelAvatar";
import LiveSection from "./components/LiveSection";
import ChannelListSection from "./components/ChannelListSection";
import type { LineConfig } from "./components/CombinedLiveGraph";
import Link from "next/link";

export const dynamic = "force-dynamic";

const BUCKET_MS = 5 * 60 * 1000;
const LINE_COLORS = ["#7c3aed", "#e11d48", "#0891b2", "#d97706", "#16a34a", "#9333ea", "#64748b"];

type SCRow = Pick<Superchat, "video_id" | "amount" | "amount_jpy" | "currency">;
type GraphPoint = { video_id: string; concurrent_viewers: number; recorded_at: string };

async function fetchData() {
  const jstMidnightMs = getJstMidnightMs();
  try {
    const [chRes, vRes, scRes, grRes, gpRes] = await Promise.all([
      supabase.from("channels").select("*").order("subscriber_count", { ascending: false }),
      supabase.from("videos").select("*").order("start_time", { ascending: false }).limit(500),
      supabase.from("superchats").select("video_id, amount, amount_jpy, currency").limit(5000),
      supabase.from("groups").select("*").order("name"),
      supabase
        .from("live_graph_points")
        .select("video_id, concurrent_viewers, recorded_at")
        .gte("recorded_at", new Date(jstMidnightMs).toISOString())
        .order("recorded_at", { ascending: true }),
    ]);
    return {
      channels: (chRes.data ?? []) as Channel[],
      videos: (vRes.data ?? []) as Video[],
      superchats: (scRes.data ?? []) as SCRow[],
      groups: (grRes.data ?? []) as Group[],
      todayPoints: (gpRes.data ?? []) as GraphPoint[],
      error:
        chRes.error?.message ?? vRes.error?.message ??
        scRes.error?.message ?? grRes.error?.message ?? gpRes.error?.message ?? null,
    };
  } catch (e) {
    return { channels: [], videos: [], superchats: [], groups: [], todayPoints: [], error: String(e) };
  }
}

function scTotalByVideo(superchats: SCRow[]): Record<string, number> {
  return superchats.reduce<Record<string, number>>((acc, sc) => {
    const jpy = sc.amount_jpy ?? (sc.currency === "JPY" ? sc.amount : 0);
    acc[sc.video_id] = (acc[sc.video_id] ?? 0) + jpy;
    return acc;
  }, {});
}

function scTotalByChannel(videos: Video[], scByVideo: Record<string, number>): Record<string, number> {
  return videos.reduce<Record<string, number>>((acc, v) => {
    acc[v.channel_id] = (acc[v.channel_id] ?? 0) + (scByVideo[v.video_id] ?? 0);
    return acc;
  }, {});
}

function buildCombinedGraph(
  liveVideos: Video[],
  channelMap: Map<string, Channel>,
  points: GraphPoint[],
): { merged: Record<string, number | string | null>[]; lines: LineConfig[] } {
  const channelVideoCount = new Map<string, number>();
  liveVideos.forEach((v) => {
    channelVideoCount.set(v.channel_id, (channelVideoCount.get(v.channel_id) ?? 0) + 1);
  });
  const channelVideoIndex = new Map<string, number>();

  const lines: LineConfig[] = liveVideos.map((v, i) => {
    const baseName = channelMap.get(v.channel_id)?.name ?? v.channel_id;
    let channelName = baseName;
    if ((channelVideoCount.get(v.channel_id) ?? 1) > 1) {
      const idx = (channelVideoIndex.get(v.channel_id) ?? 0) + 1;
      channelVideoIndex.set(v.channel_id, idx);
      channelName = `${baseName} #${idx}`;
    }
    return {
      key: v.video_id,
      channelName,
      color: LINE_COLORS[i % LINE_COLORS.length],
      videoId: v.video_id,
      iconUrl: channelMap.get(v.channel_id)?.icon_url ?? undefined,
    };
  });

  const liveIds = new Set(liveVideos.map((v) => v.video_id));
  const allBuckets = new Set<number>();
  const byVideoAndBucket = new Map<string, Map<number, number[]>>();

  for (const p of points) {
    if (!liveIds.has(p.video_id)) continue;
    const bucket = Math.floor(new Date(p.recorded_at).getTime() / BUCKET_MS) * BUCKET_MS;
    allBuckets.add(bucket);
    if (!byVideoAndBucket.has(p.video_id)) byVideoAndBucket.set(p.video_id, new Map());
    const vm = byVideoAndBucket.get(p.video_id)!;
    if (!vm.has(bucket)) vm.set(bucket, []);
    vm.get(bucket)!.push(p.concurrent_viewers);
  }

  if (allBuckets.size < 2) return { merged: [], lines };

  const sorted = Array.from(allBuckets).sort((a, b) => a - b);
  const merged = sorted.map((bucket) => {
    const t = new Date(bucket).toLocaleTimeString("ja-JP", {
      hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tokyo",
    });
    const row: Record<string, number | string | null> = { t };
    for (const { key } of lines) {
      const vals = byVideoAndBucket.get(key)?.get(bucket);
      row[key] = vals ? Math.round(vals.reduce((s, x) => s + x, 0) / vals.length) : null;
    }
    return row;
  });

  return { merged, lines };
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ group?: string }>;
}) {
  const { group: selectedGroup } = await searchParams;
  const { channels, videos, superchats, groups, todayPoints, error } = await fetchData();

  const scByVideo = scTotalByVideo(superchats);
  const scByChannel = scTotalByChannel(videos, scByVideo);
  const groupMap = new Map(groups.map((g) => [g.id, g]));
  const channelMap = new Map(channels.map((c) => [c.channel_id, c]));
  const videoMap = new Map(videos.map((v) => [v.video_id, v]));

  const filteredChannels = selectedGroup
    ? channels.filter((c) => c.group_id === selectedGroup)
    : channels;
  const filteredChannelIds = new Set(filteredChannels.map((c) => c.channel_id));

  const liveVideos = videos
    .filter((v) => v.status === "live")
    .filter((v) => !selectedGroup || filteredChannelIds.has(v.channel_id));

  // 今日のサマリー集計
  const todayVideoIds = [...new Set(todayPoints.map((p) => p.video_id))];
  const todayVideos = todayVideoIds
    .map((id) => videoMap.get(id))
    .filter((v): v is Video => v != null);

  // グループフィルター中は選択グループのみに絞る
  const groupFilteredVideos = selectedGroup
    ? todayVideos.filter((v) => filteredChannelIds.has(v.channel_id))
    : todayVideos;

  const scRanking = groupFilteredVideos
    .map((v) => ({
      video: v,
      channel: channelMap.get(v.channel_id),
      sc: scByVideo[v.video_id] ?? 0,
    }))
    .filter((x) => x.sc > 0)
    .sort((a, b) => b.sc - a.sc)
    .slice(0, 5);

  const todaySCTotal = groupFilteredVideos.reduce((s, v) => s + (scByVideo[v.video_id] ?? 0), 0);

  const finishedToday = groupFilteredVideos
    .filter((v) => v.status !== "live")
    .sort((a, b) => (b.start_time ?? "").localeCompare(a.start_time ?? ""));

  // 各動画の最新視聴者数（todayPoints は recorded_at 昇順なので後勝ち）
  const latestViewers = new Map<string, number>();
  for (const p of todayPoints) {
    latestViewers.set(p.video_id, p.concurrent_viewers);
  }

  // ライブ中の合体グラフデータ
  const { merged: graphData, lines: graphLines } = buildCombinedGraph(liveVideos, channelMap, todayPoints);

  // チャンネルごとの最新動画情報（クライアントコンポーネントに渡す）
  const latestByChannel: Record<string, { status: string; startTime: string | null }> = {};
  for (const ch of channels) {
    const chVideos = videos.filter((v) => v.channel_id === ch.channel_id);
    const latest = chVideos.find((v) => v.status === "live") ?? chVideos[0];
    if (latest) latestByChannel[ch.channel_id] = { status: latest.status, startTime: latest.start_time ?? null };
  }

  return (
    <div>
      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          DB エラー: {error}
        </div>
      )}

      {/* 今日のまとめ */}
      <section className="mb-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
            <span className="h-4 w-1 rounded-full bg-violet-500" />
            今日のまとめ
          </h2>
          <Link href="/today" className="text-xs text-violet-400 transition-colors hover:text-violet-600">
            24時間タイムライン →
          </Link>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <StatMini label="今日の配信数" value={`${todayVideos.length}`} unit="本" color="violet" />
          <StatMini label="現在ライブ中" value={`${liveVideos.length}`} unit="本" color="red" />
          <StatMini
            label="今日のスパチャ"
            value={todaySCTotal > 0 ? `¥${todaySCTotal.toLocaleString()}` : "—"}
            color="amber"
          />
        </div>

        {todayVideos.length === 0 && liveVideos.length === 0 && (
          <div className="mt-4 rounded-xl border border-dashed border-gray-200 p-8 text-center text-sm text-gray-400">
            今日の配信データはまだありません
          </div>
        )}
      </section>

      {/* ライブ中グラフ / 終了済み配信 */}
      {liveVideos.length > 0 ? (
        <section className="mb-8">
          <LiveSection
            entries={liveVideos.map((v) => {
              const ch = channelMap.get(v.channel_id);
              const group = ch?.group_id ? groupMap.get(ch.group_id) : undefined;
              return {
                videoId: v.video_id,
                title: v.title,
                channelName: ch?.name ?? v.channel_id,
                channelId: v.channel_id,
                iconUrl: ch?.icon_url ?? "",
                startTime: v.start_time,
                groupName: group?.name ?? null,
                groupColor: group?.color ?? null,
                viewers: latestViewers.get(v.video_id) ?? null,
              };
            })}
            graphData={graphData}
            graphLines={graphLines}
          />
        </section>
      ) : finishedToday.length > 0 ? (
        <section className="mb-8">
          <h2 className="mb-4 text-base font-semibold text-gray-900">終了済み配信</h2>
          {(() => {
            const row1 = finishedToday.filter((_, i) => i % 2 === 0);
            const row2 = finishedToday.filter((_, i) => i % 2 === 1);
            const card = (v: typeof finishedToday[0]) => {
              const ch = channelMap.get(v.channel_id);
              return (
                <div key={v.video_id} className="w-52 flex-shrink-0">
                  <VideoCard
                    videoId={v.video_id}
                    title={v.title}
                    channelId={v.channel_id}
                    channelName={ch?.name ?? v.channel_id}
                    iconUrl={ch?.icon_url ?? ""}
                    thumbnailUrl={v.thumbnail_url}
                    status={v.status}
                    startTime={v.start_time}
                    superchatTotal={scByVideo[v.video_id] ?? 0}
                  />
                </div>
              );
            };
            return (
              <div className="flex flex-col gap-3">
                <Marquee itemCount={row1.length}>{row1.map(card)}</Marquee>
                {row2.length > 0 && (
                  <Marquee itemCount={row2.length} reverse>{row2.map(card)}</Marquee>
                )}
              </div>
            );
          })()}
        </section>
      ) : null}

      {/* スパチャランキング */}
      {scRanking.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-gray-900">
            <span className="h-3.5 w-1 rounded-full bg-amber-400" />
            今日のスパチャ
          </h2>
          <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-amber-50 via-white to-violet-50 p-px shadow-sm ring-1 ring-amber-100">
            <div className="rounded-[15px] bg-white/90 backdrop-blur-sm">
              {scRanking.map(({ video, channel, sc }, i) => (
                <Link
                  key={video.video_id}
                  href={`/live/${video.video_id}`}
                  className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-amber-50/60 first:rounded-t-[15px] last:rounded-b-[15px] [&:not(:last-child)]:border-b [&:not(:last-child)]:border-amber-50"
                >
                  <span className={`w-5 flex-shrink-0 text-center text-xs font-bold tabular-nums ${
                    i === 0 ? "text-amber-400" : i === 1 ? "text-gray-400" : i === 2 ? "text-orange-400" : "text-gray-300"
                  }`}>{i + 1}</span>
                  <ChannelAvatar
                    channelId={video.channel_id}
                    name={channel?.name ?? ""}
                    iconUrl={channel?.icon_url ?? undefined}
                    size={28}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-gray-800">{channel?.name ?? video.channel_id}</p>
                    <p className="truncate text-[11px] text-gray-400">{video.title}</p>
                  </div>
                  <span className="flex-shrink-0 text-sm font-bold text-amber-600">
                    ¥{sc.toLocaleString()}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* チャンネル一覧 */}
      <ChannelListSection
        channels={channels}
        groups={groups}
        scByChannel={scByChannel}
        latestByChannel={latestByChannel}
        initialGroup={selectedGroup}
      />
    </div>
  );
}

function StatMini({ label, value, unit, color = "gray" }: {
  label: string; value: string; unit?: string;
  color?: "violet" | "red" | "amber" | "gray";
}) {
  const s = {
    violet: { wrap: "from-violet-50 to-white border-violet-100", val: "text-violet-700" },
    red:    { wrap: "from-red-50 to-white border-red-100",       val: "text-red-600" },
    amber:  { wrap: "from-amber-50 to-white border-amber-100",   val: "text-amber-600" },
    gray:   { wrap: "from-gray-50 to-white border-gray-200",     val: "text-gray-900" },
  }[color];
  return (
    <div className={`rounded-2xl border bg-gradient-to-br px-3 py-4 shadow-sm sm:px-4 ${s.wrap}`}>
      <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400 sm:text-[11px]">{label}</p>
      <p className={`mt-1.5 text-xl font-bold tabular-nums sm:text-2xl ${s.val}`}>
        {value}
        {unit && <span className="ml-1 text-xs font-normal text-gray-400">{unit}</span>}
      </p>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-gray-300 p-12 text-center">
      <p className="text-sm text-gray-400">{text}</p>
    </div>
  );
}
