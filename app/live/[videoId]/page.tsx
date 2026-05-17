import type { Metadata } from "next";
import { supabase } from "@/lib/supabase/client";
import type { Video, Channel, Superchat, LiveGraphPoint } from "@/lib/types";
import type { GraphDataPoint } from "./LiveGraphSection";
import LiveGraphSection from "./LiveGraphSection";
import SuperchatList from "./SuperchatList";
import type { SCItem } from "./SuperchatList";
import RefreshButton from "@/app/components/RefreshButton";
import LiveTimer from "@/app/components/LiveTimer";
import { fetchRatesToJPY } from "@/lib/exchange";
import Link from "next/link";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ videoId: string }>;
}): Promise<Metadata> {
  const { videoId } = await params;
  const { data: video } = await supabase
    .from("videos")
    .select("title, thumbnail_url, channel_id")
    .eq("video_id", videoId)
    .single();
  if (!video) return {};
  const v = video as { title: string; thumbnail_url: string | null; channel_id: string };
  const { data: ch } = await supabase
    .from("channels")
    .select("name")
    .eq("channel_id", v.channel_id)
    .single();
  const channelName = (ch as { name: string } | null)?.name ?? "";
  const title = v.title || channelName;
  const description = `${channelName}の配信「${v.title}」の視聴者数・スパチャをリアルタイム追跡。`;
  const images = v.thumbnail_url ? [{ url: v.thumbnail_url }] : [];
  return {
    title,
    description,
    openGraph: { title: `${title} | vtracker`, description, images },
    twitter: { card: "summary_large_image", title: `${title} | vtracker`, description, images },
  };
}

const TIER_COLORS: Record<number, string> = {
  1: "border-blue-200 bg-blue-50 text-blue-700",
  2: "border-cyan-200 bg-cyan-50 text-cyan-700",
  3: "border-green-200 bg-green-50 text-green-700",
  4: "border-yellow-200 bg-yellow-50 text-yellow-700",
  5: "border-orange-200 bg-orange-50 text-orange-700",
  6: "border-red-200 bg-red-50 text-red-700",
  7: "border-pink-200 bg-pink-50 text-pink-700",
};

function tierColor(tier: number) {
  return TIER_COLORS[tier] ?? TIER_COLORS[1];
}

function aggregateTo5Min(points: LiveGraphPoint[], startTime: string | null): GraphDataPoint[] {
  if (points.length === 0 || !startTime) return [];
  const startMs = new Date(startTime).getTime();
  const buckets = new Map<number, number[]>();

  for (const p of points) {
    const ms = new Date(p.recorded_at).getTime() - startMs;
    const t = Math.max(0, Math.floor(ms / (5 * 60 * 1000)) * 5);
    if (!buckets.has(t)) buckets.set(t, []);
    buckets.get(t)!.push(p.concurrent_viewers);
  }

  return Array.from(buckets.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([t, vs]) => ({
      t,
      viewers: Math.round(vs.reduce((s, x) => s + x, 0) / vs.length),
    }));
}

function getTimeBucket(publishedAt: string, startTime: string | null): number {
  if (!startTime) return 0;
  const ms = new Date(publishedAt).getTime() - new Date(startTime).getTime();
  return Math.max(0, Math.floor(ms / (5 * 60 * 1000)) * 5);
}

