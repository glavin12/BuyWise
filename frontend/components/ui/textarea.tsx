import { forwardRef, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, id, ...props }, ref) => {
    return (
      <div className="space-y-1.5">
        {label && (
          <label
            htmlFor={id}
            className="block text-sm font-medium text-primary"
          >
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={id}
          className={cn(
            "w-full px-3.5 py-2.5 text-sm bg-surface border border-border rounded-xl",
            "text-primary placeholder:text-secondary/60",
            "focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40",
            "transition-all duration-200 resize-none",
            error && "border-negative focus:ring-negative/40 focus:border-negative",
            className
          )}
          {...props}
        />
        {error && <p className="text-xs text-negative">{error}</p>}
      </div>
    );
  }
);

Textarea.displayName = "Textarea";

export { Textarea };
