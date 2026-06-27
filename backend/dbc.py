"""DBC database access, isolated so decoding can depend on a small seam.

The bundled `default.dbc` is the only DBC the product exposes; there is no
`--dbc` CLI option by design. Decoding takes a `load_dbc` callable and a
`resolve_dbc_path` context manager so tests can substitute fakes without
touching cantools or the packaged resource.
"""

from __future__ import annotations

from contextlib import contextmanager
from importlib import resources
from pathlib import Path
from typing import Any, Iterator

import cantools

Database = cantools.database.Database


def load_dbc(path: Path) -> Database:
    return cantools.database.load_file(str(path))


@contextmanager
def resolve_dbc_path(dbc_path: Path | None = None) -> Iterator[Path]:
    """Yield a usable DBC path, defaulting to the bundled resource.

    The default is resolved through importlib.resources so it works regardless
    of the current working directory and when packaged.
    """

    if dbc_path is not None:
        yield dbc_path
        return

    resource = resources.files("backend.resources").joinpath("default.dbc")
    with resources.as_file(resource) as path:
        yield path


def signal_definitions(database: Database) -> dict[tuple[int, str], dict[str, Any]]:
    """Static per-signal metadata from the DBC, keyed by (frame id, name)."""

    definitions: dict[tuple[int, str], dict[str, Any]] = {}
    for message in database.messages:
        for signal in message.signals:
            definitions[(message.frame_id, signal.name)] = {
                "choices": signal.choices,
                # Treat a single-bit 0/1 signal as boolean for step plotting.
                "is_bool": signal.length == 1 and signal.minimum in (0, None) and signal.maximum in (1, None),
            }
    return definitions
