import json
from types import SimpleNamespace
from unittest.mock import patch

from diwan_worker import cli
from diwan_worker.schemas.protocol import WorkerResponse


class RecordingStream:
    def __init__(self):
        self.calls = []

    def reconfigure(self, **kwargs):
        self.calls.append(kwargs)


def test_configure_utf8_stdio_uses_utf8_and_safe_output_errors():
    stdin = RecordingStream()
    stdout = RecordingStream()
    stderr = RecordingStream()

    fake_sys = SimpleNamespace(stdin=stdin, stdout=stdout, stderr=stderr)
    with patch.object(cli, "sys", fake_sys):
        cli.configure_utf8_stdio()

    assert stdin.calls == [{"encoding": "utf-8", "errors": "strict"}]
    assert stdout.calls == [{"encoding": "utf-8", "errors": "backslashreplace"}]
    assert stderr.calls == [{"encoding": "utf-8", "errors": "backslashreplace"}]


def test_worker_response_escapes_unicode_on_wire_but_round_trips():
    wire = WorkerResponse(
        id="youtube-1",
        success=True,
        data={"title": "🌟 قصيدة عربية"},
    ).to_json()

    assert "🌟" not in wire
    assert json.loads(wire)["data"]["title"] == "🌟 قصيدة عربية"