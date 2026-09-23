import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateTimeline } from './timelineUtils';
import { wrapArabicText } from './textLayoutUtils';
import { Poem, Recording, Poet } from '@/types';
import { useVideoExport } from './useVideoExport';
import {
  advanceRecitationProgress,
  processFinalSpeechResults,
} from './useLiveRecitationGuide';

describe('timelineUtils', () => {
  const dummyPoet: Poet = { id: 'p1', name: 'Test', era: 'حديث' };
  
  it('generates fallback equal timing when no alignment exists', () => {
    const poem: Poem = {
      id: '1', title: 'Test', poet: dummyPoet, era: 'حديث', bahr: 'الكامل', rhyme: 'م', versesCount: 3,
      recordings: [], tags: [],
      verses: [
        { id: 'v1', poemId: '1', orderIndex: 1, text: 'V1', normalizedText: 'v1', firstHemistich: '1', secondHemistich: '1' },
        { id: 'v2', poemId: '1', orderIndex: 2, text: 'V2', normalizedText: 'v2', firstHemistich: '2', secondHemistich: '2' },
        { id: 'v3', poemId: '1', orderIndex: 3, text: 'V3', normalizedText: 'v3', firstHemistich: '3', secondHemistich: '3' },
      ]
    };
    const recording: Recording = { id: 'r1', poemId: '1', title: 'R', reciter: 'A', audioPath: 'test.mp3', durationMs: 60000, createdAt: '' };
    
    const events = generateTimeline(poem, recording);
    
    // intro, 3 verses, outro = 5 events
    expect(events.length).toBe(5);
    
    const intro = events[0];
    expect(intro.type).toBe('intro');
    expect(intro.endMs - intro.startMs).toBe(3000); // Intro is 3s for 60s
    
    const v1 = events[1];
    expect(v1.type).toBe('verse');
    expect(v1.startMs).toBe(3000);
    // 60000 - 3000(intro) - 3000(outro) = 54000
    // 54000 / 3 = 18000 per verse
    expect(v1.endMs - v1.startMs).toBe(18000);

    const outro = events[4];
    expect(outro.type).toBe('outro');
    expect(outro.endMs - outro.startMs).toBe(4000); // 3000 + 1000 extension
  });

  it('generates exact timing when alignment exists', () => {
    const poem: Poem = {
      id: '1', title: 'Test', poet: dummyPoet, era: 'حديث', bahr: 'الكامل', rhyme: 'م', versesCount: 2,
      recordings: [], tags: [],
      verses: [
        { id: 'v1', poemId: '1', orderIndex: 1, text: 'V1', normalizedText: 'v1', firstHemistich: '1', secondHemistich: '1', alignment: { id: 'a1', verseId: 'v1', recordingId: 'r1', startMs: 2000, endMs: 5000, confidence: 1, status: 'auto' } },
        { id: 'v2', poemId: '1', orderIndex: 2, text: 'V2', normalizedText: 'v2', firstHemistich: '2', secondHemistich: '2', alignment: { id: 'a2', verseId: 'v2', recordingId: 'r1', startMs: 5000, endMs: 8000, confidence: 1, status: 'auto' } },
      ]
    };
    const recording: Recording = { id: 'r1', poemId: '1', title: 'R', reciter: 'A', audioPath: 'test.mp3', durationMs: 10000, createdAt: '' };
    
    const events = generateTimeline(poem, recording);
    
    expect(events.length).toBe(4); // intro, v1, v2, outro
    
    const intro = events[0];
    expect(intro.endMs).toBe(2000); // Ends exactly when first verse starts
    
    const v1 = events[1];
    expect(v1.startMs).toBe(2000);
    expect(v1.endMs).toBe(5000);
    
    const outro = events[3];
    expect(outro.startMs).toBe(8000);
    // Extends by 3000ms from last verse end, max of duration
    expect(outro.endMs).toBe(11000);
  });

  it('does not reuse alignment from a different recording', () => {
    const poem: Poem = {
      id: '1', title: 'Test', poet: dummyPoet, era: 'حديث', bahr: 'الكامل', rhyme: 'م', versesCount: 1,
      recordings: [], tags: [],
      verses: [
        {
          id: 'v1',
          poemId: '1',
          orderIndex: 1,
          text: 'V1',
          normalizedText: 'v1',
          firstHemistich: '1',
          secondHemistich: '1',
          alignment: {
            id: 'a1',
            verseId: 'v1',
            recordingId: 'other-recording',
            startMs: 9000,
            endMs: 9500,
            confidence: 1,
            status: 'auto',
          },
        },
      ],
    };
    const recording: Recording = {
      id: 'r1',
      poemId: '1',
      title: 'R',
      reciter: 'A',
      audioPath: 'test.mp3',
      durationMs: 10000,
      createdAt: '',
    };

    const events = generateTimeline(poem, recording);

    expect(events[0]).toMatchObject({ type: 'intro', startMs: 0, endMs: 1000 });
    expect(events[1]).toMatchObject({ type: 'verse', startMs: 1000, endMs: 9000 });
  });
});

