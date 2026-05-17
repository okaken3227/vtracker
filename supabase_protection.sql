-- ================================================================
-- vtracker データ保護 SQL
-- Supabase の SQL エディタで実行してください
-- ================================================================

-- ① 削除ログテーブル（削除前に行の内容を保存）
CREATE TABLE IF NOT EXISTS delete_audit (
  id        bigserial PRIMARY KEY,
  table_name text NOT NULL,
  deleted_row jsonb NOT NULL,
  deleted_at  timestamptz DEFAULT now()
);
GRANT ALL ON delete_audit TO service_role;
GRANT USAGE, SELECT ON SEQUENCE delete_audit_id_seq TO service_role;

-- ② 削除ログ関数（行ごとに削除内容を記録）
CREATE OR REPLACE FUNCTION log_row_delete()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO delete_audit (table_name, deleted_row)
  VALUES (TG_TABLE_NAME, to_jsonb(OLD));
  RETURN OLD;
END;
$$;

-- ③ 一括削除防止関数（10件超の一括削除をブロック）
CREATE OR REPLACE FUNCTION prevent_mass_delete()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  del_count integer;
BEGIN
  SELECT COUNT(*) INTO del_count FROM old_table;
  IF del_count > 10 THEN
    RAISE EXCEPTION
      '安全のため % 件の一括削除をブロックしました（テーブル: %）。1件ずつ削除してください。',
      del_count, TG_TABLE_NAME;
  END IF;
  RETURN NULL;
END;
$$;

-- ④ channels テーブルへの適用
DROP TRIGGER IF EXISTS channels_delete_log        ON channels;
DROP TRIGGER IF EXISTS channels_mass_delete_guard ON channels;

CREATE TRIGGER channels_delete_log
  BEFORE DELETE ON channels
  FOR EACH ROW EXECUTE FUNCTION log_row_delete();

CREATE TRIGGER channels_mass_delete_guard
  AFTER DELETE ON channels
  REFERENCING OLD TABLE AS old_table
  FOR EACH STATEMENT EXECUTE FUNCTION prevent_mass_delete();

-- ⑤ groups テーブルへの適用
DROP TRIGGER IF EXISTS groups_delete_log        ON groups;
DROP TRIGGER IF EXISTS groups_mass_delete_guard ON groups;

CREATE TRIGGER groups_delete_log
  BEFORE DELETE ON groups
  FOR EACH ROW EXECUTE FUNCTION log_row_delete();

CREATE TRIGGER groups_mass_delete_guard
  AFTER DELETE ON groups
  REFERENCING OLD TABLE AS old_table
  FOR EACH STATEMENT EXECUTE FUNCTION prevent_mass_delete();

-- ⑥ feedback テーブルへの権限（すでに実行済みならスキップ）
GRANT ALL ON public.feedback TO service_role;

-- ⑦ feedback の RLS（誰でも投稿可・読み書きは service_role のみ）
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public can insert feedback" ON feedback;
CREATE POLICY "public can insert feedback"
  ON feedback FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- ================================================================
-- 確認: 以下で登録されたトリガーを確認できます
-- SELECT trigger_name, event_object_table, action_timing, event_manipulation
-- FROM information_schema.triggers
-- WHERE trigger_schema = 'public'
-- ORDER BY event_object_table, action_timing;
-- ================================================================
