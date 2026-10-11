---
title: Jedox notes for FP&A packs
description: Jedox Integrator notes on management report exports Excel can trust, Snowflake-to-cube loads, Relational extracts, and automated Budget vs Actual emails.
hide:
  - toc
---

<div class="fdh-section fdh-section--jedox" markdown>

<header class="fdh-hero">
  <div class="fdh-hero__text">
    <p class="fdh-hero__eyebrow">Section</p>
    <h1>Jedox</h1>
    <p class="fdh-hero__intro">Jedox holds the plan and the management report. Excel is where the pack is annotated. The fragile step is the file that travels between them.</p>
  </div>
  <picture class="fdh-hero__mascot">
    <source srcset="../assets/mascots/section/jedox-cube.webp" type="image/webp">
    <img src="../assets/mascots/section/jedox-cube.png" alt="Jedox mascot in a purple blazer holding a purple cube" width="388" height="704" loading="lazy" decoding="async">
  </picture>
</header>

<h2 class="fdh-label">Posts</h2>
<ul class="fdh-cards">
  <li><article class="fdh-card fdh-card--start">
    <span class="fdh-start">Start here</span>
    <p class="fdh-card__tools">Jedox · Excel</p>
    <h3 class="fdh-card__title"><a href="management-report-export/">Management report export</a></h3>
    <p class="fdh-card__summary">Which elements belong in the export file, and which ones double-count.</p>
    <p class="fdh-card__meta"><span aria-hidden="true">◷</span> 5 min read</p>
  </article></li>
  <li><article class="fdh-card">
    <p class="fdh-card__tools">Snowflake · Jedox</p>
    <h3 class="fdh-card__title"><a href="snowflake-to-jedox/">Snowflake to Jedox load</a></h3>
    <p class="fdh-card__summary">Pull monthly actuals into a planning cube so a rerun leaves no stale numbers.</p>
    <p class="fdh-card__meta"><span aria-hidden="true">◷</span> 10 min read</p>
  </article></li>
  <li><article class="fdh-card">
    <p class="fdh-card__tools">Snowflake · Jedox</p>
    <h3 class="fdh-card__title"><a href="relational-extracts/">Relational extracts</a></h3>
    <p class="fdh-card__summary">Point-and-click table or your own SQL? Both run in Snowflake and return the same 58 rows.</p>
    <p class="fdh-card__meta"><span aria-hidden="true">◷</span> 7 min read</p>
  </article></li>
  <li><article class="fdh-card">
    <p class="fdh-card__tools">Jedox · Groovy</p>
    <h3 class="fdh-card__title"><a href="automated-value-emails/">Automated value emails</a></h3>
    <p class="fdh-card__summary">Send each cost center owner their own budget vs actuals from a Groovy job.</p>
    <p class="fdh-card__meta"><span aria-hidden="true">◷</span> 17 min read</p>
  </article></li>
  <li><article class="fdh-card fdh-card--tool">
    <p class="fdh-card__tools">Jedox · Groovy</p>
    <h3 class="fdh-card__title"><a href="email-builder/">Email builder and checker</a></h3>
    <p class="fdh-card__summary">Fill in the email job from the browser, then check it for the usual traps.</p>
    <p class="fdh-card__meta">Interactive tool</p>
  </article></li>
  <li><article class="fdh-card fdh-card--tool">
    <p class="fdh-card__tools">Jedox</p>
    <h3 class="fdh-card__title"><a href="rule-studio/">Business Rule Studio</a></h3>
    <p class="fdh-card__summary">The demo cubes are the fictional FDH_DEMO model.</p>
    <p class="fdh-card__meta">Interactive tool</p>
  </article></li>
</ul>

<section class="fdh-downloads" aria-labelledby="dl-jedox">
  <h2 id="dl-jedox">Jedox downloads</h2>
  <ul>
    <li><a href="../files/jedox/mgmt_report_export_sample.csv" download="mgmt_report_export_sample.csv" data-goatcounter-click="download-mgmt_report_export_sample.csv" data-goatcounter-title="Download mgmt_report_export_sample.csv" data-goatcounter-no-session="1"><span aria-hidden="true">↓</span> mgmt_report_export_sample.csv</a></li>
    <li><a href="../files/relational/relational_extract_actuals.sql" download="relational_extract_actuals.sql" data-goatcounter-click="download-relational_extract_actuals.sql" data-goatcounter-title="Download relational_extract_actuals.sql" data-goatcounter-no-session="1"><span aria-hidden="true">↓</span> relational_extract_actuals.sql</a></li>
    <li><a href="../files/email/send_value_emails.groovy" download="send_value_emails.groovy" data-goatcounter-click="download-send_value_emails.groovy" data-goatcounter-title="Download send_value_emails.groovy" data-goatcounter-no-session="1"><span aria-hidden="true">↓</span> send_value_emails.groovy</a></li>
    <li><a href="../files/email/recipients.csv" download="recipients.csv" data-goatcounter-click="download-recipients.csv" data-goatcounter-title="Download recipients.csv" data-goatcounter-no-session="1"><span aria-hidden="true">↓</span> recipients.csv</a></li>
  </ul>
  <p class="fdh-downloads__all"><a href="../downloads/">All downloads →</a></p>
</section>

</div>
