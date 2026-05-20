import { ImageResponse } from "next/og";
import fs from "node:fs";
import path from "node:path";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  const iconData = fs.readFileSync(path.join(process.cwd(), "app/icon.png"));
  const iconSrc = `data:image/png;base64,${iconData.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: 32,
          background: "linear-gradient(135deg, #0f0520 0%, #1a0840 60%, #0d0428 100%)",
          fontFamily: "sans-serif",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={iconSrc} width={380} height={380} style={{ borderRadius: 80 }} alt="vtracker" />
        <div style={{ display: "flex", alignItems: "baseline" }}>
          <span style={{ fontSize: 96, fontWeight: 900, color: "#a78bfa", lineHeight: 1 }}>v</span>
          <span style={{ fontSize: 96, fontWeight: 900, color: "#ffffff", lineHeight: 1 }}>tracker</span>
        </div>
        <span style={{ fontSize: 28, color: "#c4b5fd", fontWeight: 400 }}>
          VTuberの同接グラフ・視聴者数・スパチャ統計をリアルタイム追跡
        </span>
      </div>
    ),
    { ...size }
  );
}
