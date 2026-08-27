from __future__ import annotations
from dataclasses import dataclass, field, asdict
from typing import Any, Dict, List, Literal, Optional
import json

CommandType = Literal[
    "health",
    "inspect_audio",
    "convert_audio",
    "detect_speech",
    "align",
    "transcribe",
]

ErrorCode = Literal[
    "INVALID_COMMAND",
    "MALFORMED_JSON",
    "FILE_NOT_FOUND",
    "FILE_TOO_LARGE",
    "INSPECTION_FAILED",
    "CONVERSION_FAILED",
    "VAD_FAILED",
    "TIMEOUT",
    "INTERNAL_ERROR",
]

@dataclass
class WorkerRequest:
    id: str
    command: CommandType
    payload: Dict[str, Any] = field(default_factory=dict)

    @classmethod
    def from_json(cls, line: str) -> WorkerRequest:
        data = json.loads(line)
        if not isinstance(data, dict):
            raise ValueError("Request must be a JSON object")
        if "command" not in data:
            raise ValueError("Request must contain 'command'")
        return cls(
            id=str(data.get("id", "")),
            command=data["command"],
            payload=data.get("payload", {}) if isinstance(data.get("payload"), dict) else {},
        )

@dataclass
class WorkerResponse:
    id: str
    success: bool
    data: Optional[Dict[str, Any]] = None
    error_code: Optional[ErrorCode] = None
    error_message: Optional[str] = None

    def to_json(self) -> str:
        d = {
            "type": "response",
            "id": self.id,
            "success": self.success,
        }
        if self.data is not None:
            d["data"] = self.data
        if self.error_code is not None:
            d["error_code"] = self.error_code
        if self.error_message is not None:
            d["error_message"] = self.error_message
        return json.dumps(d, ensure_ascii=False)

@dataclass
class WorkerProgressEvent:
    id: str
    stage: str
    progress: float  # 0.0 to 1.0
    message: Optional[str] = None
    details: Optional[Dict[str, Any]] = None

    def to_json(self) -> str:
        d: Dict[str, Any] = {
            "type": "progress",
            "id": self.id,
            "stage": self.stage,
            "progress": round(self.progress, 3),
        }
        if self.message:
            d["message"] = self.message
        if self.details:
            d["details"] = self.details
        return json.dumps(d, ensure_ascii=False)

@dataclass
class SpeechInterval:
    start_ms: int
    end_ms: int
    confidence: float = 1.0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "start_ms": self.start_ms,
            "end_ms": self.end_ms,
            "confidence": round(self.confidence, 3),
        }
