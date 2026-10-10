"""Download shortcodes and the GoatCounter site-code check.

Articles link to files with ``[[download:path|Label]]`` or
``[[release:path|Label]]``. The path is relative to ``docs/files/``. Both
shortcodes serve that file from this site. A download never points at GitHub.

``docs/downloads.md`` includes ``[[file-index]]``. That token becomes a
"Sample data" group with the shared sample files, then one group per note with
only that note's own files. Every file under ``docs/files/`` appears exactly
once.
"""

from __future__ import annotations

import html
import os
import posixpath
import re
import subprocess
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath

from mkdocs.exceptions import PluginError
from mkdocs.utils import get_relative_url

CODE_PATTERN = re.compile(r"[A-Za-z0-9-]+")
SHORTCODE = re.compile(r"\[\[(download|release):([^\]|\s]+)(?:\|([^\]]+))?\]\]")
BLOCK_SHORTCODE = re.compile(
    r"\[\[(download|release):([^\]|\s]+)(?:\|([^\]]+))?\]\][ \t]*"
)
FENCE = re.compile(r"(?ms)^(```+)[^\n]*\n.*?^\1[ \t]*$")
FILE_INDEX = "[[file-index]]"
SAMPLE_DATA_TITLE = "Sample data"
# Shared sample files, listed once at the top of the Downloads page in this
# order. Several notes link them; their own groups leave them out.
SAMPLE_DATA_FILES = (
    "samples/dim_account.csv",
    "samples/dim_cost_center.csv",
    "samples/fact_actuals.csv",
    "samples/fact_budget.csv",
    "samples/load_snowflake.sql",
)


_ASSET_VERSION = ""
_VERSIONED_ASSET = re.compile(
    r'((?:href|src)="(?:\.\./)*(?:stylesheets/(?:extra|email-tool)\.css|javascripts/[^"?]+\.js))"'
)


def asset_version() -> str:
    """Query string so a deploy never reuses a visitor's cached CSS or JS."""
    global _ASSET_VERSION
    if _ASSET_VERSION:
        return _ASSET_VERSION
    forced = os.environ.get("FDH_ASSET_VERSION", "").strip()
    if forced:
        cleaned = re.sub(r"[^A-Za-z0-9._-]", "", forced)[:40]
        _ASSET_VERSION = cleaned or "build"
        return _ASSET_VERSION
    root = Path(__file__).resolve().parents[1]
    try:
        out = subprocess.check_output(
            ["git", "rev-parse", "--short", "HEAD"],
            cwd=root,
            stderr=subprocess.DEVNULL,
            text=True,
        ).strip()
    except (OSError, subprocess.CalledProcessError):
        out = ""
    if not re.fullmatch(r"[0-9a-f]+", out):
        out = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    _ASSET_VERSION = out
    return out


def on_post_page(output, page, config):
    version = asset_version()
    return _VERSIONED_ASSET.sub(rf'\1?v={version}"', output)


def on_config(config):
    code = str(config.extra.get("goatcounter_code") or "").strip()
    config.extra["goatcounter_code"] = code
    if code and not CODE_PATTERN.fullmatch(code):
        raise PluginError(
            "extra.goatcounter_code must be the GoatCounter site code only "
            "(for example financedatahub), not a full URL or script tag."
        )
    return config


def on_page_context(context, page, config, nav):
    social_name = str(page.meta.get("social_image") or "home.png").strip()
    if (
        not social_name
        or "/" in social_name
        or "\\" in social_name
        or social_name in {".", ".."}
    ):
        raise PluginError(
            f"{page.file.src_uri}: social_image must be a file name in "
            f"docs/assets/social/, for example home.png. Got: {social_name!r}"
        )
    image = Path(config["docs_dir"]) / "assets" / "social" / social_name
    if not image.is_file():
        raise PluginError(
            f"{page.file.src_uri}: social image docs/assets/social/{social_name} does not exist."
        )
    site_url = str(config.get("site_url") or "").strip().rstrip("/")
    if not site_url:
        raise PluginError(
            "site_url is required so og:image and twitter:image are absolute URLs."
        )
    # Match the document <title>: front matter title, then the page title,
    # except the home page which is just the site name. The nav label can be
    # shorter than the article title, so it is not used here.
    meta_title = str(page.meta.get("title") or "").strip() if page.meta else ""
    if meta_title:
        title = f"{meta_title} - {config.site_name}"
    elif page.title and not getattr(page, "is_homepage", False):
        title = f"{page.title} - {config.site_name}"
    else:
        title = config.site_name
    context["social_title"] = title
    context["social_description"] = page.meta.get("description") or config.site_description
    context["social_image_url"] = f"{site_url}/assets/social/{social_name}"
    return context


