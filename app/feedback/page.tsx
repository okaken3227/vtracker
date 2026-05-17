"use client";

import { useState, useEffect } from "react";

const TYPES = [
  { value: "request", label: "チャンネル追加依頼" },
  { value: "question", label: "質問" },
  { value: "other", label: "その他" },
];

type QAItem = {
  id: string;
  message: string;
  public_answer: string;
  name: string | null;
  created_at: string;
  is_admin_post: boolean;
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ja-JP", {
    year: "numeric", month: "numeric", day: "numeric",
  });
}

export default function FeedbackPage() {
  const [type, setType] = useState("request");
  const [message, setMessage] = useState("");
  const [name, setName] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [qaList, setQaList] = useState<QAItem[]>([]);

  useEffect(() => {
    fetch("/api/feedback/public")
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setQaList(data); })
      .catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;
    setStatus("sending");
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, message, name }),
      });
      if (!res.ok) throw new Error();
      setStatus("done");
      setMessage("");
      setName("");
    } catch {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 3000);
    }
  }

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">要望・質問</h1>
        <p className="mt-1 text-sm text-gray-500">
          チャンネルの追加依頼や質問をお気軽にどうぞ。
        </p>
      </div>

      {status === "done" ? (
        <div className="rounded-2xl border border-green-200 bg-green-50 p-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
            <svg className="h-6 w-6 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </div>
          <p className="text-base font-semibold text-green-800">送信しました！</p>
          <p className="mt-1 text-sm text-green-600">ありがとうございます。確認します。</p>
          <button
            onClick={() => setStatus("idle")}
            className="mt-4 rounded-full bg-green-600 px-5 py-2 text-sm font-medium text-white hover:bg-green-700 transition-colors"
          >
            もう一件送る
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* 種別 */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">種別</label>
            <div className="flex flex-wrap gap-2">
              {TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setType(t.value)}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-all ${
                    type === t.value
                      ? "bg-violet-600 text-white shadow-sm"
                      : "border border-gray-200 bg-white text-gray-500 hover:border-violet-300 hover:text-violet-600"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* メッセージ */}
          <div>
            <label htmlFor="message" className="mb-1.5 block text-sm font-medium text-gray-700">
              内容 <span className="text-red-400">*</span>
            </label>
            <textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              required
              placeholder={
                type === "request"
                  ? "例: ○○チャンネル（https://www.youtube.com/@...）を追加してほしいです"
                  : "内容をご記入ください"
              }
              className="w-full resize-none rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 placeholder-gray-400 outline-none transition-colors focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
            />
          </div>

          {/* 名前（任意） */}
          <div>
            <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-gray-700">
              お名前 <span className="text-xs font-normal text-gray-400">（任意）</span>
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="匿名でも可"
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition-colors focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
            />
          </div>

          {status === "error" && (
            <p className="text-sm text-red-500">送信に失敗しました。もう一度お試しください。</p>
          )}

          <button
            type="submit"
            disabled={status === "sending" || !message.trim()}
            className="w-full rounded-xl bg-violet-600 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-violet-700 disabled:opacity-50"
          >
            {status === "sending" ? "送信中..." : "送信する"}
          </button>
        </form>
      )}

      {/* いただいた質問 */}
      {qaList.length > 0 && (
        <div className="mt-12">
          <div className="mb-4 flex items-center gap-2">
            <h2 className="text-base font-bold text-gray-900">いただいた質問</h2>
            <span className="text-sm text-gray-400">{qaList.length}件</span>
          </div>
          <div className="flex flex-col gap-4">
            {qaList.map((qa) => (
              <div key={qa.id} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
                {/* 質問 */}
                <div className="flex gap-3">
                  <span className="mt-0.5 flex-shrink-0 text-sm font-bold text-violet-500">Q</span>
                  <p className="text-sm font-medium leading-relaxed text-gray-900">
                    {qa.message}
                  </p>
                </div>
                {/* 回答 */}
                <div className="mt-3 flex gap-3 border-t border-gray-100 pt-3">
                  <span className="mt-0.5 flex-shrink-0 text-sm font-bold text-amber-500">A</span>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-600">
                    {qa.public_answer}
                  </p>
                </div>
                {/* メタ情報 */}
                <p className="mt-2 text-right text-[11px] text-gray-300">
                  {formatDate(qa.created_at)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
