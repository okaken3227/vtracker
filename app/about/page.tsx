import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "vtrackerについて | VTuber同接・視聴者数・スパチャ統計",
  description:
    "vtrackerはVTuberの同時接続数・視聴者数・スーパーチャット統計をリアルタイムで追跡・可視化する個人運営のファンサービスです。にじさんじ・ホロライブ・ぶいすぽっ！など国内外の主要VTuberを対象に、YouTube / Twitch の公開APIを通じてデータを収集しています。",
  alternates: { canonical: "/about" },
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="mb-4 text-xl font-bold text-gray-900">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-gray-600">{children}</div>
    </section>
  );
}

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-2 flex items-center gap-2 text-xs text-gray-500">
        <Link href="/" className="hover:text-violet-600 transition-colors">ホーム</Link>
        <span>›</span>
        <span>vtrackerについて</span>
      </div>

      <h1 className="mb-2 text-3xl font-bold text-gray-900">vtrackerについて</h1>
      <p className="mb-10 text-sm text-gray-400">このサービスの概要・目的・使い方をご説明します。</p>

      <Section title="vtrackerとは">
        <p>
          vtrackerは、VTuber（バーチャルYouTuber）の配信活動をデータで追跡・可視化する個人運営のファンサービスです。
          同時接続数（同接）のグラフ、視聴者数ランキング、スーパーチャット（投げ銭）統計など、
          VTuberの活動をさまざまな角度から振り返ることができます。
        </p>
        <p>
          にじさんじ・ホロライブ・ぶいすぽっ！・VSPO EN・個人勢など、国内外の主要VTuberを対象に、
          YouTube Data API v3 および Twitch API が公開するデータを収集・集計しています。
        </p>
        <p>
          すべての機能は無料で利用できます。会員登録やアカウント作成は不要です。
        </p>
      </Section>

      <Section title="主な機能">
        <ul className="ml-4 list-disc space-y-2">
          <li>
            <span className="font-medium text-gray-800">同接グラフ</span>
            — 配信ごとの同時接続数をグラフで時系列表示。ピーク時の視聴者数や推移を一目で確認できます。
            グラフ上の任意の時点をクリックするとその時刻のYouTube動画へジャンプできます。
          </li>
          <li>
            <span className="font-medium text-gray-800">視聴者数ランキング</span>
            — 今日・今週・今月の同接・スパチャ・登録者数で上位チャンネルをランキング表示します。
          </li>
          <li>
            <span className="font-medium text-gray-800">スパチャ統計</span>
            — 配信ごとのスーパーチャット金額・件数を集計。複数通貨は円換算して合計を表示します。
          </li>
          <li>
            <span className="font-medium text-gray-800">チャンネルページ</span>
            — チャンネル登録者数の推移グラフや過去の配信履歴を確認できます。
          </li>
          <li>
            <span className="font-medium text-gray-800">比較機能</span>
            — 複数配信の同接グラフを重ねて比較できます。コラボ配信の同接比較などに便利です。
          </li>
          <li>
            <span className="font-medium text-gray-800">タイムライン</span>
            — 特定の日付に行われた配信を一覧表示。過去の配信をまとめて振り返れます。
          </li>
        </ul>
      </Section>

      <Section title="データの収集について">
        <p>
          vtrackerが表示するデータはすべて公開情報です。
          YouTube Data API v3・Twitch API などの公式APIを通じて取得しており、
          各プラットフォームの利用規約・API利用ポリシーに従っています。
        </p>
        <p>
          同時接続数は配信中に定期的に取得・記録しています。配信終了後のデータは変更されません。
          APIの制限や通信障害などにより、一部の配信でデータが欠損する場合があります。
        </p>
        <p>
          表示されるチャンネル名・アイコン・動画タイトルなどは各クリエイターおよびプラットフォームに帰属します。
          vtrackerはこれらの著作権・商標権を主張するものではありません。
        </p>
      </Section>

      <Section title="追跡対象の追加について">
        <p>
          新しいVTuberチャンネルの追加は随時受け付けています。
          <Link href="/feedback" className="mx-1 text-violet-600 hover:underline">要望・質問フォーム</Link>
          からチャンネル名またはURLをお送りください。確認後、順次追加いたします。
        </p>
        <p>
          対象はYouTube・Twitchで活動しているVTuber（バーチャルYouTuber）です。
          個人勢・事務所所属を問わず対応しています。
        </p>
      </Section>

      <Section title="運営について">
        <p>
          vtrackerは個人が趣味・学習目的で開発・運営しているファンサービスです。
          商用目的ではなく、VTuberのファンがより楽しく応援できる環境を提供することを目指しています。
        </p>
        <p>
          サービスに関するご意見・ご要望・バグ報告は
          <Link href="/feedback" className="mx-1 text-violet-600 hover:underline">要望・質問フォーム</Link>
          よりお送りください。
        </p>
        <p>
          サービス内容は予告なく変更・停止・終了する場合があります。ご了承ください。
        </p>
      </Section>

      <div className="mt-8 flex flex-wrap gap-3 border-t border-gray-100 pt-8 text-sm">
        <Link href="/" className="text-violet-600 hover:underline">ホームへ</Link>
        <span className="text-gray-200">·</span>
        <Link href="/terms" className="text-violet-600 hover:underline">利用規約・プライバシーポリシー</Link>
        <span className="text-gray-200">·</span>
        <Link href="/feedback" className="text-violet-600 hover:underline">要望・質問</Link>
      </div>
    </div>
  );
}
