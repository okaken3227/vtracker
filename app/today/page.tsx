import { supabase } from "@/lib/supabase/client";
import type { Channel, Video, LiveGraphPoint, Group, Superchat } from "@/lib/types";
import { buildChart } from "@/lib/buildChart";
import { fetchRatesToJPY } from "@/lib/exchange";
import { JST_OFFSET_MS, getJstMidnightMs, offsetDate, getTodayJST } from "@/lib/jst";
import ViewerChart from "@/app/components/ViewerChart";
import Link from "next/link";

export const dynamic = "force-dynamic";

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
      <div className="mb-6">
        <Link href="/" className="text-sm text-gray-400 hover:text-violet-600">
          ← ホーム
        </Link>
        <h1 className="mt-2 text-xl font-bold text-gray-900">
          {dateLabel} 配信タイムライン
        </h1>
        <div className="mt-3 flex items-center gap-2">
          <Link
            href={`/timeline/${yesterdayJST}`}
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-600 shadow-sm transition-colors hover:border-violet-400 hover:text-violet-600"
          >
            ← 前日を見る
          </Link>
        </div>
      </div>

      {chartData.length > 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="mb-3 text-sm font-medium text-gray-500">
            0:00〜現在の同接推移（クリックで配信ページへ）
          </p>
          <ViewerChart data={chartData} streams={streams} />
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-gray-300 p-20 text-center text-sm text-gray-400">
          今日の配信データがまだありません
        </div>
      )}
    </div>
  );
}
