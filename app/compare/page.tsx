import type { Metadata } from "next";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import type { Channel, Group } from "@/lib/types";
import CompareClient from "./CompareClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "VTuberチャンネル比較 | 同接・スパチャ・登録者数を並べて表示",
  description:
    "複数のVTuberチャンネルや配信を選んで、同接推移・スーパーチャット・登録者数を1枚のグラフで比較できます。コラボ配信のメンバー別集客比較や、別日の同企画配信の盛り上がり比較などに活用できます。",
  alternates: { canonical: "/compare" },
};

export default async function ComparePage() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [chRes, grRes, liveRes, scRes] = await Promise.all([
    supabase.from("channels").select("*").order("subscriber_count", { ascending: false }),
    supabase
      .from("groups")
      .select("*")
      .order("sort_order", { ascending: true, nullsFirst: false })
      .order("name"),
    supabase.from("videos").select("channel_id").eq("status", "live"),
    supabase
      .from("superchats")
      .select("video_id, amount_jpy")
      .gte("published_at", thirtyDaysAgo)
      .not("amount_jpy", "is", null)
      .limit(200000),
  ]);

  const channels = (chRes.data ?? []) as Channel[];
  const groups = (grRes.data ?? []) as Group[];
  const liveChannelIds = [...new Set(
    ((liveRes.data ?? []) as { channel_id: string }[]).map((v) => v.channel_id)
  )];

  // SC上位チャンネルを計算
  const scByVideo = new Map<string, number>();
  for (const sc of (scRes.data ?? []) as { video_id: string; amount_jpy: number }[]) {
    scByVideo.set(sc.video_id, (scByVideo.get(sc.video_id) ?? 0) + sc.amount_jpy);
  }

  let defaultScChannelIds: string[] = [];
  if (scByVideo.size > 0) {
    const scVideoIds = Array.from(scByVideo.keys());
    const { data: scVideos } = await supabase
      .from("videos")
      .select("video_id, channel_id")
      .in("video_id", scVideoIds);

    const scByChannel = new Map<string, number>();
    for (const v of (scVideos ?? []) as { video_id: string; channel_id: string }[]) {
      const amt = scByVideo.get(v.video_id) ?? 0;
      scByChannel.set(v.channel_id, (scByChannel.get(v.channel_id) ?? 0) + amt);
    }
    defaultScChannelIds = [...scByChannel.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id]) => id);
  }

  return (
    <div>
      <div className="mb-6">
        <div className="mb-1 flex items-center gap-2 text-xs text-gray-400">
          <Link href="/" className="hover:text-violet-600 transition-colors">ホーム</Link>
          <span>›</span>
          <span>チャンネル比較</span>
        </div>
        <h1 className="text-xl font-bold text-gray-900">VTuberチャンネル比較</h1>
        <p className="mt-2 text-sm leading-relaxed text-gray-600">
          複数のVTuberチャンネル、または個別の配信を選んで、同時接続数の推移・スパチャ金額・登録者数を
          1つのグラフ上に並べて比較できます。コラボ配信のメンバー別集客や、別日の同企画配信の盛り上がりなど、
          数字とグラフで直感的に把握したい場合にご活用ください。
        </p>
      </div>

      <CompareClient
        channels={channels}
        groups={groups}
        liveChannelIds={liveChannelIds}
        defaultScChannelIds={defaultScChannelIds}
      />

      {/* 解説 */}
      <section className="mt-12 border-t border-gray-100 pt-10 text-sm leading-relaxed text-gray-600">
        <h2 className="mb-4 text-lg font-bold text-gray-900">比較機能の使い方</h2>
        <div className="space-y-4">
          <div>
            <h3 className="mb-1 font-semibold text-gray-800">1. チャンネルを選択する</h3>
            <p>
              画面上部のチャンネル選択エリアから、比較したいVTuberを最大10チャンネルまで追加できます。
              事務所・グループでフィルタリングすることもできるため、
              同じグループ内の人気比較などにも便利です。
            </p>
          </div>
          <div>
            <h3 className="mb-1 font-semibold text-gray-800">2. 指標を切り替える</h3>
            <p>
              「同接推移」「スパチャ金額」「登録者数」の3つの指標をボタンで切り替えられます。
              指標によって縦軸のスケールが自動調整されます。
            </p>
          </div>
          <div>
            <h3 className="mb-1 font-semibold text-gray-800">3. 期間・モードを変更する</h3>
            <p>
              同接推移モードでは、「ライブ中の比較」と「過去配信の比較（直近の配信を時刻ゼロから揃えて重ねる）」の
              2つの表示モードを切り替えられます。
              スパチャ・登録者数モードでは、1日／3日／7日／全期間の期間プリセットを利用できます。
            </p>
          </div>
          <div>
            <h3 className="mb-1 font-semibold text-gray-800">4. グラフ上の情報を読み取る</h3>
            <p>
              グラフ上にマウスを乗せる（またはタップする）と、その時点での各チャンネルの数値が
              ツールチップで表示されます。線の色とチャンネルアイコンの色は連動しているため、
              凡例を確認しなくても誰のラインかを直感的に把握できます。
            </p>
          </div>
        </div>

        <h2 className="mt-8 mb-3 text-base font-semibold text-gray-900">こんな場面で活用できます</h2>
        <ul className="ml-5 list-disc space-y-1.5">
          <li>コラボ配信に参加した各メンバーの個別配信視聴者数を一覧で比較</li>
          <li>同一企画（例: 同じゲームの初見プレイ配信）の別日比較</li>
          <li>新人VTuberと既存VTuberの登録者数推移の比較</li>
          <li>大型イベント期間中の事務所内ランキングの可視化</li>
        </ul>

        <div className="mt-6 flex flex-wrap gap-3 text-sm">
          <Link href="/" className="text-violet-600 hover:underline">ホーム</Link>
          <span className="text-gray-200">·</span>
          <Link href="/ranking" className="text-violet-600 hover:underline">ランキング</Link>
          <span className="text-gray-200">·</span>
          <Link href="/groups" className="text-violet-600 hover:underline">グループ一覧</Link>
          <span className="text-gray-200">·</span>
          <Link href="/about" className="text-violet-600 hover:underline">サービスについて</Link>
        </div>
      </section>
    </div>
  );
}
