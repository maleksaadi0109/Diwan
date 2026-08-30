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
  placeholder = "ابحث بقصيدة، شاعر، أو شطر...",
}) => {
  return (
    <div className="relative w-full group">
      <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-ink-500 group-focus-within:text-accent-700 transition-colors">
        <Search className="w-4.5 h-4.5" strokeWidth={2} />
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-white/5 text-parchment-100 placeholder-ink-600 border border-white/10 rounded-xl pr-11 pl-10 py-2.5 text-sm font-sans focus:outline-none focus:border-accent-700 focus:bg-white/10 transition-colors"
        aria-label={placeholder}
      />
      {value && (
        <button
          onClick={() => onChange("")}
          className="absolute inset-y-0 left-0 pl-3 flex items-center text-ink-500 hover:text-parchment-100 transition-colors focus-visible:outline-none focus-visible:text-accent-700"
          title="مسح البحث"
          aria-label="مسح البحث"
        >
          <div className="hover:bg-white/10 p-1.5 rounded-lg transition-colors">
            <X className="w-4 h-4" strokeWidth={2.5} />
          </div>
        </button>
      )}
    </div>
  );
};
