---
title: Snowflake SQL for FP&A
description: "Get finance-shaped extracts from Snowflake SQL: closed-period P&L actuals and plan vs actuals joins you can drop straight into Excel or Jedox."
hide:
  - toc
---

<div class="fdh-section fdh-section--snowflake" markdown>

<header class="fdh-hero">
  <div class="fdh-hero__text">
    <p class="fdh-hero__eyebrow">Section</p>
    <h1>Snowflake</h1>
    <p class="fdh-hero__intro">Snowflake is where the actuals live after the general ledger closes. This section is about getting a finance-shaped extract out of Snowflake, not about warehouses, roles, or loading pipelines.</p>
  </div>
  <picture class="fdh-hero__mascot">
    <source srcset="../assets/mascots/section/snowflake-pointing.webp" type="image/webp">
    <img src="../assets/mascots/section/snowflake-pointing.png" alt="Snowflake mascot in a blue hoodie pointing toward the introduction" width="426" height="721" loading="lazy" decoding="async">
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
  </ul>
  <p class="fdh-downloads__all"><a href="../downloads/">All downloads →</a></p>
</section>

</div>
