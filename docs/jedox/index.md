# Jedox

Jedox holds the plan and the management report. Excel is where the pack is annotated. The fragile step is the file that travels between them.

This section is about the shape of that file: which elements belong in it, which elements will double-count if you include them, and how a month should be stored so next month's column does not break the workbook. It is not an installation guide and it does not walk through Integrator screen by screen.

The first note uses a 20-row sample you can open in Excel and foot by hand. E100 is in euros. E210 is in dollars. Adding them together is the mistake the file is there to show.

[Management report export](management-report-export.md){ .md-button }

The next note pulls monthly actuals from Snowflake into a planning cube. A service user with a key pair reads one view, the job clears that Actual slice, then it loads the fresh rows so a rerun does not leave stale numbers.

[Snowflake to Jedox load](snowflake-to-jedox.md){ .md-button }

The last note sends every cost center owner their own Budget vs. Actual table from one Integrator job. Recipients and the email layout live in files, and test mode stays on until you turn it off.

[Automated value emails](automated-value-emails.md){ .md-button }

The same job can be filled in from the browser. The builder writes the tested script with your wording, and the checker looks for the usual traps. Both stay on your machine.

[Create your own email](email-builder.md){ .md-button }
