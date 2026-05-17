function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-gray-100 ${className ?? ""}`} />;
}

export default function Loading() {
  return (
    <div>
      {/* チャンネルヘッダー */}
      <div className="mb-8 flex items-center gap-4">
        <Skeleton className="h-20 w-20 rounded-full" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-20" />
        </div>
      </div>
      {/* グラフ */}
      <div className="mb-8">
        <Skeleton className="mb-3 h-5 w-32" />
        <Skeleton className="h-48" />
      </div>
      {/* 動画一覧 */}
      <div>
        <Skeleton className="mb-4 h-5 w-24" />
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
      </div>
    </div>
  );
}
