import React from "react";
import { Poet, PoetryRegionId } from "@/types";
import { POETRY_REGIONS } from "@/data/poetryMapData";

export type PoetGeography = Pick<
  Poet,
  "country" | "city" | "latitude" | "longitude" | "regionId" | "school"
>;

interface PoetGeographyFieldsProps {
  value: PoetGeography;
  onChange: (value: PoetGeography) => void;
  compact?: boolean;
}

export const PoetGeographyFields: React.FC<PoetGeographyFieldsProps> = ({
  value,
  onChange,
  compact = false,
}) => {
  const set = <K extends keyof PoetGeography>(key: K, next: PoetGeography[K]) =>
    onChange({ ...value, [key]: next });
  const inputClass =
    "w-full bg-charcoal-950 text-parchment-100 placeholder-ink-600 border border-white/10 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-accent-700";

  return (
    <fieldset className={compact ? "space-y-3" : "md:col-span-2 space-y-3 border-t border-white/5 pt-5"}>
      <legend className="text-sm font-bold text-ink-400 mb-2">الموقع والمدرسة الأدبية</legend>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input className={inputClass} value={value.country || ""} onChange={(e) => set("country", e.target.value)} placeholder="البلد، مثال: العراق" />
        <input className={inputClass} value={value.city || ""} onChange={(e) => set("city", e.target.value)} placeholder="المدينة، مثال: بغداد" />
        <select className={inputClass} value={value.regionId || ""} onChange={(e) => set("regionId", (e.target.value || undefined) as PoetryRegionId | undefined)}>
          <option value="">اختر المنطقة على الخريطة</option>
          {POETRY_REGIONS.map((region) => <option key={region.id} value={region.id}>{region.name}</option>)}
        </select>
        <input className={inputClass} value={value.school || ""} onChange={(e) => set("school", e.target.value)} placeholder="المدرسة الأدبية" />
        <input className={inputClass} type="number" step="any" dir="ltr" value={value.latitude ?? ""} onChange={(e) => set("latitude", e.target.value === "" ? undefined : Number(e.target.value))} placeholder="خط العرض" />
        <input className={inputClass} type="number" step="any" dir="ltr" value={value.longitude ?? ""} onChange={(e) => set("longitude", e.target.value === "" ? undefined : Number(e.target.value))} placeholder="خط الطول" />
      </div>
      <p className="text-[11px] text-ink-600">اختيار المنطقة مطلوب لظهور الشاعر على الخريطة. الإحداثيات تحفظ موقعه الدقيق.</p>
    </fieldset>
  );
};