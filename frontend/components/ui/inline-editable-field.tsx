/**
 * InlineEditableField — DESIGN.md §6
 *
 * Click-to-edit for budget amounts and transaction inline edit.
 * Click the number → input appears → Enter saves, Esc cancels.
 */
"use client";

import { useState, useRef, useEffect, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";

interface InlineEditableFieldProps {
  value: string;
  onSave: (newValue: string) => void;
  type?: "text" | "number";
  className?: string;
  displayClassName?: string;
  inputClassName?: string;
  prefix?: string;
  placeholder?: string;
}

export function InlineEditableField({
  value,
  onSave,
  type = "text",
  className,
  displayClassName,
  inputClassName,
  prefix,
  placeholder,
}: InlineEditableFieldProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const handleSave = () => {
    setEditing(false);
    if (draft !== value) {
      onSave(draft);
    }
  };

  const handleCancel = () => {
    setEditing(false);
    setDraft(value);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleCancel();
    }
  };

  if (editing) {
    return (
      <div className={cn("inline-flex items-center", className)}>
        {prefix && (
          <span className="text-sm text-zinc-400 mr-1">{prefix}</span>
        )}
        <input
          ref={inputRef}
          type={type}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={cn(
            "bg-zinc-900 border border-emerald-500/50 rounded px-2 py-1 text-sm text-zinc-100 tabular-nums",
            "focus:outline-none focus:ring-1 focus:ring-emerald-500/50",
            "w-24",
            inputClassName
          )}
          step={type === "number" ? "0.01" : undefined}
        />
      </div>
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className={cn(
        "tabular-nums cursor-pointer hover:bg-zinc-800 rounded px-1.5 py-0.5 -mx-1.5 transition-colors",
        displayClassName,
        className
      )}
      title="Click to edit"
    >
      {prefix}
      {value || placeholder || "—"}
    </button>
  );
}
