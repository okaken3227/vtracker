import { supabase } from "@/lib/supabase/client";
import type { Channel, Video, LiveGraphPoint, Group, Superchat } from "@/lib/types";
import { buildChart } from "@/lib/buildChart";
import { fetchRatesToJPY } from "@/lib/exchange";
import { JST_OFFSET_MS, getJstMidnightForDate, getTodayJST, offsetDate } from "@/lib/jst";
import ViewerChart from "@/app/components/ViewerChart";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function TimelinePage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return notFound();

  const todayJST = getTodayJST();
  if (date > todayJST) return notFound();

  const isToday = date === todayJST;
  const jstMidnightMs = getJstMidnightForDate(date);
  const jstNextMidnightMs = jstMidnightMs + 86400000;
  const fromIso = new Date(jstMidnightMs).toISOString();
  const toIso = new Date(jstNextMidnightMs).toISOString();

  const prevDate = offsetDate(date, -1);
  const nextDate = offsetDate(date, 1);
  const canNext = nextDate <= todayJST;

  const [chRes, vRes, gpRes, grRes, scRes] = await Promise.all([
    supabase.from("channels").select("*"),
    supabase.from("videos").select("*"),
    supabase
      .from("live_graph_points")
      .select("*")
      .gte("recorded_at", fromIso)
      .lt("recorded_at", toIso)
      .order("recorded_at", { ascending: true }),
    supabase.from("groups").select("*"),
    supabase
      .from("superchats")
      .select("video_id, amount, currency, amount_jpy")
      .gte("published_at", fromIso)
      .lt("published_at", toIso),
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
  const dateLabel = jstDate.toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" });

  return (
    <div>
      {/* ヘッダー */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-gray-400">
            <Link href="/" className="hover:text-violet-600 transition-colors">ホーム</Link>
            <span>›</span>
            <Link href="/today" className="hover:text-violet-600 transition-colors">タイムライン</Link>
          </div>
          <h1 className="text-xl font-bold text-gray-900">
            {dateLabel}
            {isToday && (
              <span className="ml-2 rounded-full bg-violet-100 px-2.5 py-0.5 text-sm font-medium text-violet-600">今日</span>
            )}
          </h1>
          <p className="mt-0.5 text-xs text-gray-400">
            0:00〜24:00 の同接推移 · クリックで配信ページへ
          </p>
        </div>

        {/* 日付ナビ */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Link
            href={`/timeline/${prevDate}`}
            className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 shadow-sm transition-colors hover:border-violet-300 hover:text-violet-600"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 3L5 8l5 5" />
            </svg>
            前日
          </Link>
          {!isToday && (
            <Link
              href="/today"
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-500 shadow-sm transition-colors hover:border-violet-300 hover:text-violet-600"
            >
              今日
            </Link>
          )}
          {canNext && (
            <Link
              href={isToday ? "/today" : `/timeline/${nextDate}`}
              className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 shadow-sm transition-colors hover:border-violet-300 hover:text-violet-600"
            >
              翌日
              <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 3l5 5-5 5" />
              </svg>
            </Link>
          )}
        </div>
      </div>

      {/* チャート */}
      {chartData.length > 0 ? (
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-6">
          <ViewerChart data={chartData} streams={streams} />
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-gray-200 py-24 text-center text-sm text-gray-400">
          この日の配信データがありません
        </div>
      )}
    </div>
  );
}
