import { cn } from "@/lib/utils";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  /** default = cream surface card. `flat` drops padding (for tables/lists). */
  variant?: "default" | "flat";
}

export function Card({ children, className, variant = "default" }: CardProps) {
  return (
    <div
      className={cn(
        "bg-surface border border-border rounded-[18px]",
        variant === "default" && "p-5",
        className
      )}
    >
      {children}
    </div>
  );
}
