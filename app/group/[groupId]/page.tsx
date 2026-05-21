import type { Metadata } from "next";
import { supabase } from "@/lib/supabase/client";
import type { Channel, Video, Group, GroupCategory, LiveGraphPoint } from "@/lib/types";
import { GRAPH_COLORS, GRAPH_BUCKET_MS } from "@/lib/chartConfig";
import { getJstMidnightMs } from "@/lib/jst";
import ChannelAvatar from "@/app/components/ChannelAvatar";
import ChannelCard from "@/app/components/ChannelCard";
import CombinedLiveGraph from "@/app/components/CombinedLiveGraph";
import type { LineConfig } from "@/app/components/CombinedLiveGraph";
import LiveBanner from "@/app/components/LiveBanner";
import Link from "next/link";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ groupId: string }>;
}): Promise<Metadata> {
  const { groupId } = await params;
  const { data } = await supabase
    .from("groups")
    .select("name, icon_url")
    .eq("id", groupId)
    .single();
  if (!data) return {};
  const g = data as { name: string; icon_url: string | null };
  const description = `${g.name}に所属するVTuberの視聴者数・スパチャ・配信状況をまとめて確認。`;
  const images = g.icon_url ? [{ url: g.icon_url }] : [];
  return {
    title: g.name,
    description,
    openGraph: { title: `${g.name} | vtracker`, description, images },
    twitter: { card: "summary", title: `${g.name} | vtracker`, description, images },
  };
}

const BUCKET_MS = GRAPH_BUCKET_MS;
const LINE_COLORS = GRAPH_COLORS;

