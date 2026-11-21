"""Cron entry point for briefings (docs/api.md, "Briefings (Level 2)").

    python -m app.reports run --due            # send everyone whose week/month has passed
    python -m app.reports run --no-due         # send every active subscription now
    python -m app.reports run --due --subscription <id>
    python -m app.reports preview --role <role-id> [--role ...] [--no-policy] [--no-target-group]

Uses DATABASE_URL and the REPORT_* / RESEND_API_KEY settings from the environment.
Exit code: 0 = fine, 1 = at least one send failed, 2 = usage/configuration problem.
"""
from __future__ import annotations

import argparse
import sys

from .. import db
from ..schemas import DigestRequest, RunRequest
from . import digest as digest_service
from . import subscriptions


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="python -m app.reports",
                                     description="Market Radar briefings: send the e-mail digest or preview it.")
    commands = parser.add_subparsers(dest="command", required=True)

    run = commands.add_parser("run", help="send briefings to due (or all) subscriptions")
    due = run.add_mutually_exclusive_group()
    due.add_argument("--due", dest="due", action="store_true",
                     help="only subscriptions whose ISO week / calendar month has passed (default)")
    due.add_argument("--no-due", dest="due", action="store_false", help="send every active subscription")
    run.set_defaults(due=True)
    run.add_argument("--subscription", metavar="ID", help="limit the run to one subscription")

    preview = commands.add_parser("preview", help="print the digest that would be mailed")
    preview.add_argument("--role", action="append", default=[], metavar="ID",
                         help="role id, repeatable (default: all roles with data)")
    preview.add_argument("--no-policy", dest="include_policy", action="store_false",
                         help="leave out the Policy watch section")
    preview.add_argument("--no-target-group", dest="include_target_group", action="store_false",
                         help="leave out the Target group section")
    preview.set_defaults(include_policy=True, include_target_group=True)
    return parser


def _run(args: argparse.Namespace) -> int:
    request = RunRequest(dueOnly=args.due, subscriptionId=args.subscription)
    try:
        with db.connect() as conn:
            result = subscriptions.run(conn, request)
    except subscriptions.UnknownSubscription as exc:
        print(f"{exc}. Nothing was sent.", file=sys.stderr)
        return 2
    except RuntimeError as exc:  # DATABASE_URL missing
        print(f"Cannot reach the database: {exc}", file=sys.stderr)
        return 2
    mode = "due" if args.due else "all active"
    print(f"Market Radar briefings ({mode}): {result.sent} sent, {result.failed} failed, "
          f"{result.skipped} skipped.")
    for outcome in result.results:
        detail = f" — {outcome.detail}" if outcome.detail else ""
        print(f"  {outcome.email}: {outcome.status}{detail}")
    return 1 if result.failed else 0


def _preview(args: argparse.Namespace) -> int:
    request = DigestRequest(roleIds=args.role, includePolicy=args.include_policy,
                            includeTargetGroup=args.include_target_group)
    try:
        with db.connect() as conn:
            digest = digest_service.build_digest(conn, request)
    except ValueError as exc:
        print(f"Nothing previewed: {exc}", file=sys.stderr)
        return 2
    except RuntimeError as exc:  # DATABASE_URL missing
        print(f"Cannot reach the database: {exc}", file=sys.stderr)
        return 2
    print(digest.subject)
    print()
    print(digest.text)
    bullets = sum(len(section.bullets) for section in digest.sections)
    print()
    print(f"[{len(digest.sections)} section(s), {bullets} bullet(s), "
          f"{len(digest.sources)} source(s){', empty briefing' if digest.empty else ''}]")
    return 0


def main(argv: list[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    if args.command == "run":
        return _run(args)
    return _preview(args)


if __name__ == "__main__":
    raise SystemExit(main())
