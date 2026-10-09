"""Download shortcodes and the GoatCounter site-code check.

Articles link to files with ``[[download:path|Label]]`` or
``[[release:filename|Label]]``. The path after ``download:`` is relative to
``docs/files/``. Release links point at the GitHub Release tagged ``files``.
"""

from __future__ import annotations

import html
import os
import posixpath
import re
from pathlib import Path, PurePosixPath

from mkdocs.exceptions import PluginError
from mkdocs.utils import get_relative_url

REPO = "Balazs998/finance-data-hub"
RELEASE_TAG = "files"
CODE_PATTERN = re.compile(r"[A-Za-z0-9-]+")
SHORTCODE = re.compile(r"\[\[(download|release):([^\]|\s]+)(?:\|([^\]]+))?\]\]")
BLOCK_SHORTCODE = re.compile(
    r"\[\[(download|release):([^\]|\s]+)(?:\|([^\]]+))?\]\][ \t]*"
)
FENCE = re.compile(r"(?ms)^(```+)[^\n]*\n.*?^\1[ \t]*$")


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
    # ``hide_actions: true`` in front matter drops the edit / view-source
    # icons for that page only (Material renders them only when edit_url is set).
    if page.meta.get("hide_actions"):
        page.edit_url = None
    return context


def on_page_markdown(markdown, page, config, files):
    docs_dir = Path(config["docs_dir"])
    return render_shortcodes(
        markdown,
        page.file.src_uri,
        docs_dir,
        page_url=page.url or "",
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
    if kind == "download":
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
    elif kind == "release":
        filename = release_filename(target)
        href = (
            f"https://github.com/{REPO}/releases/download/"
            f"{RELEASE_TAG}/{filename}"
        )
    else:
        raise PluginError(f"Unknown download shortcode [[{kind}:...]].")

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
            "Put the file there, or use [[release:filename]] for a GitHub Release asset."
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


def release_filename(target: str) -> str:
    if "/" in target or "\\" in target or target in {".", ".."} or not target.strip():
        raise PluginError(
            "A release shortcode takes the asset file name only, "
            f"for example [[release:close-model.xlsm]]. Got: {target}"
        )
    if any(char in target for char in '"<>'):
        raise PluginError(f"Release file name contains a character that breaks the link: {target}")
    return target


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
