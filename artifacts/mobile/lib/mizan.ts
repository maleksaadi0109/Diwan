/**
 * Client for ميزان العرب (mizanalarab.com) — a verified-text source for
 * classical Arabic poetry. Mirrors the desktop app's MizanAlArabProvider
 * (artifacts/arabic-poetry/src/lib/providers/MizanAlArabProvider.ts), but
 * simplified for mobile: only the fields the import pipeline needs (title,
 * poet name, ordered verse text).
 *
 * Poem lookups are routed through the shared api-server's /api/mizan/poem/:id
 * proxy rather than fetched directly, because mizanalarab.com sends no CORS
 * allow-origin header — a direct browser fetch (web preview, or any future
 * web build) fails outright, even though native app fetches are unaffected.
 * Proxying server-side makes the feature work the same way everywhere.
 */

import { apiDomain } from './api';

export interface MizanVersePayload {
  id: string | number;
  order_num?: number;
  order_index?: number;
  text: string;
}

export interface MizanPoemResponse {
  id: string | number;
  title: string;
  poet_name?: string;
  poet?: { name?: string };
  verses: MizanVersePayload[];
}

export interface ParsedMizanPoem {
  title: string;
  poetName: string;
  verses: { orderIndex: number; text: string }[];
}

/** Curated "ready to import" poems: verified text on Mizan Al-Arab paired
 * with a matching audio recitation on YouTube. Ported from the desktop
 * app's poemCatalog.ts (same entries, verified 2026-09-02). */
export interface CatalogPoemEntry {
  id: string;
  titleHint: string;
  poetHint: string;
  mizanPoemId: string;
  mizanUrl: string;
  youtubeUrl: string;
}

export const POEM_CATALOG: CatalogPoemEntry[] = [
  {
    id: 'catalog-mutanabbi-laaynayk',
    titleHint: 'لعينيك ما يلقى الفؤاد وما لقي',
    poetHint: 'أبو الطيب المتنبي',
    mizanPoemId: '35820',
    mizanUrl: 'https://mizanalarab.com/poem/35820',
    youtubeUrl: 'https://www.youtube.com/watch?v=y6CKU_ob1xU',
  },
  {
    id: 'catalog-hilli-sali-rimah',
    titleHint: 'سلي الرماح العوالي عن معالينا',
    poetHint: 'صفي الدين الحلي',
    mizanPoemId: '45269',
    mizanUrl: 'https://mizanalarab.com/poem/45269',
    youtubeUrl: 'https://www.youtube.com/watch?v=KTiiwdaL7ac',
  },
  {
    id: 'catalog-almuqarrab-manal-ala',
    titleHint: 'منال العلى بالمرهفات القواضب',
    poetHint: 'ابن المقرّب العيوني',
    mizanPoemId: '7537',
    mizanUrl: 'https://mizanalarab.com/poem/7537',
    youtubeUrl: 'https://www.youtube.com/watch?v=Ad44riH5CgI',
  },
  {
    id: 'catalog-kaab-banat-suad',
    titleHint: 'بانت سعاد فقلبي اليوم متبول',
    poetHint: 'كعب بن زهير',
    mizanPoemId: '8569',
    mizanUrl: 'https://mizanalarab.com/poem/8569',
    youtubeUrl: 'https://www.youtube.com/watch?v=5hdN4hWWw4A',
  },
  {
    id: 'catalog-mutanabbi-bim-altaalul',
    titleHint: 'بم التعلل لا أهل ولا وطن',
    poetHint: 'أبو الطيب المتنبي',
    mizanPoemId: '35943',
    mizanUrl: 'https://mizanalarab.com/poem/35943',
    youtubeUrl: 'https://www.youtube.com/watch?v=4P8B3jUlMRg',
  },
  {
    id: 'catalog-mutanabbi-maqsura',
    titleHint: 'ألا كل ماشية الخيزلى (المقصورة)',
    poetHint: 'أبو الطيب المتنبي',
    mizanPoemId: '35679',
    mizanUrl: 'https://mizanalarab.com/poem/35679',
    youtubeUrl: 'https://www.youtube.com/watch?v=FS6yzxsvFao',
  },
  {
    id: 'catalog-imruulqais-tatawal',
    titleHint: 'تطاول ليلك بالأثمد',
    poetHint: 'امرؤ القيس',
    mizanPoemId: '12302',
    mizanUrl: 'https://mizanalarab.com/poem/12302',
    youtubeUrl: 'https://www.youtube.com/watch?v=ykvJqlT_rYg',
  },
  {
    id: 'catalog-abualatahiya-yaslam',
    titleHint: 'يسلم المرء أخوه',
    poetHint: 'أبو العتاهية',
    mizanPoemId: '42881',
    mizanUrl: 'https://mizanalarab.com/poem/42881',
    youtubeUrl: 'https://www.youtube.com/watch?v=NAmc74KK7JI',
  },
  {
    id: 'catalog-almalik-alamjad-albaan',
    titleHint: 'على البان قمرية تسجع',
    poetHint: 'الملك الأمجد',
    mizanPoemId: '53174',
    mizanUrl: 'https://mizanalarab.com/poem/53174',
    youtubeUrl: 'https://www.youtube.com/watch?v=W2Oxo9Xjv5I',
  },
  {
    id: 'catalog-ibnzurayq-la-taadhliyh',
    titleHint: 'لا تعذليه فإن العذل يولعه',
    poetHint: 'ابن زريق البغدادي',
    mizanPoemId: '21876',
    mizanUrl: 'https://mizanalarab.com/poem/21876',
    youtubeUrl: 'https://www.youtube.com/watch?v=Jl8h2g7lDiY',
  },
  {
    id: 'catalog-antara-hakkim-suyufak',
    titleHint: 'حكِّم سيوفك في رقاب العذَّل',
    poetHint: 'عنترة بن شداد',
    mizanPoemId: '4152',
    mizanUrl: 'https://mizanalarab.com/poem/4152',
    youtubeUrl: 'https://www.youtube.com/watch?v=IQp9zjvSUOA',
  },
];

