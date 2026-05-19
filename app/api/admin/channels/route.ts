import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/client";
import { requireAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authError = requireAdmin(req);
  if (authError) return authError;
  const { data, error } = await supabase
    .from("channels")
    .select("channel_id, name, group_id, icon_url, platform, linked_channel_id, custom_url, color, keywords")
    .order("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function PATCH(req: NextRequest) {
  const authError = requireAdmin(req);
  if (authError) return authError;
  const body = await req.json();
  const { channelId, groupId, linkedChannelId, color, keywords } = body as {
    channelId?: string;
    groupId?: string | null;
    linkedChannelId?: string | null;
    color?: string | null;
    keywords?: string | null;
  };

  if (!channelId) {
    return NextResponse.json({ error: "channelId は必須です" }, { status: 400 });
  }

  // グループ変更
  if (groupId !== undefined) {
    const { error } = await supabase
      .from("channels")
      .update({ group_id: groupId ?? null })
      .eq("channel_id", channelId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // チャンネルカラー変更
  if (color !== undefined) {
    const { error } = await supabase
      .from("channels")
      .update({ color: color ?? null })
      .eq("channel_id", channelId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // キーワード変更
  if (keywords !== undefined) {
    const { error } = await supabase
      .from("channels")
      .update({ keywords: keywords ?? null })
      .eq("channel_id", channelId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // 連携チャンネルの変更（双方向）
  if (linkedChannelId !== undefined) {
    // まず旧リンクを取得して解除
    const { data: current } = await supabase
      .from("channels")
      .select("linked_channel_id")
      .eq("channel_id", channelId)
      .single();

    if (current?.linked_channel_id) {
      await supabase
        .from("channels")
        .update({ linked_channel_id: null })
        .eq("channel_id", current.linked_channel_id);
    }

    if (linkedChannelId) {
      // 新しいリンク先の旧リンクも解除
      const { data: newTarget } = await supabase
        .from("channels")
        .select("linked_channel_id")
        .eq("channel_id", linkedChannelId)
        .single();

      if (newTarget?.linked_channel_id && newTarget.linked_channel_id !== channelId) {
        await supabase
          .from("channels")
          .update({ linked_channel_id: null })
          .eq("channel_id", newTarget.linked_channel_id);
      }

      // 双方向リンク設定
      await supabase
        .from("channels")
        .update({ linked_channel_id: linkedChannelId })
        .eq("channel_id", channelId);
      await supabase
        .from("channels")
        .update({ linked_channel_id: channelId })
        .eq("channel_id", linkedChannelId);
    } else {
      // null = 解除のみ
      await supabase
        .from("channels")
        .update({ linked_channel_id: null })
        .eq("channel_id", channelId);
    }
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const authError = requireAdmin(req);
  if (authError) return authError;
  const { channelId } = await req.json();
  if (!channelId) {
    return NextResponse.json({ error: "channelId は必須です" }, { status: 400 });
  }

  // リンク先の解除
  const { data: current } = await supabase
    .from("channels")
    .select("linked_channel_id")
    .eq("channel_id", channelId)
    .single();

  if (current?.linked_channel_id) {
    await supabase
      .from("channels")
      .update({ linked_channel_id: null })
      .eq("channel_id", current.linked_channel_id);
  }

  const { error } = await supabase
    .from("channels")
    .delete()
    .eq("channel_id", channelId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
