/**
 * Curated "ready to download" poem catalog.
 *
 * Each entry pairs a poem's text on Mizan Al-Arab (mizanalarab.com) with an
 * audio recitation on YouTube (Alqimmah Studio / Osama Al-Wa'ez & other reciters).
 * Tapping a catalog card runs the same text+audio import pipeline as the manual wizard
 * (see ImportQueueContext.processPoemImportJob), pre-filled from this data.
 */

export interface CatalogReciter {
  id: string;
  name: string;
  role: string;
  avatarUrl: string;
  channelName: string;
  channelUrl: string;
  description: string;
}

export const CATALOG_RECITERS: Record<string, CatalogReciter> = {
  "osama-alwaaedh": {
    id: "osama-alwaaedh",
    name: "أسامة الواعظ",
    role: "ملقٍ صوتي وباحث أدبي",
    avatarUrl: "/reciters/osama-alwaaedh.jpg",
    channelName: "أسامة الواعظ / استوديو القمة",
    channelUrl: "https://www.youtube.com/@osama.alwaaedh",
    description: "إلقاء هادئ ومتقن بأعلى معايير الفصاحة والضبط اللغوي لعيون الشعر العربي الفصيح.",
  },
  "omar-alsharafi": {
    id: "omar-alsharafi",
    name: "عمر الشرفي",
    role: "إلقاء جهوري ملحمي",
    avatarUrl: "/reciters/omar-alsharafi.jpg",
    channelName: "عمر الشرفي",
    channelUrl: "https://www.youtube.com/@OmarAlsharafi",
    description: "نبرة جهورية فخمة تأسر القلوب في تجسيد المعلقات السبع الكبرى وعيون الشعر الجاهلي.",
  },
  "khaled-alsharafi": {
    id: "khaled-alsharafi",
    name: "خالد الشرفي",
    role: "إلقاء وجداني وتأملي",
    avatarUrl: "/reciters/khaled-alsharafi.jpg",
    channelName: "خالد الشرفي",
    channelUrl: "https://www.youtube.com/@khaledalsharafi",
    description: "صوت دافئ متأمل يبرز جماليات شعر الحكمة والزهد وروائع الإمام الشافعي.",
  },
  "khaled-bin-hassan": {
    id: "khaled-bin-hassan",
    name: "خالد بن حسن",
    role: "إلقاء عاطفي شجي",
    avatarUrl: "/reciters/khaled-bin-hassan.jpg",
    channelName: "استوديو القمة",
    channelUrl: "https://www.youtube.com/@alqimmahstudio",
    description: "إلقاء حزين شجي يبدع في قصائد الوجد والغزل العذري وشعر مجنون ليلى.",
  },
  "taraneem": {
    id: "taraneem",
    name: "ترنيم (نواف)",
    role: "إنشاد فصيح عذب وشجي",
    avatarUrl: "/reciters/taraneem.jpg",
    channelName: "ترنيم / ترانيم",
    channelUrl: "https://www.youtube.com/playlist?list=PL7o6RRLASOhIeVHJf3X5uXWNzqpLEyHM5",
    description: "أداء صوتي شجي عذب بدون موسيقى لنخبة من عيون الشعر العربي وروائع الفصحى والوجد والحكمة.",
  },
};

import type { Poem } from "@/types";

export function getReciterForEntry(entry: CatalogPoemEntry): CatalogReciter {
  return CATALOG_RECITERS[entry.reciterId] || CATALOG_RECITERS["osama-alwaaedh"];
}

/**
 * Finds the matching CatalogReciter for any Poem in the library (via externalId,
 * recordings reciter field, recording title, or title matching).
 */