function buildLiveGraph(
  liveVideos: Video[],
  channelMap: Map<string, Channel>,
  points: { video_id: string; concurrent_viewers: number; recorded_at: string }[],
): { merged: Record<string, number | string | null>[]; lines: LineConfig[] } {
  const lines: LineConfig[] = liveVideos.map((v, i) => ({
    key: v.video_id,
    channelName: channelMap.get(v.channel_id)?.name ?? v.channel_id,
    color: LINE_COLORS[i % LINE_COLORS.length],
    videoId: v.video_id,
    iconUrl: channelMap.get(v.channel_id)?.icon_url ?? undefined,
  }));

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

const CATEGORY_STYLE: Record<GroupCategory, string> = {
  vtuber: "bg-violet-100 text-violet-700",
  esports: "bg-cyan-100 text-cyan-700",
  indie: "bg-amber-100 text-amber-700",
  other: "bg-gray-100 text-gray-600",
};

function formatCount(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(0)}万`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toLocaleString();
}

export default async function GroupPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  const jstMidnightMs = getJstMidnightMs();

  const [groupRes, allGroupsRes, channelsRes] = await Promise.all([
    supabase.from("groups").select("*").eq("id", groupId).single(),
    supabase.from("groups").select("*").order("sort_order", { ascending: true, nullsFirst: false }).order("name"),
    supabase
      .from("channels")
      .select("*")
      .eq("group_id", groupId)
      .order("subscriber_count", { ascending: false }),
  ]);

  const group = groupRes.data as Group | null;
  if (!group) {
    return (
      <div className="py-20 text-center text-gray-400">
        <p>グループが見つかりません</p>
        <Link href="/" className="mt-3 inline-block text-sm text-violet-500 hover:underline">ホームへ戻る</Link>
      </div>
    );
  }

  const allGroups = (allGroupsRes.data ?? []) as Group[];
  const channels = (channelsRes.data ?? []) as Channel[];
  const channelIds = channels.map((c) => c.channel_id);
  const channelMap = new Map(channels.map((c) => [c.channel_id, c]));

  const parentGroup = group.parent_group_id ? allGroups.find((g) => g.id === group.parent_group_id) : null;
  const childGroups = allGroups.filter((g) => g.parent_group_id === groupId);

  const [videosRes, gpRes] = channelIds.length > 0
    ? await Promise.all([
        supabase.from("videos").select("*").in("channel_id", channelIds).order("start_time", { ascending: false }),
        supabase
          .from("live_graph_points")
          .select("video_id, concurrent_viewers, recorded_at")
          .gte("recorded_at", new Date(jstMidnightMs).toISOString()),
      ])
    : [{ data: [] }, { data: [] }];

  const videos = (videosRes.data ?? []) as Video[];
  const graphPoints = (gpRes.data ?? []) as Pick<LiveGraphPoint, "video_id" | "concurrent_viewers" | "recorded_at">[];

  const videoMap = new Map(videos.map((v) => [v.video_id, v]));
  const liveVideos = videos.filter((v) => v.status === "live");
  const { merged: liveGraphData, lines: liveGraphLines } = buildLiveGraph(liveVideos, channelMap, graphPoints);

  // Latest video status per channel for ChannelCard
  const latestByChannel: Record<string, { status: string; startTime: string | null }> = {};
  for (const ch of channels) {
    const chVideos = videos.filter((v) => v.channel_id === ch.channel_id);
    const live = chVideos.find((v) => v.status === "live");
    const upcoming = chVideos.find((v) => v.status === "upcoming");
    const latest = live ?? upcoming ?? chVideos[0];
    if (latest) {
      latestByChannel[ch.channel_id] = { status: latest.status, startTime: latest.start_time };
    }
  }

  // YouTube/Twitch 同一人物の重複除去
  const linkedToIds = new Set(
    channels.filter((c) => c.linked_channel_id).map((c) => c.linked_channel_id as string)
  );
  const shownAsLinked = new Set<string>();
  for (const ch of channels) {
    if (!ch.linked_channel_id) continue;
    const isYt = !ch.platform || ch.platform === "youtube";
    const isChPointedTo = linkedToIds.has(ch.channel_id);
    if (!isChPointedTo || isYt) shownAsLinked.add(ch.linked_channel_id);
  }
  const deduped = channels.filter((c) => !shownAsLinked.has(c.channel_id));

  const STATUS_ORDER: Record<string, number> = { live: 0, upcoming: 1 };
  const sortedChannels = [...deduped].sort((a, b) => {
    const sa = STATUS_ORDER[latestByChannel[a.channel_id]?.status ?? ""] ?? 2;
    const sb = STATUS_ORDER[latestByChannel[b.channel_id]?.status ?? ""] ?? 2;
    if (sa !== sb) return sa - sb;
    return b.subscriber_count - a.subscriber_count;
  });

  const todayVideoIds = [...new Set(graphPoints.map((p) => p.video_id))].filter(
    (id) => {
      const v = videoMap.get(id);
      return v && channelIds.includes(v.channel_id);
    }
  );

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

  return (
    <div>
      {/* Group header */}
      <div className="mb-2 flex items-center gap-2 text-sm text-gray-400">
        <Link href="/" className="hover:text-violet-600">ホーム</Link>
        <span>›</span>
        <Link href="/groups" className="hover:text-violet-600">グループ</Link>
        <span>›</span>
        {parentGroup && (
          <>
            <Link href={`/group/${parentGroup.id}`} className="hover:text-violet-600">{parentGroup.name}</Link>
            <span>›</span>
          </>
        )}
        <span className="text-gray-600">{group.name}</span>
      </div>

      <div className="mb-8 flex items-center gap-4">
        {!group.parent_group_id && (group.icon_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={group.icon_url} alt={group.name} className="h-14 w-14 flex-shrink-0 rounded-full object-cover" />
        ) : (
          <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full text-white text-xl font-bold" style={{ backgroundColor: group.color }}>
            {group.name[0]}
          </div>
        ))}
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">{group.name}</h1>
            {group.category && (
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${CATEGORY_STYLE[group.category]}`}>
                {CATEGORY_LABEL[group.category]}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-400">{channels.length}チャンネル</p>
        </div>
      </div>

      {/* Child groups */}
      {childGroups.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-base font-semibold text-gray-900">サブグループ</h2>
          <div className="flex flex-wrap gap-2">
            {childGroups.map((g) => (
              <Link
                key={g.id}
                href={`/group/${g.id}`}
                className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-1.5 text-sm text-gray-700 shadow-sm transition-colors hover:border-violet-300 hover:text-violet-600"
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: g.color }} />
                {g.name}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Live now */}
      {liveVideos.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-gray-900">
            <span className="animate-pulse text-red-500">●</span>
            ライブ中
            <span className="font-normal text-gray-400">({liveVideos.length})</span>
          </h2>
          <div className="flex flex-col gap-3 mb-4">
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
          {liveGraphData.length >= 2 && (
            <CombinedLiveGraph data={liveGraphData} lines={liveGraphLines} />
          )}
        </section>
      )}

      {/* Today's peak ranking */}
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
                  <span className="w-5 flex-shrink-0 text-center text-xs font-bold text-gray-300">{i + 1}</span>
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
                  <span className="flex-shrink-0 font-bold text-violet-600">{peak.toLocaleString()}人</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Channel list */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          チャンネル一覧
          <span className="ml-2 text-sm font-normal text-gray-400">({channels.length}件)</span>
        </h2>
        {channels.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-400">
            チャンネルがありません
          </div>
        ) : (
          <div
            className="grid gap-3"
            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))" }}
          >
            {sortedChannels.map((ch) => {
              const linked = ch.linked_channel_id ? channelMap.get(ch.linked_channel_id) : undefined;
              return (
                <ChannelCard
                  key={ch.channel_id}
                  channelId={ch.channel_id}
                  name={ch.name}
                  customUrl={ch.custom_url}
                  iconUrl={ch.icon_url}
                  subscriberCount={ch.subscriber_count}
                  totalSuperchat={0}
                  latestVideoStatus={latestByChannel[ch.channel_id]?.status ?? "none"}
                  latestVideoStartTime={latestByChannel[ch.channel_id]?.startTime ?? null}
                  groupId={group.id}
                  groupColor={group.color}
                  linkedPlatform={linked?.platform ?? null}
                />
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
