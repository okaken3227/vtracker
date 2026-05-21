import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// ブラウザ用クライアント（クライアントコンポーネントから使用）
export const browserSupabase = createClient(supabaseUrl, anonKey, {
  auth: { persistSession: false },
});
