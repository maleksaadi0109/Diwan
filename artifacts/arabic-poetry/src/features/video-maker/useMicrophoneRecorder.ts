import { useEffect, useRef, useState } from "react";

export interface CapturedVoiceRecording {
  audioPath: string;
  durationMs: number;
  fileName: string;
}

interface UseMicrophoneRecorderOptions {
  onComplete: (recording: CapturedVoiceRecording) => void;
}

const MAX_RECORDING_MS = 5 * 60 * 1000;
const MAX_CAPTURE_FLOAT_BYTES = 48 * 1024 * 1024;
const MIN_SPEECH_RMS = 0.025;
const MIN_SPEECH_PEAK = 0.055;
const SPEECH_ATTACK_FRAMES = 2;

export function useMicrophoneRecorder({ onComplete }: UseMicrophoneRecorderOptions) {
  const [isRecording, setIsRecording] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [voicedDurationMs, setVoicedDurationMs] = useState(0);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const silentGainRef = useRef<GainNode | null>(null);
  const chunksRef = useRef<Float32Array[]>([]);
  const sampleCountRef = useRef(0);
  const voicedSampleCountRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef(0);
  const mountedRef = useRef(true);
  const recordingRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const releaseResources = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    processorRef.current?.disconnect();
    sourceRef.current?.disconnect();
    silentGainRef.current?.disconnect();
    processorRef.current = null;
    sourceRef.current = null;
    silentGainRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    const audioContext = audioContextRef.current;
    audioContextRef.current = null;
    if (audioContext && audioContext.state !== "closed") {
      void audioContext.close();
    }
  };

  const finishRecording = (deliverResult: boolean) => {
    if (!recordingRef.current) return;
    recordingRef.current = false;

    const sampleRate = audioContextRef.current?.sampleRate || 44_100;
    const chunks = chunksRef.current;
    const sampleCount = sampleCountRef.current;
    chunksRef.current = [];
    sampleCountRef.current = 0;
    voicedSampleCountRef.current = 0;
    releaseResources();

    if (mountedRef.current) setIsRecording(false);
    if (!deliverResult || !mountedRef.current) return;
    if (sampleCount === 0) {
      setRecordingError("لم يُسجَّل أي صوت. تحقق من الميكروفون وحاول مرة أخرى.");
      return;
    }

    const blob = encodeWav(chunks, sampleCount, sampleRate);
    onCompleteRef.current({
      audioPath: URL.createObjectURL(blob),
      durationMs: Math.max(1000, Math.round((sampleCount / sampleRate) * 1000)),
      fileName: `تسجيل-صوتي-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.wav`,
    });
  };

  const stopRecording = () => finishRecording(true);

  const startRecording = async () => {
    setRecordingError(null);

    if (!navigator.mediaDevices?.getUserMedia) {
      setRecordingError("تسجيل الصوت غير مدعوم على هذا الجهاز.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      if (!mountedRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;

      const AudioContextCtor = window.AudioContext || (window as typeof window & {
        webkitAudioContext?: typeof AudioContext;
      }).webkitAudioContext;
      if (!AudioContextCtor) {
        releaseResources();
        setRecordingError("تسجيل الصوت غير مدعوم على هذا الجهاز.");
        return;
      }

      const audioContext = new AudioContextCtor();
      audioContextRef.current = audioContext;
      await audioContext.resume();
      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      const silentGain = audioContext.createGain();
      silentGain.gain.value = 0;

      chunksRef.current = [];
      sampleCountRef.current = 0;
      voicedSampleCountRef.current = 0;
      let noiseFloorRms = 0.006;
      let consecutiveSpeechFrames = 0;
      let pendingSpeechSamples = 0;
      processor.onaudioprocess = (event) => {
        if (!recordingRef.current) return;
        const samples = new Float32Array(event.inputBuffer.getChannelData(0));
        if (
          (sampleCountRef.current + samples.length) * Float32Array.BYTES_PER_ELEMENT >
          MAX_CAPTURE_FLOAT_BYTES
        ) {
          queueMicrotask(() => finishRecording(true));
          return;
        }
        chunksRef.current.push(samples);
        sampleCountRef.current += samples.length;
        let energy = 0;
        let peak = 0;
        for (const sample of samples) {
          energy += sample * sample;
          peak = Math.max(peak, Math.abs(sample));
        }
        const rms = Math.sqrt(energy / samples.length);
        const speechRmsThreshold = Math.max(
          MIN_SPEECH_RMS,
          Math.min(0.06, noiseFloorRms * 3)
        );
        const speechPeakThreshold = Math.max(
          MIN_SPEECH_PEAK,
          speechRmsThreshold * 1.8
        );
        const hasClearVoiceEnergy =
          rms >= speechRmsThreshold && peak >= speechPeakThreshold;

        if (hasClearVoiceEnergy) {
          consecutiveSpeechFrames += 1;
          pendingSpeechSamples += samples.length;
          if (consecutiveSpeechFrames >= SPEECH_ATTACK_FRAMES) {
            voicedSampleCountRef.current += pendingSpeechSamples;
            pendingSpeechSamples = 0;
          }
        } else {
          consecutiveSpeechFrames = 0;
          pendingSpeechSamples = 0;
          // Learn the current room/microphone noise only from frames that are
          // clearly below the speech threshold. This keeps steady hiss, fans,
          // and automatic microphone gain from advancing the reading guide.
          noiseFloorRms = noiseFloorRms * 0.96 + Math.min(rms, 0.02) * 0.04;
        }
      };
      source.connect(processor);
      processor.connect(silentGain);
      silentGain.connect(audioContext.destination);

      sourceRef.current = source;
      processorRef.current = processor;
      silentGainRef.current = silentGain;
      recordingRef.current = true;
      startedAtRef.current = performance.now();
      setElapsedMs(0);
      setVoicedDurationMs(0);
      setIsRecording(true);

      intervalRef.current = setInterval(() => {
        if (!mountedRef.current) return;
        const elapsed = performance.now() - startedAtRef.current;
        setElapsedMs(elapsed);
        setVoicedDurationMs(
          (voicedSampleCountRef.current / audioContext.sampleRate) * 1000
        );
        if (elapsed >= MAX_RECORDING_MS) finishRecording(true);
      }, 200);
    } catch (error) {
      console.error("Microphone recording failed", error);
      releaseResources();
      if (!mountedRef.current) return;
      recordingRef.current = false;
      setIsRecording(false);
      setRecordingError(
        error instanceof DOMException && error.name === "NotAllowedError"
          ? "لم يُسمح باستخدام الميكروفون. فعّل الإذن ثم حاول مرة أخرى."
          : "تعذر فتح الميكروفون. تحقق من اتصاله وإذن الوصول."
      );
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      finishRecording(false);
      releaseResources();
    };
  }, []);

  return {
    isRecording,
    elapsedMs,
    voicedDurationMs,
    recordingError,
    startRecording,
    stopRecording,
  };
}

function encodeWav(
  chunks: Float32Array[],
  sampleCount: number,
  sampleRate: number
): Blob {
  const bytesPerSample = 2;
  const buffer = new ArrayBuffer(44 + sampleCount * bytesPerSample);
  const view = new DataView(buffer);

  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + sampleCount * bytesPerSample, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, sampleCount * bytesPerSample, true);

  let offset = 44;
  for (const chunk of chunks) {
    for (const sample of chunk) {
      const clamped = Math.max(-1, Math.min(1, sample));
      view.setInt16(
        offset,
        clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff,
        true
      );
      offset += bytesPerSample;
    }
  }

  return new Blob([buffer], { type: "audio/wav" });
}

function writeAscii(view: DataView, offset: number, value: string) {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}