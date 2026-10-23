---
title: Snowflake SQL for FP&A
description: "Get finance-shaped extracts from Snowflake SQL, and freeze the month you reported: closed-period P&L actuals, plan vs actuals, and permanent snapshots versus Time Travel."
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
  </ul>
  <p class="fdh-downloads__all"><a href="../downloads/">All downloads →</a></p>
</section>

</div>
