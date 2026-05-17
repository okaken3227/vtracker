import { supabase } from "@/lib/supabase/client";
import type { Channel, Video, ChannelStatsHistory, Group, Superchat } from "@/lib/types";
import { fetchRatesToJPY } from "@/lib/exchange";
import PageBackground from "@/app/components/PageBackground";
import Link from "next/link";
import SubscriberChart from "./SubscriberChart";
import ViewCountChart from "./ViewCountChart";
import BackButton from "./BackButton";
import ChannelAvatar from "@/app/components/ChannelAvatar";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ channelId: string }>;
}): Promise<Metadata> {
  const { channelId } = await params;
  const { data } = await supabase.from("channels").select("name, description, icon_url, subscriber_count").eq("channel_id", channelId).single();
  if (!data) return { title: "チャンネルが見つかりません" };
  const ch = data as Pick<Channel, "name" | "description" | "icon_url" | "subscriber_count">;
  const title = ch.name;
  const description = ch.description
    ? ch.description.slice(0, 120)
    : `${ch.name}のチャンネルページ — 登録者${ch.subscriber_count.toLocaleString()}人`;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: ch.icon_url ? [{ url: ch.icon_url, alt: ch.name }] : [],
    },
    twitter: { card: "summary", title, description },
  };
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  live: { label: "● LIVE", className: "bg-red-50 text-red-500" },
  upcoming: { label: "○ 配信予定", className: "bg-amber-50 text-amber-600" },
  none: { label: "配信終了", className: "bg-gray-100 text-gray-400" },
};

