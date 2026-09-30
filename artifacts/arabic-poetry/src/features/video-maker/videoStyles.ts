export const VIDEO_FONTS = [
  { id: "amiri", label: "أميري", description: "شعر كلاسيكي", family: '"Diwan Amiri", serif' },
  { id: "cairo", label: "القاهرة", description: "واضح وحديث", family: '"Diwan Cairo", sans-serif' },
  { id: "scheherazade", label: "شهرزاد", description: "حروف تراثية", family: '"Diwan Scheherazade", serif' },
] as const;

export const VIDEO_PALETTES = [
  { id: "gold", label: "ذهب الليل", background: "#101217", secondary: "#393021", accent: "#e6c779", text: "#fff5de" },
  { id: "rose", label: "ورد الغروب", background: "#21101c", secondary: "#663c53", accent: "#f2b4c7", text: "#fff0f5" },
  { id: "midnight", label: "أزرق المساء", background: "#0d162b", secondary: "#304873", accent: "#a9c9fc", text: "#eef5ff" },
  { id: "emerald", label: "أخضر عميق", background: "#081e1b", secondary: "#27554b", accent: "#abd8bb", text: "#effbf2" },
] as const;

export const VIDEO_MOTIONS = [
  { id: "rise", label: "صعود ناعم" },
  { id: "fade", label: "ظهور هادئ" },
  { id: "zoom", label: "اقتراب سينمائي" },
  { id: "none", label: "بدون حركة" },
] as const;

export interface VideoStyle {
  font: typeof VIDEO_FONTS[number]["id"];
  palette: typeof VIDEO_PALETTES[number]["id"];
  motion: typeof VIDEO_MOTIONS[number]["id"];
  lineHeight: number;
  safeArea: boolean;
  showProgress: boolean;
  signature: string;
}

export const DEFAULT_VIDEO_STYLE: VideoStyle = {
  font: "amiri",
  palette: "gold",
  motion: "rise",
  lineHeight: 1.65,
  safeArea: true,
  showProgress: true,
  signature: "",
};

export function getVideoFont(style: VideoStyle) {
  return VIDEO_FONTS.find(font => font.id === style.font) || VIDEO_FONTS[0];
}

export function getVideoPalette(style: VideoStyle) {
  return VIDEO_PALETTES.find(palette => palette.id === style.palette) || VIDEO_PALETTES[0];
}

export async function loadVideoFonts(style: VideoStyle) {
  if (typeof document === "undefined" || !document.fonts) return;
  const fonts = [getVideoFont(style).family, VIDEO_FONTS[1].family];
  await Promise.all(fonts.map(family => document.fonts.load(`700 64px ${family}`, "قصيدة")));
}