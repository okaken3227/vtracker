import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const BARS = [30, 45, 38, 60, 50, 72, 65, 90, 78, 68, 82, 62, 85, 58, 72];

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "linear-gradient(135deg, #0f0520 0%, #1a0840 60%, #0d0428 100%)",
          position: "relative",
          overflow: "hidden",
          fontFamily: "sans-serif",
          padding: "64px 72px",
        }}
      >
        {/* 背景グロー */}
        <div style={{
          position: "absolute", width: 560, height: 560, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(139,92,246,0.22) 0%, transparent 70%)",
          top: -160, left: -80,
        }} />
        <div style={{
          position: "absolute", width: 480, height: 480, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(236,72,153,0.15) 0%, transparent 70%)",
          bottom: -120, right: 200,
        }} />

        {/* 棒グラフ (右) */}
        <div style={{
          position: "absolute", right: 64, bottom: 64,
          display: "flex", alignItems: "flex-end", gap: 8,
        }}>
          {BARS.map((h, i) => (
            <div key={i} style={{
              width: 20, height: h * 2, borderRadius: 4,
              background: i === 7
                ? "linear-gradient(to top, #7c3aed, #ec4899)"
                : i >= 5
                ? "rgba(139,92,246,0.5)"
                : "rgba(139,92,246,0.25)",
            }} />
          ))}
        </div>

        {/* ── 上部: ロゴ + タグライン ── */}
        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          {/* ロゴ */}
          <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 16 }}>
            {/* アイコン */}
            <div style={{
              width: 72, height: 72, borderRadius: 18,
              background: "linear-gradient(135deg, #7c3aed, #a855f7)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 40,
            }}>
              📡
            </div>
            <div style={{ display: "flex", alignItems: "baseline" }}>
              <span style={{ fontSize: 88, fontWeight: 900, color: "#a78bfa", lineHeight: 1 }}>v</span>
              <span style={{ fontSize: 88, fontWeight: 900, color: "#ffffff", lineHeight: 1 }}>tracker</span>
            </div>
          </div>

          {/* タグライン */}
          <div style={{
            fontSize: 30, color: "#c4b5fd", fontWeight: 400,
            lineHeight: 1.5, marginBottom: 52, maxWidth: 600,
            display: "flex", flexDirection: "column",
          }}>
            <span>VTuberのリアルタイム視聴者数・</span>
            <span>スーパーチャットを追跡するサービス</span>
          </div>

          {/* フィーチャーカード */}
          <div style={{ display: "flex", gap: 16 }}>
            {[
              {
                icon: "▶",
                iconBg: "linear-gradient(135deg, #dc2626, #991b1b)",
                title: "YouTube & Twitch",
                desc: "2プラットフォーム対応",
                border: "rgba(239,68,68,0.4)",
              },
              {
                icon: "💴",
                iconBg: "linear-gradient(135deg, #db2777, #9d174d)",
                title: "スパチャ集計",
                desc: "多通貨・円換算対応",
                border: "rgba(236,72,153,0.4)",
              },
              {
                icon: "📊",
                iconBg: "linear-gradient(135deg, #0891b2, #164e63)",
                title: "タイムライン",
                desc: "24時間の同接推移",
                border: "rgba(6,182,212,0.4)",
              },
            ].map(({ icon, iconBg, title, desc, border }) => (
              <div key={title} style={{
                display: "flex", alignItems: "center", gap: 14,
                background: "rgba(255,255,255,0.05)",
                border: `1px solid ${border}`,
                borderRadius: 16, padding: "16px 20px",
                flex: 1,
              }}>
                <div style={{
                  width: 46, height: 46, borderRadius: 12, flexShrink: 0,
                  background: iconBg,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 22,
                }}>
                  {icon}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <span style={{ fontSize: 20, fontWeight: 700, color: "#ffffff", whiteSpace: "nowrap" }}>
                    {title}
                  </span>
                  <span style={{ fontSize: 16, color: "#9ca3af", whiteSpace: "nowrap" }}>
                    {desc}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 下部グラデーションライン */}
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0, height: 4,
          background: "linear-gradient(to right, #7c3aed, #ec4899, #06b6d4)",
        }} />
      </div>
    ),
    { ...size }
  );
}
