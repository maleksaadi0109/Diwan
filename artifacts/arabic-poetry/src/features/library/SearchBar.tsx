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
    <div className="relative w-full">
      <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-ink-400">
        <Search className="w-5 h-5" strokeWidth={1.5} />
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-sand-50 text-ink-900 placeholder-ink-400 border border-sand-300 rounded-lg pr-11 pl-11 py-2.5 text-sm font-sans tracking-wide focus:outline-none focus:border-crimson-800 focus:ring-2 focus:ring-crimson-800/20 transition-all shadow-inner"
      />
      {value && (
        <button
          onClick={() => onChange("")}
          className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-ink-400 hover:text-crimson-700 transition-colors"
          title="مسح البحث"
        >
          <div className="bg-sand-200 p-1 rounded-full">
            <X className="w-3.5 h-3.5" strokeWidth={2} />
          </div>
        </button>
      )}
    </div>
  );
};
