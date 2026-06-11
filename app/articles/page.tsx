import type { Metadata } from "next";
import Link from "next/link";
import { getAllArticles, CATEGORY_LABEL, CATEGORY_STYLE } from "@/lib/articles";

export const metadata: Metadata = {
  title: "VTuber解説記事・読み物 | vtrackerコラム",
  description:
    "同接・スパチャの仕組み解説、VTuber事務所ガイド、推し活入門、配信データの読み方、業界史など、VTuberファンのための読み物コラム。データを見るだけでなく、もっとVTuber文化を楽しむための解説記事を掲載しています。",
  alternates: { canonical: "/articles" },
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

export default function ArticlesPage() {
  const articles = getAllArticles();

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-2 flex items-center gap-2 text-xs text-gray-500">
        <Link href="/" className="hover:text-violet-600 transition-colors">ホーム</Link>
        <span>›</span>
        <span>コラム</span>
      </div>

      <h1 className="mb-2 text-3xl font-bold text-gray-900">VTuber解説コラム</h1>
      <p className="mb-10 text-sm leading-relaxed text-gray-600">
        VTuberの配信データをもっと深く楽しむための解説記事を掲載しています。
        同接やスパチャの仕組み、事務所ガイド、推し活入門、配信データの読み方、
        業界の歴史など、初心者から長年のファンまで読める内容を用意しました。
      </p>

      <div className="space-y-4">
        {articles.map((article) => (
          <Link
            key={article.slug}
            href={`/articles/${article.slug}`}
            className="group block rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-all hover:border-violet-200 hover:shadow-md sm:p-6"
          >
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${CATEGORY_STYLE[article.category]}`}>
                {CATEGORY_LABEL[article.category]}
              </span>
              <span className="text-xs text-gray-400">{formatDate(article.date)}</span>
              <span className="text-xs text-gray-300">·</span>
              <span className="text-xs text-gray-400">約{article.readMinutes}分で読了</span>
            </div>
            <h2 className="mb-2 text-lg font-bold text-gray-900 group-hover:text-violet-600 transition-colors sm:text-xl">
              {article.title}
            </h2>
            <p className="text-sm leading-relaxed text-gray-600">{article.description}</p>
            <div className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-violet-600">
              続きを読む
              <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 2l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </Link>
        ))}
      </div>

      <section className="mt-12 border-t border-gray-100 pt-10 text-sm leading-relaxed text-gray-600">
        <h2 className="mb-3 text-base font-semibold text-gray-900">このコラムについて</h2>
        <p>
          vtrackerは、VTuberの配信データをリアルタイムで集計・可視化するファンサービスです。
          このコラムでは、データの裏側にある「文化」や「楽しみ方」を、運営者の視点から
          解説していきます。記事の内容に関するご意見・ご質問・「こんなテーマを取り上げてほしい」
          というご要望は、
          <Link href="/feedback" className="mx-1 text-violet-600 hover:underline">要望・質問フォーム</Link>
          よりお寄せください。
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
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
