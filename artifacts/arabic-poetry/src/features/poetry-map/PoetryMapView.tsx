import React, { useState, useMemo } from "react";
import { Poem, Era } from "@/types";
import { POETRY_REGIONS, POETRY_MAP_POETS, MAP_CONNECTIONS, RegionId } from "@/data/poetryMapData";
import { cn, toArabicDigits } from "@/lib/utils";
import { Map as MapIcon, Feather, ChevronLeft, MapPin } from "lucide-react";

interface PoetryMapViewProps {
  poems: Poem[];
  onOpenPoem: (poem: Poem) => void;
}

const ALL_ERAS: Era[] = ['جاهلي', 'إسلامي', 'أموي', 'عباسي', 'أندلسي', 'مملوكي', 'عثماني', 'حديث', 'معاصر'];

export const PoetryMapView: React.FC<PoetryMapViewProps> = ({ poems, onOpenPoem }) => {
  const [selectedRegionId, setSelectedRegionId] = useState<RegionId | null>(null);
  const [selectedEra, setSelectedEra] = useState<Era | 'الكل'>('الكل');

  const selectedRegion = useMemo(() => 
    POETRY_REGIONS.find(r => r.id === selectedRegionId) || null
  , [selectedRegionId]);

  const filteredPoets = useMemo(() => {
    let list = POETRY_MAP_POETS;
    if (selectedRegionId) {
      list = list.filter(p => p.regionId === selectedRegionId);
    }
    if (selectedEra !== 'الكل') {
      list = list.filter(p => p.era === selectedEra);
    }
    return list;
  }, [selectedRegionId, selectedEra]);

  // Find user's poems that match the poet names
  const matchedPoemsByPoet = useMemo(() => {
    const map = new Map<string, Poem[]>();
    for (const poet of POETRY_MAP_POETS) {
      const poetMatches = poems.filter(p => 
        p.poet.name.includes(poet.name) || poet.name.includes(p.poet.name)
      );
      map.set(poet.id, poetMatches);
    }
    return map;
  }, [poems]);

  // For visual heat/active state on the map
  const activeRegions = useMemo(() => {
    if (selectedEra === 'الكل') return new Set(POETRY_REGIONS.map(r => r.id));
    const regionsWithPoetsInEra = POETRY_MAP_POETS.filter(p => p.era === selectedEra).map(p => p.regionId);
    return new Set(regionsWithPoetsInEra);
  }, [selectedEra]);

  return (
    <div className="flex flex-col md:flex-row h-full w-full bg-charcoal-950 overflow-hidden" data-testid="poetry-map-view">
      {/* Map Area */}
      <div className="flex-1 relative overflow-hidden flex flex-col items-center justify-center bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-charcoal-800 to-charcoal-950 border-b md:border-b-0 md:border-l border-white/5">
        <svg 
          viewBox="0 0 1000 1000" 
          className="w-full h-full max-h-[800px] object-contain drop-shadow-2xl"
          preserveAspectRatio="xMidYMid meet"
          aria-label="خريطة تفاعلية لأقاليم الشعر العربي"
        >
          <defs>
            <radialGradient id="nodeGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="var(--color-accent-700)" stopOpacity="0.4" />
              <stop offset="100%" stopColor="var(--color-accent-700)" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="nodeGlowActive" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="var(--color-accent-500)" stopOpacity="0.8" />
              <stop offset="100%" stopColor="var(--color-accent-500)" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Connections */}
          {MAP_CONNECTIONS.map(([r1Id, r2Id]) => {
            const r1 = POETRY_REGIONS.find(r => r.id === r1Id);
            const r2 = POETRY_REGIONS.find(r => r.id === r2Id);
            if (!r1 || !r2) return null;
            
            const isBothActive = activeRegions.has(r1.id) && activeRegions.has(r2.id);
            const isSelectedConnection = selectedRegionId && (selectedRegionId === r1.id || selectedRegionId === r2.id);

            return (
              <line
                key={`${r1Id}-${r2Id}`}
                x1={r1.cx}
                y1={r1.cy}
                x2={r2.cx}
                y2={r2.cy}
                stroke={isSelectedConnection ? "var(--color-accent-500)" : "var(--color-accent-700)"}
                strokeWidth={isSelectedConnection ? "2" : "1"}
                strokeDasharray="8 8"
                opacity={isBothActive ? (isSelectedConnection ? 0.6 : 0.2) : 0.05}
                className="transition-all duration-700 ease-out"
              />
            );
          })}

          {/* Nodes */}
          {POETRY_REGIONS.map((region) => {
            const isSelected = selectedRegionId === region.id;
            const isActive = activeRegions.has(region.id);
            
            return (
              <g 
                key={region.id}
                className={cn(
                  "cursor-pointer transition-all duration-300 outline-none", 
                  isActive ? "opacity-100" : "opacity-30 hover:opacity-70"
                )}
                onClick={() => setSelectedRegionId(isSelected ? null : region.id)}
                role="button"
                tabIndex={0}
                aria-pressed={isSelected}
                data-testid={`map-node-${region.id}`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedRegionId(isSelected ? null : region.id);
                  }
                }}
              >
                {/* Glow Background */}
                <circle 
                  cx={region.cx} 
                  cy={region.cy} 
                  r={isSelected ? 60 : 40} 
                  fill={`url(#${isSelected ? 'nodeGlowActive' : 'nodeGlow'})`}
                  className="transition-all duration-500"
                />
                
                {/* Core Dot */}
                <circle 
                  cx={region.cx} 
                  cy={region.cy} 
                  r={isSelected ? 8 : 6} 
                  fill={isSelected ? "var(--color-accent-400)" : "var(--color-accent-700)"}
                  className="transition-all duration-300"
                />
                
                {/* Outer Ring */}
                <circle 
                  cx={region.cx} 
                  cy={region.cy} 
                  r={isSelected ? 16 : 12} 
                  fill="none"
                  stroke={isSelected ? "var(--color-accent-500)" : "var(--color-accent-700)"}
                  strokeWidth="1.5"
                  className={cn("transition-all duration-300", isSelected && "animate-ping opacity-20")}
                />

                {/* Label */}
                <text 
                  x={region.cx} 
                  y={region.cy + (isSelected ? 35 : 28)} 
                  textAnchor="middle" 
                  fill={isSelected ? "var(--color-parchment-50)" : "var(--color-parchment-200)"}
                  className={cn(
                    "font-heading transition-all duration-300 select-none",
                    isSelected ? "text-2xl font-bold text-shadow-gold" : "text-xl font-medium"
                  )}
                >
                  {region.name}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Overlay Filters Map Controls */}
        <div className="absolute top-6 right-6 left-6 flex justify-between items-start pointer-events-none">
          <div className="bg-charcoal-900/80 backdrop-blur-md border border-white/10 rounded-2xl p-4 shadow-xl pointer-events-auto max-w-sm">
            <h3 className="text-lg font-heading text-accent-500 mb-2 flex items-center gap-2">
              <MapIcon className="w-5 h-5" />
              أطلس الشعر العربي
            </h3>
            <p className="text-sm text-ink-400 font-ui leading-relaxed">
              استكشف المدارس الشعرية وأبرز الشعراء عبر الأقاليم الجغرافية والعصور التاريخية المختلفة.
            </p>
          </div>
        </div>
      </div>

      {/* Sidebar Details Panel */}
      <div className="w-full md:w-[400px] lg:w-[480px] h-[50vh] md:h-full bg-charcoal-850 flex flex-col shrink-0 border-t md:border-t-0 border-white/5 z-10 shadow-[-10px_0_30px_rgba(0,0,0,0.5)]">
        {/* Era Filter (always visible) */}
        <div className="p-5 border-b border-white/5 shrink-0 bg-charcoal-900/50">
          <h4 className="text-xs font-bold text-ink-500 uppercase tracking-widest mb-3">تصفية حسب العصر</h4>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedEra('الكل')}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-bold font-ui transition-all cursor-pointer",
                selectedEra === 'الكل' 
                  ? "bg-accent-700 text-charcoal-950" 
                  : "bg-charcoal-800 text-ink-400 hover:bg-white/10 hover:text-parchment-100 border border-white/5"
              )}
            >
              الكل
            </button>
            {ALL_ERAS.map(era => (
              <button
                key={era}
                onClick={() => setSelectedEra(era)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-bold font-ui transition-all cursor-pointer",
                  selectedEra === era 
                    ? "bg-accent-700 text-charcoal-950" 
                    : "bg-charcoal-800 text-ink-400 hover:bg-white/10 hover:text-parchment-100 border border-white/5"
                )}
              >
                {era}
              </button>
            ))}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {selectedRegion ? (
            <div className="animate-fade-in space-y-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-accent-500">
                  <MapPin className="w-5 h-5" />
                  <h2 className="text-3xl font-heading font-bold">{selectedRegion.name}</h2>
                </div>
                <p className="text-ink-300 font-ui leading-relaxed text-sm">
                  {selectedRegion.description}
                </p>
              </div>

              {filteredPoets.length > 0 ? (
                <div className="space-y-4">
                  <h3 className="text-lg font-heading text-parchment-100 border-b border-white/5 pb-2">
                    أبرز الشعراء
                  </h3>
                  <div className="space-y-4">
                    {filteredPoets.map(poet => {
                      const matchedPoems = matchedPoemsByPoet.get(poet.id) || [];
                      
                      return (
                        <div key={poet.id} className="bg-charcoal-800 rounded-2xl p-4 border border-white/5 space-y-3 transition-all hover:border-white/10">
                          <div className="flex justify-between items-start gap-4">
                            <div>
                              <h4 className="text-xl font-heading text-accent-400 font-bold">{poet.name}</h4>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-[10px] bg-white/5 text-ink-400 px-2 py-0.5 rounded-full border border-white/5">
                                  {poet.era}
                                </span>
                                {poet.school && (
                                  <span className="text-[10px] bg-accent-700/10 text-accent-600 px-2 py-0.5 rounded-full border border-accent-700/20">
                                    {poet.school}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          <p className="text-sm text-ink-300 font-ui leading-relaxed">
                            {poet.bio}
                          </p>

                          {matchedPoems.length > 0 ? (
                            <div className="pt-3 mt-3 border-t border-white/5 space-y-2">
                              <h5 className="text-xs font-bold text-ink-500 flex items-center gap-1.5">
                                <Feather className="w-3.5 h-3.5" />
                                قصائد في مكتبتك ({toArabicDigits(matchedPoems.length)})
                              </h5>
                              <div className="flex flex-col gap-1.5">
                                {matchedPoems.map(poem => (
                                  <button
                                    key={poem.id}
                                    onClick={() => onOpenPoem(poem)}
                                    className="flex items-center justify-between p-2 rounded-xl bg-charcoal-900 border border-white/5 hover:bg-white/5 hover:border-white/10 transition-colors text-right cursor-pointer group"
                                  >
                                    <span className="text-sm font-ui text-parchment-200 group-hover:text-accent-500 truncate transition-colors">
                                      {poem.title}
                                    </span>
                                    <ChevronLeft className="w-4 h-4 text-ink-600 group-hover:text-accent-500 shrink-0 transition-colors" />
                                  </button>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div className="pt-3 mt-3 border-t border-white/5 flex items-center gap-2 text-xs text-ink-600">
                              <Feather className="w-3.5 h-3.5 opacity-50" />
                              <span>لا توجد قصائد متاحة حالياً في مكتبتك.</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="py-12 text-center text-ink-500 font-ui text-sm border border-dashed border-white/10 rounded-2xl">
                  لا يوجد شعراء مدرجون في هذا العصر لهذا الإقليم.
                </div>
              )}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center text-ink-500 space-y-4 opacity-50">
              <MapIcon className="w-12 h-12 text-ink-600" strokeWidth={1} />
              <p className="font-ui text-sm max-w-[200px] leading-relaxed">
                اختر إقليماً من الخريطة لاستكشاف تاريخه الشعري وأبرز أعلامه
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
