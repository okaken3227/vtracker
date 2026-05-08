import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/client";

// DBのvideo statusを "upcoming" に戻して再チェックさせる
export async function POST(req: NextRequest) {
  const { videoId } = await req.json();
  if (!videoId) return NextResponse.json({ error: "videoId required" }, { status: 400 });

  const { error } = await supabase
    .from("videos")
    .update({ status: "upcoming" })
    .eq("video_id", videoId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, videoId });
}