export function findReciterForPoem(poem: Poem): CatalogReciter | undefined {
  if (!poem) return undefined;

  // 1. If imported from Mizan Al-Arab, check if mizan externalId matches catalog
  if (poem.externalProvider === "mizan_al_arab" && poem.externalId) {
    const catalogEntry = POEM_CATALOG.find((e) => e.mizanPoemId === poem.externalId);
    if (catalogEntry) {
      return getReciterForEntry(catalogEntry);
    }
  }

  // 2. Check recordings reciter string
  if (Array.isArray(poem.recordings)) {
    for (const rec of poem.recordings) {
      const reciterStr = rec.reciter?.trim();
      if (reciterStr) {
        for (const r of Object.values(CATALOG_RECITERS)) {
          if (
            reciterStr.includes(r.name) ||
            r.name.includes(reciterStr) ||
            reciterStr === r.id ||
            (r.id === "taraneem" && (reciterStr.includes("ترنيم") || reciterStr.includes("نواف")))
          ) {
            return r;
          }
        }
      }

      // 3. Fallback check for known strings in recording title
      const recTitle = rec.title?.trim();
      if (recTitle) {
        for (const r of Object.values(CATALOG_RECITERS)) {
          if (
            recTitle.includes(r.name) ||
            (r.id === "taraneem" && (recTitle.includes("ترنيم") || recTitle.includes("نواف")))
          ) {
            return r;
          }
        }
      }
    }
  }

  // 4. Fallback check against titleHint
  if (poem.title) {
    const foundByTitle = POEM_CATALOG.find(
      (e) => e.titleHint && (poem.title.includes(e.titleHint) || e.titleHint.includes(poem.title))
    );
    if (foundByTitle) {
      return getReciterForEntry(foundByTitle);
    }
  }

  return undefined;
}

export interface CatalogPoemEntry {
  /** Stable key for this catalog entry, independent of the Mizan poem id. */
  id: string;
  /** First hemistich / common title, shown on the card before download. */
  titleHint: string;
  poetHint: string;
  mizanPoemId: string;
  mizanUrl: string;
  youtubeUrl: string;
  reciterId: string;
}

