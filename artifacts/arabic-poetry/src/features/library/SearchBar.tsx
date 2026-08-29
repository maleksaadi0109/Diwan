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
      <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-ink-500 group-focus-within:text-accent-700 transition-colors">
        <Search className="w-5 h-5" strokeWidth={1.5} />
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-paper-200 text-ink-900 placeholder-ink-500 border border-paper-400 rounded-none pr-10 pl-10 py-2.5 text-[15px] font-ui focus:outline-none focus:border-accent-700 focus:ring-1 focus:ring-accent-700 transition-colors"
      />
      {value && (
        <button
          onClick={() => onChange("")}
          className="absolute inset-y-0 left-0 pl-3 flex items-center text-ink-500 hover:text-accent-700 transition-colors"
          title="مسح البحث"
        >
          <div className="hover:bg-paper-300 p-1 rounded-none transition-colors">
            <X className="w-4 h-4" strokeWidth={2} />
          </div>
        </button>
      )}
    </div>
  );
};
