# Finance Data Hub

Public notes on Snowflake, Jedox, and Excel VBA for FP&A. The site is published at <https://balazs998.github.io/finance-data-hub/>.

Articles are Markdown. MkDocs Material turns them into the site. The look is the Data Night theme in [`docs/stylesheets/extra.css`](docs/stylesheets/extra.css): dark background, Space Grotesk headings, Inter body text, JetBrains Mono for code.

## Preview locally

Install Python 3.11 or newer, then from this folder:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
mkdocs serve
```

Open <http://127.0.0.1:8000/finance-data-hub/>. On Windows, activate the virtual environment with `.venv\Scripts\activate`.

`mkdocs build --strict` fails the build if a page, a download, or an internal link is missing. The GitHub workflow runs that command on every pull request and every push to `main`.

## Turn on GitHub Pages

[`.github/workflows/pages.yml`](.github/workflows/pages.yml) builds the site and deploys it on every push to `main`. GitHub will not serve the site until Pages is set to GitHub Actions. The workflow cannot flip that setting itself.

1. Open the repository on GitHub.
2. Go to **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to **GitHub Actions**.

The next push to `main` publishes the site. The address is <https://balazs998.github.io/finance-data-hub/>.

## Add an article

1. Create a Markdown file under `docs/`, for example `docs/snowflake/fiscal-calendar.md`.
2. Start the file with one `#` heading. That heading is the page title.
3. Add the page to `nav` in [`mkdocs.yml`](mkdocs.yml), under the matching section.
4. Preview with `mkdocs serve`, then commit and push to `main`.

Link to another page with a relative Markdown link, such as `[Fiscal calendar](fiscal-calendar.md)`.

A page that is not listed in `nav` fails the strict build.

## Add a downloadable file

Small text files live in the repository and publish with the site. Large binaries go on a GitHub Release, because Excel workbooks and Jedox exports do not belong in git history. Both kinds of link are counted in GoatCounter, one event per file.

### Small files (SQL, VBA, CSV, small templates)

Put the file in `docs/files/` and link it from the note with a shortcode. The path is relative to `docs/files/`. The build checks that the file exists.

```markdown
[[download:sql/gl_actuals_pnl.sql|Download the SQL script]]
```

The Downloads page is generated from those shortcodes. Every file under `docs/files/` has to be linked from a note, and the page lists each one under that note. Do not add the button to [`docs/downloads.md`](docs/downloads.md) by hand. The button saves the file and sends a GoatCounter event named after it, for example `download-gl_actuals_pnl.sql`.

From a fenced code block the shortcode is left as-is, so you can show the syntax without creating a button.

### Large files (Excel workbooks, Jedox exports, zip archives)

Put the file under `docs/files/` and link it from the note. `[[release:]]` is the same kind of link as `[[download:]]`: the path is relative to `docs/files/`, and the button stays on this site.

```markdown
[[release:vba/close-model.xlsm|Download the close model]]
```

That serves `docs/files/vba/close-model.xlsm`. The Downloads page lists it with the other files from that note.

## Analytics

GoatCounter is configured. The only setting is in [`mkdocs.yml`](mkdocs.yml):

```yaml
extra:
  goatcounter_code: financedatahub
```

That site code loads `https://financedatahub.goatcounter.com/count`. Page views are counted on each page. Every download link sends an event named `download-<file name>`. Clearing `goatcounter_code` turns analytics off, and the site still builds.

A preview on `mkdocs serve` is not counted. GoatCounter ignores localhost.

### Where to see download stats

- **Per file, with country:** <https://financedatahub.goatcounter.com>
  Open **Events**. Each file is one event, named `download-` plus the file name. Open the event for the count and the countries. Article traffic and countries are on the main dashboard.

## Repository layout

| Path | What it is |
| --- | --- |
| `docs/` | Articles |
| `docs/files/` | Files that download with the site |
| `docs/stylesheets/extra.css` | Data Night colors, type, and the scroll fade |
| `mkdocs.yml` | Navigation and the GoatCounter site code |
| `hooks/site.py` | Turns `[[download:]]` and `[[release:]]` into links, and builds the Downloads page from `docs/files/` |
| `.github/workflows/pages.yml` | Builds and deploys to GitHub Pages |
