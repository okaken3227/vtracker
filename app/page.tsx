import type { Metadata } from "next";
import Link from "next/link";
import { unstable_cache } from "next/cache";
import { supabase } from "@/lib/supabase/client";
import type { Channel, Video, Superchat, Group } from "@/lib/types";
import { getJstMidnightMs } from "@/lib/jst";
import HomeContent from "./components/HomeContent";

export const dynamic = "force-dynamic";

// チャンネル・グループはキャッシュ可（ライブ状態に関係ない）
const fetchCachedChannelsGroups = unstable_cache(
  async () => {
    const [chRes, grRes] = await Promise.all([
      supabase.from("channels").select("channel_id, name, icon_url, custom_url, subscriber_count, group_id, platform, linked_channel_id, color").order("subscriber_count", { ascending: false }),
      supabase.from("groups").select("*").order("sort_order", { ascending: true, nullsFirst: false }).order("name"),
    ]);
    return {
      channels: (chRes.data ?? []) as Channel[],
      groups: (grRes.data ?? []) as Group[],
    };
  },
  ["home-channels-groups"],
  { revalidate: 120 },
);

// グラフポイント・スパチャは3分キャッシュ（手動更新で即時破棄可能）
const fetchCachedLiveData = unstable_cache(
  async () => {
    const jstMidnightMs = getJstMidnightMs();
    const since3hMs = Date.now() - 3 * 60 * 60 * 1000;
    const effectiveFromMs = Math.min(jstMidnightMs, since3hMs);
    const todayIso = new Date(effectiveFromMs).toISOString();
    const since90mIso = new Date(Date.now() - 90 * 60 * 1000).toISOString();
    const [gpRes, lpRes, scRes] = await Promise.all([
      // 「今日配信があった video_id」を抽出するだけなので video_id だけで十分
      supabase
        .from("live_graph_points")
        .select("video_id")
        .gte("recorded_at", todayIso)
        .limit(100000),
      supabase
        .from("live_graph_points")
        .select("video_id, concurrent_viewers, recorded_at")
        .gte("recorded_at", since90mIso)
        .order("recorded_at", { ascending: true })
        .limit(5000),
      supabase
        .from("superchats")
        .select("video_id, amount, amount_jpy, currency")
        .gte("published_at", todayIso)
        .limit(2000),
    ]);
    const todayVideoIds = Array.from(
      new Set(((gpRes.data ?? []) as { video_id: string }[]).map((p) => p.video_id)),
    );
    return {
      todayVideoIds,
      livePoints: (lpRes.data ?? []) as GraphPoint[],
      superchats: (scRes.data ?? []) as SCRow[],
    };
  },
  ["home-live-data"],
  { revalidate: 180, tags: ["home-live-data"] },
);

export const metadata: Metadata = {
  title: "vtracker | VTuber同接グラフ・視聴者数・スパチャ統計をリアルタイム追跡",
  description:
    "VTuberの同時接続数グラフ・視聴者数ランキング・スパチャ統計・配信履歴をリアルタイムで追跡。にじさんじ・ホロライブ・ぶいすぽっ！など人気VTuberのチャンネル登録者数・同接ピークを無料で確認できるVTuber統計サイト。Track VTuber live viewers, superchat stats, and subscriber rankings in real time.",
  alternates: { canonical: "/" },
};

type SCRow = Pick<Superchat, "video_id" | "amount" | "amount_jpy" | "currency">;
type GraphPoint = { video_id: string; concurrent_viewers: number; recorded_at: string };

async function fetchData() {
  try {
    const [{ channels, groups }, vRes, { todayVideoIds, livePoints, superchats }] = await Promise.all([
      fetchCachedChannelsGroups(),
      // videosはライブ状態を即時反映するためキャッシュしない
      supabase
        .from("videos")
        .select("video_id, channel_id, title, thumbnail_url, status, start_time, platform")
        .order("start_time", { ascending: false })
        .limit(500),
      fetchCachedLiveData(),
    ]);

    return {
      channels,
      groups,
      videos: (vRes.data ?? []) as Video[],
      superchats,
      todayVideoIds,
      livePoints,
      error: vRes.error?.message ?? null,
    };
  } catch (e) {
    return { channels: [], videos: [], superchats: [], groups: [], todayVideoIds: [], livePoints: [], error: String(e) };
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

export default async function Home() {
  const { channels, videos, superchats, groups, todayVideoIds, livePoints, error } = await fetchData();
  const scByVideo = scTotalByVideo(superchats);
  const scByChannel = scTotalByChannel(videos, scByVideo);

  return (
    <>
      <section className="mb-6 rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50/60 via-white to-pink-50/40 p-5 shadow-sm sm:p-6">
        <h1 className="mb-2 text-xl font-bold text-gray-900 sm:text-2xl">
          VTuber同接グラフ・スパチャ統計をリアルタイム追跡
        </h1>
        <p className="text-sm leading-relaxed text-gray-600">
          vtrackerは、VTuberの同時接続数（同接）・視聴者数ランキング・スーパーチャット統計を
          リアルタイムで可視化する無料のファンサービスです。にじさんじ・ホロライブ・ぶいすぽっ！など、
          国内外の主要VTuberの配信データをYouTube・Twitchの公開APIから収集し、グラフで分かりやすく表示します。
          <Link href="/about" className="ml-1 text-violet-600 hover:underline">サービスの詳細はこちら →</Link>
        </p>
      </section>

      <HomeContent
        channels={channels}
        videos={videos}
        scByVideo={scByVideo}
        scByChannel={scByChannel}
        groups={groups}
        todayVideoIds={todayVideoIds}
        livePoints={livePoints}
        error={error}
      />

      <section className="mt-12 border-t border-gray-100 pt-10">
        <h2 className="mb-4 text-lg font-bold text-gray-900">vtrackerでできること</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
            <h3 className="mb-1.5 font-semibold text-gray-900">同接グラフをリアルタイム表示</h3>
            <p className="text-sm leading-relaxed text-gray-600">
              ライブ配信中の同時接続数を分単位で記録。配信終了後もグラフが残るため、
              ピーク時刻や視聴者数の推移を後から振り返ることができます。
            </p>
          </div>
          <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
            <h3 className="mb-1.5 font-semibold text-gray-900">スパチャ金額・件数を集計</h3>
            <p className="text-sm leading-relaxed text-gray-600">
              配信ごとのスーパーチャット金額と件数を集計し、ランキング形式で表示。
              複数通貨は自動で円換算します。
            </p>
          </div>
          <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
            <h3 className="mb-1.5 font-semibold text-gray-900">ランキングで人気VTuberを発見</h3>
            <p className="text-sm leading-relaxed text-gray-600">
              今日・今週・今月の同接ランキング、スパチャランキング、登録者数ランキングから、
              いま勢いのあるVTuberを見つけられます。
            </p>
          </div>
          <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
            <h3 className="mb-1.5 font-semibold text-gray-900">配信を並べて比較</h3>
            <p className="text-sm leading-relaxed text-gray-600">
              複数の配信の同接グラフを重ねて比較表示。コラボ配信や同時配信の盛り上がり比較に便利です。
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-xl bg-gray-50 p-5 text-sm leading-relaxed text-gray-600">
          <p>
            すべての機能は<span className="font-medium text-gray-800">無料</span>でご利用いただけます。
            会員登録やログインは不要です。
            追跡対象のVTuberチャンネル追加リクエストは
            <Link href="/feedback" className="mx-1 text-violet-600 hover:underline">要望・質問フォーム</Link>
            から受け付けています。
          </p>
        </div>
      </section>
    </>
  );
}