def on_page_markdown(markdown, page, config, files):
    docs_dir = Path(config["docs_dir"])
    if page.file.src_uri == "downloads.md":
        if FILE_INDEX not in markdown:
            raise PluginError(
                "docs/downloads.md must include [[file-index]]. "
                "The Downloads page is generated from the files each note links."
            )
        markdown = markdown.replace(
            FILE_INDEX,
            render_file_index(docs_dir, config["nav"]).rstrip("\n"),
        )
    return render_shortcodes(
        markdown,
        page.file.src_uri,
        docs_dir,
        page_url=page.url or "",
    )


def render_file_index(docs_dir: Path, nav) -> str:
    """Markdown for the Downloads page.

    One "Sample data" group with the shared sample files comes first, then one
    group per note (in nav order) with only the files that are not already
    listed above it. Every file under ``docs/files/`` appears exactly once. A
    file that no note links is an error, so a new file shows up here as soon
    as its note links it.
    """
    notes = _notes_with_downloads(docs_dir)
    groups = _order_notes(notes, nav)
    linked = {path for _src, _title, files in groups for path, _label in files}
    missing = [path for path in _files_under(docs_dir) if path not in linked]
    if missing:
        raise PluginError(
            "Every file in docs/files must be linked from a note with "
            "[[download:]] or [[release:]] so the Downloads page can list it "
            "under that note. "
            "Not linked: " + ", ".join(missing)
        )
    if not groups:
        return ""

    labels: dict[str, str | None] = {}
    for _src, _title, files in groups:
        for path, label in files:
            if labels.get(path) is None:
                labels[path] = label
    sample_files = [(path, labels[path]) for path in SAMPLE_DATA_FILES if path in linked]
    sample_users = [
        (src, title)
        for src, title, files in groups
        if any(path in SAMPLE_DATA_FILES for path, _label in files)
    ]

    sections: list[str] = []
    if sample_files:
        sections.append(_sample_markdown(sample_files, sample_users))
    shown = {path for path, _label in sample_files}
    for src, title, files in groups:
        own = [(path, label) for path, label in files if path not in shown]
        if not own:
            continue
        shown.update(path for path, _label in own)
        sections.append(_group_markdown(title, src, own))
    return "\n\n".join(sections) + "\n"


def _sample_markdown(
    files: list[tuple[str, str | None]],
    users: list[tuple[str, str]],
) -> str:
    lines = [f"## {SAMPLE_DATA_TITLE}", ""]
    if users:
        links = [f"[{escape_label(title)}]({src})" for src, title in users]
        if len(links) == 1:
            used_by = links[0]
        else:
            used_by = ", ".join(links[:-1]) + " and " + links[-1]
        lines += [f"The shared sample tables and their Snowflake load script, used in {used_by}.", ""]
    for relative, label in files:
        lines.append(f"[[download:{relative}|{label}]]" if label else f"[[download:{relative}]]")
    return "\n".join(lines)


def _notes_with_downloads(docs_dir: Path) -> dict[str, tuple[str | None, list[tuple[str, str | None]]]]:
    notes: dict[str, tuple[str | None, list[tuple[str, str | None]]]] = {}
    for path in sorted(docs_dir.rglob("*.md")):
        src = path.relative_to(docs_dir).as_posix()
        if src == "downloads.md":
            continue
        text = path.read_text(encoding="utf-8")
        files = _unique_downloads(_download_refs(text))
        if not files:
            continue
        for relative, _label in files:
            resolve_site_file(docs_dir, relative)
        notes[src] = (_first_heading(text), files)
    return notes


def _download_refs(markdown: str) -> list[tuple[str, str | None]]:
    found: list[tuple[str, str | None]] = []

    def collect(segment: str) -> str:
        for match in SHORTCODE.finditer(segment):
            if match.group(1) not in {"download", "release"}:
                continue
            relative = posix_target(match.group(2).strip())
            label = match.group(3).strip() if match.group(3) else None
            if label == "":
                label = None
            if label and any(char in label for char in "|]\r\n"):
                raise PluginError(
                    f"Download label cannot contain '|' or ']': {label!r}"
                )
            found.append((relative, label))
        return segment

    _map_outside_fences(markdown, collect)
    return found


def _unique_downloads(
    refs: list[tuple[str, str | None]],
) -> list[tuple[str, str | None]]:
    seen: set[str] = set()
    unique: list[tuple[str, str | None]] = []
    for relative, label in refs:
        if relative in seen:
            continue
        seen.add(relative)
        unique.append((relative, label))
    return unique


