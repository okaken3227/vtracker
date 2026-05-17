import { ImageResponse } from "next/og";
import { supabase } from "@/lib/supabase/client";
import type { Channel } from "@/lib/types";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

function formatCount(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(0)}万`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toLocaleString();
}

export default async function Image({
  params,
}: {
  params: Promise<{ channelId: string }>;
}) {
  const { channelId } = await params;

  const { data } = await supabase
    .from("channels")
    .select("name, icon_url, subscriber_count")
    .eq("channel_id", channelId)
    .single();

  const ch = data as Pick<Channel, "name" | "icon_url" | "subscriber_count"> | null;
  const name = ch?.name ?? "チャンネル";

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
          background: "linear-gradient(135deg, #faf8ff 0%, #f0ebff 100%)",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: 8,
            height: "100%",
            background: "#7c3aed",
          }}
        />
        {ch?.icon_url ? (
          <img
            src={ch.icon_url}
            width={140}
            height={140}
            style={{ borderRadius: 70, marginBottom: 28 }}
          />
        ) : null}
        <div style={{ fontSize: 64, fontWeight: 900, color: "#111827" }}>
          {name}
        </div>
        {ch?.subscriber_count != null && (
          <div style={{ fontSize: 32, color: "#6b7280", marginTop: 16 }}>
            {`登録者 ${formatCount(ch.subscriber_count)}人`}
          </div>
        )}
        <div
          style={{
            position: "absolute",
            bottom: 32,
            right: 48,
            fontSize: 24,
            fontWeight: 700,
            color: "#7c3aed",
          }}
        >
          vtracker
        </div>
      </div>
    ),
    { ...size }
  );
}
