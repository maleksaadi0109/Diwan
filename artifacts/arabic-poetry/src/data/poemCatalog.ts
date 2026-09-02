/**
 * Curated "ready to download" poem catalog.
 *
 * Each entry pairs a poem's text on Mizan Al-Arab (mizanalarab.com) with an
 * audio recitation on YouTube (Alqimmah Studio / استوديو القمة, mostly
 * recited by Osama Al-Wa'ez). Tapping a catalog card runs the same
 * text+audio import pipeline as the manual wizard (see
 * ImportQueueContext.processPoemImportJob), just pre-filled from this data
 * instead of user input.
 *
 * mizanPoemId values were confirmed against mizanalarab.com's own search
 * (GET /poems?q=...) -- mizanalarab.com hosts several duplicate pages for
 * some classical poems, so the id here is a manually verified pick, not
 * just "the first result". YouTube links were provided directly by the app
 * owner and their titles were fetched with yt-dlp to confirm identity
 * before matching (verified 2026-09-02).
 */

export interface CatalogPoemEntry {
  /** Stable key for this catalog entry, independent of the Mizan poem id. */
  id: string;
  /** First hemistich / common title, shown on the card before download. */
  titleHint: string;
  poetHint: string;
  mizanPoemId: string;
  mizanUrl: string;
  youtubeUrl: string;
}

export const POEM_CATALOG: CatalogPoemEntry[] = [
  {
    id: "catalog-mutanabbi-laaynayk",
    titleHint: "لعينيك ما يلقى الفؤاد وما لقي",
    poetHint: "أبو الطيب المتنبي",
    mizanPoemId: "35820",
    mizanUrl: "https://mizanalarab.com/poem/35820",
    youtubeUrl: "https://www.youtube.com/watch?v=y6CKU_ob1xU",
  },
  {
    id: "catalog-hilli-sali-rimah",
    titleHint: "سلي الرماح العوالي عن معالينا",
    poetHint: "صفي الدين الحلي",
    mizanPoemId: "45269",
    mizanUrl: "https://mizanalarab.com/poem/45269",
    youtubeUrl: "https://www.youtube.com/watch?v=KTiiwdaL7ac",
  },
  {
    id: "catalog-almuqarrab-manal-ala",
    titleHint: "منال العلى بالمرهفات القواضب",
    poetHint: "ابن المقرّب العيوني",
    mizanPoemId: "7537",
    mizanUrl: "https://mizanalarab.com/poem/7537",
    youtubeUrl: "https://www.youtube.com/watch?v=Ad44riH5CgI",
  },
  {
    id: "catalog-kaab-banat-suad",
    titleHint: "بانت سعاد فقلبي اليوم متبول",
    poetHint: "كعب بن زهير",
    mizanPoemId: "8569",
    mizanUrl: "https://mizanalarab.com/poem/8569",
    youtubeUrl: "https://www.youtube.com/watch?v=5hdN4hWWw4A",
  },
  {
    id: "catalog-mutanabbi-bim-altaalul",
    titleHint: "بم التعلل لا أهل ولا وطن",
    poetHint: "أبو الطيب المتنبي",
    mizanPoemId: "35943",
    mizanUrl: "https://mizanalarab.com/poem/35943",
    youtubeUrl: "https://www.youtube.com/watch?v=4P8B3jUlMRg",
  },
  {
    id: "catalog-mutanabbi-maqsura",
    titleHint: "ألا كل ماشية الخيزلى (المقصورة)",
    poetHint: "أبو الطيب المتنبي",
    mizanPoemId: "35679",
    mizanUrl: "https://mizanalarab.com/poem/35679",
    youtubeUrl: "https://www.youtube.com/watch?v=FS6yzxsvFao",
  },
  {
    id: "catalog-imruulqais-tatawal",
    titleHint: "تطاول ليلك بالأثمد",
    poetHint: "امرؤ القيس",
    mizanPoemId: "12302",
    mizanUrl: "https://mizanalarab.com/poem/12302",
    youtubeUrl: "https://www.youtube.com/watch?v=ykvJqlT_rYg",
  },
  {
    id: "catalog-abualatahiya-yaslam",
    titleHint: "يسلم المرء أخوه",
    poetHint: "أبو العتاهية",
    mizanPoemId: "42881",
    mizanUrl: "https://mizanalarab.com/poem/42881",
    youtubeUrl: "https://www.youtube.com/watch?v=NAmc74KK7JI",
  },
  {
    id: "catalog-almalik-alamjad-albaan",
    titleHint: "على البان قمرية تسجع",
    poetHint: "الملك الأمجد",
    mizanPoemId: "53174",
    mizanUrl: "https://mizanalarab.com/poem/53174",
    youtubeUrl: "https://www.youtube.com/watch?v=W2Oxo9Xjv5I",
  },
  {
    id: "catalog-ibnzurayq-la-taadhliyh",
    titleHint: "لا تعذليه فإن العذل يولعه",
    poetHint: "ابن زريق البغدادي",
    mizanPoemId: "21876",
    mizanUrl: "https://mizanalarab.com/poem/21876",
    youtubeUrl: "https://www.youtube.com/watch?v=Jl8h2g7lDiY",
  },
  {
    id: "catalog-antara-hakkim-suyufak",
    titleHint: "حكِّم سيوفك في رقاب العذَّل",
    poetHint: "عنترة بن شداد",
    mizanPoemId: "4152",
    mizanUrl: "https://mizanalarab.com/poem/4152",
    youtubeUrl: "https://www.youtube.com/watch?v=IQp9zjvSUOA",
  },
];
