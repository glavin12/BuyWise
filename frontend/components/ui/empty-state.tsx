/**
 * EmptyState — DESIGN.md §6
 *
 * Icon + one-line message + primary action. Used on every list screen before
 * any data exists, not just the dashboard.
 */
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-16 px-4 text-center",
        className
      )}
    >
      <div className="w-14 h-14 rounded-2xl bg-surface-hover border border-border flex items-center justify-center text-secondary mb-4">
        {icon}
      </div>
      <h3 className="text-base font-medium text-primary mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-secondary max-w-sm mb-4">{description}</p>
      )}
      {action && (
        <Button onClick={action.onClick} size="sm">
          {action.label}
        </Button>
      )}
    </div>
  );
}
