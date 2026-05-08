import { supabase } from "@/lib/supabase/client";
import type { Channel, Video, ChannelStatsHistory, Group, Superchat } from "@/lib/types";
import { fetchRatesToJPY } from "@/lib/exchange";
import Link from "next/link";
import SubscriberChart from "./SubscriberChart";
import BackButton from "./BackButton";
import ChannelAvatar from "@/app/components/ChannelAvatar";

export const dynamic = "force-dynamic";

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

  const [groupRes, scRes, peakRes] = await Promise.all([
    channel?.group_id
      ? supabase.from("groups").select("*").eq("id", channel.group_id).single()
      : Promise.resolve({ data: null }),
    allVideoIds.length > 0
      ? supabase.from("superchats").select("amount_jpy, amount, currency").in("video_id", allVideoIds)
      : Promise.resolve({ data: [] }),
    videoIds.length > 0
      ? supabase.from("live_graph_points").select("video_id, concurrent_viewers").in("video_id", videoIds)
      : Promise.resolve({ data: [] }),
  ]);

  const group = groupRes.data as Group | null;

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

  if (!channel) {
    return (
      <div className="py-20 text-center text-gray-500">
        チャンネルが見つかりません
      </div>
    );
  }

  return (
    <div>
      <BackButton />

      {/* チャンネルヘッダー */}
      <div className="mb-8 flex items-center gap-4">
        <ChannelAvatar
          channelId={channel.channel_id}
          name={channel.name}
          iconUrl={channel.icon_url}
          size={64}
        />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{channel.name}</h1>
          <p className="text-sm text-gray-500">{channel.custom_url}</p>
          {group && (
            <Link
              href={`/group/${group.id}`}
              className="mt-1 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium text-white transition-opacity hover:opacity-80"
              style={{ backgroundColor: group.color }}
            >
              {group.icon_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={group.icon_url} alt="" className="h-3.5 w-3.5 rounded-full object-cover" />
              )}
              {group.name}
            </Link>
          )}
          {channel.description && (
            <p className="mt-1 line-clamp-2 text-xs text-gray-400">
              {channel.description}
            </p>
          )}
        </div>
      </div>

      {/* 統計 */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="登録者数" value={formatCount(channel.subscriber_count)} />
        <StatCard label="総再生数" value={formatCount(channel.view_count)} />
        <StatCard label="動画数" value={channel.video_count.toLocaleString()} />
        <StatCard
          label="累計スパチャ"
          value={totalSCJPY > 0 ? `¥${formatCount(totalSCJPY)}` : "—"}
          accent={totalSCJPY > 0}
        />
      </div>

      {/* 登録者数推移グラフ */}
      {history.length >= 2 && (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold text-gray-900">登録者数推移</h2>
          <SubscriberChart data={history} />
        </section>
      )}

      {/* 過去ライブ一覧 */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-gray-900">
          過去の配信{" "}
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
              return (
                <Link
                  key={v.video_id}
                  href={`/live/${v.video_id}`}
                  className="group row-lift flex items-center gap-3 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm"
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
                    <p className="truncate text-sm font-medium text-gray-900 transition-colors duration-300 group-hover:text-violet-600">{v.title}</p>
                    <p className="text-xs text-gray-400">{formatDate(v.start_time)}</p>
                  </div>
                  {peakByVideo.has(v.video_id) && (
                    <span className="flex-shrink-0 pr-2 text-xs text-gray-400">
                      ピーク {peakByVideo.get(v.video_id)!.toLocaleString()}人
                    </span>
                  )}
                  <span className={`mr-3 flex-shrink-0 rounded px-2 py-0.5 text-xs font-medium ${badge.className}`}>
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

function StatCard({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
      <p className="text-xs text-gray-400">{label}</p>
      <p className={`mt-1 text-2xl font-bold tracking-tight ${accent ? "text-amber-500" : "text-gray-900"}`}>
        {value}
      </p>
    </div>
  );
}
