import React from "react";
import { Search, X } from "lucide-react";

interface SearchBarProps {
  value: string;
  onChange: (query: string) => void;
  placeholder?: string;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChange,
  placeholder = "ابحث بالقصيدة أو اسم الشاعر أو شطر بيت...",
}) => {
  return (
    <div className="relative w-full">
      <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-parchment-400">
        <Search className="w-4 h-4" />
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-charcoal-850 text-parchment-100 placeholder-parchment-400/60 border border-charcoal-700/80 rounded-xl pr-10 pl-10 py-2.5 text-sm focus:outline-none focus:border-gold-500/60 focus:ring-1 focus:ring-gold-500/40 transition-all"
      />
      {value && (
        <button
          onClick={() => onChange("")}
          className="absolute inset-y-0 left-0 pl-3 flex items-center text-parchment-400 hover:text-parchment-200"
          title="مسح البحث"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};
