from __future__ import annotations
import json
from dataclasses import dataclass, field, asdict
from typing import List, Optional, Dict, Any

@dataclass
class TimedWord:
    word: str
    start_ms: int
    end_ms: int
    probability: float  # 0.0 to 1.0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "word": self.word,
            "start_ms": self.start_ms,
            "end_ms": self.end_ms,
            "probability": round(self.probability, 3),
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> TimedWord:
        return cls(
            word=str(data["word"]),
            start_ms=int(data["start_ms"]),
            end_ms=int(data["end_ms"]),
            probability=float(data.get("probability", 1.0)),
        )

@dataclass
class TranscriptSegment:
    id: int
    text: str
    start_ms: int
    end_ms: int
    words: List[TimedWord] = field(default_factory=list)
    avg_logprob: Optional[float] = None
    no_speech_prob: Optional[float] = None

    def to_dict(self) -> Dict[str, Any]:
        d: Dict[str, Any] = {
            "id": self.id,
            "text": self.text,
            "start_ms": self.start_ms,
            "end_ms": self.end_ms,
            "words": [w.to_dict() for w in self.words],
        }
        if self.avg_logprob is not None:
            d["avg_logprob"] = round(self.avg_logprob, 3)
        if self.no_speech_prob is not None:
            d["no_speech_prob"] = round(self.no_speech_prob, 3)
        return d

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> TranscriptSegment:
        words = [TimedWord.from_dict(w) for w in data.get("words", [])]
        return cls(
            id=int(data.get("id", 0)),
            text=str(data["text"]),
            start_ms=int(data["start_ms"]),
            end_ms=int(data["end_ms"]),
            words=words,
            avg_logprob=data.get("avg_logprob"),
            no_speech_prob=data.get("no_speech_prob"),
        )

@dataclass
class TranscriptResult:
    raw_text: str
    language: str
    duration_ms: int
    segments: List[TranscriptSegment] = field(default_factory=list)
    words: List[TimedWord] = field(default_factory=list)
    model_used: str = "small"
    device_used: str = "cpu"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "schema_version": "1.0",
            "language": self.language,
            "raw_text": self.raw_text,
            "duration_ms": self.duration_ms,
            "model_used": self.model_used,
            "device_used": self.device_used,
            "segments": [s.to_dict() for s in self.segments],
            "words": [w.to_dict() for w in self.words],
        }

    def to_json(self, indent: int = 2) -> str:
        return json.dumps(self.to_dict(), ensure_ascii=False, indent=indent)

    @classmethod
    def from_json(cls, json_str: str) -> TranscriptResult:
        data = json.loads(json_str)
        segments = [TranscriptSegment.from_dict(s) for s in data.get("segments", [])]
        words = [TimedWord.from_dict(w) for w in data.get("words", [])]

        return cls(
            raw_text=str(data.get("raw_text", "")),
            language=str(data.get("language", "ar")),
            duration_ms=int(data.get("duration_ms", 0)),
            segments=segments,
            words=words,
            model_used=str(data.get("model_used", "unknown")),
            device_used=str(data.get("device_used", "cpu")),
        )

    def save_to_file(self, file_path: str) -> None:
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(self.to_json())
