import type { Metadata } from "next";
import { supabase } from "@/lib/supabase/client";
import type { Channel, Video, Group, GroupCategory, LiveGraphPoint } from "@/lib/types";
import { GRAPH_COLORS, GRAPH_BUCKET_MS } from "@/lib/chartConfig";
import { getJstMidnightMs } from "@/lib/jst";
import ChannelCard from "@/app/components/ChannelCard";
import CombinedLiveGraph from "@/app/components/CombinedLiveGraph";
import type { LineConfig } from "@/app/components/CombinedLiveGraph";
import LiveBanner from "@/app/components/LiveBanner";
import Link from "next/link";

export const dynamic = "force-dynamic";

// DBにwebsite_urlカラムがない場合のフォールバック
const KNOWN_WEBSITES: Record<string, string> = {
  "にじさんじ": "https://www.nijisanji.jp/",
  "ぶいすぽっ！": "https://vspo.jp/",
  "Reject": "https://reject.jp/",
  "あおぎり高校": "https://www.aogirihighschool.com/",
  "ホロライブ": "https://hololivepro.com/",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ groupId: string }>;
}): Promise<Metadata> {
  const { groupId } = await params;
  const { data } = await supabase.from("groups").select("name, icon_url").eq("id", groupId).single();
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
    const t = new Date(bucket).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tokyo" });
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
  if (n >= 100000000) return `${(n / 100000000).toFixed(1)}億`;
  if (n >= 10000) return `${(n / 10000).toFixed(0)}万`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toLocaleString();
}

