-- Read-only preflight for the ResolveHQ retry columns/index.
-- Run from the verified Neon main SQL editor; this query does not alter schema or data.
WITH expected_columns(column_name, expected_type, expected_nullable) AS (
  VALUES
    ('resolvehqRetryCount', 'integer', 'NO'),
    ('resolvehqLastAttemptAt', 'timestamp without time zone', 'YES'),
    ('resolvehqNextRetryAt', 'timestamp without time zone', 'YES')
),
column_checks AS (
  SELECT
    e.column_name AS check_name,
    EXISTS (
      SELECT 1
      FROM information_schema.columns c
      WHERE c.table_schema = current_schema()
        AND c.table_name = 'feedback_reports'
        AND c.column_name = e.column_name
        AND c.data_type = e.expected_type
        AND c.is_nullable = e.expected_nullable
    ) AS passed
  FROM expected_columns e
)
SELECT 'database' AS check_name, current_database() AS result
UNION ALL
SELECT check_name, passed::text AS result FROM column_checks
UNION ALL
SELECT
  'resolvehq retry index',
  EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = current_schema()
      AND tablename = 'feedback_reports'
      AND indexname = 'feedback_reports_resolvehqSyncState_resolvehqNextRetryAt_idx'
  )::text;