function formatJST(iso: string) {
  return new Date(iso).toLocaleString("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateShort(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("ja-JP", { month: "numeric", day: "numeric", timeZone: "Asia/Tokyo" });
}

function toJPY(amount: number, currency: string, rates: Record<string, number>): number {
  if (currency === "JPY") return amount;
  const rate = rates[currency];
  if (!rate) return 0;
  return Math.round(amount / rate);
}

export default async function LivePage({
  params,
}: {
  params: Promise<{ videoId: string }>;
}) {
  const { videoId } = await params;

  const [videoRes, gpRes, scRes] = await Promise.all([
    supabase.from("videos").select("*").eq("video_id", videoId).single(),
    supabase
      .from("live_graph_points")
      .select("*")
      .eq("video_id", videoId)
      .order("recorded_at", { ascending: true }),
    supabase
      .from("superchats")
      .select("*")
      .eq("video_id", videoId)
      .order("published_at", { ascending: true }),
  ]);

  const video = videoRes.data as Video | null;
  if (!video) {
    return (
      <div className="py-20 text-center text-gray-400">動画が見つかりません</div>
    );
  }

  const [channelRes, prevVideoRes, nextVideoRes] = await Promise.all([
    supabase.from("channels").select("*").eq("channel_id", video.channel_id).single(),
    video.start_time
      ? supabase
          .from("videos")
          .select("video_id, title, start_time")
          .eq("channel_id", video.channel_id)
          .not("start_time", "is", null)
          .lt("start_time", video.start_time)
          .order("start_time", { ascending: false })
          .limit(1)
          .single()
      : Promise.resolve({ data: null }),
    video.start_time
      ? supabase
          .from("videos")
          .select("video_id, title, start_time")
          .eq("channel_id", video.channel_id)
          .not("start_time", "is", null)
          .gt("start_time", video.start_time)
          .order("start_time", { ascending: true })
          .limit(1)
          .single()
      : Promise.resolve({ data: null }),
  ]);

  const prevVideo = prevVideoRes.data as { video_id: string; title: string; start_time: string } | null;
  const nextVideo = nextVideoRes.data as { video_id: string; title: string; start_time: string } | null;

  const channel = channelRes.data as Channel | null;
  const graphPoints = (gpRes.data ?? []) as LiveGraphPoint[];
  const superchats = (scRes.data ?? []) as Superchat[];
  const chartData = aggregateTo5Min(graphPoints, video.start_time);

  // スパチャを5分バケットごとにグループ化（アンカー用）
  const bucketSet = new Set<number>();
  const scWithBucket = superchats.map((sc) => {
    const bucket = getTimeBucket(sc.published_at, video.start_time);
    const isFirstInBucket = !bucketSet.has(bucket);
    if (isFirstInBucket) bucketSet.add(bucket);
    return { sc, bucket, isFirstInBucket };
  });

  // 非JPY通貨があれば現在レートを取得して円換算
  const hasNonJPY = superchats.some((sc) => sc.currency !== "JPY");
  const rates = hasNonJPY ? await fetchRatesToJPY() : {};

  // 通貨別に「元の合計」と「円換算合計」を両方集計
  const byCurrencyOrig = new Map<string, number>(); // 元の金額
  const byCurrencyJPY = new Map<string, number>();  // 円換算後
  for (const sc of superchats) {
    byCurrencyOrig.set(sc.currency, (byCurrencyOrig.get(sc.currency) ?? 0) + sc.amount);
    const jpy = sc.amount_jpy ?? toJPY(sc.amount, sc.currency, rates);
    byCurrencyJPY.set(sc.currency, (byCurrencyJPY.get(sc.currency) ?? 0) + jpy);
  }
  const totalJPY = Array.from(byCurrencyJPY.values()).reduce((s, v) => s + v, 0);
  const hasMultiCurrency = byCurrencyOrig.size > 1;

  return (
    <div>
      {/* 前後の配信ナビ */}
      {(prevVideo || nextVideo) && (
        <div className="mb-4 flex items-center justify-between gap-2">
          {prevVideo ? (
            <Link
              href={`/live/${prevVideo.video_id}`}
              className="group flex min-w-0 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs text-gray-500 shadow-sm transition-all hover:border-violet-300 hover:text-violet-600 hover:shadow-md"
            >
              <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 4l-4 4 4 4" />
              </svg>
              <span className="flex flex-col">
                <span className="text-[10px] text-gray-400">前の配信</span>
                <span className="truncate max-w-[120px] font-medium sm:max-w-[200px]">{formatDateShort(prevVideo.start_time)}</span>
              </span>
            </Link>
          ) : <div />}
          {nextVideo ? (
            <Link
              href={`/live/${nextVideo.video_id}`}
              className="group ml-auto flex min-w-0 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs text-gray-500 shadow-sm transition-all hover:border-violet-300 hover:text-violet-600 hover:shadow-md"
            >
              <span className="flex flex-col items-end">
                <span className="text-[10px] text-gray-400">次の配信</span>
                <span className="truncate max-w-[120px] font-medium sm:max-w-[200px]">{formatDateShort(nextVideo.start_time)}</span>
              </span>
              <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 4l4 4-4 4" />
              </svg>
            </Link>
          ) : <div />}
        </div>
      )}

      {/* ヘッダー */}
      <div className="relative mb-6 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        {channel?.icon_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={channel.icon_url}
            alt=""
            aria-hidden
            className="pointer-events-none absolute right-0 top-1/2 hidden h-56 w-56 -translate-y-1/2 translate-x-10 rounded-full object-cover opacity-100 select-none md:block"
          />
        )}
        <div className="relative p-4 sm:p-5">
          <div className="mb-2.5 flex flex-wrap items-center gap-2">
            {video.status === "live" ? (
              <span className="flex items-center gap-1.5 rounded-full bg-red-500 px-2.5 py-0.5 text-xs font-semibold text-white shadow-sm">
                ● LIVE
                {video.start_time && <LiveTimer startTime={video.start_time} />}
              </span>
            ) : (
              <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-500">配信終了</span>
            )}
            <Link
              href={`/channel/${video.channel_id}`}
              className="flex items-center gap-1.5 text-sm font-medium text-violet-600 transition-opacity hover:opacity-70"
            >
              {channel?.icon_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={channel.icon_url} alt="" className="h-5 w-5 rounded-full object-cover" />
              )}
              {channel?.name ?? video.channel_id}
            </Link>
          </div>
          <h1 className="text-lg font-bold leading-snug text-gray-900 sm:text-xl">{video.title}</h1>
          {video.start_time && (
            <p className="mt-1.5 text-xs text-gray-400">
              {formatJST(video.start_time)}
              {video.end_time && <span className="ml-1 text-gray-300">→ {formatJST(video.end_time)}</span>}
            </p>
          )}
        </div>
      </div>

      {/* グラフ */}
      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">同接推移</h2>
          {video.status === "live" && <RefreshButton videoId={video.video_id} />}
        </div>
        {chartData.length > 0 ? (
          <LiveGraphSection
            data={chartData}
            videoId={video.video_id}
            iconUrl={channel?.icon_url ?? undefined}
            channelName={channel?.name ?? undefined}
            startTime={video.start_time ?? undefined}
            height={400}
            platform={video.platform ?? channel?.platform ?? undefined}
            twitchLogin={channel?.custom_url ?? undefined}
            thumbnailUrl={video.thumbnail_url ?? undefined}
          />
        ) : (
          <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-400">
            グラフデータがまだありません（ライブ中に自動収集されます）
          </div>
        )}
      </section>

      {/* スパチャ一覧 */}
      <section className="mb-10">
        <h2 className="mb-3 text-lg font-semibold text-gray-900">
          スパチャ一覧{" "}
          <span className="text-sm font-normal text-gray-400">
            ({superchats.length}件 / 合計 ≈ ¥{totalJPY.toLocaleString()})
          </span>
          {hasMultiCurrency && (
            <p className="mt-0.5 text-xs text-gray-400">
              {Array.from(byCurrencyOrig.entries()).map(([cur, orig], i) => {
                const jpy = byCurrencyJPY.get(cur) ?? 0;
                return (
                  <span key={cur}>
                    {i > 0 && <span className="mx-1">+</span>}
                    {cur === "JPY"
                      ? `¥${orig.toLocaleString()}`
                      : `${cur} ${orig.toLocaleString()} → ¥${jpy.toLocaleString()}`}
                  </span>
                );
              })}
            </p>
          )}
        </h2>

        {superchats.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-400">
            スパチャはありません
          </div>
        ) : (
          <SuperchatList
            videoId={videoId}
            platform={video.platform}
            thumbnailUrl={video.thumbnail_url ?? undefined}
            items={scWithBucket.map(({ sc, bucket, isFirstInBucket }) => ({
              id: sc.id,
              author_name: sc.author_name,
              amount: sc.amount,
              currency: sc.currency,
              comment: sc.comment,
              tier: sc.tier,
              published_at: sc.published_at,
              amount_jpy: sc.currency !== "JPY" ? toJPY(sc.amount, sc.currency, rates) : null,
              bucket,
              isFirstInBucket,
            } satisfies SCItem))}
          />
        )}
      </section>

      {/* チャンネルへのリンク */}
      <div className="flex items-center gap-3">
        <Link
          href={`/channel/${video.channel_id}`}
          className="inline-flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-4 py-2.5 text-sm font-medium text-violet-600 transition-all hover:bg-violet-100 hover:shadow-sm"
        >
          {channel?.icon_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={channel.icon_url} alt="" className="h-5 w-5 rounded-full object-cover" />
          )}
          {channel?.name ?? "チャンネル"}へ →
        </Link>
        <Link
          href="/"
          className="text-sm text-gray-400 transition-colors hover:text-gray-600"
        >
          ホームへ
        </Link>
      </div>
    </div>
  );
}