export default async function GroupPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  const jstMidnightMs = getJstMidnightMs();

  // Round 1: グループ情報を先に取得（子グループIDを確定するため）
  const [groupRes, allGroupsRes] = await Promise.all([
    supabase.from("groups").select("*").eq("id", groupId).single(),
    supabase.from("groups").select("*").order("sort_order", { ascending: true, nullsFirst: false }).order("name"),
  ]);

  const group = groupRes.data as Group | null;
  if (!group) {
    return (
      <div className="py-20 text-center text-gray-400">
        <p>グループが見つかりません</p>
        <Link href="/groups" className="mt-3 inline-block text-sm text-violet-500 hover:underline">グループ一覧へ戻る</Link>
      </div>
    );
  }

  const allGroups = (allGroupsRes.data ?? []) as Group[];
  const allGroupsMap = new Map(allGroups.map((g) => [g.id, g]));

  const parentGroup = group.parent_group_id ? allGroups.find((g) => g.id === group.parent_group_id) ?? null : null;
  const childGroups = allGroups
    .filter((g) => g.parent_group_id === groupId)
    .sort((a, b) => (a.sort_order ?? 99999) - (b.sort_order ?? 99999));

  // 親グループページでは子グループのチャンネルも全て含める
  const childGroupIds = childGroups.map((g) => g.id);
  const allGroupIds = [groupId, ...childGroupIds];

  // Round 2: 対象グループ（＋子グループ）のチャンネルを取得
  const channelsRes = await supabase
    .from("channels")
    .select("*")
    .in("group_id", allGroupIds)
    .order("subscriber_count", { ascending: false });

  const channels = (channelsRes.data ?? []) as Channel[];
  const channelIds = channels.map((c) => c.channel_id);
  const channelMap = new Map(channels.map((c) => [c.channel_id, c]));

  const [videosRes, gpRes] = channelIds.length > 0
    ? await Promise.all([
        supabase.from("videos").select("*").in("channel_id", channelIds).order("start_time", { ascending: false }),
        supabase.from("live_graph_points").select("video_id, concurrent_viewers, recorded_at")
          .gte("recorded_at", new Date(jstMidnightMs).toISOString()),
      ])
    : [{ data: [] }, { data: [] }];

  const videos = (videosRes.data ?? []) as Video[];
  const graphPoints = (gpRes.data ?? []) as Pick<LiveGraphPoint, "video_id" | "concurrent_viewers" | "recorded_at">[];

  const liveVideos = videos.filter((v) => v.status === "live");
  const upcomingVideos = videos.filter((v) => v.status === "upcoming");
  const { merged: liveGraphData, lines: liveGraphLines } = buildLiveGraph(liveVideos, channelMap, graphPoints);

  const latestByChannel: Record<string, { status: string; startTime: string | null }> = {};
  for (const ch of channels) {
    const chVideos = videos.filter((v) => v.channel_id === ch.channel_id);
    const live = chVideos.find((v) => v.status === "live");
    const upcoming = chVideos.find((v) => v.status === "upcoming");
    const latest = live ?? upcoming ?? chVideos[0];
    if (latest) latestByChannel[ch.channel_id] = { status: latest.status, startTime: latest.start_time };
  }

  const linkedToIds = new Set(channels.filter((c) => c.linked_channel_id).map((c) => c.linked_channel_id as string));
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

  const totalSubs = channels.reduce((s, c) => s + (c.subscriber_count ?? 0), 0);
  const websiteUrl = group.website_url ?? KNOWN_WEBSITES[group.name] ?? null;
  const accentColor = group.color ?? "#6b7280";

  return (
    <div>
      {/* パンくず */}
      <div className="mb-4 flex items-center gap-1.5 text-xs text-gray-400">
        <Link href="/" className="hover:text-violet-600 transition-colors">ホーム</Link>
        <span>›</span>
        <Link href="/groups" className="hover:text-violet-600 transition-colors">グループ</Link>
        <span>›</span>
        {parentGroup && (
          <>
            <Link href={`/group/${parentGroup.id}`} className="hover:text-violet-600 transition-colors">{parentGroup.name}</Link>
            <span>›</span>
          </>
        )}
        <span className="text-gray-600">{group.name}</span>
      </div>

      {/* ヒーローセクション */}
      <div
        className="relative mb-8 overflow-hidden rounded-2xl p-6 sm:p-8"
        style={{ background: `linear-gradient(135deg, ${accentColor}22 0%, ${accentColor}08 100%)`, borderLeft: `4px solid ${accentColor}` }}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            {!group.parent_group_id && (group.icon_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={group.icon_url} alt={group.name} className="h-16 w-16 flex-shrink-0 rounded-2xl object-cover shadow-sm sm:h-20 sm:w-20" />
            ) : (
              <div
                className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-2xl text-2xl font-bold text-white shadow-sm sm:h-20 sm:w-20"
                style={{ backgroundColor: accentColor }}
              >
                {group.name[0]}
              </div>
            ))}
            <div>
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">{group.name}</h1>
                {group.category && (
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${CATEGORY_STYLE[group.category]}`}>
                    {CATEGORY_LABEL[group.category]}
                  </span>
                )}
                {liveVideos.length > 0 && (
                  <span className="flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-600">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
                    {liveVideos.length}本ライブ中
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                <span><span className="font-semibold text-gray-900">{channels.length}</span> チャンネル</span>
                <span><span className="font-semibold text-gray-900">{formatCount(totalSubs)}</span> 総登録者</span>
              </div>
            </div>
          </div>

          {/* 公式サイトボタン */}
          {websiteUrl && (
            <a
              href={websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition-all hover:border-violet-300 hover:text-violet-600 hover:shadow-md"
            >
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="10" cy="10" r="8" />
                <path d="M10 2C10 2 7 6 7 10s3 8 3 8M10 2c0 0 3 4 3 8s-3 8-3 8M2 10h16" strokeLinecap="round" />
              </svg>
              公式サイト
              <svg className="h-3 w-3 opacity-50" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M2 10L10 2M10 2H5M10 2v5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
          )}
        </div>
      </div>

      {/* サブグループ */}
      {childGroups.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-400">サブグループ</h2>
          <div className="flex flex-wrap gap-2">
            {childGroups.map((g) => (
              <Link
                key={g.id}
                href={`/group/${g.id}`}
                className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3.5 py-1.5 text-sm font-medium text-gray-700 shadow-sm transition-all hover:border-violet-300 hover:text-violet-600 hover:shadow-md"
              >
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: g.color }} />
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
          <div className="mb-4 flex flex-col gap-3">
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

      {/* 配信予定 */}
      {upcomingVideos.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-gray-900">
            <span className="text-blue-400">◷</span>
            配信予定
            <span className="font-normal text-gray-400">({upcomingVideos.length})</span>
          </h2>
          <div className="flex flex-col gap-2">
            {upcomingVideos.slice(0, 5).map((v) => {
              const ch = channelMap.get(v.channel_id);
              return (
                <Link
                  key={v.video_id}
                  href={`/live/${v.video_id}`}
                  className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white p-3 text-sm transition-all hover:border-violet-200 hover:shadow-sm"
                >
                  {ch?.icon_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={ch.icon_url} alt={ch.name} className="h-8 w-8 flex-shrink-0 rounded-full object-cover" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-gray-800">{ch?.name ?? v.channel_id}</p>
                    <p className="truncate text-xs text-gray-400">{v.title}</p>
                  </div>
                  {v.scheduled_start_time && (
                    <span className="flex-shrink-0 text-xs text-gray-400">
                      {new Date(v.scheduled_start_time).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tokyo" })}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* チャンネル一覧 */}
      <section>
        <h2 className="mb-4 text-base font-semibold text-gray-900">
          チャンネル一覧
          <span className="ml-2 text-sm font-normal text-gray-400">({deduped.length}件)</span>
        </h2>
        {sortedChannels.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-400">
            チャンネルがありません
          </div>
        ) : (
          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))" }}>
            {sortedChannels.map((ch) => {
              const linked = ch.linked_channel_id ? channelMap.get(ch.linked_channel_id) : undefined;
              const chGroup = ch.group_id ? allGroupsMap.get(ch.group_id) : undefined;
              const displayGroup = chGroup ?? group;
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
                  groupId={displayGroup.id}
                  groupName={childGroupIds.length > 0 ? displayGroup.name : undefined}
                  groupColor={displayGroup.color}
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
