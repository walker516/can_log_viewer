from __future__ import annotations

import json
from pathlib import Path

import pyarrow.parquet as pq

from backend.cli import main
from backend.decoder import DecodeRequest, decode_logs
from backend.readers import CanFrame


DECODED_SCHEMA = [
    "session_time",
    "source_time",
    "source_file",
    "channel",
    "can_id",
    "message_name",
    "signal_name",
    "value",
    "raw_value",
    "unit",
    "enum_label",
]

SIGNAL_INDEX_SCHEMA = {
    "signal_name",
    "message_name",
    "can_id",
    "unit",
    "value_type",
    "plot_type",
    "sample_count",
    "first_session_time",
    "last_session_time",
}


def test_decode_csv_writes_expected_outputs(tmp_path: Path) -> None:
    log_path = tmp_path / "sample.csv"
    out_dir = tmp_path / "cache" / "sample"
    log_path.write_text(
        "\n".join(
            [
                "timestamp,can_id,data,channel,is_extended_id",
                "0.0,0x100,E803030000000000,can0,false",
                "0.5,0x100,D007010000000000,can0,false",
                "0.7,0x999,0000000000000000,can0,false",
            ]
        )
        + "\n",
        encoding="utf-8",
    )

    assert main(["decode", "--log", str(log_path), "--out", str(out_dir)]) == 0

    assert (out_dir / "meta.json").exists()
    assert (out_dir / "decoded_signals.parquet").exists()
    assert (out_dir / "signal_index.json").exists()
    assert (out_dir / "warnings.json").exists()

    table = pq.read_table(out_dir / "decoded_signals.parquet")
    assert table.schema.names == DECODED_SCHEMA
    rows = table.to_pylist()
    assert len(rows) == 20
    first_speed = next(row for row in rows if row["session_time"] == 0.0 and row["signal_name"] == "Speed")
    first_gear = next(row for row in rows if row["session_time"] == 0.0 and row["signal_name"] == "Gear")
    second_speed = next(row for row in rows if row["session_time"] == 0.5 and row["signal_name"] == "Speed")
    assert first_speed["value"] == 100.0
    assert first_gear["enum_label"] == "D"
    assert second_speed["session_time"] == 0.5
    assert second_speed["source_time"] == 0.5
    assert second_speed["source_file"] == str(log_path)

    signal_index = json.loads((out_dir / "signal_index.json").read_text(encoding="utf-8"))
    assert set(signal_index[0]) == SIGNAL_INDEX_SCHEMA
    assert {"Speed", "Gear", "BumpDetected", "WirelessSystemState"}.issubset({item["signal_name"] for item in signal_index})
    assert next(item for item in signal_index if item["signal_name"] == "Gear")["plot_type"] == "step"

    warnings = json.loads((out_dir / "warnings.json").read_text(encoding="utf-8"))
    assert warnings["summary"]["by_code"]["unknown_message"] == 1


def test_decode_csv_missing_columns_reports_warning(tmp_path: Path) -> None:
    log_path = tmp_path / "bad.csv"
    out_dir = tmp_path / "cache" / "bad"
    log_path.write_text("timestamp,can_id\n0.0,0x100\n", encoding="utf-8")

    assert main(["decode", "--log", str(log_path), "--out", str(out_dir)]) == 0

    warnings = json.loads((out_dir / "warnings.json").read_text(encoding="utf-8"))
    assert warnings["summary"]["by_code"]["csv_missing_columns"] == 1
    assert "empty_log" not in warnings["summary"]["by_code"]


def test_decode_empty_log_writes_empty_outputs_and_warning(tmp_path: Path) -> None:
    log_path = tmp_path / "empty.csv"
    out_dir = tmp_path / "cache" / "empty"
    log_path.write_text("timestamp,can_id,data\n", encoding="utf-8")

    assert main(["decode", "--log", str(log_path), "--out", str(out_dir)]) == 0

    table = pq.read_table(out_dir / "decoded_signals.parquet")
    assert table.schema.names == DECODED_SCHEMA
    assert table.num_rows == 0
    assert json.loads((out_dir / "signal_index.json").read_text(encoding="utf-8")) == []
    warnings = json.loads((out_dir / "warnings.json").read_text(encoding="utf-8"))
    assert warnings["summary"]["by_code"]["empty_log"] == 1


def test_decode_unsupported_extension_reports_warning(tmp_path: Path) -> None:
    log_path = tmp_path / "sample.txt"
    out_dir = tmp_path / "cache" / "unsupported"
    log_path.write_text("not a can log\n", encoding="utf-8")

    assert main(["decode", "--log", str(log_path), "--out", str(out_dir)]) == 0

    assert pq.read_table(out_dir / "decoded_signals.parquet").num_rows == 0
    warnings = json.loads((out_dir / "warnings.json").read_text(encoding="utf-8"))
    assert warnings["summary"]["by_code"]["unsupported_log_type"] == 1


