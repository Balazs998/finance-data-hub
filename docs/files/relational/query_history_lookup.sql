USE ROLE SYSADMIN; -- or any role with MONITOR on JEDOX_ETL_WH
-- What did Snowflake actually run? Both extracts show up here.
SELECT start_time, query_text, rows_produced, total_elapsed_time
FROM TABLE(FDH_DEMO.INFORMATION_SCHEMA.QUERY_HISTORY_BY_WAREHOUSE(WAREHOUSE_NAME => 'JEDOX_ETL_WH', END_TIME_RANGE_START => DATEADD('day', -7, CURRENT_TIMESTAMP()), RESULT_LIMIT => 10000))
WHERE query_tag = 'jedox_actuals_load'
ORDER BY start_time DESC;
