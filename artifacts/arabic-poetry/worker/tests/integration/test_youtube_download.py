import os
import pytest
from pathlib import Path
from diwan_worker.audio.youtube import download_youtube_audio
from diwan_worker.audio.inspector import inspect_audio

# Permitted public audio / short test recording
SHORT_TEST_URL = "https://www.youtube.com/watch?v=jNQXAC9IVRw"  # "Me at the zoo" (19 seconds)


@pytest.mark.skipif(
    os.environ.get("RUN_YOUTUBE_INTEGRATION_TEST") != "1",
    reason="Opt-in network integration test. Set RUN_YOUTUBE_INTEGRATION_TEST=1 to run."
)
def test_real_network_youtube_download(tmp_path: Path):
    output_dir = tmp_path / "integration_recordings"
    job_id = "real_test_job"

    result = download_youtube_audio(
        url=SHORT_TEST_URL,
        output_base_dir=str(output_dir),
        job_id=job_id,
        audio_quality="192k",
    )

    assert result["source_type"] == "youtube"
    assert result["job_id"] == job_id
    assert os.path.exists(result["playback_audio_path"])
    assert os.path.exists(result["processing_audio_path"])

    playback_meta = inspect_audio(result["playback_audio_path"])
    processing_meta = inspect_audio(result["processing_audio_path"])

    assert playback_meta.duration_ms > 0
    assert processing_meta.duration_ms > 0
    assert processing_meta.sample_rate == 16000
    assert processing_meta.channels == 1
