import { Era, PoetryRegionId } from "../types";

export type RegionId = PoetryRegionId;

export interface MapRegion {
  id: RegionId;
  name: string;
  description: string;
  cx: number;
  cy: number;
}

export interface MapPoet {
  id: string;
  name: string;
  regionId: RegionId;
  era: Era;
  school?: string;
  bio: string;
  country?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
}

export const POETRY_REGIONS: MapRegion[] = [
  {
    id: 'andalusia',
    name: 'الأندلس',
    description: 'فردوس الشعر المفقود، موطن الموشحات والزجل ووصف الطبيعة الساحرة.',
    cx: 150,
    cy: 250
  },
  {
    id: 'maghreb',
    name: 'المغرب العربي',
    description: 'ملتقى القوافل ومعبر الثقافات، امتاز شعره بالرقة والتأمل والعمق الصوفي.',
    cx: 250,
    cy: 420
  },
  {
    id: 'egypt',
    name: 'مصر',
    description: 'كنانة الله، ازدهر فيها الشعر في العصرين المملوكي والحديث، وموطن مدرسة الإحياء والبعث.',
    cx: 450,
    cy: 450
  },
  {
    id: 'levant',
    name: 'الشام',
    description: 'ربوع الجمال ومنبت الحضارات، مهد الشعر العباسي المجدد ومدارس الشعر المعاصر.',
    cx: 600,
    cy: 300
  },
  {
    id: 'iraq',
    name: 'العراق',
    description: 'حاضرة الخلافة العباسية وبغداد الشعر، منبع التجديد اللغوي والشعر الحر.',
    cx: 750,
    cy: 280
  },
  {
    id: 'hijaz',
    name: 'الحجاز',
    description: 'مهد الإسلام ومنطلق الدعوة، امتاز بشعر الدعوة والمديح النبوي والغزل العذري.',
    cx: 650,
    cy: 550
  },
  {
    id: 'najd',
    name: 'نجد',
    description: 'قلب الجزيرة العربية وموطن المعلقات والشعر الجاهلي الأصيل، حيث الخيام والفروسية.',
    cx: 820,
    cy: 500
  },
  {
    id: 'yemen',
    name: 'اليمن',
    description: 'اليمن السعيد، أصل العرب ومنبع القصيدة الأولى، يتميز بعمق مفرداته وأصالته.',
    cx: 750,
    cy: 750
  }
];

export const MAP_CONNECTIONS: [RegionId, RegionId][] = [
  ['andalusia', 'maghreb'],
  ['maghreb', 'egypt'],
  ['egypt', 'levant'],
  ['egypt', 'hijaz'],
  ['levant', 'iraq'],
  ['levant', 'hijaz'],
  ['hijaz', 'najd'],
  ['hijaz', 'yemen'],
  ['najd', 'iraq'],
  ['najd', 'yemen']
];

