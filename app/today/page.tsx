import type { Metadata } from "next";
import { supabase } from "@/lib/supabase/client";
import type { Channel, Video, Group, Superchat } from "@/lib/types";
import { buildChart, type GraphPoint } from "@/lib/buildChart";
import { fetchRatesToJPY } from "@/lib/exchange";
import { JST_OFFSET_MS, getJstMidnightMs, offsetDate, getTodayJST } from "@/lib/jst";
import ViewerChart from "@/app/components/ViewerChart";
import AutoRefresher from "@/app/components/AutoRefresher";
import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "本日のVTuber配信タイムライン | 同接推移まとめ",
  description:
    "本日のVTuber配信を時系列の同接グラフで一覧表示。日本時間0:00〜現在までの全配信について、視聴者数の推移をひとつのチャートで確認できます。にじさんじ・ホロライブ・ぶいすぽっ！などの配信ピークを当日中に振り返ることができます。",
  alternates: { canonical: "/today" },
};

export default async function TodayPage() {
  const jstMidnightMs = getJstMidnightMs();
  const todayIso = new Date(jstMidnightMs).toISOString();
  const tomorrowIso = new Date(jstMidnightMs + 86400000).toISOString();

  const [chRes, gpRes, grRes, scRes] = await Promise.all([
    supabase.from("channels").select("*"),
    supabase.rpc("get_chart_data", { from_ts: todayIso, to_ts: tomorrowIso }).limit(200000),
    supabase.from("groups").select("*").order("sort_order", { ascending: true, nullsFirst: false }).order("name"),
    supabase
      .from("superchats")
      .select("video_id, amount, currency, amount_jpy")
      .gte("published_at", todayIso)
      .limit(50000),
  ]);

  const channels = (chRes.data ?? []) as Channel[];
  const graphPoints = (gpRes.data ?? []) as GraphPoint[];

  // グラフデータに登場する video_id だけを直接クエリ
  const videoIds = [...new Set(graphPoints.map((p) => p.video_id))];
  const vRes = videoIds.length > 0
    ? await supabase.from("videos").select("*").in("video_id", videoIds)
    : { data: [] as Video[], error: null };
  const videos = (vRes.data ?? []) as Video[];
  const groups = (grRes.data ?? []) as Group[];
  const scRows = (scRes.data ?? []) as Pick<Superchat, "video_id" | "amount" | "currency" | "amount_jpy">[];

  const needsRates = scRows.some((sc) => sc.amount_jpy == null && sc.currency !== "JPY");
  const rates = needsRates ? await fetchRatesToJPY() : {};

  const scByVideo = new Map<string, number>();
  for (const sc of scRows) {
    const jpy =
      sc.amount_jpy ??
      (sc.currency === "JPY" ? sc.amount : rates[sc.currency] ? Math.round(sc.amount / rates[sc.currency]) : 0);
    scByVideo.set(sc.video_id, (scByVideo.get(sc.video_id) ?? 0) + jpy);
  }

  const { data: chartData, streams } = buildChart(videos, graphPoints, channels, groups, jstMidnightMs, scByVideo);

  const jstDate = new Date(jstMidnightMs + JST_OFFSET_MS);
  const dateLabel = jstDate.toLocaleDateString("ja-JP", { month: "long", day: "numeric" });
  const yesterdayJST = offsetDate(getTodayJST(), -1);

  return (
    <div>
      <AutoRefresher intervalMs={60000} />
      {/* ヘッダー */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-gray-400">
            <Link href="/" className="hover:text-violet-600 transition-colors">ホーム</Link>
            <span>›</span>
            <span>タイムライン</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900">
            {dateLabel}
            <span className="ml-2 rounded-full bg-violet-100 px-2.5 py-0.5 text-sm font-medium text-violet-600">今日</span>
          </h1>
          <p className="mt-0.5 text-xs text-gray-400">
            0:00〜現在の同接推移 · クリックで配信ページへ
          </p>
        </div>

        <Link
          href={`/timeline/${yesterdayJST}`}
          className="flex items-center gap-1.5 self-start rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 shadow-sm transition-colors hover:border-violet-300 hover:text-violet-600 sm:self-auto"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 3L5 8l5 5" />
          </svg>
          前日
        </Link>
      </div>

      {/* チャート */}
      {chartData.length > 0 ? (
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-6">
          <ViewerChart data={chartData} streams={streams} />
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-gray-200 py-24 text-center text-sm text-gray-400">
          今日の配信データがまだありません
        </div>
      )}

      {/* 解説 */}
      <section className="mt-10 border-t border-gray-100 pt-8 text-sm leading-relaxed text-gray-600">
        <h2 className="mb-3 text-base font-semibold text-gray-900">このページについて</h2>
        <div className="space-y-3">
          <p>
            このページは、日本時間の本日0時から現在までに行われた（または進行中の）すべてのVTuber配信について、
            同時接続数の推移を1枚のチャートにまとめて表示します。
            グラフ上の線の濃さや高さで「いつ・誰の・どの配信が盛り上がっていたか」を一目で確認できます。
          </p>
          <p>
            ライブ配信中はおよそ1分ごとにデータが更新され、ページもおよそ60秒間隔で自動再読み込みされます。
            グラフ上の任意の配信ラインをクリックすると、その配信の詳細ページ（同接グラフ拡大表示・スパチャ一覧）に
            移動できます。
          </p>
          <p>
            「特定の日」を遡って確認したい場合は、ヘッダー右上の「前日」ボタンから日付ナビゲーションで
            過去日のタイムラインに移動できます。
          </p>
        </div>

        <h2 className="mt-8 mb-3 text-base font-semibold text-gray-900">こんな使い方ができます</h2>
        <ul className="ml-5 list-disc space-y-1.5">
          <li>「今日同接ピークが高かった配信トップ3」を見つける</li>
          <li>コラボ配信が複数同時に走った時間帯の盛り上がりを比較する</li>
          <li>推しの配信が他の配信と被っていなかったか確認する</li>
          <li>大型コラボや記念配信があった日の全体傾向を振り返る</li>
        </ul>

        <div className="mt-6 flex flex-wrap gap-3 text-sm">
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
