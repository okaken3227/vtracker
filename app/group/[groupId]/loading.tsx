function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-gray-100 ${className ?? ""}`} />;
}

export default function Loading() {
  return (
    <div>
      {/* ヘッダー */}
      <div className="mb-8 flex items-center gap-4">
        <Skeleton className="h-14 w-14 rounded-full" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>
      {/* ライブ */}
      <div className="mb-8">
        <Skeleton className="mb-3 h-5 w-20" />
        <Skeleton className="h-56" />
      </div>
      {/* チャンネル一覧 */}
      <div>
        <Skeleton className="mb-4 h-5 w-32" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} className="aspect-square" />)}
        </div>
      </div>
    </div>
  );
}
