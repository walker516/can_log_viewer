"""Command-line entry point.

This stays intentionally thin: it parses arguments, calls the library functions
(`decode_logs`, `inspect_cache`, `query_cache`), and prints their JSON result.
All real work lives in the decoder and cache modules.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from .cache_query import CacheError, inspect_cache, query_cache
from .decoder import DecodeRequest, decode_logs


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="python -m backend")
    subparsers = parser.add_subparsers(dest="command", required=True)

    decode = subparsers.add_parser("decode", help="Decode CAN logs with the fixed bundled DBC.")
    decode.add_argument(
        "--log",
        action="append",
        required=True,
        help="Path to a BLF, ASC, or CSV CAN log. Repeat to append multiple logs.",
    )
    decode.add_argument("--out", required=True, help="Output cache directory.")
    decode.set_defaults(handler=_run_decode)

    inspect = subparsers.add_parser("inspect", help="Inspect a decoded cache directory.")
    inspect.add_argument("--cache", required=True, help="Path to a decoded cache directory.")
    inspect.set_defaults(handler=_run_inspect)

    query = subparsers.add_parser("query", help="Query selected signals from a decoded cache directory.")
    query.add_argument("--cache", required=True, help="Path to a decoded cache directory.")
    query.add_argument("--signals", required=True, help="Comma-separated signal names.")
    query.add_argument("--start", required=True, type=float, help="Start session_time.")
    query.add_argument("--end", required=True, type=float, help="End session_time.")
    query.add_argument(
        "--max-points-per-signal",
        type=int,
        default=None,
        help="Optional simple downsample limit per signal.",
    )
    query.set_defaults(handler=_run_query)

    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    return args.handler(parser, args)


def _run_decode(parser: argparse.ArgumentParser, args: argparse.Namespace) -> int:
    result = decode_logs(DecodeRequest(log_paths=[Path(p) for p in args.log], out_dir=Path(args.out)))
    _print_json(result)
    return 0


def _run_inspect(parser: argparse.ArgumentParser, args: argparse.Namespace) -> int:
    result = _guard_cache(parser, lambda: inspect_cache(Path(args.cache)))
    _print_json(result)
    return 0


def _run_query(parser: argparse.ArgumentParser, args: argparse.Namespace) -> int:
    result = _guard_cache(
        parser,
        lambda: query_cache(
            Path(args.cache),
            args.signals.split(","),
            args.start,
            args.end,
            args.max_points_per_signal,
        ),
    )
    _print_json(result)
    return 0


def _guard_cache(parser: argparse.ArgumentParser, run):
    """Run a cache operation, turning CacheError into a clean CLI exit."""

    try:
        return run()
    except CacheError as exc:
        parser.exit(1, f"error: {exc}\n")


def _print_json(payload) -> None:
    print(json.dumps(payload, indent=2))
