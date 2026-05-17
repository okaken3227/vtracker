import { supabase } from "@/lib/supabase/client";
import type { Channel, Video, Superchat } from "@/lib/types";
import { notFound } from "next/navigation";
import Link from "next/link";
import ChannelAvatar from "@/app/components/ChannelAvatar";
import BackButton from "../BackButton";
import { fetchRatesToJPY } from "@/lib/exchange";

export const dynamic = "force-dynamic";

function formatCount(n: number): string {
  if (n >= 100000000) return `${(n / 100000000).toFixed(1)}億`;
  if (n >= 10000) return `${(n / 10000).toFixed(0)}万`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toLocaleString();
}

function formatJST(iso: string) {
  return new Date(iso).toLocaleString("ja-JP", {
    year: "numeric", month: "numeric", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function getBucket(publishedAt: string, startTime: string | null): number {
  if (!startTime) return 0;
  const ms = new Date(publishedAt).getTime() - new Date(startTime).getTime();
  return Math.max(0, Math.floor(ms / (5 * 60 * 1000)) * 5);
}

// YouTube SuperChat 公式配色（円換算額基準）
function scStyle(amountJpy: number): { card: string; badge: string } {
  if (amountJpy >= 10000) return { card: "border-red-400 bg-red-50",     badge: "bg-red-500 text-white" };
  if (amountJpy >= 5000)  return { card: "border-fuchsia-400 bg-fuchsia-50", badge: "bg-fuchsia-500 text-white" };
  if (amountJpy >= 2000)  return { card: "border-orange-300 bg-orange-50",   badge: "bg-orange-400 text-white" };
  if (amountJpy >= 1000)  return { card: "border-yellow-300 bg-yellow-50",   badge: "bg-yellow-400 text-gray-900" };
  if (amountJpy >= 500)   return { card: "border-green-300 bg-green-50",     badge: "bg-green-500 text-white" };
  if (amountJpy >= 200)   return { card: "border-cyan-300 bg-cyan-50",       badge: "bg-cyan-500 text-white" };
  return                         { card: "border-blue-200 bg-blue-50",        badge: "bg-blue-400 text-white" };
}

export default async function ChannelSuperchatsPage({
  params,
}: {
  params: Promise<{ channelId: string }>;
}) {
  const { channelId } = await params;

  const [channelRes, videosRes] = await Promise.all([
    supabase.from("channels").select("*").eq("channel_id", channelId).single(),
    supabase.from("videos").select("video_id, title, start_time, status").eq("channel_id", channelId).order("start_time", { ascending: false }),
  ]);

  const channel = channelRes.data as Channel | null;
  if (!channel) notFound();

  const videos = (videosRes.data ?? []) as Pick<Video, "video_id" | "title" | "start_time" | "status">[];
  const videoIds = videos.map((v) => v.video_id);
  const videoMap = new Map(videos.map((v) => [v.video_id, v]));

  if (videoIds.length === 0) {
    return (
      <div>
        <BackButton />
        <p className="mt-8 text-center text-sm text-gray-400">スパチャデータがありません</p>
      </div>
    );
  }

  const { data: scData } = await supabase
    .from("superchats")
    .select("*")
    .in("video_id", videoIds)
    .order("published_at", { ascending: false });

  const superchats = (scData ?? []) as Superchat[];

  // 現在レートで円換算（非JPY通貨のみ）
  const hasNonJPY = superchats.some((sc) => sc.currency !== "JPY");
  const rates = hasNonJPY ? await fetchRatesToJPY() : {};
  function toCurrentJPY(amount: number, currency: string): number {
    if (currency === "JPY") return amount;
    const rate = rates[currency];
    if (!rate) return 0;
    return Math.round(amount / rate);
  }

  if (superchats.length === 0) {
    return (
      <div>
        <BackButton />
        <div className="mt-8 rounded-xl border border-dashed border-gray-300 p-12 text-center text-sm text-gray-400">
          スパチャはまだありません
        </div>
      </div>
    );
  }

  const totalJPY = superchats.reduce((s, sc) => s + (sc.amount_jpy ?? (sc.currency === "JPY" ? sc.amount : 0)), 0);

  // 動画ごとにグループ化（動画の順序を保持）
  const byVideo = new Map<string, Superchat[]>();
  for (const sc of superchats) {
    if (!byVideo.has(sc.video_id)) byVideo.set(sc.video_id, []);
    byVideo.get(sc.video_id)!.push(sc);
  }
  // 動画を start_time 降順で並べ、スパチャがある動画のみ
  const videoOrder = videos.filter((v) => byVideo.has(v.video_id));

  return (
    <div className="mx-auto max-w-3xl">
      <BackButton />

      {/* ヘッダー */}
      <div className="mb-6 flex items-center gap-3">
        <ChannelAvatar channelId={channelId} name={channel.name} iconUrl={channel.icon_url} size={48} />
        <div>
          <Link href={`/channel/${channelId}`} className="text-sm text-violet-500 hover:underline">
            {channel.name}
          </Link>
          <h1 className="text-xl font-bold text-gray-900">累計スパチャ一覧</h1>
          <p className="text-sm text-gray-500">
            {superchats.length.toLocaleString()}件 / 合計 ¥{totalJPY.toLocaleString()}
          </p>
        </div>
      </div>

      {/* 動画ごとのスパチャ */}
      <div className="flex flex-col gap-8">
        {videoOrder.map((video) => {
          const scs = byVideo.get(video.video_id) ?? [];
          const videoTotal = scs.reduce((s, sc) => s + (sc.amount_jpy ?? (sc.currency === "JPY" ? sc.amount : 0)), 0);

          return (
            <section key={video.video_id}>
              {/* 動画ヘッダー */}
              <Link
                href={`/live/${video.video_id}`}
                className="mb-3 flex items-start justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm transition-colors hover:border-violet-300"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-gray-900">{video.title}</p>
                  <p className="text-xs text-gray-400">{video.start_time ? formatJST(video.start_time) : "—"}</p>
                </div>
                <span className="flex-shrink-0 font-mono text-sm font-bold text-amber-500">
                  ¥{videoTotal.toLocaleString()}
                </span>
              </Link>

              {/* スパチャリスト */}
              <div className="flex flex-col gap-1.5">
                {scs.map((sc) => {
                  const jpy = sc.amount_jpy ?? (sc.currency === "JPY" ? sc.amount : 0);
                  const currentJPY = sc.currency !== "JPY" ? toCurrentJPY(sc.amount, sc.currency) : null;
                  const { card, badge } = scStyle(jpy);
                  const bucket = getBucket(sc.published_at, video.start_time);
                  const ytUrl = channel.platform !== "twitch"
                    ? `https://www.youtube.com/watch?v=${sc.video_id}&t=${bucket * 60}`
                    : null;

                  return (
                    <div
                      key={sc.id}
                      className={`flex items-start gap-3 rounded-lg border px-3 py-2 ${card}`}
                    >
                      {/* 金額バッジ */}
                      <span className={`flex-shrink-0 rounded-full px-2 py-0.5 font-mono text-xs font-bold ${badge}`}>
                        {sc.currency === "JPY"
                          ? `¥${sc.amount.toLocaleString()}`
                          : `${sc.currency} ${sc.amount.toLocaleString()}`}
                      </span>

                      {/* コメント・著者 */}
                      <div className="min-w-0 flex-1">
                        <span className="text-xs font-semibold text-gray-800">{sc.author_name}</span>
                        {sc.comment && (
                          <p className="mt-0.5 text-xs text-gray-600 line-clamp-2">{sc.comment}</p>
                        )}
                      </div>

                      {/* 円換算 + 時刻 + 動画リンク */}
                      <div className="flex flex-shrink-0 flex-col items-end gap-0.5">
                        {sc.currency !== "JPY" && currentJPY != null && currentJPY > 0 && (
                          <span className="font-mono text-[10px] text-gray-500">≈ ¥{currentJPY.toLocaleString()}</span>
                        )}
                        <span className="text-[10px] text-gray-400">{formatJST(sc.published_at)}</span>
                        {ytUrl ? (
                          <a
                            href={ytUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-0.5 text-[10px] text-gray-400 hover:text-red-500 transition-colors"
                            title="YouTubeで開く"
                          >
                            ▶ {Math.floor(bucket / 60) > 0 ? `${Math.floor(bucket / 60)}:${String(bucket % 60).padStart(2, "0")}` : `${bucket}:00`}
                          </a>
                        ) : (
                          <span className="mt-0.5 text-[10px] text-gray-400">
                            {Math.floor(bucket / 60) > 0 ? `${Math.floor(bucket / 60)}:${String(bucket % 60).padStart(2, "0")}` : `${bucket}:00`}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
