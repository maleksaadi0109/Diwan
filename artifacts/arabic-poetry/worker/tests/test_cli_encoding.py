from types import SimpleNamespace
from unittest.mock import patch

from diwan_worker import cli


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