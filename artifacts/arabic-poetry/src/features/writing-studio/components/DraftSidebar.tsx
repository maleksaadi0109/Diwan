import React from "react";
import { FileText, Plus, Copy, Trash2, Clock } from "lucide-react";
import { StudioDraft } from "../../../lib/studio/types";
import { cn } from "../../../lib/utils";

interface DraftSidebarProps {
  drafts: StudioDraft[];
  activeDraftId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
}

export const DraftSidebar: React.FC<DraftSidebarProps> = ({
  drafts,
  activeDraftId,
  onSelect,
  onCreate,
  onDuplicate,
  onDelete
}) => {
  return (
    <div className="w-64 flex flex-col bg-charcoal-900/50 border-r border-white/5 h-full shrink-0">
      <div className="p-4 border-b border-white/5 flex items-center justify-between">
        <h3 className="font-ui font-bold text-parchment-100 flex items-center gap-2">
          <FileText className="w-4 h-4 text-accent-700" />
          <span>مسودات القصائد</span>
        </h3>
        <button
          onClick={onCreate}
          className="p-1.5 rounded-lg bg-accent-700/10 text-accent-500 hover:bg-accent-700/20 transition-colors cursor-pointer"
          title="مسودة جديدة"
          data-testid="button-create-draft"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {drafts.map((draft) => {
          const isActive = draft.id === activeDraftId;
          const date = new Date(draft.updatedAt).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' });
          
          return (
            <div
              key={draft.id}
              className={cn(
                "group flex flex-col gap-1 p-2.5 rounded-xl cursor-pointer transition-all border",
                isActive 
                  ? "bg-white/10 border-white/10" 
                  : "bg-transparent border-transparent hover:bg-white/5 hover:border-white/5"
              )}
              onClick={() => onSelect(draft.id)}
              data-testid={`card-draft-${draft.id}`}
            >
              <div className="flex items-center justify-between">
                <span className="font-ui font-medium text-sm text-parchment-100 truncate w-full text-right">
                  {draft.title || "بدون عنوان"}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-ink-500">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {date}
                </span>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={(e) => { e.stopPropagation(); onDuplicate(draft.id); }}
                    className="p-1 rounded hover:text-parchment-100 hover:bg-white/10"
                    title="نسخ"
                    data-testid={`button-duplicate-${draft.id}`}
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button 
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      if(confirm("هل أنت متأكد من حذف هذه المسودة؟")) onDelete(draft.id);
                    }}
                    className="p-1 rounded hover:text-crimson-500 hover:bg-crimson-500/10"
                    title="حذف"
                    data-testid={`button-delete-${draft.id}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
