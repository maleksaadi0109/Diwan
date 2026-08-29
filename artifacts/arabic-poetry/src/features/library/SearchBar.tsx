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
      <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-[#6C7A8C] group-focus-within:text-[#D4AF37] transition-colors">
        <Search className="w-5 h-5" strokeWidth={1.75} />
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-[#14171E]/90 text-[#F8F9FA] placeholder-[#6C7A8C] border border-white/[0.08] rounded-xl pr-12 pl-12 py-3 text-sm font-sans tracking-wide focus:outline-none focus:border-[#D4AF37]/60 focus:ring-2 focus:ring-[#D4AF37]/20 transition-all duration-300 shadow-inner backdrop-blur-md"
      />
      {value && (
        <button
          onClick={() => onChange("")}
          className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-[#A0AAB7] hover:text-[#F3E19C] transition-colors"
          title="مسح البحث"
        >
          <div className="bg-white/[0.08] hover:bg-white/[0.15] p-1.5 rounded-full transition-colors">
            <X className="w-3.5 h-3.5" strokeWidth={2} />
          </div>
        </button>
      )}
    </div>
  );
};
