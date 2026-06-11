import type { Metadata } from "next";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import type { Channel, Video, ChannelStatsHistory, Group, Superchat } from "@/lib/types";
import { fetchRatesToJPY } from "@/lib/exchange";
import BackButton from "./BackButton";
import ChannelPageContent, { type ChData } from "./ChannelPageContent";
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ channelId: string }>;
}): Promise<Metadata> {
  const { channelId } = await params;
  const { data } = await supabase
    .from("channels")
    .select("name, description, icon_url, subscriber_count")
    .eq("channel_id", channelId)
    .single();
  if (!data) return {};
  const ch = data as { name: string; description: string | null; icon_url: string | null; subscriber_count: number | null };
  const sub = ch.subscriber_count ? `登録者${ch.subscriber_count >= 10000 ? `${(ch.subscriber_count / 10000).toFixed(0)}万` : ch.subscriber_count.toLocaleString()}人` : null;
  const description = `${ch.name}の視聴者数・スパチャ・配信履歴を追跡します。${sub ? `${sub}。` : ""}`;
  const images = ch.icon_url ? [{ url: ch.icon_url }] : [];
  return {
    title: ch.name,
    description,
    openGraph: { title: `${ch.name} | vtracker`, description, images },
    twitter: { card: "summary", title: `${ch.name} | vtracker`, description, images },
  };
}

async function fetchChannelData(channelId: string): Promise<ChData | null> {
  // 今月の開始（JST: UTC+9）
  const nowMs = Date.now();
  const jstNow = new Date(nowMs + 9 * 3600 * 1000);
  const monthStartUtc = new Date(Date.UTC(jstNow.getUTCFullYear(), jstNow.getUTCMonth(), 1) - 9 * 3600 * 1000);
  const monthStartIso = monthStartUtc.toISOString();
  const monthLabel = `${jstNow.getUTCFullYear()}年${jstNow.getUTCMonth() + 1}月`;

  // 6ヶ月前の月初（JST）
  const sixMonthsAgoIso = new Date(
    Date.UTC(jstNow.getUTCFullYear(), jstNow.getUTCMonth() - 5, 1) - 9 * 3600 * 1000
  ).toISOString();

  const [channelRes, videosRes, historyRes, allVideoIdsRes, monthlyRes, sixMonthsRes] = await Promise.all([
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
    supabase
      .from("videos")
      .select("video_id, start_time, end_time, status")
      .eq("channel_id", channelId)
      .gte("start_time", monthStartIso)
      .neq("status", "upcoming")
      .not("start_time", "is", null),
    supabase
      .from("videos")
      .select("start_time, end_time, status")
      .eq("channel_id", channelId)
      .gte("start_time", sixMonthsAgoIso)
      .neq("status", "upcoming")
      .not("start_time", "is", null),
  ]);

  const channel = channelRes.data as Channel | null;
  if (!channel) return null;

  const videos = (videosRes.data ?? []) as Video[];
  const history = (historyRes.data ?? []) as ChannelStatsHistory[];
  const allVideoIds = ((allVideoIdsRes.data ?? []) as { video_id: string }[]).map((v) => v.video_id);
  const videoIds = videos.map((v) => v.video_id);

  const [groupRes, scRes, peakRes] = await Promise.all([
    channel.group_id
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
  const parentGroupRes = group?.parent_group_id
    ? await supabase.from("groups").select("*").eq("id", group.parent_group_id).single()
    : { data: null };
  const parentGroup = parentGroupRes.data as Group | null;

  const scRows = (scRes.data ?? []) as Pick<Superchat, "amount_jpy" | "amount" | "currency">[];
  const needsRates = scRows.some((sc) => sc.amount_jpy == null && sc.currency !== "JPY");
  const rates = needsRates ? await fetchRatesToJPY() : {};
  const totalSCJPY = scRows.reduce((sum, sc) => {
    const jpy = sc.amount_jpy ?? (sc.currency === "JPY" ? sc.amount : rates[sc.currency] ? Math.round(sc.amount / rates[sc.currency]) : 0);
    return sum + jpy;
  }, 0);

  const peakByVideo: Record<string, number> = {};
  for (const p of (peakRes.data ?? []) as { video_id: string; concurrent_viewers: number }[]) {
    peakByVideo[p.video_id] = Math.max(peakByVideo[p.video_id] ?? 0, p.concurrent_viewers);
  }

  // 今月の配信統計
  const monthlyVideos = (monthlyRes.data ?? []) as { video_id: string; start_time: string | null; end_time: string | null; status: string }[];
  const streamCount = monthlyVideos.length;
  const totalSeconds = monthlyVideos.reduce((sum, v) => {
    if (!v.start_time || !v.end_time) return sum;
    return sum + (new Date(v.end_time).getTime() - new Date(v.start_time).getTime()) / 1000;
  }, 0);
  const totalHours = totalSeconds / 3600;
  const monthlyPeaks = monthlyVideos.map((v) => peakByVideo[v.video_id] ?? 0).filter((n) => n > 0);
  const avgPeakViewers = monthlyPeaks.length > 0 ? Math.round(monthlyPeaks.reduce((s, n) => s + n, 0) / monthlyPeaks.length) : 0;
  const monthlyStats = { streamCount, totalHours, avgPeakViewers, monthLabel };

  // 月次履歴（過去6ヶ月）
  type SixMonthRow = { start_time: string | null; end_time: string | null; status: string };
  const sixMonthMap = new Map<string, { streamCount: number; totalSeconds: number }>();
  for (const v of (sixMonthsRes.data ?? []) as SixMonthRow[]) {
    if (!v.start_time) continue;
    const jst = new Date(new Date(v.start_time).getTime() + 9 * 3600 * 1000);
    const key = `${jst.getUTCFullYear()}-${String(jst.getUTCMonth() + 1).padStart(2, "0")}`;
    const entry = sixMonthMap.get(key) ?? { streamCount: 0, totalSeconds: 0 };
    entry.streamCount++;
    if (v.end_time) {
      entry.totalSeconds += (new Date(v.end_time).getTime() - new Date(v.start_time).getTime()) / 1000;
    }
    sixMonthMap.set(key, entry);
  }
  const monthlyHistory = Array.from(sixMonthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, stats]) => ({
      monthKey: key,
      monthLabel: `${parseInt(key.split("-")[1])}月`,
      streamCount: stats.streamCount,
      totalHours: stats.totalSeconds / 3600,
    }));

  return { channel, videos, history, group, parentGroup, totalSCJPY, peakByVideo, monthlyStats, monthlyHistory };
}