def _order_notes(
    notes: dict[str, tuple[str | None, list[tuple[str, str | None]]]],
    nav,
) -> list[tuple[str, str, list[tuple[str, str | None]]]]:
    titles: dict[str, str] = {}
    order: list[str] = []
    for title, src in _nav_pages(nav):
        if src not in order:
            order.append(src)
        if title and src not in titles:
            titles[src] = title
    ordered: list[tuple[str, str, list[tuple[str, str | None]]]] = []
    seen: set[str] = set()
    for src in order + sorted(src for src in notes if src not in order):
        if src not in notes or src in seen:
            continue
        heading, files = notes[src]
        ordered.append((src, titles.get(src) or heading or src, files))
        seen.add(src)
    return ordered


def _nav_pages(nav) -> list[tuple[str | None, str]]:
    pages: list[tuple[str | None, str]] = []

    def walk(node) -> None:
        if isinstance(node, str):
            pages.append((None, node))
        elif isinstance(node, dict):
            for key, value in node.items():
                if isinstance(value, str):
                    pages.append((str(key), value))
                else:
                    walk(value)
        elif isinstance(node, list):
            for item in node:
                walk(item)

    if nav:
        walk(nav)
    return pages


def _first_heading(markdown: str) -> str | None:
    lines = markdown.splitlines()
    if lines and lines[0].strip() == "---":
        for index in range(1, len(lines)):
            if lines[index].strip() == "---":
                lines = lines[index + 1 :]
                break
    for line in lines:
        if line.startswith("# "):
            return line[2:].strip()
    return None


def _group_markdown(
    title: str,
    src: str,
    files: list[tuple[str, str | None]],
) -> str:
    lines = [f"## [{escape_label(title)}]({src})", ""]
    for relative, label in files:
        if label:
            lines.append(f"[[download:{relative}|{label}]]")
        else:
            lines.append(f"[[download:{relative}]]")
    return "\n".join(lines)


def _files_under(docs_dir: Path) -> list[str]:
    root = docs_dir / "files"
    if not root.is_dir():
        raise PluginError(f"Missing download directory {root}.")
    return sorted(
        path.relative_to(root).as_posix()
        for path in root.rglob("*")
        if path.is_file()
    )


def render_shortcodes(
    markdown: str,
    src_uri: str,
    docs_dir: Path,
    page_url: str | None = None,
) -> str:
    """Replace download shortcodes outside fenced code blocks.

    Shortcodes that sit on their own lines (a Downloads section) become one
    ``<div class="downloads">`` grid. Indented shortcodes, such as the button
    inside a card, stay inline Markdown links.
    """

    def replace_segment(segment: str) -> str:
        return _render_segment(segment, src_uri, docs_dir, page_url)

    return _map_outside_fences(markdown, replace_segment)


def _render_segment(
    segment: str,
    src_uri: str,
    docs_dir: Path,
    page_url: str | None,
) -> str:
    lines = segment.splitlines(keepends=True)
    pieces: list[str] = []
    index = 0
    while index < len(lines):
        if _is_block_shortcode(lines[index]):
            group, index = _take_shortcode_group(lines, index)
            pieces.append(_downloads_container(group, src_uri, docs_dir, page_url))
            continue
        pieces.append(
            SHORTCODE.sub(
                lambda match: _replace_shortcode(match, src_uri, docs_dir, page_url=page_url),
                lines[index],
            )
        )
        index += 1
    return "".join(pieces)


def _is_block_shortcode(line: str) -> bool:
    return BLOCK_SHORTCODE.fullmatch(line.strip("\r\n")) is not None


def _take_shortcode_group(lines: list[str], index: int) -> tuple[list[str], int]:
    """Collect a Downloads run, including ones separated only by blank lines."""
    group = [lines[index]]
    index += 1
    while index < len(lines):
        if _is_block_shortcode(lines[index]):
            group.append(lines[index])
            index += 1
            continue
        if lines[index].strip() == "":
            lookahead = index + 1
            while lookahead < len(lines) and lines[lookahead].strip() == "":
                lookahead += 1
            if lookahead < len(lines) and _is_block_shortcode(lines[lookahead]):
                index = lookahead
                continue
        break
    return group, index


def _downloads_container(
    group: list[str],
    src_uri: str,
    docs_dir: Path,
    page_url: str | None,
) -> str:
    anchors = []
    for line in group:
        match = SHORTCODE.search(line)
        if match is None:
            raise PluginError(f"Download shortcode could not be read: {line!r}")
        anchors.append(
            _replace_shortcode(match, src_uri, docs_dir, as_html=True, page_url=page_url)
        )
    last = group[-1]
    if last.endswith("\r\n"):
        newline = "\r\n"
    elif last.endswith("\n"):
        newline = "\n"
    else:
        newline = ""
    return '<div class="downloads">\n' + "\n".join(anchors) + "\n</div>" + newline


