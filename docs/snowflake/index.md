---
title: Snowflake SQL for FP&A
description: "Get finance-shaped extracts from Snowflake SQL, and freeze the month you reported: closed-period P&L actuals, plan vs actuals, permanent snapshots versus Time Travel, an FX rate lock, a 13-week cash runway, cost per vehicle, capex project tracking, a BOM cost rollup, and ERP control totals for fictional FDH Motors."
hide:
  - toc
---

<div class="fdh-section fdh-section--snowflake" markdown>

<header class="fdh-hero">
  <div class="fdh-hero__text">
    <p class="fdh-hero__eyebrow">Section</p>
    <h1>Snowflake</h1>
    <p class="fdh-hero__intro">Snowflake is where the actuals live after the general ledger closes. This section is about getting a finance-shaped extract out of Snowflake, and freezing the number you reported, not about warehouses, roles, or loading pipelines.</p>
  </div>
  <picture class="fdh-hero__mascot">
    <source media="(max-width: 600px)" srcset="../assets/mascots/section/snowflake-pointing-phone.webp 1x, ../assets/mascots/section/snowflake-pointing-phone-2x.webp 2x" type="image/webp">
    <source srcset="../assets/mascots/section/snowflake-pointing.webp 1x, ../assets/mascots/section/snowflake-pointing-2x.webp 2x" type="image/webp">
    <img src="../assets/mascots/section/snowflake-pointing.png" alt="Snowflake mascot in a blue hoodie pointing toward the introduction" width="154" height="260" fetchpriority="high" loading="eager" decoding="async">
  </picture>
</header>

