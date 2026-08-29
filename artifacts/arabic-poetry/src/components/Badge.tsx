import React from "react";
import { cn } from "@/lib/utils";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "gold" | "charcoal" | "success" | "warning" | "danger" | "outline";
  className?: string;
  size?: "sm" | "md";
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = "charcoal",
  className,
  size = "sm",
}) => {
  const variantStyles = {
    gold: "bg-[#D4AF37]/15 text-[#F3E19C] border border-[#D4AF37]/30 shadow-[0_0_12px_rgba(212,175,55,0.15)]",
    charcoal: "bg-white/[0.06] text-[#CED4DA] border border-white/10 hover:bg-white/[0.1]",
    success: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.15)]",
    warning: "bg-amber-500/15 text-amber-300 border border-amber-500/30",
    danger: "bg-rose-500/15 text-rose-300 border border-rose-500/30",
    outline: "bg-transparent text-[#A0AAB7] border border-white/15",
  };

  const sizeStyles = {
    sm: "text-[11px] px-2.5 py-0.5 rounded-full font-sans tracking-wide",
    md: "text-xs px-3 py-1 rounded-full font-sans tracking-wide",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-medium transition-all whitespace-nowrap backdrop-blur-sm",
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
    >
      {children}
    </span>
  );
};
