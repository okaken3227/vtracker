import Link from "next/link";

export const metadata = {
  title: "利用規約・プライバシーポリシー | vtracker",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-base font-semibold text-gray-900">{title}</h2>
      <div className="space-y-2 text-sm leading-relaxed text-gray-600">{children}</div>
    </section>
  );
}

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-2 flex items-center gap-2 text-xs text-gray-500">
        <Link href="/" className="hover:text-violet-600 transition-colors">ホーム</Link>
        <span>›</span>
        <span>利用規約・プライバシーポリシー</span>
      </div>

      <h1 className="mb-1 text-2xl font-bold text-gray-900">利用規約・プライバシーポリシー</h1>
      <p className="mb-8 text-xs text-gray-400">最終更新: 2025年5月</p>

      <Section title="サービスの概要">
        <p>
          vtracker（以下「本サービス」）は、VTuberの配信活動・登録者数・スーパーチャット等の公開情報を
          集計・可視化する個人運営のファンサービスです。
        </p>
        <p>
          本サービスが表示するデータは YouTube Data API・Twitch API 等の公開APIを通じて取得した
          情報であり、各プラットフォームの利用規約に従って使用しています。
        </p>
      </Section>

      <Section title="免責事項">
        <p>
          本サービスに掲載される情報の正確性・完全性について保証しません。
          データの遅延・欠損・誤りが生じる場合があります。
        </p>
        <p>
          本サービスの利用によって生じたいかなる損害についても、運営者は責任を負いません。
        </p>
        <p>
          サービスは予告なく変更・停止・終了する場合があります。
        </p>
      </Section>

      <Section title="禁止事項">
        <p>利用者は以下の行為を行ってはなりません。</p>
        <ul className="ml-5 list-disc space-y-1.5">
          <li>本サービスへの過度なアクセス・スクレイピング・自動取得</li>
          <li>本サービスのデータを商用目的で無断転載・再配布すること</li>
          <li>本サービスのシステムへの不正アクセスを試みること</li>
          <li>法令または公序良俗に反する行為</li>
        </ul>
      </Section>

      <Section title="知的財産権">
        <p>
          本サービス上に表示されるチャンネル名・アイコン・動画タイトル等は
          各クリエイターおよびプラットフォームに帰属します。
          本サービスはこれらの著作権・商標権を主張するものではありません。
        </p>
      </Section>

      <Section title="プライバシーポリシー">
        <p>
          本サービスは「要望・質問」フォームから送信された内容（メッセージ・任意の名前）を
          サービス改善のために使用します。第三者への提供・販売は行いません。
        </p>
        <p>
          本サービスはアクセス解析のために Cookie やローカルストレージを使用する場合があります。
        </p>
        <p>
          送信済みデータの削除を希望される場合は、要望フォームよりご連絡ください。
        </p>
      </Section>

      <Section title="広告について（Google AdSense）">
        <p>
          本サービスは Google LLC が提供する広告配信サービス「Google AdSense」を利用しています。
          Google AdSense はユーザーの興味・関心に合った広告を表示するために Cookie を使用します。
        </p>
        <p>
          Cookie を使用することで、Google やそのパートナーは本サービスおよびその他のサイトへの
          アクセス情報に基づいて適切な広告を表示します。
          ユーザーは{" "}
          <a
            href="https://www.google.com/settings/ads"
            target="_blank"
            rel="noopener noreferrer"
            className="text-violet-600 hover:underline"
          >
            Google の広告設定ページ
          </a>
          {" "}からパーソナライズ広告を無効化することができます。
        </p>
        <p>
          Cookie の使用に関する詳細は{" "}
          <a
            href="https://policies.google.com/technologies/ads"
            target="_blank"
            rel="noopener noreferrer"
            className="text-violet-600 hover:underline"
          >
            Google のポリシーと規約
          </a>
          {" "}をご確認ください。
        </p>
      </Section>

      <Section title="APIおよびデータについて">
        <p>本サービスは以下の外部サービスのAPIを利用しています。</p>
        <ul className="ml-5 list-disc space-y-1.5">
          <li>
            <a href="https://developers.google.com/youtube/v3" target="_blank" rel="noopener noreferrer" className="text-violet-600 hover:underline">
              YouTube Data API v3
            </a>
            {" "}（Google LLC）
          </li>
          <li>
            <a href="https://dev.twitch.tv/docs/api/" target="_blank" rel="noopener noreferrer" className="text-violet-600 hover:underline">
              Twitch API
            </a>
            {" "}（Twitch Interactive, Inc.）
          </li>
        </ul>
        <p>これらのサービスの利用規約も合わせてご確認ください。</p>
      </Section>

      <Section title="お問い合わせ">
        <p>
          ご意見・ご要望・データの削除依頼等は{" "}
          <Link href="/feedback" className="text-violet-600 hover:underline">
            要望・質問フォーム
          </Link>
          {" "}よりお送りください。
        </p>
      </Section>
    </div>
  );
}
