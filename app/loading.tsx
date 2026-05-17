function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-gray-100 ${className ?? ""}`} />;
}

export default function Loading() {
  return (
    <div>
      {/* サマリー */}
      <div className="mb-8">
        <Skeleton className="mb-4 h-6 w-32" />
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-20" />)}
        </div>
      </div>
      {/* ライブセクション */}
      <div className="mb-8">
        <Skeleton className="mb-4 h-6 w-24" />
        <Skeleton className="h-[460px]" />
      </div>
      {/* チャンネル一覧 */}
      <div>
        <Skeleton className="mb-4 h-6 w-32" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} className="aspect-square" />)}
        </div>
      </div>
    </div>
  );
}