function formatCount(n: number): string {
  if (n >= 100000000) return `${(n / 100000000).toFixed(1)}億`;
  if (n >= 10000) return `${(n / 10000).toFixed(0)}万`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toLocaleString();
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function ChannelPage({
  params,
}: {
  params: Promise<{ channelId: string }>;
}) {
  const { channelId } = await params;

  const [channelRes, videosRes, historyRes, allVideoIdsRes] = await Promise.all([
    supabase.from("channels").select("*").eq("channel_id", channelId).single(),
    supabase
      .from("videos")
      .select("*")
      .eq("channel_id", channelId)
      .order("start_time", { ascending: false })
      .limit(30),
    supabase
      .from("channel_stats_history")
      .select("id, channel_id, subscriber_count, view_count, recorded_at")
      .eq("channel_id", channelId)
      .order("recorded_at", { ascending: true })
      .limit(200),
    supabase.from("videos").select("video_id").eq("channel_id", channelId),
  ]);

  const channel = channelRes.data as Channel | null;
  const videos = (videosRes.data ?? []) as Video[];
  const history = (historyRes.data ?? []) as ChannelStatsHistory[];
  const allVideoIds = ((allVideoIdsRes.data ?? []) as { video_id: string }[]).map((v) => v.video_id);

  const videoIds = videos.map((v) => v.video_id);

  const [groupRes, scRes, peakRes, linkedChannelRes] = await Promise.all([
    channel?.group_id
      ? supabase.from("groups").select("*").eq("id", channel.group_id).single()
      : Promise.resolve({ data: null }),
    allVideoIds.length > 0
      ? supabase.from("superchats").select("amount_jpy, amount, currency").in("video_id", allVideoIds)
      : Promise.resolve({ data: [] }),
    videoIds.length > 0
      ? supabase.from("live_graph_points").select("video_id, concurrent_viewers").in("video_id", videoIds)
      : Promise.resolve({ data: [] }),
    channel?.linked_channel_id
      ? supabase.from("channels").select("channel_id, name, icon_url, platform, custom_url").eq("channel_id", channel.linked_channel_id).single()
      : Promise.resolve({ data: null }),
  ]);

  const group = groupRes.data as Group | null;
  const linkedChannel = linkedChannelRes.data as Pick<Channel, "channel_id" | "name" | "icon_url" | "platform" | "custom_url"> | null;

  // 累計スパチャ（amount_jpy 優先、外貨は為替換算）
  const scRows = (scRes.data ?? []) as Pick<Superchat, "amount_jpy" | "amount" | "currency">[];
  const needsRates = scRows.some((sc) => sc.amount_jpy == null && sc.currency !== "JPY");
  const rates = needsRates ? await fetchRatesToJPY() : {};
  const totalSCJPY = scRows.reduce((sum, sc) => {
    const jpy = sc.amount_jpy ?? (sc.currency === "JPY" ? sc.amount : rates[sc.currency] ? Math.round(sc.amount / rates[sc.currency]) : 0);
    return sum + jpy;
  }, 0);

  // 動画ごとのピーク同接
  const peakByVideo = new Map<string, number>();
  for (const p of (peakRes.data ?? []) as { video_id: string; concurrent_viewers: number }[]) {
    peakByVideo.set(p.video_id, Math.max(peakByVideo.get(p.video_id) ?? 0, p.concurrent_viewers));
  }

  if (!channel) notFound();

  return (
    <div>
      <PageBackground color={channel.color} />
      <BackButton />

      {/* バナー */}
      {channel.banner_url && (
        <div className="relative -mx-3 mb-6 h-28 overflow-hidden sm:-mx-4 sm:h-44 sm:rounded-xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`${channel.banner_url}=w1280-fcrop64=1,00005a57ffffa5a8-k-c0xffffffff-no-nd-rj`}
            alt=""
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
        </div>
      )}

      {/* チャンネルヘッダー */}
      <div className="mb-6 flex items-start gap-3 sm:gap-4">
        <ChannelAvatar
          channelId={channel.channel_id}
          name={channel.name}
          iconUrl={channel.icon_url}
          size={52}
        />
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold leading-tight text-gray-900 sm:text-2xl">{channel.name}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            {channel.platform === "twitch" ? (
              <a
                href={`https://www.twitch.tv/${channel.custom_url || channel.channel_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 rounded-full bg-purple-600 px-2.5 py-0.5 text-xs font-medium text-white transition-opacity hover:opacity-80"
              >
                <svg className="h-3 w-3 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/>
                </svg>
                Twitchで見る
              </a>
            ) : (
              <a
                href={`https://www.youtube.com/${channel.custom_url || `channel/${channel.channel_id}`}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 rounded-full bg-red-500 px-2.5 py-0.5 text-xs font-medium text-white transition-opacity hover:opacity-80"
              >
                <svg className="h-3 w-3 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31.5 31.5 0 0 0 0 12a31.5 31.5 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1A31.5 31.5 0 0 0 24 12a31.5 31.5 0 0 0-.5-5.8zM9.75 15.5V8.5l6.5 3.5-6.5 3.5z"/>
                </svg>
                YouTubeで見る
              </a>
            )}
            {/* 連携済みの別プラットフォーム */}
            {linkedChannel && (
              <Link
                href={`/channel/${linkedChannel.channel_id}`}
                className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium text-white transition-opacity hover:opacity-80 ${linkedChannel.platform === "twitch" ? "bg-purple-600" : "bg-red-500"}`}
              >
                {linkedChannel.platform === "twitch" ? (
                  <svg className="h-3 w-3 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/>
                  </svg>
                ) : (
                  <svg className="h-3 w-3 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31.5 31.5 0 0 0 0 12a31.5 31.5 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1A31.5 31.5 0 0 0 24 12a31.5 31.5 0 0 0-.5-5.8zM9.75 15.5V8.5l6.5 3.5-6.5 3.5z"/>
                  </svg>
                )}
                {linkedChannel.name}
              </Link>
            )}
            {channel.platform !== "twitch" && channel.custom_url && (
              <span className="text-xs text-gray-400">{channel.custom_url}</span>
            )}
            {group && (
              <Link
                href={`/group/${group.slug ?? group.id}`}
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-white transition-opacity hover:opacity-80"
                style={{ backgroundColor: group.color }}
              >
                {group.icon_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={group.icon_url} alt="" className="h-3 w-3 rounded-full object-cover" />
                )}
                {group.name}
              </Link>
            )}
          </div>
          {channel.description && (
            <p className="mt-1.5 line-clamp-2 text-xs text-gray-400">
              {channel.description}
            </p>
          )}
        </div>
      </div>

      {/* 統計 */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="登録者数" value={formatCount(channel.subscriber_count)} color="violet" />
        <StatCard label="総再生数" value={formatCount(channel.view_count)} color="cyan" />
        <StatCard label="動画数" value={channel.video_count.toLocaleString()} color="blue" />
        <StatCard
          label="累計スパチャ"
          value={totalSCJPY > 0 ? `¥${formatCount(totalSCJPY)}` : "—"}
          color={totalSCJPY > 0 ? "amber" : "gray"}
          href={totalSCJPY > 0 ? `/channel/${channelId}/superchats` : undefined}
        />
      </div>

      {/* 登録者数推移グラフ */}
      {history.length >= 2 && (
        <section className="mb-8">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-gray-900">
            <span className="h-4 w-1 rounded-full bg-violet-500" />
            登録者数推移
          </h2>
          <SubscriberChart data={history} />
        </section>
      )}

      {/* 総再生数推移グラフ */}
      {history.length >= 2 && (
        <section className="mb-8">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-gray-900">
            <span className="h-4 w-1 rounded-full bg-cyan-500" />
            総再生数推移
          </h2>
          <ViewCountChart data={history} />
        </section>
      )}

      {/* 過去ライブ一覧 */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-gray-900">
          <span className="h-4 w-1 rounded-full bg-gray-400" />
          過去の配信
          <span className="text-sm font-normal text-gray-400">({videos.length}件)</span>
        </h2>

        {videos.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 p-10 text-center text-sm text-gray-400">
            配信データがありません
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {videos.map((v) => {
              const badge = STATUS_BADGE[v.status] ?? STATUS_BADGE.none;
              const accentColor = v.status === "live" ? "border-l-red-400" : v.status === "upcoming" ? "border-l-amber-400" : "border-l-transparent";
              return (
                <Link
                  key={v.video_id}
                  href={`/live/${v.video_id}`}
                  className={`group row-lift flex items-center gap-3 overflow-hidden rounded-xl border border-gray-100 border-l-4 bg-white shadow-sm ${accentColor}`}
                >
                  {/* サムネイル */}
                  <div className="relative h-16 w-28 flex-shrink-0 overflow-hidden bg-gray-100 sm:h-[72px] sm:w-32">
                    {v.thumbnail_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={v.thumbnail_url}
                        alt={v.title}
                        className="thumb-inner h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xl text-gray-300">▶</div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 py-3 pr-3">
                    <p className="truncate text-sm font-medium text-gray-900 transition-colors duration-200 group-hover:text-violet-600">{v.title}</p>
                    <p className="mt-0.5 text-xs text-gray-400">{formatDate(v.start_time)}</p>
                  </div>
                  {peakByVideo.has(v.video_id) && (
                    <span className="flex-shrink-0 pr-2 text-[11px] tabular-nums text-gray-400">
                      ピーク {peakByVideo.get(v.video_id)!.toLocaleString()}人
                    </span>
                  )}
                  <span className={`mr-3 flex-shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${badge.className}`}>
                    {badge.label}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({ label, value, color = "gray", href }: {
  label: string; value: string;
  color?: "violet" | "cyan" | "blue" | "amber" | "gray";
  href?: string;
}) {
  const s = {
    violet: { wrap: "from-violet-50 to-white border-violet-100", val: "text-violet-700", hover: "hover:border-violet-200 hover:bg-violet-50" },
    cyan:   { wrap: "from-cyan-50 to-white border-cyan-100",     val: "text-cyan-700",   hover: "hover:border-cyan-200 hover:bg-cyan-50" },
    blue:   { wrap: "from-blue-50 to-white border-blue-100",     val: "text-blue-700",   hover: "hover:border-blue-200 hover:bg-blue-50" },
    amber:  { wrap: "from-amber-50 to-white border-amber-100",   val: "text-amber-600",  hover: "hover:border-amber-200 hover:bg-amber-50" },
    gray:   { wrap: "from-gray-50 to-white border-gray-200",     val: "text-gray-900",   hover: "hover:border-gray-300 hover:bg-gray-50" },
  }[color];

  const inner = (
    <>
      <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">{label}</p>
      <p className={`mt-1.5 text-2xl font-bold tracking-tight tabular-nums ${s.val}`}>{value}</p>
    </>
  );
  const base = `block rounded-2xl border bg-gradient-to-br px-4 py-3.5 shadow-sm ${s.wrap}`;
  if (href) {
    return <a href={href} className={`${base} transition-colors ${s.hover}`}>{inner}</a>;
  }
  return <div className={base}>{inner}</div>;
}