/** Extracts the poem id from a mizanalarab.com/poem/{id} URL. */
export function extractMizanPoemId(rawUrl: string): string {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    throw new Error('صيغة رابط ميزان العرب غير صحيحة');
  }
  const validHosts = ['mizanalarab.com', 'www.mizanalarab.com'];
  if (!validHosts.includes(parsed.hostname.toLowerCase())) {
    throw new Error('الرابط يجب أن يكون من موقع mizanalarab.com');
  }
  const match = parsed.pathname.match(/\/poem\/([^/?#]+)/i);
  if (!match || !match[1]) {
    throw new Error('تعذر استخراج معرف القصيدة من الرابط');
  }
  return match[1].trim();
}

export async function fetchMizanPoem(poemId: string): Promise<MizanPoemResponse> {
  const endpoint = `https://${apiDomain()}/api/mizan/poem/${encodeURIComponent(poemId)}`;
  let response: Response;
  try {
    response = await fetch(endpoint, { headers: { Accept: 'application/json' } });
  } catch {
    throw new Error('تعذر الاتصال بموقع ميزان العرب، تحقق من الإنترنت');
  }
  if (!response.ok) {
    let message = `فشل جلب القصيدة من ميزان العرب (HTTP ${response.status})`;
    try {
      const errBody = (await response.json()) as { error_message?: string };
      if (errBody?.error_message) message = errBody.error_message;
    } catch {
      // ignore — fall back to the generic message above
    }
    throw new Error(message);
  }
  const data = (await response.json()) as MizanPoemResponse;
  if (!data || !data.title || !Array.isArray(data.verses) || data.verses.length === 0) {
    throw new Error('استجابة ميزان العرب ناقصة أو غير متوافقة');
  }
  return data;
}

export function parseMizanPoem(response: MizanPoemResponse): ParsedMizanPoem {
  const poetName = response.poet_name || response.poet?.name || 'شاعر غير معروف';
  const verses = response.verses.map((v, idx) => ({
    orderIndex: v.order_num ?? v.order_index ?? idx + 1,
    text: v.text,
  }));
  return { title: response.title, poetName, verses };
}