def _replace_shortcode(
    match: re.Match,
    src_uri: str,
    docs_dir: Path,
    as_html: bool = False,
    page_url: str | None = None,
) -> str:
    label = match.group(3).strip() if match.group(3) else None
    return build_link(
        match.group(1),
        match.group(2).strip(),
        label,
        src_uri,
        docs_dir,
        as_html=as_html,
        page_url=page_url,
    )


def build_link(
    kind: str,
    target: str,
    label: str | None,
    src_uri: str,
    docs_dir: Path,
    as_html: bool = False,
    page_url: str | None = None,
) -> str:
    if kind not in {"download", "release"}:
        raise PluginError(f"Unknown download shortcode [[{kind}:...]].")
    path = resolve_site_file(docs_dir, target)
    site_path = f"files/{posix_target(target)}"
    # Markdown links are rewritten by MkDocs from the source file. Raw HTML
    # is not, and a page is served as a directory (…/page/index.html), so an
    # HTML href has to be relative to that directory URL.
    if as_html and page_url is not None:
        href = get_relative_url(site_path, page_url)
    else:
        href = relative_href(src_uri, site_path)
    filename = path.name

    text = label or f"Download {filename}"
    event = event_name(filename)
    title = f"Download {filename}"
    if as_html:
        return (
            '<a class="md-button download"'
            f' href="{escape_attr(href)}"'
            f' download="{escape_attr(filename)}"'
            f' data-goatcounter-click="{escape_attr(event)}"'
            f' data-goatcounter-title="{escape_attr(title)}"'
            ' data-goatcounter-no-session="1">'
            f"{html.escape(text)}</a>"
        )
    return (
        f"[{escape_label(text)}]({href})"
        "{ .md-button .download"
        f' download="{escape_attr(filename)}"'
        f' data-goatcounter-click="{escape_attr(event)}"'
        f' data-goatcounter-title="{escape_attr(title)}"'
        ' data-goatcounter-no-session="1" }'
    )


def event_name(filename: str) -> str:
    """GoatCounter event name. One event per file. Must not start with '/'."""
    name = PurePosixPath(filename).name
    if not name or name in {".", ".."} or "/" in name or "\\" in name:
        raise PluginError(f"Cannot name a download event for {filename!r}.")
    event = f"download-{name}"
    if event.startswith("/"):
        raise PluginError(f"Download event name must not start with '/': {event}")
    return event


def relative_href(src_uri: str, target: str) -> str:
    """Href from a docs-relative markdown file to another docs-relative path."""
    source_dir = posixpath.dirname(src_uri.replace("\\", "/"))
    return posixpath.relpath(target, source_dir or ".")


def resolve_site_file(docs_dir: Path, target: str) -> Path:
    relative = posix_target(target)
    root = (docs_dir / "files").resolve()
    candidate = (root / Path(*PurePosixPath(relative).parts)).resolve()
    if os.path.commonpath([str(root), str(candidate)]) != str(root):
        raise PluginError(f"Download path escapes docs/files: {target}")
    if not candidate.is_file():
        raise PluginError(
            f"Download file docs/files/{relative} does not exist. "
            "Put the file under docs/files/ and link it with [[download:]] or [[release:]]."
        )
    return candidate


def posix_target(target: str) -> str:
    if not target or target.startswith(("/", "\\")) or "\\" in target:
        raise PluginError(
            f"Download path must be relative to docs/files, using forward slashes: {target}"
        )
    path = PurePosixPath(target)
    if any(part in {"", ".", ".."} for part in path.parts):
        raise PluginError(f"Download path must stay inside docs/files: {target}")
    return str(path)


def escape_label(label: str) -> str:
    return label.replace("\\", "\\\\").replace("[", "\\[").replace("]", "\\]")


def escape_attr(value: str) -> str:
    if any(char in value for char in '"<>&'):
        raise PluginError(f"Download name cannot contain quotes or HTML characters: {value}")
    return value


def _map_outside_fences(markdown: str, transform) -> str:
    pieces: list[str] = []
    cursor = 0
    for match in FENCE.finditer(markdown):
        pieces.append(transform(markdown[cursor : match.start()]))
        pieces.append(match.group(0))
        cursor = match.end()
    pieces.append(transform(markdown[cursor:]))
    return "".join(pieces)
