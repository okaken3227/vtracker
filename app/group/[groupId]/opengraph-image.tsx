import { ImageResponse } from "next/og";
import { supabase } from "@/lib/supabase/client";
import type { Group } from "@/lib/types";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;

  const { data: rows } = await supabase
    .from("groups")
    .select("id, name, color, icon_url")
    .or(`id.eq.${groupId},slug.eq.${groupId}`);
  const group = rows?.[0] ?? null;
  const { count } = group
    ? await supabase.from("channels").select("*", { count: "exact", head: true }).eq("group_id", group.id)
    : { count: 0 };

  const g = group as Pick<Group, "name" | "color" | "icon_url"> | null;
  const color = g?.color ?? "#7c3aed";
  const name = g?.name ?? "グループ";

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
            background: color,
          }}
        />
        {g?.icon_url ? (
          <img
            src={g.icon_url}
            width={120}
            height={120}
            style={{ borderRadius: 60, marginBottom: 24 }}
          />
        ) : (
          <div
            style={{
              width: 120,
              height: 120,
              borderRadius: 60,
              background: color,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 48,
              fontWeight: 900,
              color: "white",
              marginBottom: 24,
            }}
          >
            {name[0]}
          </div>
        )}
        <div style={{ fontSize: 72, fontWeight: 900, color: "#111827" }}>
          {name}
        </div>
        <div style={{ fontSize: 32, color: "#6b7280", marginTop: 16 }}>
          {`${count ?? 0}チャンネル`}
        </div>
        <div
          style={{
            position: "absolute",
            bottom: 32,
            right: 48,
            fontSize: 24,
            fontWeight: 700,
            color: color,
          }}
        >
          vtracker
        </div>
      </div>
    ),
    { ...size }
  );
}
