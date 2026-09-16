/**
 * Combobox — searchable dropdown with inline "+ Add new" creation.
 *
 * Used by QuickAddModal for Category and Payee: both need search/filter over
 * a growing list, a clear selected-value display, and a way to create a new
 * item without leaving the form. Native <select> can't do any of that, so
 * this is a small custom widget built on the same tokens as Select/Input
 * rather than a new dependency.
 */
"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { AlertCircle, ChevronDown, Loader2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ComboboxOption {
  value: string;
  label: string;
  icon?: string | null;
}

interface ComboboxProps {
  label?: ReactNode;
  options: ComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  emptyMessage?: string;
  onCreate?: (name: string) => void | Promise<void>;
  creating?: boolean;
  createLabel?: (query: string) => string;
  disabled?: boolean;
}

export function Combobox({
  label,
  options,
  value,
  onChange,
  placeholder = "Select...",
  searchPlaceholder = "Search...",
  loading,
  error,
  onRetry,
  emptyMessage = "No results",
  onCreate,
  creating,
  createLabel,
  disabled,
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  const trimmedQuery = query.trim();
  const exactMatch = filtered.some(
    (o) => o.label.toLowerCase() === trimmedQuery.toLowerCase()
  );
  const canCreate = !!onCreate && trimmedQuery.length > 0 && !exactMatch;
  const rowCount = filtered.length + (canCreate ? 1 : 0);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setHighlight(0);
    const t = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [open]);

  const selectIndex = (index: number) => {
    if (index < filtered.length) {
      onChange(filtered[index].value);
      setOpen(false);
    } else if (canCreate && onCreate) {
      Promise.resolve(onCreate(trimmedQuery)).then(() => setOpen(false));
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!open) {
      if (e.key === "Enter" || e.key === "ArrowDown" || e.key === " ") {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, Math.max(rowCount - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (rowCount > 0) selectIndex(highlight);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  };

  return (
    <div className="space-y-1.5" ref={rootRef}>
      {label && <label className="block text-sm font-medium text-primary">{label}</label>}
      <div className="relative">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((o) => !o)}
          onKeyDown={handleKeyDown}
          className={cn(
            "w-full flex items-center gap-2 px-3.5 py-2.5 text-sm bg-surface border border-border rounded-xl text-left",
            "focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all",
            disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer"
          )}
        >
          {selected ? (
            <span className="flex items-center gap-1.5 text-primary truncate">
              {selected.icon && <span className="leading-none">{selected.icon}</span>}
              {selected.label}
            </span>
          ) : (
            <span className="text-secondary/60 truncate">{placeholder}</span>
          )}
          <ChevronDown className="w-3.5 h-3.5 text-secondary ml-auto shrink-0" />
        </button>

        {open && (
          <div className="absolute z-20 top-full mt-1 w-full bg-surface border border-border rounded-xl shadow-lg overflow-hidden">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setHighlight(0);
              }}
              onKeyDown={handleKeyDown}
              placeholder={searchPlaceholder}
              className="w-full px-3.5 py-2.5 text-sm bg-surface border-b border-border text-primary placeholder:text-secondary/60 focus:outline-none"
            />
            <div className="max-h-52 overflow-y-auto">
              {loading ? (
                <div className="flex items-center gap-2 px-3.5 py-3 text-sm text-secondary">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…
                </div>
              ) : error ? (
                <div className="px-3.5 py-3 text-sm text-negative space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {error}
                  </div>
                  {onRetry && (
                    <button
                      type="button"
                      onClick={onRetry}
                      className="text-xs underline cursor-pointer"
                    >
                      Retry
                    </button>
                  )}
                </div>
              ) : (
                <>
                  {filtered.length === 0 && !canCreate && (
                    <div className="px-3.5 py-3 text-sm text-secondary">{emptyMessage}</div>
                  )}
                  {filtered.map((o, i) => (
                    <button
                      key={o.value}
                      type="button"
                      onMouseEnter={() => setHighlight(i)}
                      onClick={() => selectIndex(i)}
                      className={cn(
                        "w-full flex items-center gap-2 text-left px-3.5 py-2.5 text-sm text-primary cursor-pointer",
                        i === highlight && "bg-surface-hover"
                      )}
                    >
                      {o.icon && <span className="leading-none">{o.icon}</span>}
                      <span className="truncate">{o.label}</span>
                    </button>
                  ))}
                  {canCreate && (
                    <button
                      type="button"
                      onMouseEnter={() => setHighlight(filtered.length)}
                      onClick={() => selectIndex(filtered.length)}
                      disabled={creating}
                      className={cn(
                        "w-full flex items-center gap-1.5 text-left px-3.5 py-2.5 text-sm text-primary font-medium border-t border-border cursor-pointer disabled:opacity-60",
                        filtered.length === highlight && "bg-surface-hover"
                      )}
                    >
                      <Plus className="w-3.5 h-3.5 shrink-0" />
                      {creating
                        ? "Adding…"
                        : createLabel
                          ? createLabel(trimmedQuery)
                          : `Add "${trimmedQuery}"`}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