<h2 class="fdh-label">Posts</h2>
<ul class="fdh-cards">
  <li><article class="fdh-card fdh-card--start">
    <span class="fdh-start">Start here</span>
    <p class="fdh-card__tools">Snowflake</p>
    <h3 class="fdh-card__title"><a href="month-end-actuals/">Month-end actuals</a></h3>
    <p class="fdh-card__summary">Turn journal lines into monthly P&amp;L actuals that stay right when a period is reloaded.</p>
    <p class="fdh-card__meta"><span aria-hidden="true">◷</span> 7 min read</p>
  </article></li>
  <li><article class="fdh-card">
    <p class="fdh-card__tools">Snowflake</p>
    <h3 class="fdh-card__title"><a href="plan-vs-actuals/">Plan vs actuals</a></h3>
    <p class="fdh-card__summary">Compare budget and actuals so a month missing on either side still shows up.</p>
    <p class="fdh-card__meta"><span aria-hidden="true">◷</span> 7 min read</p>
  </article></li>
  <li><article class="fdh-card">
    <p class="fdh-card__tools">Snowflake</p>
    <h3 class="fdh-card__title"><a href="month-end-snapshots/">Snapshots vs Time Travel</a></h3>
    <p class="fdh-card__summary">Freeze the month you reported so a late posting does not change the number you sent.</p>
    <p class="fdh-card__meta"><span aria-hidden="true">◷</span> 20 min read</p>
  </article></li>
  <li><article class="fdh-card">
    <p class="fdh-card__tools">Snowflake</p>
    <h3 class="fdh-card__title"><a href="fx-rate-lock/">FX rate lock</a></h3>
    <p class="fdh-card__summary">Lock the FX rate on the pack you sent so a later restatement cannot move the total.</p>
    <p class="fdh-card__meta"><span aria-hidden="true">◷</span> 25 min read</p>
  </article></li>
  <li><article class="fdh-card">
    <p class="fdh-card__tools">Snowflake</p>
    <h3 class="fdh-card__title"><a href="asof-join/">ASOF JOIN</a></h3>
    <p class="fdh-card__summary">Attach the latest prior daily FX rate when the posting date has no exact match.</p>
    <p class="fdh-card__meta"><span aria-hidden="true">◷</span> 8 min read</p>
  </article></li>
  <li><article class="fdh-card">
    <p class="fdh-card__tools">Snowflake</p>
    <h3 class="fdh-card__title"><a href="automaker-13-week-cash-runway/">13-week cash runway</a></h3>
    <p class="fdh-card__summary">Forecast 13 weeks of FDH Motors cash and read how many weeks stay above the liquidity floor.</p>
    <p class="fdh-card__meta"><span aria-hidden="true">◷</span> 25 min read</p>
  </article></li>
  <li><article class="fdh-card">
    <p class="fdh-card__tools">Snowflake · Jedox</p>
    <h3 class="fdh-card__title"><a href="automaker-cost-per-vehicle/">Cost per vehicle</a></h3>
    <p class="fdh-card__summary">Allocate FDH Motors plant cost by units produced, then split the revenue gap into price, volume, mix, new and lost.</p>
    <p class="fdh-card__meta"><span aria-hidden="true">◷</span> 30 min read</p>
  </article></li>
  <li><article class="fdh-card">
    <p class="fdh-card__tools">Snowflake</p>
    <h3 class="fdh-card__title"><a href="automaker-capex-project-tracking/">Capex project tracking</a></h3>
    <p class="fdh-card__summary">Track FDH Motors capex budget, open commitments and actuals, and alert only when a project is over budget or unapproved.</p>
    <p class="fdh-card__meta"><span aria-hidden="true">◷</span> 25 min read</p>
  </article></li>
  <li><article class="fdh-card">
    <p class="fdh-card__tools">Snowflake</p>
    <h3 class="fdh-card__title"><a href="automaker-bom-cost-rollup/">BOM cost rollup</a></h3>
    <p class="fdh-card__summary">Explode the FDH Motors bill of materials, roll standard cost up to the vehicle, and split purchase price and usage variance.</p>
    <p class="fdh-card__meta"><span aria-hidden="true">◷</span> 30 min read</p>
  </article></li>
  <li><article class="fdh-card">
    <p class="fdh-card__tools">Snowflake · Jedox</p>
    <h3 class="fdh-card__title"><a href="automaker-erp-control-totals/">ERP control totals</a></h3>
    <p class="fdh-card__summary">Record FDH Motors control totals at each hop from the ERP file to Snowflake to Jedox, and keep an append-only evidence row per run.</p>
    <p class="fdh-card__meta"><span aria-hidden="true">◷</span> 35 min read</p>
  </article></li>
  <li><article class="fdh-card">
    <p class="fdh-card__tools">Snowflake · Jedox</p>
    <h3 class="fdh-card__title"><a href="../jedox/snowflake-to-jedox/">Snowflake to Jedox load</a></h3>
    <p class="fdh-card__summary">Pull monthly actuals into a planning cube so a rerun leaves no stale numbers.</p>
    <p class="fdh-card__meta"><span aria-hidden="true">◷</span> 10 min read</p>
  </article></li>
</ul>

