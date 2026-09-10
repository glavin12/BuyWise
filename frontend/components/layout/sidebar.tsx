/**
 * Sidebar — DESIGN.md §3 Information Architecture
 *
 * Seven primary sections: Dashboard, Transactions, Budget, Accounts, Goals,
 * Reports, Chat, Settings. Collapses to icon rail at <1024px per §7.
 * Bottom tab bar at <640px.
 *
 * Persistent "+ Add transaction" quick-add button.
 */
"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Receipt,
  PiggyBank,
  Landmark,
  Target,
  BarChart3,
  MessageSquare,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronLeft,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { QuickAddModal } from "@/components/quick-add/quick-add-modal";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/transactions", label: "Transactions", icon: Receipt },
  { href: "/budget", label: "Budget", icon: PiggyBank },
  { href: "/accounts", label: "Accounts", icon: Landmark },
  { href: "/goals", label: "Goals", icon: Target },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/chat", label: "Chat", icon: MessageSquare },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="p-4 border-b border-zinc-800">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-sm">B</span>
          </div>
          {!collapsed && (
            <span className="font-semibold text-lg text-zinc-100">
              BuyWise
            </span>
          )}
        </Link>
      </div>

      {/* Quick-add button — per §3 */}
      <div className="p-3">
        <button
          onClick={() => setQuickAddOpen(true)}
          className={cn(
            "w-full flex items-center gap-2 py-2.5 text-sm font-medium text-white bg-emerald-500 hover:bg-emerald-600 rounded-lg transition-all duration-200 cursor-pointer shadow-sm shadow-emerald-500/20",
            collapsed ? "justify-center px-0" : "px-3"
          )}
        >
          <Plus className="w-4 h-4 flex-shrink-0" />
          {!collapsed && "Add Transaction"}
        </button>
      </div>

      {/* Nav */}
      <nav className="px-3 space-y-0.5 flex-1">
        {navItems.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer",
                active
                  ? "bg-emerald-500/10 text-emerald-400"
                  : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
              )}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {!collapsed && item.label}
            </Link>
          );
        })}
      </nav>

      {/* Sign out */}
      <div className="p-3 border-t border-zinc-800 mt-auto">
        <button
          onClick={handleLogout}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200 cursor-pointer",
            collapsed && "justify-center"
          )}
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          {!collapsed && "Sign Out"}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-zinc-950 border border-zinc-800 rounded-lg shadow-sm cursor-pointer"
      >
        <Menu className="w-5 h-5 text-zinc-400" />
      </button>

      {/* Mobile slide-over */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full w-72 bg-zinc-950 border-r border-zinc-800 shadow-xl">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-4 p-1 cursor-pointer"
            >
              <X className="w-5 h-5 text-zinc-500" />
            </button>
            {sidebarContent}
          </div>
        </div>
      )}

      {/* Desktop sidebar — icon rail at collapsed per §7 */}
      <aside
        className={cn(
          "hidden lg:flex flex-col h-screen bg-zinc-950 border-r border-zinc-800 sticky top-0 transition-all duration-300",
          collapsed ? "w-[68px]" : "w-64"
        )}
      >
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-20 z-10 w-6 h-6 bg-zinc-950 border border-zinc-800 rounded-full flex items-center justify-center shadow-sm cursor-pointer hover:bg-zinc-900"
        >
          <ChevronLeft
            className={cn(
              "w-3.5 h-3.5 text-zinc-500 transition-transform",
              collapsed && "rotate-180"
            )}
          />
        </button>
        {sidebarContent}
      </aside>

      {/* Mobile bottom tab bar (< 640px) per §7 */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-zinc-950 border-t border-zinc-800 px-2 py-1 safe-bottom">
        <div className="flex items-center justify-around">
          {[
            { href: "/dashboard", icon: LayoutDashboard, label: "Home" },
            { href: "/transactions", icon: Receipt, label: "Transactions" },
            { href: "/budget", icon: PiggyBank, label: "Budget" },
            { href: "/chat", icon: MessageSquare, label: "Chat" },
          ].map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-0.5 py-1.5 px-3 rounded-lg text-[10px] font-medium transition-colors",
                  active ? "text-emerald-400" : "text-zinc-500"
                )}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Quick-add modal */}
      <QuickAddModal
        open={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
      />
    </>
  );
}
