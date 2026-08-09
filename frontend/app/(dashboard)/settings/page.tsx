"use client";

import { useEffect, useState } from "react";
import { Save, Check } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import type { UserProfile, ProfileUpdate } from "@/lib/types";

const incomeTypes = [
  { value: "salaried", label: "Salaried" },
  { value: "freelancer", label: "Freelancer" },
  { value: "business_owner", label: "Business Owner" },
  { value: "retired", label: "Retired" },
  { value: "other", label: "Other" },
];

const investmentStyles = [
  { value: "conservative", label: "Conservative" },
  { value: "moderate", label: "Moderate" },
  { value: "aggressive", label: "Aggressive" },
];

const currencies = [
  { value: "INR", label: "INR (\u20B9)" },
  { value: "USD", label: "USD ($)" },
  { value: "EUR", label: "EUR (\u20AC)" },
  { value: "GBP", label: "GBP (\u00A3)" },
];

export default function SettingsPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<ProfileUpdate>({
    full_name: "",
    currency: "INR",
    income_type: "salaried",
    salary_day: null,
    savings_target_percent: null,
    investment_style: "moderate",
    budget_alerts: true,
  });

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const data = await api.getProfile();
        setProfile(data);
        setForm({
          full_name: data.full_name || "",
          currency: data.currency,
          income_type: data.income_type || "salaried",
          salary_day: data.salary_day,
          savings_target_percent: data.savings_target_percent,
          investment_style: data.investment_style || "moderate",
          budget_alerts: data.budget_alerts,
        });
      } catch (err) {
        console.error("Failed to load profile:", err);
      } finally {
        setLoading(false);
      }
    };
    loadProfile();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      const updated = await api.updateProfile(form);
      setProfile(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  const updateForm = (key: keyof ProfileUpdate, value: unknown) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const selectClass =
    "w-full px-3.5 py-2.5 text-sm bg-input border border-border rounded-lg text-primary focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all duration-200";

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-primary">
            Settings
          </h1>
          <p className="text-sm text-muted mt-1">
            Manage your financial profile and preferences
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <h2 className="font-semibold text-primary mb-4">
              Personal Information
            </h2>
            <div className="space-y-4">
              <Input
                id="full_name"
                label="Full Name"
                placeholder="Your name"
                value={form.full_name || ""}
                onChange={(e) => updateForm("full_name", e.target.value)}
              />
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-primary">
                  Currency
                </label>
                <select
                  value={form.currency}
                  onChange={(e) => updateForm("currency", e.target.value)}
                  className={selectClass}
                >
                  {currencies.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </Card>

          <Card>
            <h2 className="font-semibold text-primary mb-4">
              Income Details
            </h2>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-primary">
                  Income Type
                </label>
                <select
                  value={form.income_type || "salaried"}
                  onChange={(e) => updateForm("income_type", e.target.value)}
                  className={selectClass}
                >
                  {incomeTypes.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              {form.income_type === "salaried" && (
                <Input
                  id="salary_day"
                  label="Salary Day (1-31)"
                  type="number"
                  min={1}
                  max={31}
                  placeholder="28"
                  value={form.salary_day?.toString() || ""}
                  onChange={(e) =>
                    updateForm(
                      "salary_day",
                      e.target.value ? parseInt(e.target.value) : null
                    )
                  }
                />
              )}
            </div>
          </Card>

          <Card>
            <h2 className="font-semibold text-primary mb-4">
              Savings & Investments
            </h2>
            <div className="space-y-4">
              <Input
                id="savings_target"
                label="Savings Target (%)"
                type="number"
                min={0}
                max={100}
                placeholder="20"
                value={form.savings_target_percent?.toString() || ""}
                onChange={(e) =>
                  updateForm(
                    "savings_target_percent",
                    e.target.value ? parseInt(e.target.value) : null
                  )
                }
              />
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-primary">
                  Investment Style
                </label>
                <select
                  value={form.investment_style || "moderate"}
                  onChange={(e) =>
                    updateForm("investment_style", e.target.value)
                  }
                  className={selectClass}
                >
                  {investmentStyles.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="budget_alerts"
                  checked={form.budget_alerts ?? true}
                  onChange={(e) => updateForm("budget_alerts", e.target.checked)}
                  className="w-4 h-4 text-accent bg-input border-border rounded focus:ring-accent/50 cursor-pointer"
                />
                <label
                  htmlFor="budget_alerts"
                  className="text-sm text-primary cursor-pointer"
                >
                  Enable budget alerts
                </label>
              </div>
            </div>
          </Card>

          {error && (
            <div className="p-3 bg-error/10 border border-error/20 rounded-lg">
              <p className="text-sm text-error">{error}</p>
            </div>
          )}

          <div className="flex items-center gap-3">
            <Button type="submit" loading={saving}>
              {saved ? (
                <>
                  <Check className="w-4 h-4" /> Saved
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" /> Save Changes
                </>
              )}
            </Button>
            {profile && (
              <p className="text-xs text-muted">
                Last updated:{" "}
                {new Date(profile.updated_at).toLocaleDateString()}
              </p>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
