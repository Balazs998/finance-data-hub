-- What did Snowflake actually run? Both extracts show up here.
-- Run as SYSADMIN, which owns the warehouse.
USE ROLE SYSADMIN;
SELECT start_time, query_text, rows_produced, total_elapsed_time
FROM TABLE(FDH_DEMO.INFORMATION_SCHEMA.QUERY_HISTORY_BY_WAREHOUSE(WAREHOUSE_NAME => 'JEDOX_ETL_WH'))
WHERE query_tag = 'jedox_actuals_load'
ORDER BY start_time DESC;
