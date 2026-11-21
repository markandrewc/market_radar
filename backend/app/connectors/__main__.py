"""CLI for the config-driven connectors.

    python -m app.connectors reload    # sources.yaml -> database (like POST /api/connectors/reload)
    python -m app.connectors list      # what the file contains, without touching the database

Useful for Railway cron jobs and for checking a volume-mounted file.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

from .. import db
from ..services import connectors as store
from . import config as sources_config


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m app.connectors", description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("command", choices=("reload", "list"))
    parser.add_argument("--file", type=Path, help="sources.yaml to use instead of SOURCES_FILE")
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

    if not loaded.usable:
        print("sources.yaml could not be read; nothing applied.", file=sys.stderr)
        return 1
    with db.connect() as conn:
        result = store.apply_config(conn, loaded)
    print(f"applied: {result.added} added, {result.updated} updated, {result.disabled} disabled, "
          f"{result.source_count} source(s)")
    return 0 if not result.errors else 1


if __name__ == "__main__":
    raise SystemExit(main())
