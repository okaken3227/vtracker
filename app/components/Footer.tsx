"use client";

import { useEffect, useState } from "react";

export default function Footer() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const check = () => {
      const scrollTop = window.scrollY;
      const scrollHeight = document.documentElement.scrollHeight;
      const clientHeight = window.innerHeight;
      setVisible(scrollHeight - scrollTop - clientHeight < 80);
    };

    window.addEventListener("scroll", check, { passive: true });
    check();
    return () => window.removeEventListener("scroll", check);
  }, []);

  return (
    <footer
      className={`shrink-0 overflow-hidden border-t border-gray-200 bg-white transition-all duration-300 ${
        visible ? "max-h-20 py-6" : "max-h-0 py-0"
      }`}
    >
      <div className="mx-auto max-w-6xl px-4 text-center text-sm text-gray-400">
        © {new Date().getFullYear()} vtracker
        <span className="mx-2">·</span>
        <a href="/terms" className="hover:text-gray-600 transition-colors">利用規約</a>
        <span className="mx-2">·</span>
        <a href="/feedback" className="hover:text-gray-600 transition-colors">要望・質問</a>
        <span className="mx-2">·</span>
        <a href="/admin" className="hover:text-gray-600 transition-colors">管理</a>
      </div>
    </footer>
  );
}
