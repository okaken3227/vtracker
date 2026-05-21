import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

// ブラウザ用クライアント（クライアントコンポーネントから使用）
export const browserSupabase = createClient(supabaseUrl, publishableKey, {
  auth: { persistSession: false },
});
