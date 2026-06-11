import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ARTICLES,
  getArticleBySlug,
  getAllArticles,
  CATEGORY_LABEL,
  CATEGORY_STYLE,
} from "@/lib/articles";

export function generateStaticParams() {
  return ARTICLES.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticleBySlug(slug);
  if (!article) return {};
  return {
    title: article.title,
    description: article.description,
    alternates: { canonical: `/articles/${article.slug}` },
    openGraph: {
      type: "article",
      title: `${article.title} | vtracker`,
      description: article.description,
      publishedTime: article.date,
    },
    twitter: {
      card: "summary",
      title: article.title,
      description: article.description,
    },
  };
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = getArticleBySlug(slug);
  if (!article) notFound();

  const others = getAllArticles().filter((a) => a.slug !== slug).slice(0, 3);

  return (
    <article className="mx-auto max-w-3xl">
      <div className="mb-2 flex items-center gap-2 text-xs text-gray-500">
        <Link href="/" className="hover:text-violet-600 transition-colors">ホーム</Link>
        <span>›</span>
        <Link href="/articles" className="hover:text-violet-600 transition-colors">コラム</Link>
        <span>›</span>
        <span className="truncate text-gray-400">{article.title}</span>
      </div>

      <header className="mb-8">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${CATEGORY_STYLE[article.category]}`}>
            {CATEGORY_LABEL[article.category]}
          </span>
          <span className="text-xs text-gray-400">{formatDate(article.date)}</span>
          <span className="text-xs text-gray-300">·</span>
          <span className="text-xs text-gray-400">約{article.readMinutes}分で読了</span>
        </div>
        <h1 className="mb-3 text-2xl font-bold leading-snug text-gray-900 sm:text-3xl">
          {article.title}
        </h1>
        <p className="text-sm leading-relaxed text-gray-500">{article.description}</p>
      </header>

      <div className="prose-vtracker">
        {article.content}
      </div>

      <footer className="mt-14 border-t border-gray-100 pt-8">
        <div className="rounded-2xl border border-violet-100/60 bg-gradient-to-br from-violet-50/60 via-white to-pink-50/40 p-5 text-sm leading-relaxed text-gray-600">
          <p className="mb-2 font-semibold text-gray-800">vtrackerについて</p>
          <p>
            vtrackerは、VTuberの配信データをリアルタイムに集計・可視化する個人運営のファンサービスです。
            記事の感想やリクエストは
            <Link href="/feedback" className="mx-1 text-violet-600 hover:underline">要望・質問フォーム</Link>
            よりお寄せください。
          </p>
        </div>

        {others.length > 0 && (
          <section className="mt-10">
            <h2 className="mb-4 text-base font-bold text-gray-900">他の記事も読む</h2>
            <div className="space-y-3">
              {others.map((a) => (
                <Link
                  key={a.slug}
                  href={`/articles/${a.slug}`}
                  className="group block rounded-xl border border-gray-100 bg-white p-4 shadow-sm transition-all hover:border-violet-200 hover:shadow-md"
                >
                  <div className="mb-1 flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${CATEGORY_STYLE[a.category]}`}>
                      {CATEGORY_LABEL[a.category]}
                    </span>
                    <span className="text-[11px] text-gray-400">{formatDate(a.date)}</span>
                  </div>
                  <p className="text-sm font-semibold text-gray-900 group-hover:text-violet-600 transition-colors">
                    {a.title}
                  </p>
                  <p className="mt-1 truncate text-xs text-gray-500">{a.description}</p>
                </Link>
              ))}
            </div>
          </section>
        )}

        <div className="mt-10 flex flex-wrap gap-3 text-sm">
          <Link href="/articles" className="text-violet-600 hover:underline">コラム一覧へ戻る</Link>
          <span className="text-gray-200">·</span>
          <Link href="/" className="text-violet-600 hover:underline">ホーム</Link>
          <span className="text-gray-200">·</span>
          <Link href="/about" className="text-violet-600 hover:underline">サービスについて</Link>
        </div>
      </footer>
    </article>
  );
}
