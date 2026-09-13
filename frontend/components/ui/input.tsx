import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
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
        <input
          ref={ref}
          id={id}
          className={cn(
            "w-full px-3.5 py-2.5 text-sm bg-surface border border-border rounded-xl",
            "text-primary placeholder:text-secondary/60",
            "focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40",
            "transition-all duration-200",
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

Input.displayName = "Input";

export { Input };
