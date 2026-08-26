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
    gold: "bg-gold-500/15 text-gold-400 border border-gold-500/30",
    charcoal: "bg-charcoal-800 text-parchment-200 border border-charcoal-700",
    success: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
    warning: "bg-amber-500/15 text-amber-300 border border-amber-500/30",
    danger: "bg-rose-500/15 text-rose-400 border border-rose-500/30",
    outline: "bg-transparent text-parchment-300 border border-charcoal-700",
  };

  const sizeStyles = {
    sm: "text-xs px-2 py-0.5 rounded-md",
    md: "text-sm px-2.5 py-1 rounded-lg",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-medium transition-colors",
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
    >
      {children}
    </span>
  );
};
