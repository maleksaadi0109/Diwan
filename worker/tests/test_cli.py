import json
import subprocess
import sys

def run_worker_cli(input_lines):
    cmd = [sys.executable, "-m", "diwan_worker.cli"]
    res = subprocess.run(
        cmd,
        input="\n".join(input_lines) + "\n",
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        timeout=10,
    )
    assert res.returncode == 0
    lines = [json.loads(line) for line in res.stdout.strip().split("\n") if line.strip()]
    return lines

def test_cli_health():
    req = json.dumps({"id": "req-1", "command": "health"})
    responses = run_worker_cli([req])
    assert len(responses) == 1
    resp = responses[0]
    assert resp["id"] == "req-1"
    assert resp["success"] is True
    assert resp["data"]["status"] == "ready"
    assert "ffmpeg" in resp["data"]

def test_cli_inspect(synthetic_wav):
    req = json.dumps({"id": "req-2", "command": "inspect_audio", "payload": {"file_path": synthetic_wav}})
    responses = run_worker_cli([req])
    assert len(responses) == 1
    resp = responses[0]
    assert resp["id"] == "req-2"
    assert resp["success"] is True
    assert resp["data"]["channels"] == 1
    assert resp["data"]["sample_rate"] == 16000

def test_cli_convert(synthetic_wav, tmp_path):
    out_wav = str(tmp_path / "cli_out.wav")
    req = json.dumps({
        "id": "req-3",
        "command": "convert_audio",
        "payload": {"input_path": synthetic_wav, "output_path": out_wav}
    })
    messages = run_worker_cli([req])
    progress_msgs = [m for m in messages if m.get("type") == "progress"]
    resp_msgs = [m for m in messages if m.get("type") == "response"]

    assert len(progress_msgs) >= 1
    assert len(resp_msgs) == 1
    assert resp_msgs[0]["success"] is True

def test_cli_detect_speech(synthetic_wav):
    req = json.dumps({
        "id": "req-4",
        "command": "detect_speech",
        "payload": {"wav_path": synthetic_wav}
    })
    messages = run_worker_cli([req])
    resp_msgs = [m for m in messages if m.get("type") == "response"]
    assert len(resp_msgs) == 1
    resp = resp_msgs[0]
    assert resp["success"] is True
    assert resp["data"]["speech_count"] >= 2

def test_cli_malformed_json_never_crashes():
    messages = run_worker_cli(["not a valid json", "{}"])
    assert len(messages) >= 1
    assert messages[0]["success"] is False
    assert messages[0]["error_code"] == "MALFORMED_JSON"