describe('live recitation progress', () => {
  it('advances repeated words one at a time without searching ahead', () => {
    expect(advanceRecitationProgress(['يا', 'يا', 'ليل'], ['يا', 'يا', 'ليل'])).toBe(3);
    expect(advanceRecitationProgress(['يا', 'ليل'], ['ليل'])).toBe(0);
  });

  it('does not turn a later matching word green when an earlier word was missed', () => {
    expect(advanceRecitationProgress(['قلباه', 'واحر'], ['واحر'])).toBe(0);
  });

  it('accepts common Arabic orthographic variants after normalization', () => {
    expect(advanceRecitationProgress(['إِلى', 'فتى', 'رحمة'], ['الى', 'فتي', 'رحمه'])).toBe(3);
  });

  it('keeps interim revisions from changing confirmed progress', () => {
    const initial = { confirmedWordCount: 0, processedFinalResultCount: 0 };
    const interimOnly = processFinalSpeechResults(initial, ['هذا', 'نص'], [
      { isFinal: false, 0: { transcript: 'هذا نص' } },
    ]);
    expect(interimOnly).toEqual(initial);

    const confirmed = processFinalSpeechResults(initial, ['هذا', 'نص'], [
      { isFinal: true, 0: { transcript: 'هذا' } },
      { isFinal: false, 0: { transcript: 'نص' } },
    ]);
    expect(confirmed.confirmedWordCount).toBe(1);

    const revised = processFinalSpeechResults(confirmed, ['هذا', 'نص'], [
      { isFinal: true, 0: { transcript: 'هذا' } },
      { isFinal: false, 0: { transcript: 'نص مختلف' } },
    ]);
    expect(revised.confirmedWordCount).toBe(1);
  });
});

describe('textLayoutUtils', () => {
  it('wraps arabic text correctly based on context width', () => {
    // Mock measureText
    const mockCtx = {
      measureText: (text: string) => ({ width: text.length * 10 })
    } as CanvasRenderingContext2D;
    
    // "هذا نص عربي طويل يحتاج إلى التفاف"
    // Each char is 10px. 
    // "هذا نص" = 7 chars = 70px.
    const text = "هذا نص عربي طويل يحتاج إلى التفاف";
    const lines = wrapArabicText(mockCtx, text, 80); // max 80px per line (8 chars)
    
    expect(lines.length).toBeGreaterThan(1);
    expect(lines[0]).toBe("هذا نص");
    expect(lines[1]).toBe("عربي");
    expect(lines[2]).toBe("طويل");
  });

  it('keeps short text on one line', () => {
    const mockCtx = {
      measureText: (text: string) => ({ width: text.length * 10 })
    } as CanvasRenderingContext2D;
    
    const lines = wrapArabicText(mockCtx, "نص قصير", 200);
    expect(lines.length).toBe(1);
    expect(lines[0]).toBe("نص قصير");
  });

  it('splits a single oversized token so it cannot overflow the canvas', () => {
    const mockCtx = {
      measureText: (text: string) => ({ width: Array.from(text).length * 10 })
    } as CanvasRenderingContext2D;

    const lines = wrapArabicText(mockCtx, "كلمةطويلةجداً", 40);

    expect(lines.length).toBeGreaterThan(1);
    expect(lines.every((line) => Array.from(line).length <= 4)).toBe(true);
  });
});
