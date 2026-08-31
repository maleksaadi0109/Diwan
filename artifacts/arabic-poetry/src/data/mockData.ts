import { Poem, Poet } from "@/types";

export const MOCK_POETS: Record<string, Poet> = {
  mutanabbi: {
    id: "mutanabbi",
    name: "أبو الطيب المتنبي",
    era: "عباسي",
    bio: "أحمد بن الحسين الكندي الكوفي، حكيم الشعراء وأحد مفاخر الأدب العربي وصاحب الأمثال السائرة.",
    birthYear: "303 هـ / 915 م",
    deathYear: "354 هـ / 965 م",
  },
  imru_alqais: {
    id: "imru_alqais",
    name: "امرؤ القيس",
    era: "جاهلي",
    bio: "امرؤ القيس بن حجر الكندي، أمير شعراء العصر الجاهلي وصاحب أشهر معلقة في الشعر العربي.",
    birthYear: "نحو 130 ق.هـ",
    deathYear: "نحو 80 ق.هـ",
  },
  abu_firas: {
    id: "abu_firas",
    name: "أبو فراس الحمداني",
    era: "عباسي",
    bio: "الحارث بن سعيد بن حمدان الحمداني التغلبي، أمير وشاعر وفارس وقائد عسكري عباسي.",
    birthYear: "320 هـ / 932 م",
    deathYear: "357 هـ / 968 م",
  },
};

export const MOCK_POEMS: Poem[] = [];

export const mockPoems = MOCK_POEMS;
export const mockPoets = MOCK_POETS;
