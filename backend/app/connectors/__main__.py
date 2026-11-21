"""CLI for the config-driven connectors (docs/ADDING_SOURCES.md).

    python -m app.connectors list              # what the file contains, no database needed
    python -m app.connectors check <id>        # fetch one source, show what it would produce
    python -m app.connectors reload            # sources.yaml -> database (like POST /api/connectors/reload)
    python -m app.connectors sync [--source X] [--due-only]

Useful for Railway cron jobs and for checking a volume-mounted file.
"""
from __future__ import annotations

import argparse
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

from .. import db
from ..connectors import adapter_for
from ..connectors.base import apply_filters
from ..services import connectors as store
from . import config as sources_config


def _fetch_one(source, defaults):
    return adapter_for(source.adapter_type)(source, defaults=defaults, fetched_at=datetime.now(timezone.utc))


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m app.connectors", description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("command", choices=("list", "check", "reload", "sync"))
    parser.add_argument("source_id", nargs="?", help="source id for 'check'")
    parser.add_argument("--file", type=Path, help="sources.yaml to use instead of SOURCES_FILE")
    parser.add_argument("--source", help="limit 'sync' to one source id")
    parser.add_argument("--due-only", action="store_true", help="only sources whose refresh_rate has elapsed")
    args = parser.parse_args(argv)

    loaded = sources_config.load(args.file or sources_config.ensure_file())
    print(f"{loaded.path}: {len(loaded.sources)} source(s), sha256 {loaded.sha256[:12] or '-'}")
    for problem in loaded.errors:
        print(f"  problem: {problem}", file=sys.stderr)

    if args.command == "list":
        for source in loaded.sources:
            state = "on " if source.enabled else "off"
            print(f"  {source.id:<28} {','.join(source.category):<6} {source.adapter_type:<9} "
                  f"{source.refresh_rate:<8} {state}  {source.urls[0]}")
        return 0 if not loaded.errors else 1

    if args.command == "check":
        if not args.source_id:
            parser.error("check needs a source id, e.g. `python -m app.connectors check adzuna_ch`")
        source = loaded.by_id().get(args.source_id)
        if source is None:
            print(f"unknown source '{args.source_id}'", file=sys.stderr)
            return 2
        missing = [name for name in source.auth_env if not os.environ.get(name)]
        if missing:
            print(f"skipped: missing env {', '.join(missing)}")
            return 1
        try:
            items = _fetch_one(source, loaded.defaults)
        except Exception as exc:  # network, auth, parsing: the point of 'check' is seeing this
            print(f"failed: {type(exc).__name__}: {exc}", file=sys.stderr)
            return 1
        kept = apply_filters(items, source, loaded.defaults)
        print(f"ok: {len(items)} item(s) fetched, {len(kept)} after filters")
        for item in kept[:3]:
            print(f"  {item.category} | {item.title[:80]} | {item.published_at or '-'}")
        return 0

    if not loaded.usable:
        print("sources.yaml could not be read; nothing applied.", file=sys.stderr)
        return 1

    with db.connect() as conn:
        if args.command == "reload":
            result = store.apply_config(conn, loaded)
            print(f"applied: {result.added} added, {result.updated} updated, {result.disabled} disabled, "
                  f"{result.source_count} source(s)")
            return 0 if not result.errors else 1

        summary = store.sync_all(conn, loaded, only=args.source, due_only=args.due_only)
    for result in summary.results:
        if result.error:
            state = f"error: {result.error}"
        elif result.skipped:
            state = f"skipped ({result.reason})"
        else:
            state = f"{result.items} item(s)"
        print(f"  {result.source:<28} {state}")
    print(f"{summary.items} item(s), {summary.errors} error(s)")
    return 1 if summary.errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
