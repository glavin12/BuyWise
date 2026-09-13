/**
 * Tabs — animated tab bar for switching views.
 */
"use client";

import { cn } from "@/lib/utils";

interface Tab {
  id: string;
  label: string;
  count?: number;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (id: string) => void;
  className?: string;
}

export function Tabs({ tabs, activeTab, onChange, className }: TabsProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-0.5 bg-surface-hover border border-border rounded-xl p-1",
        className
      )}
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={cn(
            "px-3.5 py-1.5 text-sm font-medium rounded-lg transition-colors duration-200 cursor-pointer",
            activeTab === tab.id
              ? "bg-primary text-background"
              : "text-secondary hover:text-primary"
          )}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span
              className={cn(
                "ml-1.5 text-xs tabular-nums",
                activeTab === tab.id ? "text-background/70" : "text-secondary"
              )}
            >
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
