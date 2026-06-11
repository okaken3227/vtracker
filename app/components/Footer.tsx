"use client";

import { useEffect, useState } from "react";

export default function Footer() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = document.getElementById("main-scroll");
    if (!el) return;
    const check = () => {
      setVisible(el.scrollHeight - el.scrollTop - el.clientHeight < 80);
    };
    el.addEventListener("scroll", check, { passive: true });
    check();
    return () => el.removeEventListener("scroll", check);
  }, []);

  return (
    <footer
      className={`fixed bottom-0 inset-x-0 z-20 overflow-hidden bg-white/80 backdrop-blur-xl transition-all duration-300 ${
        visible ? "max-h-20 py-4" : "max-h-0 py-0"
      }`}
      style={{ borderTop: "1px solid transparent", backgroundImage: "linear-gradient(rgba(255,255,255,0.8),rgba(255,255,255,0.8)), linear-gradient(to right,rgba(124,58,237,0.2),rgba(236,72,153,0.12),rgba(99,102,241,0.1))", backgroundOrigin: "border-box", backgroundClip: "padding-box, border-box" }}
    >
      <div className="mx-auto max-w-6xl px-4 text-center text-xs text-gray-400">
        © {new Date().getFullYear()} vtracker — VTuber同接・スパチャ統計トラッカー
        <span className="mx-2 text-gray-200">·</span>
        <a href="/about" className="hover:text-violet-600 transition-colors">このサービスについて</a>
        <span className="mx-2 text-gray-200">·</span>
        <a href="/terms" className="hover:text-violet-600 transition-colors">利用規約・プライバシー</a>
        <span className="mx-2 text-gray-200">·</span>
        <a href="/feedback" className="hover:text-violet-600 transition-colors">お問い合わせ</a>
        <span className="mx-2 text-gray-200">·</span>
        <a href="/admin" className="hover:text-violet-600 transition-colors">管理</a>
      </div>
    </footer>
  );
}
