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
    <section className="mb-12">
      <h2 className="mb-4 text-xl font-bold text-gray-900">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-gray-600">{children}</div>
    </section>
  );
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return <h3 className="mt-5 mb-2 text-base font-semibold text-gray-800">{children}</h3>;
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
      <p className="mb-10 text-sm text-gray-400">VTuberファンのためのデータ可視化サービス — 概要・使い方・運営方針・FAQ</p>

      <Section title="vtrackerとは">
        <p>
          vtracker（ブイトラッカー）は、VTuber（バーチャルYouTuber）の配信活動を「データ」で振り返るための、
          無料のファンサービスです。同時接続数（同接）の推移グラフ、視聴者数ランキング、
          スーパーチャット（投げ銭）統計、チャンネル登録者数の履歴など、
          配信現場のリアルな空気感を数値とグラフで可視化することを目指しています。
        </p>
        <p>
          にじさんじ・ホロライブ・ぶいすぽっ！・あおぎり高校・ホロライブEN・Nijisanji EN・個人勢など、
          国内外の主要VTuberを対象に、YouTube Data API v3 および Twitch API が公開するデータを
          一定間隔で収集・集計しています。
        </p>
        <p>
          すべての機能は無料で利用できます。会員登録やアカウント作成は不要で、
          ブラウザでアクセスするだけで全機能をご利用いただけます。
        </p>
      </Section>

      <Section title="このサービスを作った理由">
        <p>
          VTuberの配信を追いかけていると「あの配信の同接ピークはどのくらいだったのか」
          「特定のコラボ配信で各メンバーがどれくらいの視聴者を集めたのか」
          「あのスパチャラッシュの瞬間はいつだったのか」など、
          後から振り返って確認したいシーンが頻繁にあります。
        </p>
        <p>
          YouTubeやTwitchの配信は終わってしまうとリアルタイムの数字が見えなくなり、
          後追いで盛り上がりを確認することが難しいという課題があります。
          vtrackerは、こうした「配信中の熱量」を時系列でアーカイブし、
          配信後でも当時の盛り上がりを再現できるようにすることを目的に作られました。
        </p>
        <p>
          単なるランキング表ではなく、配信ごとの「グラフ上の任意の時点をクリックすると
          YouTube動画の該当時刻にジャンプできる」ような、
          ファンが推し配信を深掘りするための導線を意識して設計しています。
        </p>
      </Section>

      <Section title="主な機能">
        <SubHeading>同接グラフ</SubHeading>
        <p>
          配信ごとに同時接続数（concurrent viewers）を一定間隔で記録し、
          時系列グラフとして表示します。配信の盛り上がりが視覚的に分かるほか、
          グラフ上の任意の時点をクリックするとYouTubeの該当時刻にジャンプできます。
          ライブ配信中はリアルタイムで更新され、配信終了後は記録としてそのまま保存されます。
        </p>

        <SubHeading>視聴者数ランキング</SubHeading>
        <p>
          「今日」「今週」「今月」の3つの期間で、同接ピーク・スパチャ金額・登録者数の
          3つの指標についてランキングを表示します。今勢いのあるVTuberや、
          話題になっている配信を素早く発見できます。
        </p>

        <SubHeading>スーパーチャット統計</SubHeading>
        <p>
          配信ごとのスーパーチャット金額・件数を集計し、合計金額を表示します。
          USD・EUR・KRW・TWD など複数通貨が混在する場合は、配信開始時のレートで円換算した値を合算します。
          スパチャの送信タイミングは同接グラフ上にもプロットされるため、
          どの瞬間に盛り上がりが集中したかを視覚的に確認できます。
        </p>

        <SubHeading>チャンネル詳細ページ</SubHeading>
        <p>
          各チャンネルの詳細ページでは、登録者数の推移グラフ、
          過去30本までの配信履歴、月別配信本数と累計時間、累計スパチャ金額を表示します。
          推しの活動量を月単位で振り返りたいときに便利です。
        </p>

        <SubHeading>配信比較</SubHeading>
        <p>
          複数の配信（または複数のチャンネル）の同接グラフを1枚のチャートに重ねて表示できます。
          コラボ配信における各メンバーの集客比較、別日の同企画配信の盛り上がり比較、
          ライバル関係にあるVTuber同士の対決配信比較など、多様な使い方が可能です。
        </p>

        <SubHeading>タイムライン（日別配信一覧）</SubHeading>
        <p>
          指定した日付に行われた全配信を、時刻順の同接グラフとして一覧表示します。
          特定の日に「誰がいつ配信していたか」「ピークが重なった時間帯はいつか」を確認できます。
          前日・翌日への日付ナビゲーションも備えています。
        </p>

        <SubHeading>グループ・事務所ページ</SubHeading>
        <p>
          にじさんじ・ホロライブ・ぶいすぽっ！などのVTuber事務所・グループごとに、
          所属チャンネル一覧、現在のライブ状況、配信予定、合計登録者数を確認できます。
        </p>
      </Section>

      <Section title="用語解説">
        <SubHeading>同接（同時接続数）</SubHeading>
        <p>
          配信を同時に視聴している人数のこと。英語では concurrent viewers（同接ビューワー）と表現されます。
          配信中にリアルタイムで変動するため、ピーク時の数値が配信の盛り上がりを示す代表的な指標として参照されます。
        </p>

        <SubHeading>スパチャ（スーパーチャット）</SubHeading>
        <p>
          YouTubeの投げ銭機能。視聴者がチャット欄に金額付きのメッセージを送信できる仕組みで、
          金額に応じてメッセージが目立つ色で固定表示されます。
          配信者の収益源のひとつであり、ファンが応援の気持ちを直接届けられる手段として広く利用されています。
        </p>

        <SubHeading>登録者数（チャンネル登録者数）</SubHeading>
        <p>
          YouTube/Twitchチャンネルの購読者（フォロワー）数。
          配信者の人気を測る基礎的な指標で、vtrackerでは時系列で履歴を保存し、
          増加ペースをグラフで確認できるようにしています。
        </p>

        <SubHeading>VTuber（バーチャルYouTuber）</SubHeading>
        <p>
          2Dまたは3Dのキャラクターアバターを用いて配信活動を行う配信者の総称。
          日本発の文化として2016年頃から本格的に広がり、
          現在では日本国内のみならず、英語圏・韓国・台湾・インドネシアなど世界各地で活動するVTuberが存在します。
        </p>

        <SubHeading>事務所・グループ</SubHeading>
        <p>
          複数のVTuberが所属する運営会社や集団のこと。
          代表的な事務所として、にじさんじ（運営：ANYCOLOR）、
          ホロライブ（運営：カバー）、ぶいすぽっ！（運営：株式会社バーチャルエンターテイメント／Brave groupグループ）などがあります。
          事務所に所属しない「個人勢」も多数存在します。
        </p>
      </Section>

      <Section title="データの収集・更新について">
        <p>
          vtrackerが表示するデータはすべて公開情報です。
          YouTube Data API v3・Twitch API・YouTube Live Chat API などの公式APIを通じて取得しており、
          各プラットフォームの利用規約・API利用ポリシー・レートリミットを遵守しています。
          スクレイピングや非公式な手段でのデータ取得は一切行っていません。
        </p>
        <p>
          同時接続数は配信中におよそ1分ごとに取得・記録しています。
          配信終了後のデータは編集されず、そのままアーカイブとして保存されます。
          API側の制限や通信障害、配信側の設定変更などにより、一部の配信でデータが欠損する場合があります。
        </p>
        <p>
          スーパーチャット情報はYouTube Live Chat APIを通じて取得しています。
          配信中にチャット欄に流れたスパチャを記録する仕組み上、
          配信終了後に送られたメンバーシップギフトやチャンネルメンバーシップ加入は集計対象外となります。
        </p>
        <p>
          通貨換算は、配信時点で取得した参考レート（exchangerate.host 等の公開為替APIを利用）で
          日本円に換算しています。レートは変動するため、表示金額は概算値としてご参照ください。
        </p>
      </Section>

      <Section title="追跡対象の追加について">
        <p>
          新しいVTuberチャンネルの追跡対象への追加は、随時受け付けています。
          <Link href="/feedback" className="mx-1 text-violet-600 hover:underline">要望・質問フォーム</Link>
          から、チャンネル名またはYouTube/TwitchのチャンネルURLをお送りください。
          内容を確認のうえ、順次追加いたします。
        </p>
        <p>
          対象はYouTube・Twitchで定期的に配信活動を行っているVTuber（バーチャルYouTuber）です。
          事務所所属・個人勢の区別は問いません。
        </p>
        <p>
          ただし、以下の場合は追加をお断りすることがあります。
        </p>
        <ul className="ml-5 list-disc space-y-1">
          <li>長期間配信実績がない、または過去の配信本数が極端に少ないチャンネル</li>
          <li>VTuberに該当しない通常の配信者・YouTuber</li>
          <li>本人または所属事務所から本サービスへの掲載を望まない旨の申し入れがあったチャンネル</li>
          <li>その他、運営の判断で掲載が適切でないと考えられるチャンネル</li>
        </ul>
      </Section>

      <Section title="掲載停止・データ削除のご依頼">
        <p>
          VTuber本人または所属事務所からのご依頼により、
          チャンネルの掲載停止・データ削除・表示内容の修正に対応いたします。
          <Link href="/feedback" className="mx-1 text-violet-600 hover:underline">要望・質問フォーム</Link>
          から、対象チャンネル名およびご依頼内容をお知らせください。
          内容を確認のうえ、原則として速やかに対応いたします。
        </p>
        <p>
          一般のファンの方からの「特定VTuberのデータを非表示にしてほしい」というご要望については、
          原則として本人または所属事務所からの直接のご依頼に限らせていただいております。
        </p>
      </Section>

      <Section title="よくある質問（FAQ）">
        <SubHeading>Q. 利用料金はかかりますか？</SubHeading>
        <p>
          すべての機能を無料でご利用いただけます。会員登録・課金は一切ありません。
          サーバー運用費は、サイトに表示されるGoogle AdSense広告によって賄われています。
        </p>

        <SubHeading>Q. 表示されている数値は正確ですか？</SubHeading>
        <p>
          公式APIから取得したデータをそのまま表示していますが、
          数分ごとの取得・サンプリングであるため、瞬間値とは数十秒〜数分のズレが生じます。
          また、API側の障害や仕様変更により、稀にデータが欠損する場合があります。
          「目安」「アーカイブ参照用」としてご利用ください。
        </p>

        <SubHeading>Q. データの保存期間はどれくらいですか？</SubHeading>
        <p>
          配信ごとの同接グラフ・スパチャ情報・登録者数履歴は、原則として無期限で保存します。
          ただし、サービス運用上の都合や容量制限により、
          古いデータは集計値のみ残して詳細データを間引く可能性があります。
        </p>

        <SubHeading>Q. 同接ピークが公式の発表と違うのですが？</SubHeading>
        <p>
          vtrackerが記録するのは「サンプリング間隔ごとの値の最大値」であり、
          配信中の真のピーク（秒単位の最大瞬間値）とは数値が異なる場合があります。
          公式の発表値や配信者ご本人の集計と差異がある場合は、公式の値が正しいものとしてご認識ください。
        </p>

        <SubHeading>Q. スマートフォンでも快適に使えますか？</SubHeading>
        <p>
          はい。vtrackerはスマートフォン・タブレット・PCのいずれの画面サイズでも
          快適に使えるレスポンシブデザインで設計されています。
          一部のグラフは横スクロールで詳細を確認できます。
        </p>

        <SubHeading>Q. データの引用・転載は可能ですか？</SubHeading>
        <p>
          スクリーンショットや数値の引用は、出典として「vtracker」へのリンクを明記いただければ
          自由に行っていただいて構いません。商用利用や、データの大規模な転用については
          事前に
          <Link href="/feedback" className="mx-1 text-violet-600 hover:underline">要望・質問フォーム</Link>
          よりご相談ください。
        </p>

        <SubHeading>Q. バグや表示の不具合を見つけた場合は？</SubHeading>
        <p>
          要望・質問フォームから、発生したページのURL・操作内容・お使いの端末/ブラウザを
          添えてご報告いただけると助かります。
        </p>
      </Section>

      <Section title="運営について">
        <p>
          vtrackerは、VTuber文化を愛する個人エンジニアが
          趣味および技術学習を兼ねて開発・運営している、ファンメイドのサービスです。
          公式団体・VTuber事務所・配信プラットフォームとは一切資本関係・提携関係にありません。
        </p>
        <p>
          サービス内で表示されるチャンネル名・アイコン・サムネイル・配信タイトルなどは、
          すべて各クリエイターおよびプラットフォームに帰属します。
          vtrackerはこれらの著作権・商標権を主張するものではなく、
          二次利用や転載を許諾するものでもありません。
        </p>
        <p>
          サービスに関するご意見・ご要望・バグ報告・データ修正依頼などは
          <Link href="/feedback" className="mx-1 text-violet-600 hover:underline">要望・質問フォーム</Link>
          より承っております。
        </p>
        <p>
          サービス内容・取得対象・表示形式は予告なく変更・停止・終了する場合があります。
          長期メンテナンス時には可能な限り事前にトップページで告知いたします。
        </p>
      </Section>

      <div className="mt-8 flex flex-wrap gap-3 border-t border-gray-100 pt-8 text-sm">
        <Link href="/" className="text-violet-600 hover:underline">ホームへ</Link>
        <span className="text-gray-200">·</span>
        <Link href="/ranking" className="text-violet-600 hover:underline">ランキング</Link>
        <span className="text-gray-200">·</span>
        <Link href="/groups" className="text-violet-600 hover:underline">グループ一覧</Link>
        <span className="text-gray-200">·</span>
        <Link href="/articles" className="text-violet-600 hover:underline">コラム</Link>
        <span className="text-gray-200">·</span>
        <Link href="/terms" className="text-violet-600 hover:underline">利用規約・プライバシーポリシー</Link>
        <span className="text-gray-200">·</span>
        <Link href="/feedback" className="text-violet-600 hover:underline">要望・質問</Link>
      </div>
    </div>
  );
}
