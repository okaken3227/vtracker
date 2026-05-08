"use client";

import { useEffect, useState } from "react";

export default function Footer() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const main = document.getElementById("main-scroll");
    if (!main) return;

    const check = () => {
      const { scrollTop, scrollHeight, clientHeight } = main;
      setVisible(scrollHeight - scrollTop - clientHeight < 80);
    };

    main.addEventListener("scroll", check, { passive: true });
    check();
    return () => main.removeEventListener("scroll", check);
  }, []);

  return (
    <footer
      className={`shrink-0 overflow-hidden border-t border-gray-200 bg-white transition-all duration-300 ${
        visible ? "max-h-20 py-6" : "max-h-0 py-0"
      }`}
    >
      <div className="mx-auto max-w-6xl px-4 text-center text-sm text-gray-400">
        © {new Date().getFullYear()} vtracker
      </div>
    </footer>
  );
}