export default async function ChannelPage({
  params,
}: {
  params: Promise<{ channelId: string }>;
}) {
  const { channelId } = await params;

  const mainData = await fetchChannelData(channelId);

  if (!mainData) {
    return (
      <div className="py-20 text-center text-gray-500">
        チャンネルが見つかりません
      </div>
    );
  }

  const linkedChannelId = mainData.channel.linked_channel_id;
  const linkedData = linkedChannelId ? await fetchChannelData(linkedChannelId) : null;

  return (
    <div>
      <BackButton />
      <ChannelPageContent
        mainData={mainData}
        linkedData={linkedData}
        startChannelId={channelId}
      />

      {/* チャンネルページの解説 */}
      <section className="mt-12 border-t border-gray-100 pt-8 text-sm leading-relaxed text-gray-600">
        <h2 className="mb-3 text-base font-semibold text-gray-900">このページについて</h2>
        <div className="space-y-3">
          <p>
            このページは、<span className="font-medium text-gray-800">{mainData.channel.name}</span>のチャンネルに関する
            活動データをまとめたアーカイブページです。チャンネル登録者数の推移グラフ、
            過去30本の配信履歴、今月の配信本数・累計配信時間・累計スパチャ金額、
            過去6ヶ月分の月別活動量を確認できます。
          </p>
          <p>
            登録者数の推移グラフは、定期的に取得したスナップショットをつないだものです。
            数百〜数千人単位の細かな増減は、サンプリング間隔の関係で正確に反映されない場合があります。
            長期的なトレンドの把握にご活用ください。
          </p>
          <p>
            配信履歴の各サムネイルをクリックすると、その配信の詳細ページ（同接グラフ・スパチャ一覧）に
            移動します。グラフ上の時点をクリックすると、YouTube動画の該当時刻にジャンプして
            その瞬間の様子を確認できます。
          </p>
          <p>
            このページに表示される情報は、YouTube Data API（および該当チャンネルがTwitchの場合は Twitch API）が
            公開しているデータをもとに、本サービスが独自に集計・可視化したものです。
            掲載内容に関するご指摘や、掲載停止のご依頼は
            <Link href="/feedback" className="mx-1 text-violet-600 hover:underline">要望・質問フォーム</Link>
            よりお寄せください（本人または所属事務所からのご依頼を優先します）。
          </p>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/" className="text-violet-600 hover:underline">ホーム</Link>
          <span className="text-gray-200">·</span>
          <Link href="/ranking" className="text-violet-600 hover:underline">ランキング</Link>
          <span className="text-gray-200">·</span>
          <Link href="/compare" className="text-violet-600 hover:underline">配信比較</Link>
          <span className="text-gray-200">·</span>
          <Link href="/about" className="text-violet-600 hover:underline">サービスについて</Link>
        </div>
      </section>
    </div>
  );
}
