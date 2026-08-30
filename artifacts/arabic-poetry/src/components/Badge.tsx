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
    gold: "text-accent-700 border border-accent-700 bg-parchment-200 font-bold",
    charcoal: "text-ink-800 border border-ink-500 bg-parchment-100",
    success: "text-green-800 border border-green-800 bg-green-50",
    warning: "text-amber-800 border border-amber-800 bg-amber-50",
    danger: "text-red-800 border border-red-800 bg-red-50",
    outline: "text-ink-700 border border-parchment-300 bg-transparent",
  };

  const sizeStyles = {
    sm: "text-[12px] px-2 py-0.5",
    md: "text-[14px] px-3 py-1",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 transition-colors whitespace-nowrap font-ui shadow-sm rounded-none",
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
    >
      {children}
    </span>
  );
};
