"use client";

import { useRouter } from "next/navigation";

export default function BackButton() {
  const router = useRouter();
  return (
    <button
      onClick={() => router.back()}
      className="mb-6 inline-flex items-center gap-1 text-sm text-gray-400 transition-colors hover:text-violet-600"
    >
      ← ライブ詳細へ戻る
    </button>
  );
}
