import { cn } from "@/lib/utils";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "glass" | "elevated";
}

export function Card({ children, className, variant = "default" }: CardProps) {
  const variants = {
    default: "bg-surface border border-border shadow-sm",
    glass: "glass",
    elevated: "bg-surface border border-border shadow-md shadow-black/20",
  };

  return (
    <div className={cn("rounded-xl p-5", variants[variant], className)}>
      {children}
    </div>
  );
}
