import { supabase } from "@/lib/supabase/client";
import type { Channel, Video, Group, GroupCategory, LiveGraphPoint } from "@/lib/types";
import { getJstMidnightMs } from "@/lib/jst";
import ChannelAvatar from "@/app/components/ChannelAvatar";
import ChannelCard from "@/app/components/ChannelCard";
import CombinedLiveGraph from "@/app/components/CombinedLiveGraph";
import type { LineConfig } from "@/app/components/CombinedLiveGraph";
import LiveBanner from "@/app/components/LiveBanner";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

async function fetchGroup(slugOrId: string): Promise<Group | null> {
  const { data } = await supabase
    .from("groups")
    .select("*")
    .or(`id.eq.${slugOrId},slug.eq.${slugOrId}`);
  return (data?.[0] as Group) ?? null;
}

export async function generateStaticParams() {
  const { data } = await supabase.from("groups").select("id, slug");
  return (data ?? []).flatMap((g) => {
    const params = [{ groupId: g.id as string }];
    if (g.slug && g.slug !== g.id) params.push({ groupId: g.slug as string });
    return params;
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ groupId: string }>;
}): Promise<Metadata> {
  const { groupId } = await params;
  const group = await fetchGroup(groupId);
  const [, { count }] = await Promise.all([
    Promise.resolve(null),
    group
      ? supabase.from("channels").select("*", { count: "exact", head: true }).eq("group_id", group.id)
      : Promise.resolve({ count: 0 }),
  ]);
  if (!group) return { title: "グループが見つかりません" };

  const g = group as Group;
  const title = g.name;
  const description = `${g.name}の所属VTuberチャンネル${count ?? 0}件のライブ配信・視聴者数をリアルタイム追跡`;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: g.icon_url ? [{ url: g.icon_url, alt: g.name }] : [],
    },
    twitter: { card: "summary", title, description },
  };
}

const BUCKET_MS = 5 * 60 * 1000;
const LINE_COLORS = ["#7c3aed", "#e11d48", "#0891b2", "#d97706", "#16a34a", "#9333ea", "#64748b"];

