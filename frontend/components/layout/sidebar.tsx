/**
 * Sidebar — colorful-cream shell (see BuyWise Colorful.dc.html).
 *
 * Cream rail (#EDE4CE) with a coloured icon tile per section, "Every rupee, a
 * job." tagline, a black "+ Add transaction" pill, and a gradient-avatar user
 * footer. "Accounts" is now "Balance" (single-balance backend). Desktop rail +
 * mobile slide-over + bottom tab bar.
 */
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { api } from "@/lib/api";
import { QuickAddModal } from "@/components/quick-add/quick-add-modal";

const navItems = [
  { href: "/dashboard", label: "Dashboard", glyph: "◉", tile: "#FF6F5C", badge: "" },
  { href: "/transactions", label: "Transactions", glyph: "≡", tile: "#F2C14E", badge: "" },
  { href: "/budget", label: "Budget", glyph: "◧", tile: "#6FCF97", badge: "" },
  { href: "/accounts", label: "Balance", glyph: "▤", tile: "#6FA8DC", badge: "" },
  { href: "/goals", label: "Goals", glyph: "◆", tile: "#A46FCF", badge: "" },
  { href: "/reports", label: "Reports", glyph: "▲", tile: "#E48BB0", badge: "" },
  { href: "/chat", label: "Chat", glyph: "✦", tile: "#5EC5C1", badge: "AI" },
  { href: "/settings", label: "Settings", glyph: "⚙", tile: "#C7BFA8", badge: "" },
];

const bottomNav = [
  { href: "/dashboard", label: "Home", glyph: "◉" },
  { href: "/transactions", label: "Activity", glyph: "≡" },
  { href: "/budget", label: "Budget", glyph: "◧" },
  { href: "/chat", label: "Chat", glyph: "✦" },
];

function initialsFrom(name: string | null, email: string): string {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/);
    return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [name, setName] = useState<string | null>(null);
  const [email, setEmail] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (active && user?.email) setEmail(user.email);
      try {
        const profile = await api.getProfile();
        if (active) setName(profile.full_name);
      } catch {
        /* profile optional */
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  const content = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <Link href="/dashboard" className="flex items-center gap-2.5 px-2 pt-1.5 pb-5">
        <div className="relative w-[34px] h-[34px] rounded-[10px] bg-primary flex items-center justify-center">
          <div className="w-3.5 h-3.5 rounded-full bg-[#FF6F5C]" />
          <div className="absolute -right-0.5 -bottom-0.5 w-3 h-3 rounded-full bg-[#F2C14E] border-2 border-sidebar" />
        </div>
        <div>
          <div className="font-semibold text-base tracking-tight text-primary">BuyWise</div>
          <div className="text-[11px] text-secondary">Every rupee, a job.</div>
        </div>
      </Link>

      {/* Add transaction */}
      <button
        onClick={() => {
          setQuickAddOpen(true);
          setMobileOpen(false);
        }}
        className="mx-1 mb-3.5 flex items-center gap-2 rounded-xl bg-primary px-3.5 py-2.5 text-sm font-medium text-background cursor-pointer hover:bg-accent-hover transition-colors"
      >
        <span className="inline-flex h-[18px] w-[18px] items-center justify-center rounded-full bg-[#FF6F5C] text-sm font-bold text-primary">
          +
        </span>
        Add transaction
        <span className="ml-auto mono rounded bg-[#2A2620] px-1.5 py-0.5 text-[10px] text-[#B8AC8F]">
          A
        </span>
      </button>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5">
        {navItems.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-background text-primary"
                  : "text-tertiary hover:bg-border"
              )}
            >
              <span
                className="inline-flex h-[22px] w-[22px] items-center justify-center rounded-[7px] text-xs"
                style={{ backgroundColor: item.tile }}
              >
                {item.glyph}
              </span>
              {item.label}
              {item.badge && (
                <span className="ml-auto mono text-[10px] text-secondary">{item.badge}</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="mt-auto border-t border-border pt-3.5">
        <div className="flex items-center gap-2.5 px-1">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#FF6F5C] to-[#F2C14E] text-xs font-semibold text-white">
            {initialsFrom(name, email)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-medium text-primary">
              {name || "Your account"}
            </div>
            <div className="truncate text-[11px] text-secondary">{email}</div>
          </div>
          <button
            onClick={handleLogout}
            className="rounded-lg p-1.5 text-secondary hover:bg-border hover:text-negative transition-colors cursor-pointer"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 rounded-xl border border-border bg-surface p-2 cursor-pointer"
      >
        <Menu className="h-5 w-5 text-secondary" />
      </button>

      {/* Mobile slide-over */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-[264px] bg-sidebar border-r border-border p-4 shadow-xl">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-4 p-1 cursor-pointer"
            >
              <X className="h-5 w-5 text-secondary" />
            </button>
            {content}
          </div>
        </div>
      )}

      {/* Desktop rail */}
      <aside className="hidden lg:flex flex-col h-screen w-[248px] shrink-0 sticky top-0 bg-sidebar border-r border-border px-3.5 py-5">
        {content}
      </aside>

      {/* Mobile bottom tab bar */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-sidebar border-t border-border px-2 py-1 safe-bottom">
        <div className="flex items-center justify-around">
          {bottomNav.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 text-[10px] font-medium transition-colors",
                  active ? "text-primary" : "text-secondary"
                )}
              >
                <span className="text-base leading-none">{item.glyph}</span>
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>

      <QuickAddModal open={quickAddOpen} onClose={() => setQuickAddOpen(false)} />
    </>
  );
}
