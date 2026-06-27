from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class DecodeWarningKey:
    code: str
    source_file: str | None
    source_time: float | None
    can_id: int | None
    message_name: str | None
    signal_name: str | None
    reason: str


class WarningCollector:
    def __init__(self) -> None:
        self._counts: dict[DecodeWarningKey, int] = {}

    def add(
        self,
        *,
        code: str,
        reason: str,
        source_file: str | None = None,
        source_time: float | None = None,
        can_id: int | None = None,
        message_name: str | None = None,
        signal_name: str | None = None,
    ) -> None:
        key = DecodeWarningKey(
            code=code,
            source_file=source_file,
            source_time=source_time,
            can_id=can_id,
            message_name=message_name,
            signal_name=signal_name,
            reason=reason,
        )
        self._counts[key] = self._counts.get(key, 0) + 1

    def to_dict(self) -> dict[str, Any]:
        warnings = [
            {
                "code": key.code,
                "source_file": key.source_file,
                "source_time": key.source_time,
                "can_id": key.can_id,
                "message_name": key.message_name,
                "signal_name": key.signal_name,
                "reason": key.reason,
                "count": count,
            }
            for key, count in sorted(self._counts.items(), key=lambda item: (item[0].code, item[0].source_file or "", item[0].can_id or 0))
        ]
        by_code: dict[str, int] = {}
        for item in warnings:
            by_code[item["code"]] = by_code.get(item["code"], 0) + item["count"]
        return {
            "summary": {
                "total": sum(by_code.values()),
                "by_code": by_code,
            },
            "warnings": warnings,
        }