def test_decode_malformed_csv_row_reports_warning(tmp_path: Path) -> None:
    log_path = tmp_path / "broken.csv"
    out_dir = tmp_path / "cache" / "broken"
    log_path.write_text(
        "\n".join(
            [
                "timestamp,can_id,data",
                "0.0,0x100,not_hex",
                "0.1,0x100,E803030000000000",
            ]
        )
        + "\n",
        encoding="utf-8",
    )

    assert main(["decode", "--log", str(log_path), "--out", str(out_dir)]) == 0

    assert pq.read_table(out_dir / "decoded_signals.parquet").num_rows == 10
    warnings = json.loads((out_dir / "warnings.json").read_text(encoding="utf-8"))
    assert warnings["summary"]["by_code"]["malformed_csv_row"] == 1


def test_decode_short_payload_reports_decode_error(tmp_path: Path) -> None:
    log_path = tmp_path / "short.csv"
    out_dir = tmp_path / "cache" / "short"
    log_path.write_text(
        "\n".join(
            [
                "timestamp,can_id,data",
                "0.0,0x100,01",
            ]
        )
        + "\n",
        encoding="utf-8",
    )

    assert main(["decode", "--log", str(log_path), "--out", str(out_dir)]) == 0

    assert pq.read_table(out_dir / "decoded_signals.parquet").num_rows == 0
    warnings = json.loads((out_dir / "warnings.json").read_text(encoding="utf-8"))
    assert warnings["summary"]["by_code"]["decode_error"] == 1


def test_decode_logs_accepts_internal_dbc_path_without_cli_option(tmp_path: Path) -> None:
    dbc_path = tmp_path / "custom.dbc"
    dbc_path.write_text(
        "\n".join(
            [
                'VERSION ""',
                "NS_ :",
                "BS_:",
                "BU_: Vector__XXX",
                "BO_ 512 CustomMessage: 8 Vector__XXX",
                ' SG_ CustomSignal : 0|8@1+ (2,0) [0|510] "V" Vector__XXX',
            ]
        )
        + "\n",
        encoding="utf-8",
    )
    log_path = tmp_path / "custom.csv"
    log_path.write_text("timestamp,can_id,data\n0.0,0x200,0500000000000000\n", encoding="utf-8")
    out_dir = tmp_path / "cache" / "custom"

    meta = decode_logs(DecodeRequest(log_paths=[log_path], out_dir=out_dir, dbc_path=dbc_path))

    assert meta["dbc"] == str(dbc_path)
    rows = pq.read_table(out_dir / "decoded_signals.parquet").to_pylist()
    assert rows[0]["message_name"] == "CustomMessage"
    assert rows[0]["signal_name"] == "CustomSignal"
    assert rows[0]["value"] == 10.0


def test_decode_logs_accepts_injected_log_reader(tmp_path: Path) -> None:
    # The decoder depends on a log-reader seam, so frames can be supplied without
    # any real file or python-can. The fake reader ignores the path entirely.
    out_dir = tmp_path / "cache" / "injected"

    def fake_reader(path: Path, session_offset: float, warnings) -> tuple[list[CanFrame], float]:
        frame = CanFrame(
            session_time=session_offset,
            source_time=0.0,
            source_file=str(path),
            channel="can0",
            can_id=0x100,
            is_extended_id=False,
            dlc=8,
            data=bytes.fromhex("E803030000000000"),
        )
        return [frame], session_offset

    meta = decode_logs(
        DecodeRequest(log_paths=[Path("virtual.log")], out_dir=out_dir),
        read_log_file=fake_reader,
    )

    assert meta["frame_count"] == 1
    rows = pq.read_table(out_dir / "decoded_signals.parquet").to_pylist()
    speed = next(row for row in rows if row["signal_name"] == "Speed")
    assert speed["value"] == 100.0


def test_default_dbc_resolution_is_independent_of_current_directory(tmp_path: Path, monkeypatch) -> None:
    work_dir = tmp_path / "elsewhere"
    work_dir.mkdir()
    log_path = tmp_path / "sample.csv"
    out_dir = tmp_path / "cache" / "sample"
    log_path.write_text("timestamp,can_id,data\n0.0,0x100,E803030000000000\n", encoding="utf-8")

    monkeypatch.chdir(work_dir)

    assert main(["decode", "--log", str(log_path), "--out", str(out_dir)]) == 0
    assert pq.read_table(out_dir / "decoded_signals.parquet").num_rows == 10
