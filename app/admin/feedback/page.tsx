"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

type FeedbackRow = {
  id: string;
  type: string;
  message: string;
  name: string | null;
  created_at: string;
  is_read: boolean;
  admin_reply: string | null;
  is_deleted: boolean;
  is_public: boolean;
  is_admin_post: boolean;
  public_answer: string | null;
};

const TYPE_LABEL: Record<string, string> = {
  request: "チャンネル追加",
  question: "質問",
  other: "その他",
};

const TYPE_STYLE: Record<string, string> = {
  request: "bg-violet-100 text-violet-700",
  question: "bg-blue-100 text-blue-700",
  other: "bg-gray-100 text-gray-600",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("ja-JP", {
    month: "numeric", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

type OpenSection = "memo" | "answer" | null;

function FeedbackCard({
  fb,
  onUpdate,
  onSoftDelete,
  onRestore,
}: {
  fb: FeedbackRow;
  onUpdate: (id: string, patch: Partial<FeedbackRow>) => void;
  onSoftDelete: (id: string) => void;
  onRestore: (id: string) => void;
}) {
  const [open, setOpen] = useState<OpenSection>(null);
  const [memoText, setMemoText] = useState(fb.admin_reply ?? "");
  const [answerText, setAnswerText] = useState(fb.public_answer ?? "");
  const [saving, setSaving] = useState(false);
  const [acting, setActing] = useState(false);

  async function markRead() {
    await fetch("/api/feedback", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: fb.id, is_read: true }),
    });
    onUpdate(fb.id, { is_read: true });
  }

  async function saveMemo() {
    setSaving(true);
    await fetch("/api/feedback", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: fb.id, admin_reply: memoText, is_read: true }),
    });
    onUpdate(fb.id, { admin_reply: memoText, is_read: true });
    setSaving(false);
    setOpen(null);
  }

  async function saveAnswer() {
    setSaving(true);
    await fetch("/api/feedback", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: fb.id, public_answer: answerText }),
    });
    onUpdate(fb.id, { public_answer: answerText });
    setSaving(false);
    setOpen(null);
  }

  async function togglePublic() {
    if (!fb.is_public && !fb.public_answer && !answerText.trim()) {
      setOpen("answer");
      return;
    }
    const next = !fb.is_public;
    await fetch("/api/feedback", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: fb.id, is_public: next }),
    });
    onUpdate(fb.id, { is_public: next });
  }

  async function handleSoftDelete() {
    setActing(true);
    await fetch("/api/feedback", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: fb.id }),
    });
    onSoftDelete(fb.id);
  }

  async function handleRestore() {
    setActing(true);
    await fetch("/api/feedback", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: fb.id, is_deleted: false }),
    });
    onRestore(fb.id);
  }

  return (
    <div className={`rounded-xl border p-4 transition-colors ${
      fb.is_deleted
        ? "border-gray-200 bg-gray-50 opacity-70"
        : fb.is_read
          ? "border-gray-100 bg-white"
          : "border-violet-200 bg-violet-50/40"
    }`}>
      {/* ヘッダー行 */}
      <div className="mb-2 flex flex-wrap items-center gap-2">
        {!fb.is_read && !fb.is_deleted && (
          <span className="h-2 w-2 flex-shrink-0 rounded-full bg-red-500" />
        )}
        {fb.is_admin_post && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
            手動追加
          </span>
        )}
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${TYPE_STYLE[fb.type] ?? TYPE_STYLE.other}`}>
          {TYPE_LABEL[fb.type] ?? fb.type}
        </span>
        {fb.name && (
          <span className="text-xs font-medium text-gray-700">{fb.name}</span>
        )}
        {fb.is_public && (
          <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700">
            公開中
          </span>
        )}
        <span className="ml-auto text-[11px] text-gray-400">{formatDate(fb.created_at)}</span>
      </div>

      {/* メッセージ */}
      <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{fb.message}</p>

      {/* 管理者メモ表示 */}
      {fb.admin_reply && open !== "memo" && (
        <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
          <p className="mb-0.5 text-[10px] font-semibold text-gray-500">管理者メモ（非公開）</p>
          <p className="whitespace-pre-wrap text-xs text-gray-700">{fb.admin_reply}</p>
        </div>
      )}

      {/* 公開回答表示 */}
      {fb.public_answer && open !== "answer" && (
        <div className="mt-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2">
          <p className="mb-0.5 text-[10px] font-semibold text-green-600">公開回答</p>
          <p className="whitespace-pre-wrap text-xs text-green-800">{fb.public_answer}</p>
        </div>
      )}

      {/* メモ編集エリア */}
      {open === "memo" && (
        <div className="mt-3">
          <textarea
            value={memoText}
            onChange={(e) => setMemoText(e.target.value)}
            rows={3}
            placeholder="管理者メモ（非公開・内部用）"
            className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
          />
          <div className="mt-2 flex gap-2">
            <button onClick={saveMemo} disabled={saving}
              className="rounded-lg bg-violet-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-violet-700 disabled:opacity-50">
              {saving ? "保存中..." : "保存"}
            </button>
            <button onClick={() => { setOpen(null); setMemoText(fb.admin_reply ?? ""); }}
              className="rounded-lg border border-gray-200 px-4 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-50">
              キャンセル
            </button>
          </div>
        </div>
      )}

      {/* 公開回答編集エリア */}
      {open === "answer" && (
        <div className="mt-3">
          <textarea
            value={answerText}
            onChange={(e) => setAnswerText(e.target.value)}
            rows={4}
            placeholder="公開する回答を入力してください"
            className="w-full resize-none rounded-lg border border-green-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100"
          />
          <div className="mt-2 flex items-center gap-2">
            <button onClick={saveAnswer} disabled={saving || !answerText.trim()}
              className="rounded-lg bg-green-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50">
              {saving ? "保存中..." : "回答を保存"}
            </button>
            <button onClick={() => { setOpen(null); setAnswerText(fb.public_answer ?? ""); }}
              className="rounded-lg border border-gray-200 px-4 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-50">
              キャンセル
            </button>
          </div>
        </div>
      )}

      {/* アクション行 */}
      {!fb.is_deleted ? (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <button onClick={() => setOpen(open === "memo" ? null : "memo")}
            className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-500 hover:border-violet-300 hover:text-violet-600 transition-colors">
            {fb.admin_reply ? "メモ編集" : "メモ追加"}
          </button>
          <button onClick={() => setOpen(open === "answer" ? null : "answer")}
            className="flex items-center gap-1 rounded-lg border border-green-200 px-3 py-1.5 text-xs font-medium text-green-600 hover:border-green-400 hover:bg-green-50 transition-colors">
            {fb.public_answer ? "回答編集" : "回答を入力"}
          </button>
          <button
            onClick={togglePublic}
            className={`flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
              fb.is_public
                ? "border-green-400 bg-green-50 text-green-700 hover:bg-green-100"
                : "border-gray-200 px-3 text-gray-400 hover:border-green-300 hover:text-green-600"
            }`}
          >
            {fb.is_public ? "● 公開中" : "公開する"}
          </button>
          {!fb.is_read && (
            <button onClick={markRead}
              className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-500 hover:border-green-300 hover:text-green-600 transition-colors">
              既読
            </button>
          )}
          <button onClick={handleSoftDelete} disabled={acting}
            className="ml-auto flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors disabled:opacity-50">
            <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M3 3l10 10M13 3L3 13" />
            </svg>
            削除
          </button>
        </div>
      ) : (
        <div className="mt-3 flex items-center gap-2">
          <span className="text-xs text-gray-400">削除済み</span>
          <button onClick={handleRestore} disabled={acting}
            className="ml-auto flex items-center gap-1.5 rounded-lg border border-blue-200 px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-50">
            <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2.5 8a5.5 5.5 0 1 1 1 3.2" />
              <path d="M2.5 4.5v4h4" />
            </svg>
            復元
          </button>
        </div>
      )}
    </div>
  );
}

function CreateQAModal({ onClose, onCreate }: {
  onClose: () => void;
  onCreate: (item: FeedbackRow) => void;
}) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim() || !answer.trim()) return;
    setSaving(true);
    const res = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "question",
        message: question.trim(),
        public_answer: answer.trim(),
        is_admin_post: true,
      }),
    }).then((r) => r.json()).catch(() => ({ error: "通信エラー" }));

    if (!res.error) {
      const listRes = await fetch("/api/feedback").then((r) => r.json()).catch(() => []);
      const newest = Array.isArray(listRes) ? listRes[0] : null;
      if (newest) onCreate(newest);
      onClose();
    }
    setSaving(false);
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-bold text-gray-900">いただいた質問を追加</h2>
            <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-gray-100 text-gray-400">
              <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M3 3l10 10M13 3L3 13" />
              </svg>
            </button>
          </div>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-gray-700">質問</label>
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                rows={3}
                required
                placeholder="いただいた質問を入力"
                className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-gray-700">回答</label>
              <textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                rows={4}
                required
                placeholder="回答を入力"
                className="w-full resize-none rounded-lg border border-green-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100"
              />
            </div>
            <p className="text-[11px] text-gray-400">保存後すぐに「いただいた質問」として公開されます。</p>
            <div className="flex gap-2">
              <button type="submit" disabled={saving || !question.trim() || !answer.trim()}
                className="flex-1 rounded-xl bg-violet-600 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50">
                {saving ? "保存中..." : "追加して公開"}
              </button>
              <button type="button" onClick={onClose}
                className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-500 hover:bg-gray-50">
                キャンセル
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

type TabType = "unread" | "all" | "deleted";

export default function AdminFeedbackPage() {
  const [list, setList] = useState<FeedbackRow[]>([]);
  const [deletedList, setDeletedList] = useState<FeedbackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletedLoading, setDeletedLoading] = useState(false);
  const [tab, setTab] = useState<TabType>("unread");
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/feedback", { cache: "no-store" }).then((r) => r.json()).catch(() => []);
    setList(Array.isArray(res) ? res : []);
    setLoading(false);
  }, []);

  const loadDeleted = useCallback(async () => {
    setDeletedLoading(true);
    const res = await fetch("/api/feedback?deleted=true", { cache: "no-store" }).then((r) => r.json()).catch(() => []);
    setDeletedList(Array.isArray(res) ? res : []);
    setDeletedLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (tab === "deleted") loadDeleted();
  }, [tab, loadDeleted]);

  async function markAllRead() {
    const unread = list.filter((f) => !f.is_read);
    await Promise.all(
      unread.map((f) =>
        fetch("/api/feedback", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: f.id, is_read: true }),
        })
      )
    );
    setList((prev) => prev.map((f) => ({ ...f, is_read: true })));
  }

  function handleUpdate(id: string, patch: Partial<FeedbackRow>) {
    setList((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }

  function handleSoftDelete(id: string) {
    setList((prev) => prev.filter((f) => f.id !== id));
  }

  function handleRestore(id: string) {
    const item = deletedList.find((f) => f.id === id);
    if (item) setList((prev) => [{ ...item, is_deleted: false }, ...prev]);
    setDeletedList((prev) => prev.filter((f) => f.id !== id));
  }

  function handleCreate(item: FeedbackRow) {
    setList((prev) => [item, ...prev]);
    setTab("all");
  }

  const unreadCount = list.filter((f) => !f.is_read).length;
  const displayed =
    tab === "unread" ? list.filter((f) => !f.is_read) :
    tab === "deleted" ? deletedList :
    list;

  return (
    <div className="mx-auto max-w-2xl">
      {/* ヘッダー */}
      <div className="mb-6 flex items-center gap-3">
        <Link href="/admin" className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-700 transition-colors">
          <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 3L5 8l5 5" />
          </svg>
          管理
        </Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-lg font-bold text-gray-900">要望・質問</h1>
        {unreadCount > 0 && (
          <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-bold text-white">
            {unreadCount}
          </span>
        )}
        <button
          onClick={() => setShowCreate(true)}
          className="ml-auto flex items-center gap-1.5 rounded-xl bg-violet-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-violet-700 transition-colors"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M8 3v10M3 8h10" />
          </svg>
          いただいた質問を追加
        </button>
      </div>

      {/* タブ + 操作 */}
      <div className="mb-4 flex items-center gap-2">
        <div className="flex items-center gap-0.5 rounded-full bg-gray-100 p-0.5 text-xs font-medium">
          <button onClick={() => setTab("unread")}
            className={`rounded-full px-3 py-1 transition-all ${tab === "unread" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
            未読{unreadCount > 0 && ` (${unreadCount})`}
          </button>
          <button onClick={() => setTab("all")}
            className={`rounded-full px-3 py-1 transition-all ${tab === "all" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
            すべて ({list.length})
          </button>
          <button onClick={() => setTab("deleted")}
            className={`rounded-full px-3 py-1 transition-all ${tab === "deleted" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
            削除済み{deletedList.length > 0 && ` (${deletedList.length})`}
          </button>
        </div>
        {unreadCount > 0 && tab !== "deleted" && (
          <button onClick={markAllRead} className="ml-auto text-xs text-gray-400 hover:text-gray-700 transition-colors">
            すべて既読にする
          </button>
        )}
      </div>

      {/* リスト */}
      {(loading && tab !== "deleted") || (deletedLoading && tab === "deleted") ? (
        <p className="py-12 text-center text-sm text-gray-400">読み込み中...</p>
      ) : displayed.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 py-12 text-center text-sm text-gray-400">
          {tab === "unread" ? "未読の要望・質問はありません" :
           tab === "deleted" ? "削除済みの項目はありません" :
           "まだ要望・質問はありません"}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {displayed.map((fb) => (
            <FeedbackCard
              key={fb.id}
              fb={fb}
              onUpdate={handleUpdate}
              onSoftDelete={handleSoftDelete}
              onRestore={handleRestore}
            />
          ))}
        </div>
      )}

      {showCreate && (
        <CreateQAModal onClose={() => setShowCreate(false)} onCreate={handleCreate} />
      )}
    </div>
  );
}
