import type { Metadata } from "next";
import { supabase } from "@/lib/supabase/client";
import type { Channel, Video, LiveGraphPoint, Group, Superchat } from "@/lib/types";
import { buildChart } from "@/lib/buildChart";
import { fetchRatesToJPY } from "@/lib/exchange";
import { JST_OFFSET_MS, getJstMidnightMs, offsetDate, getTodayJST } from "@/lib/jst";
import ViewerChart from "@/app/components/ViewerChart";
import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "本日の配信まとめ",
  description: "本日のVTuber配信をまとめてチェック。視聴者数・スパチャのデイリーランキングも確認できます。",
};

export default async function TodayPage() {
  const jstMidnightMs = getJstMidnightMs();
  const todayIso = new Date(jstMidnightMs).toISOString();

  const [chRes, vRes, gpRes, grRes, scRes] = await Promise.all([
    supabase.from("channels").select("*"),
    supabase.from("videos").select("*"),
    supabase
      .from("live_graph_points")
      .select("*")
      .gte("recorded_at", todayIso)
      .order("recorded_at", { ascending: true }),
    supabase.from("groups").select("*"),
    supabase
      .from("superchats")
      .select("video_id, amount, currency, amount_jpy")
      .gte("published_at", todayIso),
  ]);

  const channels = (chRes.data ?? []) as Channel[];
  const videos = (vRes.data ?? []) as Video[];
  const graphPoints = (gpRes.data ?? []) as LiveGraphPoint[];
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
    </div>
  );
}
