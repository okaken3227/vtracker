import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
  );
}

// サーバーサイド専用（RLS をバイパスして書き込む）
// global.fetch に cache: 'no-store' を設定し router.refresh() で常に最新DBを取得する
export const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
  global: {
    fetch: (url, options) =>
      fetch(url, { ...options, cache: "no-store" }),
  },
});
