function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-gray-100 ${className ?? ""}`} />;
}

export default function Loading() {
  return (
    <div>
      {/* 動画ヘッダー */}
      <div className="mb-6">
        <Skeleton className="mb-3 h-7 w-3/4" />
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-5 w-32" />
        </div>
      </div>
      {/* グラフ */}
      <div className="mb-6">
        <Skeleton className="h-64" />
      </div>
      {/* スパチャリスト */}
      <div>
        <Skeleton className="mb-3 h-5 w-28" />
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16" />)}
        </div>
      </div>
    </div>
  );
}