export const POETRY_MAP_POETS: MapPoet[] = [
  { id: 'ibn-zaydun', name: 'ابن زيدون', regionId: 'andalusia', era: 'أندلسي', school: 'الشعر الأندلسي', bio: 'أعظم شعراء قرطبة، اشتهر بقصة حبه لولادة بنت المستكفي ونونيته الشهيرة.' },
  { id: 'ibn-khafaja', name: 'ابن خفاجة', regionId: 'andalusia', era: 'أندلسي', school: 'الشعر الأندلسي', bio: 'شاعر أندلسي لُقب بصنوبر الأندلس لكثرة وصفه للطبيعة والرياض.' },
  { id: 'al-mutanabbi', name: 'المتنبي', regionId: 'iraq', era: 'عباسي', school: 'صنعة الشعر', bio: 'أحمد بن الحسين، مالئ الدنيا وشاغل الناس. من أعظم شعراء العربية، اتسم شعره بالحكمة وقوة الصياغة.' },
  { id: 'abu-nuwas', name: 'أبو نواس', regionId: 'iraq', era: 'عباسي', school: 'الشعر العباسي', bio: 'الحسن بن هانئ، شاعر العراق في العصر العباسي وأحد أشهر شعراء الخمر والمجون.' },
  { id: 'badr-shakir', name: 'بدر شاكر السياب', regionId: 'iraq', era: 'معاصر', school: 'الشعر الحر (التفعيلة)', bio: 'من رواد التجديد في الشعر العربي المعاصر ومؤسسي الشعر الحر.' },
  { id: 'jawahiri', name: 'محمد مهدي الجواهري', regionId: 'iraq', era: 'حديث', school: 'الكلاسيكية الجديدة', bio: 'شاعر العرب الأكبر في العصر الحديث، امتازت قصائده بقوة السبك وجزالة اللفظ.' },
  { id: 'abu-tammam', name: 'أبو تمام', regionId: 'levant', era: 'عباسي', school: 'صنعة الشعر', bio: 'حبيب بن أوس الطائي، من أمراء الشعر في العصر العباسي، امتاز بجزالة اللفظ وعمق المعنى.' },
  { id: 'al-buhturi', name: 'البحتري', regionId: 'levant', era: 'عباسي', school: 'ديباجة الشعر', bio: 'أحد أشهر شعراء العصر العباسي، عُرف بروعة أسلوبه وجمال سبكه في الوصف والمديح.' },
  { id: 'nizar-qabbani', name: 'نزار قباني', regionId: 'levant', era: 'معاصر', school: 'الشعر الحديث', bio: 'دبلوماسي وشاعر سوري، من أبرز شعراء العصر الحديث، لُقب بشاعر المرأة.' },
  { id: 'ahmed-shawqi', name: 'أحمد شوقي', regionId: 'egypt', era: 'حديث', school: 'الكلاسيكية الجديدة', bio: 'أمير الشعراء، رائد المسرح الشعري العربي، ورمز مدرسة الإحياء والبعث.' },
  { id: 'hafez-ibrahim', name: 'حافظ إبراهيم', regionId: 'egypt', era: 'حديث', school: 'الكلاسيكية الجديدة', bio: 'شاعر النيل، عُرف بشعره الوطني والاجتماعي القريب من نبض الشعب.' },
  { id: 'hassan-ibn-thabit', name: 'حسان بن ثابت', regionId: 'hijaz', era: 'إسلامي', school: 'شعر الدعوة', bio: 'شاعر الرسول ﷺ، دافع عن الإسلام بقصائده وكان له دور بارز في صدر الإسلام.' },
  { id: 'umar-ibn-abi-rabia', name: 'عمر بن أبي ربيعة', regionId: 'hijaz', era: 'أموي', school: 'الغزل الحضري', bio: 'من أشهر شعراء الغزل في العصر الأموي، امتازت قصائده بالقصص الغرامية الحوارية.' },
  { id: 'imru-al-qais', name: 'امرؤ القيس', regionId: 'najd', era: 'جاهلي', school: 'المعلقات', bio: 'الملك الضليل، أمير شعراء الجاهلية وأول من وقف على الأطلال واستبكى.' },
  { id: 'antarah', name: 'عنترة بن شداد', regionId: 'najd', era: 'جاهلي', school: 'المعلقات', bio: 'فارس بني عبس وشاعرها، صاحب إحدى المعلقات السبع، اشتهر بالغزل العفيف بشيمة عبلة والبطولة.' },
  { id: 'al-khansa', name: 'الخنساء', regionId: 'najd', era: 'إسلامي', school: 'الرثاء', bio: 'شاعرة مخضرمة أدركت الجاهلية والإسلام، اشتهرت برثاء أخويها صخر ومعاوية.' },
  { id: 'waddah', name: 'وضاح اليمن', regionId: 'yemen', era: 'أموي', school: 'الغزل', bio: 'عبد الرحمن بن إسماعيل الخولاني، شاعر غزل يماني اشتهر بجماله ونهايته التراجيدية.' },
  { id: 'al-shabbi', name: 'أبو القاسم الشابي', regionId: 'maghreb', era: 'حديث', school: 'الرومانسية', bio: 'شاعر الخضراء (تونس)، من رواد الشعر الحديث والرومانسي في المغرب العربي، صاحب "إرادة الحياة".' }
];