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
    gold: "bg-crimson-800/10 text-crimson-800 border border-crimson-800/20",
    charcoal: "bg-sand-200 text-ink-800 border border-sand-300",
    success: "bg-emerald-100 text-emerald-800 border border-emerald-300",
    warning: "bg-amber-100 text-amber-800 border border-amber-300",
    danger: "bg-rose-100 text-rose-800 border border-rose-300",
    outline: "bg-transparent text-ink-600 border border-sand-400",
  };

  const sizeStyles = {
    sm: "text-[11px] px-2 py-0.5 rounded-full font-sans tracking-wide",
    md: "text-xs px-3 py-1 rounded-full font-sans tracking-wide",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-medium transition-colors whitespace-nowrap",
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
    >
      {children}
    </span>
  );
};
