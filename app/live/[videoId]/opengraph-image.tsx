import { ImageResponse } from "next/og";
import { supabase } from "@/lib/supabase/client";
import type { Video, Channel } from "@/lib/types";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ videoId: string }>;
}) {
  const { videoId } = await params;

  const { data: video } = await supabase
    .from("videos")
    .select("title, channel_id, status")
    .eq("video_id", videoId)
    .single();

  const v = video as Pick<Video, "title" | "channel_id" | "status"> | null;

  const { data: channel } = v
    ? await supabase.from("channels").select("name, icon_url").eq("channel_id", v.channel_id).single()
    : { data: null };
  const ch = channel as Pick<Channel, "name" | "icon_url"> | null;

  const isLive = v?.status === "live";
  const accentColor = isLive ? "#ef4444" : "#7c3aed";
  const title = v?.title ? (v.title.length > 40 ? v.title.slice(0, 40) + "…" : v.title) : "配信";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: isLive
            ? "linear-gradient(135deg, #fff5f5 0%, #ffe4e6 100%)"
            : "linear-gradient(135deg, #faf8ff 0%, #f0ebff 100%)",
          position: "relative",
          padding: "0 80px",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: 8,
            height: "100%",
            background: accentColor,
          }}
        />
        {isLive && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              background: "#ef4444",
              color: "white",
              borderRadius: 9999,
              padding: "8px 24px",
              fontSize: 24,
              fontWeight: 700,
              marginBottom: 24,
            }}
          >
            ● LIVE
          </div>
        )}
        <div
          style={{
            fontSize: 56,
            fontWeight: 800,
            color: "#111827",
            textAlign: "center",
            lineHeight: 1.3,
          }}
        >
          {title}
        </div>
        {ch && (
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 32 }}>
            {ch.icon_url ? (
              <img
                src={ch.icon_url}
                width={48}
                height={48}
                style={{ borderRadius: 24 }}
              />
            ) : null}
            <div style={{ fontSize: 32, color: "#6b7280" }}>{ch.name}</div>
          </div>
        )}
        <div
          style={{
            position: "absolute",
            bottom: 32,
            right: 48,
            fontSize: 24,
            fontWeight: 700,
            color: accentColor,
          }}
        >
          vtracker
        </div>
      </div>
    ),
    { ...size }
  );
}
