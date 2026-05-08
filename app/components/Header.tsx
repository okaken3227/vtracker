import Link from "next/link";
import RefreshButton from "./RefreshButton";

export default function Header() {
  return (
    <header className="shrink-0 border-b border-gray-200 bg-white shadow-sm">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="text-xl font-bold tracking-tight text-gray-900">
          v<span className="text-violet-600">tracker</span>
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href="/today"
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-500 transition-colors hover:border-violet-400 hover:text-violet-600"
          >
            タイムライン
          </Link>
          <RefreshButton />
          <Link
            href="/admin"
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-500 transition-colors hover:border-violet-400 hover:text-violet-600"
          >
            管理
          </Link>
        </div>
      </div>
    </header>
  );
}