<section class="fdh-downloads" aria-labelledby="dl-snowflake">
  <h2 id="dl-snowflake">Snowflake downloads</h2>
  <ul>
    <li><a href="../files/sql/gl_actuals_pnl.sql" download="gl_actuals_pnl.sql" data-goatcounter-click="download-gl_actuals_pnl.sql" data-goatcounter-title="Download gl_actuals_pnl.sql" data-goatcounter-no-session="1"><span aria-hidden="true">↓</span> gl_actuals_pnl.sql</a></li>
    <li><a href="../files/sql/plan_vs_actual.sql" download="plan_vs_actual.sql" data-goatcounter-click="download-plan_vs_actual.sql" data-goatcounter-title="Download plan_vs_actual.sql" data-goatcounter-no-session="1"><span aria-hidden="true">↓</span> plan_vs_actual.sql</a></li>
    <li><a href="../files/samples/load_snowflake.sql" download="load_snowflake.sql" data-goatcounter-click="download-load_snowflake.sql" data-goatcounter-title="Download load_snowflake.sql" data-goatcounter-no-session="1"><span aria-hidden="true">↓</span> load_snowflake.sql</a></li>
    <li><a href="../files/samples/fact_actuals.csv" download="fact_actuals.csv" data-goatcounter-click="download-fact_actuals.csv" data-goatcounter-title="Download fact_actuals.csv" data-goatcounter-no-session="1"><span aria-hidden="true">↓</span> fact_actuals.csv</a></li>
    <li><a href="../files/snapshots/01_fact_actuals_snapshot_ddl.sql" download="01_fact_actuals_snapshot_ddl.sql" data-goatcounter-click="download-01_fact_actuals_snapshot_ddl.sql" data-goatcounter-title="Download 01_fact_actuals_snapshot_ddl.sql" data-goatcounter-no-session="1"><span aria-hidden="true">↓</span> 01_fact_actuals_snapshot_ddl.sql</a></li>
    <li><a href="../files/snapshots/03_take_snapshot.sql" download="03_take_snapshot.sql" data-goatcounter-click="download-03_take_snapshot.sql" data-goatcounter-title="Download 03_take_snapshot.sql" data-goatcounter-no-session="1"><span aria-hidden="true">↓</span> 03_take_snapshot.sql</a></li>
    <li><a href="../files/snapshots/02_seed_late_posting.sql" download="02_seed_late_posting.sql" data-goatcounter-click="download-02_seed_late_posting.sql" data-goatcounter-title="Download 02_seed_late_posting.sql" data-goatcounter-no-session="1"><span aria-hidden="true">↓</span> 02_seed_late_posting.sql</a></li>
    <li><a href="../files/snapshots/04_v_snapshot_vs_current.sql" download="04_v_snapshot_vs_current.sql" data-goatcounter-click="download-04_v_snapshot_vs_current.sql" data-goatcounter-title="Download 04_v_snapshot_vs_current.sql" data-goatcounter-no-session="1"><span aria-hidden="true">↓</span> 04_v_snapshot_vs_current.sql</a></li>
    <li><a href="../files/snapshots/05_compare_query.sql" download="05_compare_query.sql" data-goatcounter-click="download-05_compare_query.sql" data-goatcounter-title="Download 05_compare_query.sql" data-goatcounter-no-session="1"><span aria-hidden="true">↓</span> 05_compare_query.sql</a></li>
    <li><a href="../files/fx/01_fx_rate_daily_ddl.sql" download="01_fx_rate_daily_ddl.sql" data-goatcounter-click="download-01_fx_rate_daily_ddl.sql" data-goatcounter-title="Download 01_fx_rate_daily_ddl.sql" data-goatcounter-no-session="1"><span aria-hidden="true">↓</span> 01_fx_rate_daily_ddl.sql</a></li>
    <li><a href="../files/fx/02_fx_rate_period_ddl.sql" download="02_fx_rate_period_ddl.sql" data-goatcounter-click="download-02_fx_rate_period_ddl.sql" data-goatcounter-title="Download 02_fx_rate_period_ddl.sql" data-goatcounter-no-session="1"><span aria-hidden="true">↓</span> 02_fx_rate_period_ddl.sql</a></li>
    <li><a href="../files/fx/03_seed_fx_rates.sql" download="03_seed_fx_rates.sql" data-goatcounter-click="download-03_seed_fx_rates.sql" data-goatcounter-title="Download 03_seed_fx_rates.sql" data-goatcounter-no-session="1"><span aria-hidden="true">↓</span> 03_seed_fx_rates.sql</a></li>
    <li><a href="../files/fx/04_v_fx_missing_rates.sql" download="04_v_fx_missing_rates.sql" data-goatcounter-click="download-04_v_fx_missing_rates.sql" data-goatcounter-title="Download 04_v_fx_missing_rates.sql" data-goatcounter-no-session="1"><span aria-hidden="true">↓</span> 04_v_fx_missing_rates.sql</a></li>
    <li><a href="../files/fx/05_asof_join_convert.sql" download="05_asof_join_convert.sql" data-goatcounter-click="download-05_asof_join_convert.sql" data-goatcounter-title="Download 05_asof_join_convert.sql" data-goatcounter-no-session="1"><span aria-hidden="true">↓</span> 05_asof_join_convert.sql</a></li>
    <li><a href="../files/fx/06_period_lock_and_snapshot.sql" download="06_period_lock_and_snapshot.sql" data-goatcounter-click="download-06_period_lock_and_snapshot.sql" data-goatcounter-title="Download 06_period_lock_and_snapshot.sql" data-goatcounter-no-session="1"><span aria-hidden="true">↓</span> 06_period_lock_and_snapshot.sql</a></li>
    <li><a href="../files/fx/07_restate_after_lock_demo.sql" download="07_restate_after_lock_demo.sql" data-goatcounter-click="download-07_restate_after_lock_demo.sql" data-goatcounter-title="Download 07_restate_after_lock_demo.sql" data-goatcounter-no-session="1"><span aria-hidden="true">↓</span> 07_restate_after_lock_demo.sql</a></li>
    <li><a href="../files/samples/motors/load_motors.sql" download="load_motors.sql" data-goatcounter-click="download-load_motors.sql" data-goatcounter-title="Download load_motors.sql" data-goatcounter-no-session="1"><span aria-hidden="true">↓</span> load_motors.sql</a></li>
    <li><a href="../files/samples/motors/cash_opening.csv" download="cash_opening.csv" data-goatcounter-click="download-cash_opening.csv" data-goatcounter-title="Download cash_opening.csv" data-goatcounter-no-session="1"><span aria-hidden="true">↓</span> cash_opening.csv</a></li>
    <li><a href="../files/samples/motors/cash_flow.csv" download="cash_flow.csv" data-goatcounter-click="download-cash_flow.csv" data-goatcounter-title="Download cash_flow.csv" data-goatcounter-no-session="1"><span aria-hidden="true">↓</span> cash_flow.csv</a></li>
    <li><a href="../files/samples/motors/cash_scenario.csv" download="cash_scenario.csv" data-goatcounter-click="download-cash_scenario.csv" data-goatcounter-title="Download cash_scenario.csv" data-goatcounter-no-session="1"><span aria-hidden="true">↓</span> cash_scenario.csv</a></li>
    <li><a href="../files/samples/motors/liquidity_floor.csv" download="liquidity_floor.csv" data-goatcounter-click="download-liquidity_floor.csv" data-goatcounter-title="Download liquidity_floor.csv" data-goatcounter-no-session="1"><span aria-hidden="true">↓</span> liquidity_floor.csv</a></li>
    <li><a href="../files/cash13/01_cash_tables_ddl_load.sql" download="01_cash_tables_ddl_load.sql" data-goatcounter-click="download-01_cash_tables_ddl_load.sql" data-goatcounter-title="Download 01_cash_tables_ddl_load.sql" data-goatcounter-no-session="1"><span aria-hidden="true">↓</span> 01_cash_tables_ddl_load.sql</a></li>
    <li><a href="../files/cash13/02_v_cash_flow_week.sql" download="02_v_cash_flow_week.sql" data-goatcounter-click="download-02_v_cash_flow_week.sql" data-goatcounter-title="Download 02_v_cash_flow_week.sql" data-goatcounter-no-session="1"><span aria-hidden="true">↓</span> 02_v_cash_flow_week.sql</a></li>
    <li><a href="../files/cash13/03_v_cash_13w.sql" download="03_v_cash_13w.sql" data-goatcounter-click="download-03_v_cash_13w.sql" data-goatcounter-title="Download 03_v_cash_13w.sql" data-goatcounter-no-session="1"><span aria-hidden="true">↓</span> 03_v_cash_13w.sql</a></li>
    <li><a href="../files/cash13/04_v_cash_runway.sql" download="04_v_cash_runway.sql" data-goatcounter-click="download-04_v_cash_runway.sql" data-goatcounter-title="Download 04_v_cash_runway.sql" data-goatcounter-no-session="1"><span aria-hidden="true">↓</span> 04_v_cash_runway.sql</a></li>
    <li><a href="../files/cash13/05_v_cash_week1_avf.sql" download="05_v_cash_week1_avf.sql" data-goatcounter-click="download-05_v_cash_week1_avf.sql" data-goatcounter-title="Download 05_v_cash_week1_avf.sql" data-goatcounter-no-session="1"><span aria-hidden="true">↓</span> 05_v_cash_week1_avf.sql</a></li>
    <li><a href="../files/cash13/06_v_receipt_slip.sql" download="06_v_receipt_slip.sql" data-goatcounter-click="download-06_v_receipt_slip.sql" data-goatcounter-title="Download 06_v_receipt_slip.sql" data-goatcounter-no-session="1"><span aria-hidden="true">↓</span> 06_v_receipt_slip.sql</a></li>
    <li><a href="../files/cash13/07_checks.sql" download="07_checks.sql" data-goatcounter-click="download-07_checks.sql" data-goatcounter-title="Download 07_checks.sql" data-goatcounter-no-session="1"><span aria-hidden="true">↓</span> 07_checks.sql</a></li>
    <li><a href="../files/pvm/01_v_plant_cost.sql" download="01_v_plant_cost.sql" data-goatcounter-click="download-01_v_plant_cost.sql" data-goatcounter-title="Download 01_v_plant_cost.sql" data-goatcounter-no-session="1"><span aria-hidden="true">↓</span> 01_v_plant_cost.sql</a></li>
    <li><a href="../files/pvm/02_v_cost_per_vehicle.sql" download="02_v_cost_per_vehicle.sql" data-goatcounter-click="download-02_v_cost_per_vehicle.sql" data-goatcounter-title="Download 02_v_cost_per_vehicle.sql" data-goatcounter-no-session="1"><span aria-hidden="true">↓</span> 02_v_cost_per_vehicle.sql</a></li>
    <li><a href="../files/pvm/03_v_unit_economics.sql" download="03_v_unit_economics.sql" data-goatcounter-click="download-03_v_unit_economics.sql" data-goatcounter-title="Download 03_v_unit_economics.sql" data-goatcounter-no-session="1"><span aria-hidden="true">↓</span> 03_v_unit_economics.sql</a></li>
    <li><a href="../files/pvm/04_v_pvm_variance.sql" download="04_v_pvm_variance.sql" data-goatcounter-click="download-04_v_pvm_variance.sql" data-goatcounter-title="Download 04_v_pvm_variance.sql" data-goatcounter-no-session="1"><span aria-hidden="true">↓</span> 04_v_pvm_variance.sql</a></li>
    <li><a href="../files/pvm/05_jedox_rules.txt" download="05_jedox_rules.txt" data-goatcounter-click="download-05_jedox_rules.txt" data-goatcounter-title="Download 05_jedox_rules.txt" data-goatcounter-no-session="1"><span aria-hidden="true">↓</span> 05_jedox_rules.txt</a></li>
    <li><a href="../files/pvm/06_checks.sql" download="06_checks.sql" data-goatcounter-click="download-06_checks.sql" data-goatcounter-title="Download 06_checks.sql" data-goatcounter-no-session="1"><span aria-hidden="true">↓</span> 06_checks.sql</a></li>
    <li><a href="../files/capex/01_v_capex_status.sql" download="01_v_capex_status.sql" data-goatcounter-click="download-01_v_capex_status.sql" data-goatcounter-title="Download 01_v_capex_status.sql" data-goatcounter-no-session="1"><span aria-hidden="true">↓</span> 01_v_capex_status.sql</a></li>
    <li><a href="../files/capex/02_v_capex_exceptions.sql" download="02_v_capex_exceptions.sql" data-goatcounter-click="download-02_v_capex_exceptions.sql" data-goatcounter-title="Download 02_v_capex_exceptions.sql" data-goatcounter-no-session="1"><span aria-hidden="true">↓</span> 02_v_capex_exceptions.sql</a></li>
    <li><a href="../files/capex/03_v_capex_alert.sql" download="03_v_capex_alert.sql" data-goatcounter-click="download-03_v_capex_alert.sql" data-goatcounter-title="Download 03_v_capex_alert.sql" data-goatcounter-no-session="1"><span aria-hidden="true">↓</span> 03_v_capex_alert.sql</a></li>
    <li><a href="../files/capex/04_checks.sql" download="04_checks.sql" data-goatcounter-click="download-04_checks.sql" data-goatcounter-title="Download 04_checks.sql" data-goatcounter-no-session="1"><span aria-hidden="true">↓</span> 04_checks.sql</a></li>
    <li><a href="../files/bom/01_v_bom_exploded.sql" download="01_v_bom_exploded.sql" data-goatcounter-click="download-01_v_bom_exploded.sql" data-goatcounter-title="Download 01_v_bom_exploded.sql" data-goatcounter-no-session="1"><span aria-hidden="true">↓</span> 01_v_bom_exploded.sql</a></li>
    <li><a href="../files/bom/02_v_std_cost_rollup.sql" download="02_v_std_cost_rollup.sql" data-goatcounter-click="download-02_v_std_cost_rollup.sql" data-goatcounter-title="Download 02_v_std_cost_rollup.sql" data-goatcounter-no-session="1"><span aria-hidden="true">↓</span> 02_v_std_cost_rollup.sql</a></li>
    <li><a href="../files/bom/03_v_ppv.sql" download="03_v_ppv.sql" data-goatcounter-click="download-03_v_ppv.sql" data-goatcounter-title="Download 03_v_ppv.sql" data-goatcounter-no-session="1"><span aria-hidden="true">↓</span> 03_v_ppv.sql</a></li>
    <li><a href="../files/bom/04_v_usage_var.sql" download="04_v_usage_var.sql" data-goatcounter-click="download-04_v_usage_var.sql" data-goatcounter-title="Download 04_v_usage_var.sql" data-goatcounter-no-session="1"><span aria-hidden="true">↓</span> 04_v_usage_var.sql</a></li>
    <li><a href="../files/bom/05_checks.sql" download="05_checks.sql" data-goatcounter-click="download-05_checks.sql" data-goatcounter-title="Download 05_checks.sql" data-goatcounter-no-session="1"><span aria-hidden="true">↓</span> 05_checks.sql</a></li>
    <li><a href="../files/erpctl/01_erp_gl_landing_ddl.sql" download="01_erp_gl_landing_ddl.sql" data-goatcounter-click="download-01_erp_gl_landing_ddl.sql" data-goatcounter-title="Download 01_erp_gl_landing_ddl.sql" data-goatcounter-no-session="1"><span aria-hidden="true">↓</span> 01_erp_gl_landing_ddl.sql</a></li>
    <li><a href="../files/erpctl/02_views.sql" download="02_views.sql" data-goatcounter-click="download-02_views.sql" data-goatcounter-title="Download 02_views.sql" data-goatcounter-no-session="1"><span aria-hidden="true">↓</span> 02_views.sql</a></li>
    <li><a href="../files/erpctl/03_load_and_log.sql" download="03_load_and_log.sql" data-goatcounter-click="download-03_load_and_log.sql" data-goatcounter-title="Download 03_load_and_log.sql" data-goatcounter-no-session="1"><span aria-hidden="true">↓</span> 03_load_and_log.sql</a></li>
    <li><a href="../files/erpctl/04_v_control_recon.sql" download="04_v_control_recon.sql" data-goatcounter-click="download-04_v_control_recon.sql" data-goatcounter-title="Download 04_v_control_recon.sql" data-goatcounter-no-session="1"><span aria-hidden="true">↓</span> 04_v_control_recon.sql</a></li>
    <li><a href="../files/erpctl/05_jedox_hop.sql" download="05_jedox_hop.sql" data-goatcounter-click="download-05_jedox_hop.sql" data-goatcounter-title="Download 05_jedox_hop.sql" data-goatcounter-no-session="1"><span aria-hidden="true">↓</span> 05_jedox_hop.sql</a></li>
    <li><a href="../files/erpctl/06_control_evidence.sql" download="06_control_evidence.sql" data-goatcounter-click="download-06_control_evidence.sql" data-goatcounter-title="Download 06_control_evidence.sql" data-goatcounter-no-session="1"><span aria-hidden="true">↓</span> 06_control_evidence.sql</a></li>
    <li><a href="../files/erpctl/07_checks.sql" download="07_checks.sql" data-goatcounter-click="download-07_checks.sql" data-goatcounter-title="Download 07_checks.sql" data-goatcounter-no-session="1"><span aria-hidden="true">↓</span> 07_checks.sql</a></li>
  </ul>
  <p class="fdh-downloads__all"><a href="../downloads/">All downloads →</a></p>
</section>

</div>
