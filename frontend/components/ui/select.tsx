/**
 * Select — styled select matching the Input design.
 */
import { forwardRef, type SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, id, options, placeholder, ...props }, ref) => {
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
        <select
          ref={ref}
          id={id}
          className={cn(
            "w-full px-3.5 py-2.5 text-sm bg-surface border border-border rounded-xl",
            "text-primary",
            "focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40",
            "transition-all duration-200 cursor-pointer",
            error && "border-negative focus:ring-negative/40 focus:border-negative",
            className
          )}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && <p className="text-xs text-negative">{error}</p>}
      </div>
    );
  }
);

Select.displayName = "Select";

export { Select };
