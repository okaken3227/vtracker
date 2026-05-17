import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-32 text-center">
      <p className="text-8xl font-bold text-violet-100">404</p>
      <h1 className="mt-4 text-xl font-semibold text-gray-700">ページが見つかりません</h1>
      <p className="mt-2 text-sm text-gray-400">
        URLが間違っているか、削除された可能性があります
      </p>
      <Link
        href="/"
        className="mt-8 rounded-full bg-violet-600 px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-700"
      >
        ホームへ戻る
      </Link>
    </div>
  );
}
