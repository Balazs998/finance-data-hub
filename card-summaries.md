# Card summaries

One sentence on each section card.

## Snowflake

- Month-end actuals: Turn journal lines into monthly P&L actuals that stay right when a period is reloaded.
- Plan vs actuals: Compare budget and actuals so a month missing on either side still shows up.
- Snapshots vs Time Travel: Freeze the month you reported so a late posting does not change the number you sent.
- FX rate lock: Lock the FX rate on the pack you sent so a later restatement cannot move the total.
- ASOF JOIN: Attach the latest prior daily FX rate when the posting date has no exact match.
- 13-week cash runway: Forecast 13 weeks of FDH Motors cash and read how many weeks stay above the liquidity floor.
- Cost per vehicle: Allocate FDH Motors plant cost by units produced, then split the revenue gap into price, volume, mix, new and lost.
- Capex project tracking: Track FDH Motors capex budget, open commitments and actuals, and alert only when a project is over budget or unapproved.
- BOM cost rollup: Explode the FDH Motors bill of materials, roll standard cost up to the vehicle, and split purchase price and usage variance.
- Snowflake to Jedox load: Pull monthly actuals into a planning cube so a rerun leaves no stale numbers.

## Jedox

- Management report export: Which elements belong in the export file, and which ones double-count.
- Snowflake to Jedox load: Pull monthly actuals into a planning cube so a rerun leaves no stale numbers.
- Relational extracts: Point-and-click table or your own SQL? Both run in Snowflake and return the same 58 rows.
- Automated value emails: Send each cost center owner their own budget vs actuals from a Groovy job.
- Email only when a Jedox load fails: Email one alert a night when a Jedox Integrator load fails, warns, or loads zero rows.
- Email builder and checker: Fill in the email job from the browser, then check it for the usual traps.
- Business Rule Studio: The demo cubes are the fictional FDH_DEMO model.

## VBA

- Month-close checks: Flag a blank reporting period, empty Input_ drivers and #REF! or #N/A errors before the pack goes out.
- Your VBA email macro after New Outlook: Classic or New Outlook? What to switch to when VBA can't send, and a fallback so no month-end mail is lost.
- Is your finance workbook hit by VBScript deprecation?: Find the macros that use VBScript RegExp or call a .vbs script before Windows turns VBScript off.
- Excel as a thin front end: Move P&L and variance into Snowflake views and refresh the workbook with one button.