export const POEM_CATALOG: CatalogPoemEntry[] = [
  {
    id: "catalog-mutanabbi-laaynayk",
    titleHint: "لعينيك ما يلقى الفؤاد وما لقي",
    poetHint: "أبو الطيب المتنبي",
    mizanPoemId: "35820",
    mizanUrl: "https://mizanalarab.com/poem/35820",
    youtubeUrl: "https://www.youtube.com/watch?v=y6CKU_ob1xU",
    reciterId: "osama-alwaaedh",
  },
  {
    id: "catalog-hilli-sali-rimah",
    titleHint: "سلي الرماح العوالي عن معالينا",
    poetHint: "صفي الدين الحلي",
    mizanPoemId: "45269",
    mizanUrl: "https://mizanalarab.com/poem/45269",
    youtubeUrl: "https://www.youtube.com/watch?v=KTiiwdaL7ac",
    reciterId: "osama-alwaaedh",
  },
  {
    id: "catalog-almuqarrab-manal-ala",
    titleHint: "منال العلى بالمرهفات القواضب",
    poetHint: "ابن المقرّب العيوني",
    mizanPoemId: "7537",
    mizanUrl: "https://mizanalarab.com/poem/7537",
    youtubeUrl: "https://www.youtube.com/watch?v=Ad44riH5CgI",
    reciterId: "osama-alwaaedh",
  },
  {
    id: "catalog-kaab-banat-suad",
    titleHint: "بانت سعاد فقلبي اليوم متبول",
    poetHint: "كعب بن زهير",
    mizanPoemId: "8569",
    mizanUrl: "https://mizanalarab.com/poem/8569",
    youtubeUrl: "https://www.youtube.com/watch?v=5hdN4hWWw4A",
    reciterId: "osama-alwaaedh",
  },
  {
    id: "catalog-mutanabbi-bim-altaalul",
    titleHint: "بم التعلل لا أهل ولا وطن",
    poetHint: "أبو الطيب المتنبي",
    mizanPoemId: "35943",
    mizanUrl: "https://mizanalarab.com/poem/35943",
    youtubeUrl: "https://www.youtube.com/watch?v=4P8B3jUlMRg",
    reciterId: "osama-alwaaedh",
  },
  {
    id: "catalog-mutanabbi-maqsura",
    titleHint: "ألا كل ماشية الخيزلى (المقصورة)",
    poetHint: "أبو الطيب المتنبي",
    mizanPoemId: "35679",
    mizanUrl: "https://mizanalarab.com/poem/35679",
    youtubeUrl: "https://www.youtube.com/watch?v=FS6yzxsvFao",
    reciterId: "osama-alwaaedh",
  },
  {
    id: "catalog-imruulqais-tatawal",
    titleHint: "تطاول ليلك بالأثمد",
    poetHint: "امرؤ القيس",
    mizanPoemId: "12302",
    mizanUrl: "https://mizanalarab.com/poem/12302",
    youtubeUrl: "https://www.youtube.com/watch?v=ykvJqlT_rYg",
    reciterId: "osama-alwaaedh",
  },
  {
    id: "catalog-abualatahiya-yaslam",
    titleHint: "يسلم المرء أخوه",
    poetHint: "أبو العتاهية",
    mizanPoemId: "42881",
    mizanUrl: "https://mizanalarab.com/poem/42881",
    youtubeUrl: "https://www.youtube.com/watch?v=NAmc74KK7JI",
    reciterId: "osama-alwaaedh",
  },
  {
    id: "catalog-almalik-alamjad-albaan",
    titleHint: "على البان قمرية تسجع",
    poetHint: "الملك الأمجد",
    mizanPoemId: "53174",
    mizanUrl: "https://mizanalarab.com/poem/53174",
    youtubeUrl: "https://www.youtube.com/watch?v=W2Oxo9Xjv5I",
    reciterId: "osama-alwaaedh",
  },
  {
    id: "catalog-ibnzurayq-la-taadhliyh",
    titleHint: "لا تعذليه فإن العذل يولعه",
    poetHint: "ابن زريق البغدادي",
    mizanPoemId: "21876",
    mizanUrl: "https://mizanalarab.com/poem/21876",
    youtubeUrl: "https://www.youtube.com/watch?v=Jl8h2g7lDiY",
    reciterId: "osama-alwaaedh",
  },
  {
    id: "catalog-antara-hakkim-suyufak",
    titleHint: "حكِّم سيوفك في رقاب العذَّل",
    poetHint: "عنترة بن شداد",
    mizanPoemId: "4152",
    mizanUrl: "https://mizanalarab.com/poem/4152",
    youtubeUrl: "https://www.youtube.com/watch?v=IQp9zjvSUOA",
    reciterId: "osama-alwaaedh",
  },
  {
    id: "catalog-abufiras-nahat-hamama",
    titleHint: "أقول وقد ناحت بقربي حمامة",
    poetHint: "أبو فراس الحمداني",
    mizanPoemId: "17804",
    mizanUrl: "https://mizanalarab.com/poem/17804",
    youtubeUrl: "https://www.youtube.com/watch?v=UboOYH9fJxQ",
    reciterId: "osama-alwaaedh",
  },
  {
    id: "catalog-abualbaqa-rithaa-alandalus",
    titleHint: "لكل شيء إذا ما تم نقصان (رثاء الأندلس)",
    poetHint: "أبو البقاء الرندي",
    mizanPoemId: "12335",
    mizanUrl: "https://mizanalarab.com/poem/12335",
    youtubeUrl: "https://www.youtube.com/watch?v=12ahz197wow",
    reciterId: "osama-alwaaedh",
  },
  {
    id: "catalog-ibnzaydun-adha-attanai",
    titleHint: "أضحى التنائي بديلاً من تدانينا (هل تذكرون غريبًا)",
    poetHint: "ابن زيدون",
    mizanPoemId: "11002",
    mizanUrl: "https://mizanalarab.com/poem/11002",
    youtubeUrl: "https://www.youtube.com/watch?v=3GEarxDwhSE",
    reciterId: "osama-alwaaedh",
  },
  {
    id: "catalog-mutanabbi-kafa-bika-daa",
    titleHint: "كفى بك داء أن ترى الموت شافيا",
    poetHint: "أبو الطيب المتنبي",
    mizanPoemId: "35956",
    mizanUrl: "https://mizanalarab.com/poem/35956",
    youtubeUrl: "https://www.youtube.com/watch?v=Fp_4J5UpV7I",
    reciterId: "osama-alwaaedh",
  },
  {
    id: "catalog-alibin-aljahm-uyun-almaha",
    titleHint: "عيون المها بين الرصافة والجسر",
    poetHint: "علي بن الجهم",
    mizanPoemId: "222453",
    mizanUrl: "https://mizanalarab.com/poem/222453",
    youtubeUrl: "https://www.youtube.com/watch?v=SzW9YSxWA6Q",
    reciterId: "osama-alwaaedh",
  },
  {
    id: "catalog-mutanabbi-alhubbu-ma-manaa",
    titleHint: "الحب ما منع الكلام الألسنا",
    poetHint: "أبو الطيب المتنبي",
    mizanPoemId: "35937",
    mizanUrl: "https://mizanalarab.com/poem/35937",
    youtubeUrl: "https://www.youtube.com/watch?v=Vj9jNIL-NuY",
    reciterId: "osama-alwaaedh",
  },
  {
    id: "catalog-mutanabbi-nuiddu-almushrafiyya",
    titleHint: "نعد المشرفية والعوالي",
    poetHint: "أبو الطيب المتنبي",
    mizanPoemId: "35843",
    mizanUrl: "https://mizanalarab.com/poem/35843",
    youtubeUrl: "https://www.youtube.com/watch?v=QBAo9vHxZLM",
    reciterId: "osama-alwaaedh",
  },
  {
    id: "catalog-hassan-bitaybata-rasmun",
    titleHint: "بطيبة رسم للرسول ومعهد",
    poetHint: "حسان بن ثابت",
    mizanPoemId: "18578",
    mizanUrl: "https://mizanalarab.com/poem/18578",
    youtubeUrl: "https://www.youtube.com/watch?v=ZPFPDIH-vng",
    reciterId: "osama-alwaaedh",
  },
  {
    id: "catalog-baha-al-din-daoo-alwushata",
    titleHint: "دعوا الوشاة وما قالوا وما نقلوا",
    poetHint: "بهاء الدين زهير",
    mizanPoemId: "26654",
    mizanUrl: "https://mizanalarab.com/poem/26654",
    youtubeUrl: "https://www.youtube.com/watch?v=uA2xzFOE0H0",
    reciterId: "osama-alwaaedh",
  },
  {
    id: "catalog-mutanabbi-alyawma-ahdukum",
    titleHint: "اليوم عهدكم فأين الموعد",
    poetHint: "أبو الطيب المتنبي",
    mizanPoemId: "35734",
    mizanUrl: "https://mizanalarab.com/poem/35734",
    youtubeUrl: "https://www.youtube.com/watch?v=mEgjxXIFu1A",
    reciterId: "osama-alwaaedh",
  },
  {
    id: "catalog-baroudi-hal-min-tabeeb",
    titleHint: "هل من طبيب لداء الحب أو راق",
    poetHint: "محمود سامي البارودي",
    mizanPoemId: "162213",
    mizanUrl: "https://mizanalarab.com/poem/162213",
    youtubeUrl: "https://www.youtube.com/watch?v=IX1uewE5zOg",
    reciterId: "osama-alwaaedh",
  },
  {
    id: "catalog-shawqi-saloo-qalbi",
    titleHint: "سلوا قلبي غداة سلا وثابا (نهج البردة)",
    poetHint: "أحمد شوقي",
    mizanPoemId: "180786",
    mizanUrl: "https://mizanalarab.com/poem/180786",
    youtubeUrl: "https://www.youtube.com/watch?v=0uIefFxtSRc",
    reciterId: "osama-alwaaedh",
  },
  {
    id: "catalog-abufiras-arak-asiya-addami",
    titleHint: "أراك عصي الدمع شيمتك الصبر",
    poetHint: "أبو فراس الحمداني",
    mizanPoemId: "17879",
    mizanUrl: "https://mizanalarab.com/poem/17879",
    youtubeUrl: "https://www.youtube.com/watch?v=zbB2x1afhYU",
    reciterId: "osama-alwaaedh",
  },
  {
    id: "catalog-mutanabbi-ala-qadri-ahlil-azm",
    titleHint: "على قدر أهل العزم تأتي العزائم",
    poetHint: "أبو الطيب المتنبي",
    mizanPoemId: "35895",
    mizanUrl: "https://mizanalarab.com/poem/35895",
    youtubeUrl: "https://www.youtube.com/watch?v=01v6T9wghjw",
    reciterId: "osama-alwaaedh",
  },
  {
    id: "catalog-jarir-bana-alkhaleet",
    titleHint: "بان الخليط ولو طوعت ما بانا",
    poetHint: "جرير",
    mizanPoemId: "15762",
    mizanUrl: "https://mizanalarab.com/poem/15762",
    youtubeUrl: "https://www.youtube.com/watch?v=6eyfKLPVHX8",
    reciterId: "osama-alwaaedh",
  },
  {
    id: "catalog-khansa-ala-ma-liaynayki",
    titleHint: "ألا ما لعينك أم ما لها",
    poetHint: "الخنساء",
    mizanPoemId: "12660",
    mizanUrl: "https://mizanalarab.com/poem/12660",
    youtubeUrl: "https://www.youtube.com/watch?v=lU12RCIusqM",
    reciterId: "osama-alwaaedh",
  },
  {
    id: "catalog-antara-hal-ghadara-ashuaraa",
    titleHint: "هل غادر الشعراء من متردم (معلقة عنترة)",
    poetHint: "عنترة بن شداد",
    mizanPoemId: "4045",
    mizanUrl: "https://mizanalarab.com/poem/4045",
    youtubeUrl: "https://www.youtube.com/watch?v=LpGGs4yOXTc",
    reciterId: "omar-alsharafi",
  },
  {
    id: "catalog-amr-bin-kulthum-ala-hubbi",
    titleHint: "ألا هبي بصحنك فاصبحينا (معلقة عمرو بن كلثوم)",
    poetHint: "عمرو بن كلثوم",
    mizanPoemId: "235257",
    mizanUrl: "https://mizanalarab.com/poem/235257",
    youtubeUrl: "https://www.youtube.com/watch?v=IJQhVS1q3Bc",
    reciterId: "omar-alsharafi",
  },
  {
    id: "catalog-imruulqais-qifa-nabki",
    titleHint: "قفا نبك من ذكرى حبيب ومنزل (معلقة امرئ القيس)",
    poetHint: "امرؤ القيس",
    mizanPoemId: "12271",
    mizanUrl: "https://mizanalarab.com/poem/12271",
    youtubeUrl: "https://www.youtube.com/watch?v=OaIsGlS8ONY",
    reciterId: "omar-alsharafi",
  },
  {
    id: "catalog-majnun-layla-almunisa",
    titleHint: "تذكرت ليلى والسنين الخواليا (المؤنسة)",
    poetHint: "قيس بن الملوح (مجنون ليلى)",
    mizanPoemId: "248303",
    mizanUrl: "https://mizanalarab.com/poem/248303",
    youtubeUrl: "https://www.youtube.com/watch?v=b25dp6oirQA",
    reciterId: "khaled-bin-hassan",
  },
  {
    id: "catalog-shafii-daa-al-ayyam",
    titleHint: "دع الأيام تفعل ما تشاء",
    poetHint: "الإمام الشافعي",
    mizanPoemId: "5148",
    mizanUrl: "https://mizanalarab.com/poem/5148",
    youtubeUrl: "https://www.youtube.com/watch?v=TL7NRb6u8hs",
    reciterId: "khaled-alsharafi",
  },
  {
    id: "catalog-shafii-idha-al-maru-la-yaraaka",
    titleHint: "إذا المرء لا يرعاك إلا تكلفا",
    poetHint: "الإمام الشافعي",
    mizanPoemId: "5082",
    mizanUrl: "https://mizanalarab.com/poem/5082",
    youtubeUrl: "https://www.youtube.com/watch?v=JgiE4_n99S0",
    reciterId: "khaled-alsharafi",
  },
  {
    id: "catalog-shawqi-salamun-min-saba-barada",
    titleHint: "سلام من صبا بردى أرق (نكبة دمشق)",
    poetHint: "أحمد شوقي",
    mizanPoemId: "34974",
    mizanUrl: "https://mizanalarab.com/poem/34974",
    youtubeUrl: "https://www.youtube.com/watch?v=1lAVCKF7SC0",
    reciterId: "osama-alwaaedh",
  },
  {
    id: "catalog-busti-ziyadat-almar-fi-dunyahu",
    titleHint: "زيادة المرء في دنياه نقصان (نونية البستي)",
    poetHint: "أبو الفتح البستي",
    mizanPoemId: "41522",
    mizanUrl: "https://mizanalarab.com/poem/41522",
    youtubeUrl: "https://www.youtube.com/watch?v=yRu-P1Xz6bI",
    reciterId: "osama-alwaaedh",
  },
  {
    id: "catalog-ibn-alwardi-itazil-dhikra-alaghani",
    titleHint: "اعتزل ذكر الأغاني والغزل (لامية ابن الوردي)",
    poetHint: "ابن الوردي",
    mizanPoemId: "52246",
    mizanUrl: "https://mizanalarab.com/poem/52246",
    youtubeUrl: "https://www.youtube.com/watch?v=oWzo-SsqOVY",
    reciterId: "osama-alwaaedh",
  },
  {
    id: "catalog-ibn-duraid-al-maqsura",
    titleHint: "يا ظبية أشبه شيء بالمها (مقصورة ابن دريد)",
    poetHint: "ابن دريد الأزدي",
    mizanPoemId: "7067",
    mizanUrl: "https://mizanalarab.com/poem/7067",
    youtubeUrl: "https://www.youtube.com/watch?v=ABhIY5g4Qxs",
    reciterId: "osama-alwaaedh",
  },
  {
    id: "catalog-baha-al-din-arafa-alhabeebu-makanahu",
    titleHint: "عرف الحبيب مكانه فتدللا",
    poetHint: "بهاء الدين زهير",
    mizanPoemId: "26642",
    mizanUrl: "https://mizanalarab.com/poem/26642",
    youtubeUrl: "https://www.youtube.com/watch?v=M9h-RO58ABs",
    reciterId: "osama-alwaaedh",
  },
  {
    id: "catalog-mutanabbi-lihawa-annufus",
    titleHint: "لهوى النفوس سريرة لا تعلم",
    poetHint: "أبو الطيب المتنبي",
    mizanPoemId: "35919",
    mizanUrl: "https://mizanalarab.com/poem/35919",
    youtubeUrl: "https://www.youtube.com/watch?v=P6QOr3SdE_Q",
    reciterId: "osama-alwaaedh",
  },
  {
    id: "catalog-abualatahiya-addahru-dhu-duwal",
    titleHint: "الدهر ذو دول والموت ذو علل",
    poetHint: "أبو العتاهية",
    mizanPoemId: "42879",
    mizanUrl: "https://mizanalarab.com/poem/42879",
    youtubeUrl: "https://www.youtube.com/watch?v=MUORJT3kPSE",
    reciterId: "osama-alwaaedh",
  },
  {
    id: "catalog-antara-la-yahmilu-alhiqda",
    titleHint: "لا يحمل الحقد من تعلو به الرتب",
    poetHint: "عنترة بن شداد",
    mizanPoemId: "4086",
    mizanUrl: "https://mizanalarab.com/poem/4086",
    youtubeUrl: "https://www.youtube.com/watch?v=Cn8P7mYLzj0",
    reciterId: "khaled-alsharafi",
  },
  {
    id: "catalog-taraneem-1",
    titleHint: "حكِّم سيوفك في رقاب العذَّل",
    poetHint: "عنترة بن شداد",
    mizanPoemId: "4152",
    mizanUrl: "https://mizanalarab.com/poem/4152",
    youtubeUrl: "https://www.youtube.com/watch?v=IQp9zjvSUOA",
    reciterId: "taraneem",
  },
  {
    id: "catalog-taraneem-2",
    titleHint: "مرثية مالك بن الريب (ألا ليت شعري)",
    poetHint: "مالك بن الريب",
    mizanPoemId: "248301",
    mizanUrl: "https://mizanalarab.com/poem/248301",
    youtubeUrl: "https://www.youtube.com/watch?v=aggd100IAFM",
    reciterId: "taraneem",
  },
  {
    id: "catalog-taraneem-3",
    titleHint: "معلقة عنترة بن شداد (هل غادر الشعراء)",
    poetHint: "عنترة بن شداد",
    mizanPoemId: "4147",
    mizanUrl: "https://mizanalarab.com/poem/4147",
    youtubeUrl: "https://www.youtube.com/watch?v=5zvJZH5SvEs",
    reciterId: "taraneem",
  },
  {
    id: "catalog-taraneem-4",
    titleHint: "أراك عصي الدمع شيمتك الصبر",
    poetHint: "أبو فراس الحمداني",
    mizanPoemId: "17730",
    mizanUrl: "https://mizanalarab.com/poem/17730",
    youtubeUrl: "https://www.youtube.com/watch?v=qS3Dk4zfuQY",
    reciterId: "taraneem",
  },
  {
    id: "catalog-taraneem-5",
    titleHint: "قصيدة التائية (خليلي هذا ربع عزة فاعقلا)",
    poetHint: "كثيِّر عزَّة",
    mizanPoemId: "248302",
    mizanUrl: "https://mizanalarab.com/poem/248302",
    youtubeUrl: "https://www.youtube.com/watch?v=M-oegIwR9Y0",
    reciterId: "taraneem",
  },
  {
    id: "catalog-taraneem-6",
    titleHint: "سما لك شوق بعدما كان أقصرا",
    poetHint: "امرؤ القيس",
    mizanPoemId: "12302",
    mizanUrl: "https://mizanalarab.com/poem/12302",
    youtubeUrl: "https://www.youtube.com/watch?v=TUXdscdicak",
    reciterId: "taraneem",
  },
  {
    id: "catalog-taraneem-7",
    titleHint: "لا تعذليه فإن العذل يولعه (يتيمة الدهر)",
    poetHint: "ابن زريق البغدادي",
    mizanPoemId: "21876",
    mizanUrl: "https://mizanalarab.com/poem/21876",
    youtubeUrl: "https://www.youtube.com/watch?v=ddLVHuJJcuc",
    reciterId: "taraneem",
  },
  {
    id: "catalog-taraneem-8",
    titleHint: "قذى بعينك أم بالعين عوار",
    poetHint: "الخنساء",
    mizanPoemId: "12411",
    mizanUrl: "https://mizanalarab.com/poem/12411",
    youtubeUrl: "https://www.youtube.com/watch?v=ntO_BvlPM2I",
    reciterId: "taraneem",
  },
  {
    id: "catalog-taraneem-9",
    titleHint: "بادٍ هواك صبرت أم لم تصبرا",
    poetHint: "أبو الطيب المتنبي",
    mizanPoemId: "35711",
    mizanUrl: "https://mizanalarab.com/poem/35711",
    youtubeUrl: "https://www.youtube.com/watch?v=v1wKyymoPzw",
    reciterId: "taraneem",
  },
  {
    id: "catalog-taraneem-10",
    titleHint: "لكل شيء إذا ما تم نقصان (رثاء الأندلس)",
    poetHint: "أبو البقاء الرندي",
    mizanPoemId: "12335",
    mizanUrl: "https://mizanalarab.com/poem/12335",
    youtubeUrl: "https://www.youtube.com/watch?v=Ub9PGQmEyHk",
    reciterId: "taraneem",
  },
  {
    id: "catalog-taraneem-11",
    titleHint: "بطيبة رسم للرسول ومعهد",
    poetHint: "حسان بن ثابت",
    mizanPoemId: "248304",
    mizanUrl: "https://mizanalarab.com/poem/248304",
    youtubeUrl: "https://www.youtube.com/watch?v=6Rsz2ghbpNQ",
    reciterId: "taraneem",
  },
  {
    id: "catalog-taraneem-12",
    titleHint: "واحر قلباه ممن قلبه شبم",
    poetHint: "أبو الطيب المتنبي",
    mizanPoemId: "35898",
    mizanUrl: "https://mizanalarab.com/poem/35898",
    youtubeUrl: "https://www.youtube.com/watch?v=JGULLBBEgAw",
    reciterId: "taraneem",
  },
  {
    id: "catalog-taraneem-13",
    titleHint: "بم التعلل لا أهل ولا وطن",
    poetHint: "أبو الطيب المتنبي",
    mizanPoemId: "35943",
    mizanUrl: "https://mizanalarab.com/poem/35943",
    youtubeUrl: "https://www.youtube.com/watch?v=VgaKcJ0SeZE",
    reciterId: "taraneem",
  },
  {
    id: "catalog-taraneem-14",
    titleHint: "إذا المرء لم يدنس من اللؤم عرضه",
    poetHint: "السموأل",
    mizanPoemId: "12349",
    mizanUrl: "https://mizanalarab.com/poem/12349",
    youtubeUrl: "https://www.youtube.com/watch?v=cE3alYMpumE",
    reciterId: "taraneem",
  },
  {
    id: "catalog-taraneem-15",
    titleHint: "السيف أصدق أنباء من الكتب (فتح عمورية)",
    poetHint: "أبو تمام",
    mizanPoemId: "4523",
    mizanUrl: "https://mizanalarab.com/poem/4523",
    youtubeUrl: "https://www.youtube.com/watch?v=KJiWrIqvSaU",
    reciterId: "taraneem",
  },
  {
    id: "catalog-taraneem-16",
    titleHint: "باسم الإله تحية لمتيم",
    poetHint: "عمر بن أبي ربيعة",
    mizanPoemId: "248305",
    mizanUrl: "https://mizanalarab.com/poem/248305",
    youtubeUrl: "https://www.youtube.com/watch?v=da_xqmtpmQ8",
    reciterId: "taraneem",
  },
  {
    id: "catalog-taraneem-17",
    titleHint: "تأهب مثل أهبة ذي كفاح",
    poetHint: "جساس بن مرة",
    mizanPoemId: "248306",
    mizanUrl: "https://mizanalarab.com/poem/248306",
    youtubeUrl: "https://www.youtube.com/watch?v=Tit7neeqqFI",
    reciterId: "taraneem",
  },
  {
    id: "catalog-taraneem-18",
    titleHint: "أمن المنون وريبها تتوجع",
    poetHint: "أبو ذؤيب الهذلي",
    mizanPoemId: "248307",
    mizanUrl: "https://mizanalarab.com/poem/248307",
    youtubeUrl: "https://www.youtube.com/watch?v=iHq_RBsGJFg",
    reciterId: "taraneem",
  },
  {
    id: "catalog-taraneem-19",
    titleHint: "لقد زادني ما تعلمين صبابة",
    poetHint: "بشار بن برد",
    mizanPoemId: "248308",
    mizanUrl: "https://mizanalarab.com/poem/248308",
    youtubeUrl: "https://www.youtube.com/watch?v=cNqtoMB4jyg",
    reciterId: "taraneem",
  },
  {
    id: "catalog-taraneem-20",
    titleHint: "أيا أم الأسير سقاك غيث (رثاء أمه)",
    poetHint: "أبو فراس الحمداني",
    mizanPoemId: "248309",
    mizanUrl: "https://mizanalarab.com/poem/248309",
    youtubeUrl: "https://www.youtube.com/watch?v=NVYLNXjd9Ag",
    reciterId: "taraneem",
  },
  {
    id: "catalog-taraneem-21",
    titleHint: "كفى بك داء أن ترى الموت شافيا",
    poetHint: "أبو الطيب المتنبي",
    mizanPoemId: "35900",
    mizanUrl: "https://mizanalarab.com/poem/35900",
    youtubeUrl: "https://www.youtube.com/watch?v=b6A3os2nd5g",
    reciterId: "taraneem",
  },
  {
    id: "catalog-taraneem-22",
    titleHint: "كل الحوادث مبداها من النظر",
    poetHint: "أحمد شوقي",
    mizanPoemId: "248310",
    mizanUrl: "https://mizanalarab.com/poem/248310",
    youtubeUrl: "https://www.youtube.com/watch?v=V7TxiVmShJs",
    reciterId: "taraneem",
  },
  {
    id: "catalog-taraneem-23",
    titleHint: "أخاف إلهي ثم أرجو نواله",
    poetHint: "أبو تمام",
    mizanPoemId: "248311",
    mizanUrl: "https://mizanalarab.com/poem/248311",
    youtubeUrl: "https://www.youtube.com/watch?v=jFf4rSzHKMc",
    reciterId: "taraneem",
  },
  {
    id: "catalog-taraneem-24",
    titleHint: "ألا من لنفسي بالهوى قد تمادت",
    poetHint: "أبو العتاهية",
    mizanPoemId: "42881",
    mizanUrl: "https://mizanalarab.com/poem/42881",
    youtubeUrl: "https://www.youtube.com/watch?v=NOdC1SWwjgk",
    reciterId: "taraneem",
  },
  {
    id: "catalog-taraneem-25",
    titleHint: "قف بالديار وصح إلى بيداها",
    poetHint: "عنترة بن شداد",
    mizanPoemId: "248312",
    mizanUrl: "https://mizanalarab.com/poem/248312",
    youtubeUrl: "https://www.youtube.com/watch?v=ku7IyrzDb6I",
    reciterId: "taraneem",
  },
  {
    id: "catalog-taraneem-26",
    titleHint: "ترى كم قد بدت منكم أمور ما عهدناها",
    poetHint: "بهاء الدين زهير",
    mizanPoemId: "248313",
    mizanUrl: "https://mizanalarab.com/poem/248313",
    youtubeUrl: "https://www.youtube.com/watch?v=2LpT_CR2AH0",
    reciterId: "taraneem",
  },
  {
    id: "catalog-taraneem-27",
    titleHint: "وقائلة والدمع سكب مبادر",
    poetHint: "عمرو بن الحارث",
    mizanPoemId: "248314",
    mizanUrl: "https://mizanalarab.com/poem/248314",
    youtubeUrl: "https://www.youtube.com/watch?v=--lWB0Sf1ec",
    reciterId: "taraneem",
  },
  {
    id: "catalog-taraneem-28",
    titleHint: "وقائلة لما أردت وداعها",
    poetHint: "بهاء الدين زهير",
    mizanPoemId: "248315",
    mizanUrl: "https://mizanalarab.com/poem/248315",
    youtubeUrl: "https://www.youtube.com/watch?v=iRZ7U9oGfJ4",
    reciterId: "taraneem",
  },
  {
    id: "catalog-taraneem-29",
    titleHint: "يا سالب القلب مني عندما رمقا",
    poetHint: "أبو البقاء الرندي",
    mizanPoemId: "248316",
    mizanUrl: "https://mizanalarab.com/poem/248316",
    youtubeUrl: "https://www.youtube.com/watch?v=VD0qa-zc5vo",
    reciterId: "taraneem",
  },
  {
    id: "catalog-taraneem-30",
    titleHint: "خليلي ليلى قرة العين فاطلبا",
    poetHint: "قيس بن الملوح (مجنون ليلى)",
    mizanPoemId: "248317",
    mizanUrl: "https://mizanalarab.com/poem/248317",
    youtubeUrl: "https://www.youtube.com/watch?v=Tv9fbKlAqvw",
    reciterId: "taraneem",
  },
];
