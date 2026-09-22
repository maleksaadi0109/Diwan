import React from "react";
import { LucideIcon } from "lucide-react";

interface VideoSidebarCardProps {
  title: string;
  icon?: LucideIcon;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

export function VideoSidebarCard({ title, icon: Icon, children, defaultOpen = true }: VideoSidebarCardProps) {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);

  return (
    <section className="bg-charcoal-900 border border-white/5 rounded-xl overflow-hidden shadow-sm flex flex-col shrink-0">
      <button 
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="px-4 py-3 border-b border-white/5 bg-white/[0.02] flex items-center justify-between hover:bg-white/[0.04] transition-colors w-full text-right"
      >
        <div className="flex items-center gap-2">
          {Icon && <Icon className="w-4 h-4 text-ink-400" />}
          <h3 className="text-sm font-bold text-ink-300">{title}</h3>
        </div>
        <div className={`w-4 h-4 border-l-2 border-b-2 border-ink-500 transform transition-transform ${isOpen ? "rotate-45 -translate-y-1" : "-rotate-45 translate-x-1"}`} style={{ width: '8px', height: '8px' }} />
      </button>
      
      {isOpen && (
        <div className="p-4 flex flex-col gap-5">
          {children}
        </div>
      )}
    </section>
  );
}