function buildLiveGraph(
  liveVideos: Video[],
  channelMap: Map<string, Channel>,
  points: { video_id: string; concurrent_viewers: number; recorded_at: string }[],
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

const CATEGORY_LABEL: Record<GroupCategory, string> = {
  vtuber: "VTuber事務所",
  esports: "Eスポーツ",
  indie: "個人勢",
  other: "その他",
};

export default async function GroupPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  const jstMidnightMs = getJstMidnightMs();

  const [group, allGroupsRes] = await Promise.all([
    fetchGroup(groupId),
    supabase.from("groups").select("*"),
  ]);
  if (!group) notFound();

  const channelsRes = await supabase
    .from("channels")
    .select("*")
    .eq("group_id", group.id)
    .order("subscriber_count", { ascending: false });

  const allGroups = (allGroupsRes.data ?? []) as Group[];
  const channels = (channelsRes.data ?? []) as Channel[];
  const channelIds = channels.map((c) => c.channel_id);
  const channelMap = new Map(channels.map((c) => [c.channel_id, c]));

  const parentGroup = group.parent_group_id ? allGroups.find((g) => g.id === group.parent_group_id) : null;
  const childGroups = allGroups.filter((g) => g.parent_group_id === groupId);

  const videosRes = channelIds.length > 0
    ? await supabase.from("videos").select("*").in("channel_id", channelIds).order("start_time", { ascending: false })
    : { data: [] };

  const videos = (videosRes.data ?? []) as Video[];

  // グラフポイントはこのグループの動画IDのみ取得
  const groupVideoIds = videos
    .filter((v) => v.start_time && new Date(v.start_time).getTime() >= jstMidnightMs - 12 * 60 * 60 * 1000)
    .map((v) => v.video_id);

  const gpRes = groupVideoIds.length > 0
    ? await supabase
        .from("live_graph_points")
        .select("video_id, concurrent_viewers, recorded_at")
        .gte("recorded_at", new Date(jstMidnightMs).toISOString())
        .in("video_id", groupVideoIds)
    : { data: [] };
  const graphPoints = (gpRes.data ?? []) as Pick<LiveGraphPoint, "video_id" | "concurrent_viewers" | "recorded_at">[];

  const scVideoIds = videos
    .filter((v) => v.start_time && new Date(v.start_time).getTime() >= jstMidnightMs)
    .map((v) => v.video_id);
  const { data: scData } = scVideoIds.length > 0
    ? await supabase.from("superchats").select("video_id, amount, amount_jpy, currency").in("video_id", scVideoIds)
    : { data: [] };

  const scByVideo = (scData ?? []).reduce<Record<string, number>>((acc, sc) => {
    const jpy = (sc as { amount_jpy?: number | null; currency: string; amount: number }).amount_jpy
      ?? ((sc as { currency: string; amount: number }).currency === "JPY" ? (sc as { amount: number }).amount : 0);
    acc[(sc as { video_id: string }).video_id] = (acc[(sc as { video_id: string }).video_id] ?? 0) + jpy;
    return acc;
  }, {});
  const scByChannel = videos.reduce<Record<string, number>>((acc, v) => {
    acc[v.channel_id] = (acc[v.channel_id] ?? 0) + (scByVideo[v.video_id] ?? 0);
    return acc;
  }, {});

  const latestVideoByChannel = new Map<string, Video>();
  for (const v of videos) {
    const existing = latestVideoByChannel.get(v.channel_id);
    if (!existing || (v.status === "live" && existing.status !== "live")) {
      latestVideoByChannel.set(v.channel_id, v);
    }
  }

  const videoMap = new Map(videos.map((v) => [v.video_id, v]));
  const liveVideos = videos.filter((v) => v.status === "live");

  const liveChannelIds = new Set(liveVideos.map((v) => v.channel_id));
  const sortedChannels = [...channels].sort((a, b) => {
    const aLive = liveChannelIds.has(a.channel_id) ? 0 : 1;
    const bLive = liveChannelIds.has(b.channel_id) ? 0 : 1;
    if (aLive !== bLive) return aLive - bLive;
    return b.subscriber_count - a.subscriber_count;
  });
  const { merged: liveGraphData, lines: liveGraphLines } = buildLiveGraph(liveVideos, channelMap, graphPoints);

  const todayVideoIds = [...new Set(graphPoints.map((p) => p.video_id))].filter((id) => {
    const v = videoMap.get(id);
    return v && channelIds.includes(v.channel_id);
  });

  const peakByVideo = new Map<string, number>();
  for (const p of graphPoints) {
    peakByVideo.set(p.video_id, Math.max(peakByVideo.get(p.video_id) ?? 0, p.concurrent_viewers));
  }

  const peakRanking = todayVideoIds
    .map((vid) => ({
      video: videoMap.get(vid)!,
      channel: channelMap.get(videoMap.get(vid)?.channel_id ?? ""),
      peak: peakByVideo.get(vid) ?? 0,
    }))
    .filter((x) => x.video)
    .sort((a, b) => b.peak - a.peak)
    .slice(0, 10);

  const color = group.color ?? "#7c3aed";

  return (
    <div>
      {/* パンくず */}
      <div className="mb-4 flex items-center gap-1.5 text-xs text-gray-400">
        <Link href="/" className="hover:text-violet-600">ホーム</Link>
        <span>›</span>
        {parentGroup && (
          <>
            <Link href={`/group/${parentGroup.slug ?? parentGroup.id}`} className="hover:text-violet-600">{parentGroup.name}</Link>
            <span>›</span>
          </>
        )}
        <span className="text-gray-600">{group.name}</span>
      </div>

      {/* ── ヒーローバナー ── */}
      <div
        className="relative -mx-4 mb-8 overflow-hidden px-6 py-10 sm:rounded-2xl sm:mx-0"
        style={{ background: `linear-gradient(135deg, ${color}ee 0%, ${color}99 100%)` }}
      >
        {/* 背景: アイコンをぼかして敷く */}
        {group.icon_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={group.icon_url}
            alt=""
            className="pointer-events-none absolute inset-0 h-full w-full scale-110 object-cover opacity-10 blur-3xl"
          />
        )}
        {/* メッシュグラデーション */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/20" />

        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center">
          {/* アイコン */}
          <div
            className="flex h-24 w-24 flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl shadow-2xl ring-4 ring-white/30"
            style={{ backgroundColor: `${color}55` }}
          >
            {group.icon_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={group.icon_url} alt={group.name} className="h-full w-full object-cover" />
            ) : (
              <span className="text-4xl font-bold text-white drop-shadow">{group.name[0]}</span>
            )}
          </div>

          {/* テキスト */}
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              {group.category && (
                <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-medium text-white/90 backdrop-blur-sm">
                  {CATEGORY_LABEL[group.category]}
                </span>
              )}
            </div>
            <h1 className="text-3xl font-extrabold text-white drop-shadow-sm sm:text-4xl">{group.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-white/80">
              <span>{channels.length} チャンネル</span>
              {liveVideos.length > 0 && (
                <span className="flex items-center gap-1">
                  <span className="animate-pulse">●</span>
                  {liveVideos.length} ライブ中
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* サブグループ */}
      {childGroups.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-base font-semibold text-gray-900">サブグループ</h2>
          <div className="flex flex-wrap gap-2">
            {childGroups.map((g) => (
              <Link
                key={g.id}
                href={`/group/${g.slug ?? g.id}`}
                className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-1.5 text-sm text-gray-700 shadow-sm transition-colors hover:border-violet-300 hover:text-violet-600"
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: g.color }} />
                {g.name}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ライブ中 */}
      {liveVideos.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-gray-900">
            <span className="animate-pulse text-red-500">●</span>
            ライブ中
            <span className="font-normal text-gray-400">({liveVideos.length})</span>
          </h2>
          <div className="flex flex-col gap-2 mb-4">
            {liveVideos.map((v) => {
              const ch = channelMap.get(v.channel_id);
              return (
                <LiveBanner
                  key={v.video_id}
                  videoId={v.video_id}
                  title={v.title}
                  channelName={ch?.name ?? v.channel_id}
                  channelId={v.channel_id}
                  iconUrl={ch?.icon_url ?? ""}
                  startTime={v.start_time}
                />
              );
            })}
          </div>
          {liveGraphData.length >= 2 ? (
            <CombinedLiveGraph data={liveGraphData} lines={liveGraphLines} />
          ) : (
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {liveVideos.map((v) => {
                const ch = channelMap.get(v.channel_id);
                return (
                  <a
                    key={v.video_id}
                    href={`/live/${v.video_id}`}
                    className="group flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-opacity hover:opacity-90"
                  >
                    <div className="relative aspect-video w-full overflow-hidden bg-gray-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`https://img.youtube.com/vi/${v.video_id}/hqdefault.jpg`}
                        alt={v.title}
                        className="h-full w-full object-cover"
                      />
                      <span className="absolute left-2 top-2 rounded bg-red-500 px-1.5 py-0.5 text-xs font-medium text-white">
                        ● LIVE
                      </span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-2">
                      <ChannelAvatar channelId={v.channel_id} name={ch?.name ?? ""} iconUrl={ch?.icon_url ?? ""} size={20} />
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-gray-900 group-hover:text-violet-600">{ch?.name ?? v.channel_id}</p>
                        <p className="truncate text-[11px] text-gray-500">{v.title}</p>
                      </div>
                    </div>
                  </a>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* 今日のピーク同接 */}
      {peakRanking.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-base font-semibold text-gray-900">今日のピーク同接</h2>
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="divide-y divide-gray-100">
              {peakRanking.map(({ video, channel, peak }, i) => (
                <Link
                  key={video.video_id}
                  href={`/live/${video.video_id}`}
                  className="flex items-center gap-3 py-2.5 transition-opacity hover:opacity-70"
                >
                  <span className={`w-5 flex-shrink-0 text-center text-xs font-bold ${i < 3 ? "text-amber-400" : "text-gray-300"}`}>
                    {i + 1}
                  </span>
                  <ChannelAvatar
                    channelId={video.channel_id}
                    name={channel?.name ?? ""}
                    iconUrl={channel?.icon_url ?? undefined}
                    size={32}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-800">{channel?.name ?? video.channel_id}</p>
                    <p className="truncate text-xs text-gray-400">{video.title}</p>
                  </div>
                  <span className="flex-shrink-0 font-bold" style={{ color }}>{peak.toLocaleString()}人</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 所属チャンネル */}
      <section>
        <h2 className="mb-4 text-base font-semibold text-gray-900">
          所属チャンネル
          <span className="ml-2 text-sm font-normal text-gray-400">({channels.length}件)</span>
        </h2>
        {sortedChannels.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 p-12 text-center text-sm text-gray-400">
            チャンネルがありません
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {sortedChannels.map((ch) => {
              const latest = latestVideoByChannel.get(ch.channel_id);
              return (
                <ChannelCard
                  key={ch.channel_id}
                  channelId={ch.channel_id}
                  name={ch.name}
                  customUrl={ch.custom_url}
                  iconUrl={ch.icon_url}
                  subscriberCount={ch.subscriber_count}
                  totalSuperchat={scByChannel[ch.channel_id] ?? 0}
                  latestVideoStatus={latest?.status ?? "none"}
                  latestVideoStartTime={latest?.start_time ?? null}
                  groupName={group.name}
                  groupColor={group.color}
                  groupIconUrl={group.icon_url}
                />
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
