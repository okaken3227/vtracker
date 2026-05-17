import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/client";

export async function GET() {
  const { data, error } = await supabase
    .from("channels")
    .select("channel_id, name, group_id, color, platform, linked_channel_id")
    .order("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function DELETE(req: NextRequest) {
  const { channelId } = await req.json();
  if (!channelId) return NextResponse.json({ error: "channelId は必須です" }, { status: 400 });
  const { error } = await supabase.from("channels").delete().eq("channel_id", channelId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest) {
  const { channelId, groupId, color, linkedChannelId } = await req.json();
  if (!channelId) {
    return NextResponse.json({ error: "channelId は必須です" }, { status: 400 });
  }
  const updateData: Record<string, unknown> = { group_id: groupId ?? null };
  if (color !== undefined) updateData.color = color || null;
  const { error } = await supabase
    .from("channels")
    .update(updateData)
    .eq("channel_id", channelId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 別プラットフォームとの紐付け（双方向に設定）
  if (linkedChannelId !== undefined) {
    if (linkedChannelId) {
      await supabase.from("channels").update({ linked_channel_id: linkedChannelId }).eq("channel_id", channelId);
      await supabase.from("channels").update({ linked_channel_id: channelId }).eq("channel_id", linkedChannelId);
    } else {
      await supabase.from("channels").update({ linked_channel_id: null }).eq("channel_id", channelId);
    }
  }

  return NextResponse.json({ ok: true });
}
