import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "利用規約・プライバシーポリシー | vtracker",
  description:
    "vtracker（ブイトラッカー）の利用規約およびプライバシーポリシー。データの取り扱い・Cookieの使用・Google AdSenseによる広告配信・お問い合わせ窓口について明記しています。",
  alternates: { canonical: "/terms" },
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="mb-3 text-lg font-semibold text-gray-900">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-gray-600">{children}</div>
    </section>
  );
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return <h3 className="mt-4 mb-1.5 text-sm font-semibold text-gray-800">{children}</h3>;
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
      <p className="mb-8 text-xs text-gray-400">最終更新: 2026年6月</p>

      <Section title="本規約について">
        <p>
          本規約は、vtracker（以下「本サービス」）の利用条件および
          個人情報の取り扱い方針を定めるものです。
          本サービスをご利用いただくすべてのユーザーの皆さま（以下「利用者」）には、
          本規約に同意のうえご利用いただきます。
        </p>
        <p>
          運営者は、必要に応じて本規約を改定することがあります。
          改定後の規約は本ページに掲載した時点で効力を生じるものとし、
          変更後も継続して本サービスを利用された場合、変更内容に同意したものとみなします。
        </p>
      </Section>

      <Section title="サービスの概要">
        <p>
          本サービスは、VTuber（バーチャルYouTuber）の配信活動に関する公開情報（同時接続数・
          スーパーチャット・チャンネル登録者数・配信履歴など）を集計・可視化し、
          ファンが配信を振り返るための参考情報を提供する、個人運営のファンサービスです。
        </p>
        <p>
          本サービスが表示するデータは、YouTube Data API v3・YouTube Live Chat API・
          Twitch API などの公開APIを通じて取得した情報であり、
          各プラットフォームの利用規約・API利用ポリシーに従って取り扱っています。
        </p>
        <p>
          本サービスはVTuber事務所・配信プラットフォームから公式に提供されている情報源では
          ありません。表示内容は参考情報としてご利用ください。
        </p>
      </Section>

      <Section title="ご利用にあたって">
        <SubHeading>本サービスの利用</SubHeading>
        <p>
          本サービスは、誰でも無料でご利用いただけます。
          会員登録・課金は一切ありません。年齢制限も特に設けていませんが、
          未成年者がご利用になる場合は、保護者の方の同意のもとご利用ください。
        </p>

        <SubHeading>禁止事項</SubHeading>
        <p>利用者は、本サービスの利用にあたり、以下の行為を行ってはなりません。</p>
        <ul className="ml-5 list-disc space-y-1.5">
          <li>本サービスのサーバーに過度な負荷をかける行為（高頻度な自動アクセス・スクレイピング・データ収集スクリプトの実行など）</li>
          <li>本サービスのデータを許可なく商用目的で転載・再配布・販売する行為</li>
          <li>本サービスのシステムやコンテンツに対し、不正アクセス・改ざん・リバースエンジニアリングを試みる行為</li>
          <li>本サービスを通じて取得した情報を、特定のVTuberや事務所への誹謗中傷・嫌がらせなどに利用する行為</li>
          <li>法令または公序良俗に反する行為</li>
          <li>その他、運営者が不適切と判断する行為</li>
        </ul>

        <SubHeading>掲載情報の引用について</SubHeading>
        <p>
          スクリーンショットや個別データの引用は、出典として「vtracker」へのリンクを明記いただければ
          自由に行っていただけます。データの大規模な転用・商用利用については、
          事前に
          <Link href="/feedback" className="mx-1 text-violet-600 hover:underline">要望・質問フォーム</Link>
          よりご相談ください。
        </p>
      </Section>

      <Section title="免責事項">
        <p>
          運営者は、本サービスに掲載される情報の正確性・完全性・最新性について
          保証するものではありません。
          API側の制限・通信障害・サンプリング間隔の関係などにより、
          データに遅延・欠損・誤りが生じる場合があります。
        </p>
        <p>
          本サービスの利用または利用不能によって利用者または第三者に生じたいかなる損害についても、
          運営者は責任を負いません。
        </p>
        <p>
          本サービスは予告なく内容を変更・停止・終了する場合があります。
          長期メンテナンスや終了の際には、可能な限り事前にトップページで告知いたします。
        </p>
      </Section>

      <Section title="知的財産権">
        <p>
          本サービス上に表示されるチャンネル名・アイコン・サムネイル・配信タイトル・
          スーパーチャットのコメント文などは、
          すべて各クリエイターおよび配信プラットフォーム（YouTube・Twitch等）に帰属します。
          本サービスはこれらの著作権・商標権・肖像権を主張するものではなく、
          二次利用を許諾するものでもありません。
        </p>
        <p>
          本サービス独自のグラフ・集計値・UI・コード・デザインに関する著作権は
          運営者に帰属します。
        </p>
      </Section>

      <Section title="プライバシーポリシー">
        <SubHeading>取得する情報</SubHeading>
        <p>
          本サービスでは、サービスの提供・改善・不正利用の防止を目的として、
          以下の情報を取得・保存することがあります。
        </p>
        <ul className="ml-5 list-disc space-y-1.5">
          <li>「要望・質問」フォームから送信された内容（メッセージ本文、任意で入力された名前）</li>
          <li>アクセス解析サービスを通じて取得される、ブラウザの種類・OS・参照元URL・閲覧ページ・滞在時間などの統計情報</li>
          <li>サーバーアクセスログ（IPアドレス・アクセス日時・リクエストURL等。サービス運用および不正アクセス調査の目的にのみ使用します）</li>
        </ul>

        <SubHeading>利用目的</SubHeading>
        <p>取得した情報は、以下の目的でのみ利用します。</p>
        <ul className="ml-5 list-disc space-y-1.5">
          <li>本サービスの提供・維持・改善</li>
          <li>利用者からのお問い合わせへの対応</li>
          <li>利用状況の把握・統計データの作成</li>
          <li>不正利用の検知および対応</li>
        </ul>

        <SubHeading>第三者への提供</SubHeading>
        <p>
          法令に基づく場合を除き、取得した個人情報を第三者に提供・販売することはありません。
        </p>

        <SubHeading>データの削除依頼</SubHeading>
        <p>
          「要望・質問」フォームに入力された内容について、削除をご希望の場合は
          <Link href="/feedback" className="mx-1 text-violet-600 hover:underline">要望・質問フォーム</Link>
          よりご連絡ください。本人確認のうえ、原則として速やかに削除いたします。
        </p>
      </Section>

      <Section title="Cookie・ローカルストレージの利用について">
        <p>
          本サービスは、利用者の利便性向上およびサービス改善のため、
          Cookie および localStorage を使用することがあります。
        </p>
        <ul className="ml-5 list-disc space-y-1.5">
          <li>表示設定（サイドバーの開閉状態、選択中の期間・指標など）の保存</li>
          <li>アクセス解析（後述）</li>
          <li>Google AdSense による広告配信（後述）</li>
        </ul>
        <p>
          Cookie の利用を望まない場合は、ブラウザの設定により Cookie を無効化することができます。
          ただし、その場合、本サービスの一部機能が正常に動作しない場合があります。
        </p>
      </Section>

      <Section title="広告配信について（Google AdSense）">
        <p>
          本サービスはサーバー運用費等の捻出のため、第三者配信の広告サービスである
          Google LLC が提供する「Google AdSense」を利用しています。
        </p>
        <p>
          広告配信事業者である Google は、利用者の興味・関心に応じた広告を表示するため、
          Cookie（広告 Cookie を含む）を使用することがあります。Cookie を使用することで、
          Google および Google のパートナーは、本サービスや他のサイトへのアクセス情報に基づいて、
          利用者に適切な広告を表示します。
        </p>
        <p>
          利用者は、以下のリンクから「広告のカスタマイズ」を無効に設定することができます。
        </p>
        <ul className="ml-5 list-disc space-y-1.5">
          <li>
            <a
              href="https://www.google.com/settings/ads"
              target="_blank"
              rel="noopener noreferrer"
              className="text-violet-600 hover:underline"
            >
              Google の広告設定ページ
            </a>
            {" "}（パーソナライズ広告の無効化）
          </li>
          <li>
            <a
              href="https://policies.google.com/technologies/ads"
              target="_blank"
              rel="noopener noreferrer"
              className="text-violet-600 hover:underline"
            >
              Google の広告に関するポリシー
            </a>
            {" "}（Cookie 使用の詳細）
          </li>
          <li>
            <a
              href="https://policies.google.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-violet-600 hover:underline"
            >
              Google のプライバシーポリシー
            </a>
          </li>
        </ul>
        <p>
          サードパーティの広告配信事業者（Google AdSense のパートナー）が、
          利用者にとって関心の高い商品やサービスの広告を配信するために、
          利用者のアクセス情報を使用することがあります。詳細は上記リンクをご確認ください。
        </p>
      </Section>

      <Section title="アクセス解析について">
        <p>
          本サービスは、利用状況の把握・改善のため、アクセス解析ツール（Vercel Analytics 等）を
          使用する場合があります。
          これらのツールはトラフィック量・閲覧ページなどの統計データを匿名で収集します。
          これらのツールは Cookie を使用することがありますが、個人を特定する情報は含みません。
        </p>
      </Section>

      <Section title="外部API・データソースについて">
        <p>本サービスは、データの取得・表示にあたり以下の外部サービスのAPIを利用しています。</p>
        <ul className="ml-5 list-disc space-y-1.5">
          <li>
            <a href="https://developers.google.com/youtube/v3" target="_blank" rel="noopener noreferrer" className="text-violet-600 hover:underline">
              YouTube Data API v3
            </a>
            {" "}（Google LLC）— チャンネル情報、動画情報、ライブ配信ステータスの取得
          </li>
          <li>
            <a href="https://developers.google.com/youtube/v3/live/getting-started" target="_blank" rel="noopener noreferrer" className="text-violet-600 hover:underline">
              YouTube Live Streaming API / Live Chat API
            </a>
            {" "}（Google LLC）— 同時接続数・スーパーチャット情報の取得
          </li>
          <li>
            <a href="https://dev.twitch.tv/docs/api/" target="_blank" rel="noopener noreferrer" className="text-violet-600 hover:underline">
              Twitch API
            </a>
            {" "}（Twitch Interactive, Inc.）— Twitchでの配信情報の取得
          </li>
          <li>
            為替レート取得用の公開API（exchangerate.host 等）— スーパーチャットの円換算用
          </li>
        </ul>
        <p>
          本サービスの利用にあたっては、これらのサービスの利用規約・プライバシーポリシーも
          合わせてご確認ください。
        </p>
      </Section>

      <Section title="準拠法・裁判管轄">
        <p>
          本規約の解釈および適用は日本法に準拠します。
          本サービスに関連して紛争が生じた場合は、運営者の所在地を管轄する裁判所を
          第一審の専属的合意管轄裁判所とします。
        </p>
      </Section>

      <Section title="お問い合わせ窓口">
        <p>
          本規約・プライバシーポリシーに関するお問い合わせ、
          掲載情報の修正・削除依頼、本サービスへのご意見・ご要望は、
          以下のフォームより承っております。
        </p>
        <p>
          <Link
            href="/feedback"
            className="inline-flex items-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 px-4 py-2 font-medium text-violet-600 transition-all hover:bg-violet-100"
          >
            要望・質問フォームへ →
          </Link>
        </p>
        <p>
          フォームから送信された内容は運営者のみが確認します。
          原則として個別の返信は行いませんが、対応が必要な内容については
          速やかに本サービス内に反映いたします。
        </p>
      </Section>

      <div className="mt-8 flex flex-wrap gap-3 border-t border-gray-100 pt-8 text-sm">
        <Link href="/" className="text-violet-600 hover:underline">ホームへ</Link>
        <span className="text-gray-200">·</span>
        <Link href="/about" className="text-violet-600 hover:underline">サービスについて</Link>
        <span className="text-gray-200">·</span>
        <Link href="/feedback" className="text-violet-600 hover:underline">要望・質問</Link>
      </div>
    </div>
  );
}
