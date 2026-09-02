"""Helper script to download the offline tiny Whisper model into src-tauri/windows-dist/models.

Works out of the box using pure standard library (no pip dependencies required).
"""
import os
import sys
import urllib.request
import urllib.error

# Suppress Hugging Face symlinks warning on Windows
os.environ["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1"

FILES_TO_DOWNLOAD = [
    "config.json",
    "model.bin",
    "tokenizer.json",
    "vocabulary.txt",
]

BASE_URL = "https://huggingface.co/Systran/faster-whisper-tiny/resolve/main"

def download_file_with_progress(url: str, dest_path: str) -> None:
    filename = os.path.basename(dest_path)
    
    def reporthook(count: int, block_size: int, total_size: int) -> None:
        if total_size > 0:
            downloaded = count * block_size
            pct = min(100.0, (downloaded / total_size) * 100.0)
            mb_downloaded = downloaded / (1024 * 1024)
            mb_total = total_size / (1024 * 1024)
            sys.stdout.write(f"\r  Downloading {filename}: {mb_downloaded:.1f}MB / {mb_total:.1f}MB ({pct:.1f}%)")
            sys.stdout.flush()
        else:
            sys.stdout.write(f"\r  Downloading {filename}...")
            sys.stdout.flush()

    req = urllib.request.Request(
        url,
        headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) DiwanWorker/0.1.0"},
    )
    with urllib.request.urlopen(req) as response, open(dest_path, "wb") as out_file:
        total_size = int(response.info().get("Content-Length", -1))
        block_size = 65536
        count = 0
        while True:
            buffer = response.read(block_size)
            if not buffer:
                break
            out_file.write(buffer)
            count += 1
            reporthook(count, block_size, total_size)
    print(" [OK]")

def main() -> None:
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.abspath(os.path.join(script_dir, ".."))
    
    # We place files in both `tiny/` and `models--Systran--faster-whisper-tiny/` layout
    target_models_dir = os.path.join(project_root, "src-tauri", "windows-dist", "models")
    tiny_dir = os.path.join(target_models_dir, "tiny")
    os.makedirs(tiny_dir, exist_ok=True)
    
    print(f"============================================================")
    print(f"[Diwan] Downloading offline Whisper 'tiny' model (~75 MB)")
    print(f"Destination: {tiny_dir}")
    print(f"============================================================\n")
    
    # Try faster_whisper first if available
    try:
        from faster_whisper import WhisperModel
        print("Using faster-whisper package to fetch model...")
        WhisperModel("tiny", download_root=target_models_dir)
        print("\n[Diwan] Success! Whisper 'tiny' model is downloaded and ready for bundling.")
        return
    except ImportError:
        print("Note: 'faster-whisper' package not in current Python. Downloading files directly...\n")

    # Pure standard library fallback
    for fname in FILES_TO_DOWNLOAD:
        url = f"{BASE_URL}/{fname}"
        dest = os.path.join(tiny_dir, fname)
        if os.path.exists(dest) and os.path.getsize(dest) > 0:
            print(f"  {fname} already exists, skipping.")
            continue
        try:
            download_file_with_progress(url, dest)
        except Exception as err:
            print(f"\nError downloading {fname}: {err}")
            sys.exit(1)

    print(f"\n[Diwan] Success! All Whisper 'tiny' model files downloaded to:")
    print(f"  {tiny_dir}")
    print("\nYou can now build the offline installer with: pnpm tauri build")

if __name__ == "__main__":
    main()
