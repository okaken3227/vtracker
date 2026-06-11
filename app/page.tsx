import type { Metadata } from "next";
import Link from "next/link";
import { unstable_cache } from "next/cache";
import { supabase } from "@/lib/supabase/client";
import type { Channel, Video, Superchat, Group } from "@/lib/types";
import { getJstMidnightMs } from "@/lib/jst";
import HomeContent from "./components/HomeContent";
import { getAllArticles, CATEGORY_LABEL, CATEGORY_STYLE } from "@/lib/articles";

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
              ライブ配信中の同時接続数を分単位で記録し、時系列グラフとして可視化します。
              配信終了後もグラフはそのまま残るため、ピーク時刻や視聴者数の推移を後から振り返ることができます。
              グラフ上の任意の時点をクリックすると、YouTube動画の該当時刻にジャンプすることも可能です。
            </p>
          </div>
          <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
            <h3 className="mb-1.5 font-semibold text-gray-900">スパチャ金額・件数を集計</h3>
            <p className="text-sm leading-relaxed text-gray-600">
              配信ごとのスーパーチャット金額と件数を一覧表示し、累計を集計します。
              USD・EUR・KRW・TWDなど海外通貨のスパチャは、配信時点のレートで円換算した値を併記。
              「あの瞬間にスパチャが集中していた」という熱量を時刻つきで振り返ることができます。
            </p>
          </div>
          <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
            <h3 className="mb-1.5 font-semibold text-gray-900">ランキングで人気VTuberを発見</h3>
            <p className="text-sm leading-relaxed text-gray-600">
              今日・今週・今月の3期間で、同接ピーク・スパチャ金額・登録者数の各指標についてランキングを表示。
              VTuberシーン全体の勢いを俯瞰したり、新しい推しを見つけるきっかけとして活用できます。
            </p>
          </div>
          <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
            <h3 className="mb-1.5 font-semibold text-gray-900">配信を並べて比較</h3>
            <p className="text-sm leading-relaxed text-gray-600">
              複数配信の同接グラフを重ねて1枚のチャートで比較できます。
              コラボ配信のメンバー別集客比較、同企画の別日比較、対決配信での盛り上がり比較など、
              データに基づいた「振り返り」が可能です。
            </p>
          </div>
        </div>

        {/* 詳しい使い方 */}
        <div className="mt-10">
          <h2 className="mb-4 text-lg font-bold text-gray-900">使い方ガイド</h2>
          <div className="space-y-5 text-sm leading-relaxed text-gray-600">
            <div>
              <h3 className="mb-1.5 font-semibold text-gray-800">1. トップページで「いま配信中」のVTuberを把握する</h3>
              <p>
                トップページ上部には、現在ライブ配信中のVTuberが視聴者数順に表示されます。
                サムネイルをクリックすると、その配信の詳細ページ（同接グラフ・スパチャ一覧）に移動します。
              </p>
            </div>
            <div>
              <h3 className="mb-1.5 font-semibold text-gray-800">2. ランキングで勢いのあるVTuberを発見する</h3>
              <p>
                <Link href="/ranking" className="text-violet-600 hover:underline">ランキングページ</Link>
                では、期間（今日／今週／今月）と指標（同接ピーク／スパチャ金額／登録者数）を切り替えて、
                それぞれの上位50チャンネルを確認できます。
              </p>
            </div>
            <div>
              <h3 className="mb-1.5 font-semibold text-gray-800">3. チャンネルページで推しの活動を深掘り</h3>
              <p>
                各チャンネル名をクリックすると、登録者数の推移グラフ、過去30本の配信一覧、
                月別の配信本数・累計時間・累計スパチャを確認できます。推しの活動ペースを月単位で把握するのに最適です。
              </p>
            </div>
            <div>
              <h3 className="mb-1.5 font-semibold text-gray-800">4. グループページで事務所ごとに俯瞰する</h3>
              <p>
                <Link href="/groups" className="text-violet-600 hover:underline">グループ一覧</Link>
                から、にじさんじ・ホロライブ・ぶいすぽっ！などの事務所ページに移動できます。
                所属メンバー全体のライブ状況や合計登録者数をまとめて確認できます。
              </p>
            </div>
            <div>
              <h3 className="mb-1.5 font-semibold text-gray-800">5. 比較機能で「2配信を1枚のグラフ」に重ねる</h3>
              <p>
                <Link href="/compare" className="text-violet-600 hover:underline">比較ページ</Link>
                では、任意の配信またはチャンネルを選んで、同接推移を1つのグラフ上に並べて表示できます。
                コラボ配信や対決企画の振り返りに便利です。
              </p>
            </div>
          </div>
        </div>

        {/* よくある質問 */}
        <div className="mt-12">
          <h2 className="mb-4 text-lg font-bold text-gray-900">よくある質問</h2>
          <dl className="space-y-5 text-sm leading-relaxed text-gray-600">
            <div>
              <dt className="font-semibold text-gray-800">Q. 利用料金はかかりますか？</dt>
              <dd className="mt-1">
                すべての機能を無料でご利用いただけます。会員登録・課金は不要です。
                サーバー費用はサイトに表示される広告で賄っています。
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-gray-800">Q. 表示されている同接数は正確ですか？</dt>
              <dd className="mt-1">
                YouTube Data APIから一定間隔で取得した値をそのまま表示しています。
                瞬間値ではなくサンプリング値のため、数十秒〜数分の誤差が生じる場合があります。
                配信者本人の公式発表値と差異がある場合は、公式値を正としてご認識ください。
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-gray-800">Q. 海外スパチャの円換算はどう計算していますか？</dt>
              <dd className="mt-1">
                配信時点で取得した参考為替レート（公開為替APIを利用）を用いて日本円に換算しています。
                レートは変動するため、表示金額は概算値です。
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-gray-800">Q. 追跡してほしいVTuberがいます。</dt>
              <dd className="mt-1">
                <Link href="/feedback" className="text-violet-600 hover:underline">要望・質問フォーム</Link>
                からチャンネル名またはURLをお送りください。確認のうえ順次追加します。
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-gray-800">Q. 自分のチャンネルを掲載停止してほしい場合は？</dt>
              <dd className="mt-1">
                VTuber本人または所属事務所からのご依頼により、掲載停止に対応します。
                <Link href="/feedback" className="text-violet-600 hover:underline">要望・質問フォーム</Link>
                よりご連絡ください。
              </dd>
            </div>
          </dl>
        </div>

        {/* 最新コラム */}
        <div className="mt-12">
          <div className="mb-4 flex items-end justify-between">
            <h2 className="text-lg font-bold text-gray-900">VTuberコラム・読み物</h2>
            <Link href="/articles" className="text-xs font-medium text-violet-600 hover:underline">
              すべて見る →
            </Link>
          </div>
          <p className="mb-4 text-sm leading-relaxed text-gray-600">
            同接やスパチャの仕組み、事務所ガイド、推し活入門、配信データの読み方など、
            VTuber文化をもっと深く楽しむための解説記事を掲載しています。
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {getAllArticles().slice(0, 4).map((a) => (
              <Link
                key={a.slug}
                href={`/articles/${a.slug}`}
                className="group block rounded-xl border border-gray-100 bg-white p-4 shadow-sm transition-all hover:border-violet-200 hover:shadow-md"
              >
                <div className="mb-2 flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${CATEGORY_STYLE[a.category]}`}>
                    {CATEGORY_LABEL[a.category]}
                  </span>
                  <span className="text-[11px] text-gray-400">約{a.readMinutes}分</span>
                </div>
                <p className="text-sm font-semibold leading-snug text-gray-900 group-hover:text-violet-600 transition-colors">
                  {a.title}
                </p>
                <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-gray-500">
                  {a.description}
                </p>
              </Link>
            ))}
          </div>
        </div>

        <div className="mt-10 rounded-xl bg-gradient-to-br from-violet-50/60 via-white to-pink-50/40 p-5 text-sm leading-relaxed text-gray-600">
          <p>
            すべての機能は<span className="font-medium text-gray-800">無料</span>でご利用いただけます。
            会員登録やログインは不要です。
            追跡対象のVTuberチャンネル追加リクエストは
            <Link href="/feedback" className="mx-1 text-violet-600 hover:underline">要望・質問フォーム</Link>
            から受け付けています。サービスの詳細については
            <Link href="/about" className="mx-1 text-violet-600 hover:underline">vtrackerについて</Link>
            ページをご覧ください。
          </p>
        </div>
      </section>
    </>
  );
}
