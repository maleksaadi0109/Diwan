#!/usr/bin/env python3
"""Fetches the pre-converted CTranslate2 Whisper model bundled into the
Windows desktop build, so a fresh install can transcribe with no internet
access on its very first run (see WINDOWS_PACKAGING.md).

This is the one part of Windows packaging that still needs an internet
connection -- it runs once per release, on the build machine, not on the
end user's machine. It is invoked automatically by
`scripts/build-windows.ps1` / `scripts/build-windows.bat` before `tauri
build`, and can also be run standalone:

    python worker/scripts/fetch_bundled_model.py

The revision is pinned to a specific Hugging Face Hub commit (not "main")
so every release bundles an identical, reproducible model rather than
whatever happens to be latest on the day someone runs this script.
"""
from __future__ import annotations
import argparse
import hashlib
import os
import sys

# Maps the app's model_size strings (see worker/diwan_worker/asr/transcriber.py)
# to the upstream CTranslate2-converted repo + pinned commit revision to fetch.
# Bump the revision deliberately (and re-run this script) when intentionally
# picking up a model update -- never silently float to "main".
MODEL_SOURCES = {
    "small": {
        "repo_id": "Systran/faster-whisper-small",
        "revision": "536b0662742c02347bc0e980a01041f333bce120",
    },
}

# Files that must exist and be non-empty for faster-whisper's local-directory
# load path to work (matches the transcriber.py / WhisperModel.__init__
# expectations). preprocessor_config.json is included by upstream repos when
# present, but not every converted model ships one, so it isn't required.
REQUIRED_FILES = ["config.json", "model.bin", "tokenizer.json"]
# Exactly one of these vocabulary files must be present (different repos use
# different formats).
VOCAB_FILE_CANDIDATES = ["vocabulary.json", "vocabulary.txt"]

DEFAULT_OUTPUT_ROOT = os.path.normpath(
    os.path.join(
        os.path.dirname(__file__),
        "..",
        "..",
        "src-tauri",
        "windows-dist",
        "models",
    )
)


def _sha256_of_file(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def verify_model_dir(model_dir: str) -> list[str]:
    """Returns a list of problems (empty list means the directory is valid
    and ready to bundle). Used both after a fresh download and as a
    standalone `--verify-only` check in CI/build scripts."""
    problems: list[str] = []

    if not os.path.isdir(model_dir):
        return [f"directory does not exist: {model_dir}"]

    for filename in REQUIRED_FILES:
        path = os.path.join(model_dir, filename)
        if not os.path.isfile(path):
            problems.append(f"missing required file: {filename}")
        elif os.path.getsize(path) == 0:
            problems.append(f"required file is empty: {filename}")

    if not any(
        os.path.isfile(os.path.join(model_dir, f)) for f in VOCAB_FILE_CANDIDATES
    ):
        problems.append(
            "missing vocabulary file (expected one of: "
            f"{', '.join(VOCAB_FILE_CANDIDATES)})"
        )

    model_bin = os.path.join(model_dir, "model.bin")
    if os.path.isfile(model_bin):
        # A real CTranslate2 Whisper "small" model.bin is on the order of a
        # few hundred MB. Anything drastically smaller almost certainly
        # means a truncated/failed download rather than a real model, so
        # catch that loudly here instead of shipping a broken bundle.
        size_mb = os.path.getsize(model_bin) / (1024 * 1024)
        if size_mb < 50:
            problems.append(
                f"model.bin is only {size_mb:.1f}MB -- looks truncated/incomplete "
                "(a real 'small' model is several hundred MB)"
            )

    return problems


def fetch_model(model_size: str, output_root: str, force: bool = False) -> str:
    if model_size not in MODEL_SOURCES:
        raise SystemExit(
            f"Unknown model_size '{model_size}'. Add it to MODEL_SOURCES in "
            "this script first (with a pinned revision) if the app needs it."
        )

    source = MODEL_SOURCES[model_size]
    target_dir = os.path.join(output_root, model_size)

    if not force:
        existing_problems = verify_model_dir(target_dir)
        if not existing_problems:
            print(f"[fetch_bundled_model] '{model_size}' already present and valid at {target_dir}; skipping download (use --force to re-fetch).")
            return target_dir

    try:
        from huggingface_hub import snapshot_download
    except ImportError as exc:
        raise SystemExit(
            "huggingface_hub is required to fetch the bundled model. Install it with "
            "`pip install huggingface_hub` (or `pip install -e .[build]` from worker/) "
            "and re-run this script."
        ) from exc

    print(
        f"[fetch_bundled_model] Downloading {source['repo_id']}@{source['revision']} "
        f"into {target_dir} ..."
    )
    os.makedirs(target_dir, exist_ok=True)
    snapshot_download(
        source["repo_id"],
        revision=source["revision"],
        local_dir=target_dir,
        allow_patterns=[
            "config.json",
            "preprocessor_config.json",
            "model.bin",
            "tokenizer.json",
            "vocabulary.*",
        ],
    )

    # huggingface_hub's local_dir download mode leaves a `.cache/huggingface`
    # metadata folder (lock/etag files) alongside the real model files. It's
    # only used to make re-runs of this script idempotent/resumable and
    # faster-whisper never reads it, so drop it before bundling to keep the
    # installer resource clean.
    cache_dir = os.path.join(target_dir, ".cache")
    if os.path.isdir(cache_dir):
        import shutil

        shutil.rmtree(cache_dir, ignore_errors=True)

    problems = verify_model_dir(target_dir)
    if problems:
        raise SystemExit(
            "[fetch_bundled_model] Downloaded model failed verification -- "
            "refusing to produce a broken offline bundle:\n"
            + "\n".join(f"  - {p}" for p in problems)
        )

    model_bin_sha256 = _sha256_of_file(os.path.join(target_dir, "model.bin"))
    print(f"[fetch_bundled_model] OK. model.bin sha256: {model_bin_sha256}")
    return target_dir


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--model-size",
        default="small",
        choices=sorted(MODEL_SOURCES.keys()),
        help="Which model size to fetch (must match what the app requests, see transcriber.py).",
    )
    parser.add_argument(
        "--output-root",
        default=DEFAULT_OUTPUT_ROOT,
        help="Directory that will contain <model-size>/ (defaults to src-tauri/windows-dist/models).",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Re-download even if a valid copy already exists.",
    )
    parser.add_argument(
        "--verify-only",
        action="store_true",
        help="Don't download anything; just check whether a valid bundle already exists and exit non-zero if not.",
    )
    args = parser.parse_args()

    target_dir = os.path.join(args.output_root, args.model_size)

    if args.verify_only:
        problems = verify_model_dir(target_dir)
        if problems:
            print(
                f"[fetch_bundled_model] '{args.model_size}' bundle at {target_dir} is INVALID:",
                file=sys.stderr,
            )
            for p in problems:
                print(f"  - {p}", file=sys.stderr)
            raise SystemExit(1)
        print(f"[fetch_bundled_model] '{args.model_size}' bundle at {target_dir} is valid.")
        return

    fetch_model(args.model_size, args.output_root, force=args.force)


if __name__ == "__main__":
    main()
