"use client";

type FeedbackRow = { id: string; type: string; message: string; name: string | null; created_at: string };

type Props = {
  feedbackList: FeedbackRow[];
  feedbackLoading: boolean;
  onRefresh: () => void;
  onDelete: (id: string) => void;
};

export default function AdminFeedbackSection({ feedbackList, feedbackLoading, onRefresh, onDelete }: Props) {
  return (
    <section className="mt-10">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-900">
          要望・質問
          {feedbackList.length > 0 && (
            <span className="ml-2 text-sm font-normal text-gray-400">{feedbackList.length}件</span>
          )}
        </h2>
        <button onClick={onRefresh} className="text-xs text-gray-400 hover:text-gray-600">
          ↻ 更新
        </button>
      </div>
      {feedbackLoading ? (
        <p className="text-sm text-gray-400">読み込み中...</p>
      ) : feedbackList.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 p-8 text-center text-sm text-gray-400">
          まだ要望・質問はありません
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {feedbackList.map((fb) => (
            <div key={fb.id} className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    fb.type === "request" ? "bg-violet-100 text-violet-700"
                    : fb.type === "question" ? "bg-blue-100 text-blue-700"
                    : "bg-gray-100 text-gray-600"
                  }`}>
                    {fb.type === "request" ? "チャンネル追加" : fb.type === "question" ? "質問" : "その他"}
                  </span>
                  {fb.name && <span className="text-xs text-gray-500">{fb.name}</span>}
                  <span className="ml-auto text-[11px] text-gray-400">
                    {new Date(fb.created_at).toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <p className="text-sm text-gray-800 whitespace-pre-wrap">{fb.message}</p>
              </div>
              <button
                onClick={() => onDelete(fb.id)}
                className="flex-shrink-0 rounded-lg p-1.5 text-gray-300 hover:bg-red-50 hover:text-red-400 transition-colors"
                title="削除"
              >
                <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M3 3l10 10M13 3L3 13" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
