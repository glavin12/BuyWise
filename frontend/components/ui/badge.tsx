/**
 * Badge — status badges for account types, cleared status, priorities, etc.
 */
import { cn } from "@/lib/utils";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "danger" | "info" | "neutral";
  className?: string;
}

const variants = {
  default: "bg-[#E4E0D2] text-[#4A4033]",
  success: "bg-[#E9F5EE] text-[#3E7A5A]",
  warning: "bg-[#FBF1D8] text-[#8A6B24]",
  danger: "bg-[#FCE9E5] text-[#B93D28]",
  info: "bg-[#E7EFF9] text-[#3F6A9A]",
  neutral: "bg-[#E4E0D2] text-[#4A4033]",
};

export function Badge({
  children,
  variant = "default",
  className,
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-medium rounded-full",
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
