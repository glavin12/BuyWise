// Settings forms as pure functions: profile, category and payee drafts,
// validation and patches. Mirrors the goal/transaction form pattern (draft
// holds text, a validate function parses it once). Import-free or explicit
// .ts siblings so `npm test` can run it.

import { categoryHue, HUES, type Hue } from "./categoryStyle.ts";
import { diffFields } from "./ledger.ts";
import type {
  Category,
  CategoryCreate,
  CategoryType,
  CategoryUpdate,
  Payee,
  ProfileUpdate,
  UserProfile,
} from "./types";

// ── Profile ─────────────────────────────────────────────────────

export const PROFILE_NAME_MAX = 255; // backend ProfileUpdate.full_name

// Same list the web offers (frontend/app/(dashboard)/settings/page.tsx).
export const CURRENCY_OPTIONS: readonly { value: string; label: string }[] = [
  { value: "INR", label: "INR — Indian Rupee (₹)" },
  { value: "USD", label: "USD — US Dollar ($)" },
  { value: "EUR", label: "EUR — Euro (€)" },
  { value: "GBP", label: "GBP — British Pound (£)" },
];

// A short curated list: Hermes (the Expo Go JS engine) may lack
// Intl.supportedValuesOf, which the web uses for the full IANA list.
export const TIMEZONE_OPTIONS: readonly { value: string; label: string }[] = [
  { value: "Asia/Kolkata", label: "Asia/Kolkata" },
  { value: "UTC", label: "UTC" },
  { value: "Europe/London", label: "Europe/London" },
  { value: "America/New_York", label: "America/New_York" },
  { value: "America/Los_Angeles", label: "America/Los_Angeles" },
  { value: "Asia/Dubai", label: "Asia/Dubai" },
  { value: "Asia/Singapore", label: "Asia/Singapore" },
  { value: "Australia/Sydney", label: "Australia/Sydney" },
];

/** The curated list, plus the profile's current zone if it isn't already in it. */
export function timezoneOptions(current: string): readonly { value: string; label: string }[] {
  return TIMEZONE_OPTIONS.some((z) => z.value === current) ? TIMEZONE_OPTIONS : [...TIMEZONE_OPTIONS, { value: current, label: current }];
}

export type ProfileDraft = { name: string; currency: string; timezone: string };

export function profileDraftFromProfile(profile: UserProfile): ProfileDraft {
  return { name: profile.full_name ?? "", currency: profile.currency, timezone: profile.timezone };
}

export type ProfileErrors = { name?: string };

export function validateProfileDraft(draft: ProfileDraft): { name: string; errors: ProfileErrors } {
  const name = draft.name.trim();
  const errors: ProfileErrors = {};
  if (name.length > PROFILE_NAME_MAX) errors.name = `Keep the name under ${PROFILE_NAME_MAX} characters.`;
  return { name, errors };
}

/** PATCH body: only what changed from the profile as opened. */
export function profileEditPatch(profile: UserProfile, draft: ProfileDraft, name: string): ProfileUpdate {
  const patch: ProfileUpdate = {};
  if (name !== (profile.full_name ?? "")) patch.full_name = name;
  if (draft.currency !== profile.currency) patch.currency = draft.currency;
  if (draft.timezone !== profile.timezone) patch.timezone = draft.timezone;
  return patch;
}

/** A stable fingerprint of the form, so "dirty" ignores object identity. */
export function profileDraftKey(draft: ProfileDraft): string {
  return JSON.stringify([draft.name.trim(), draft.currency, draft.timezone]);
}

// ── Categories ──────────────────────────────────────────────────

export const CATEGORY_NAME_MAX = 100; // backend CategoryCreate.name
export const CATEGORY_ICON_MAX = 32; // backend CategoryCreate.icon

export type CategoryDraft = { name: string; icon: string; hue: Hue; type: CategoryType };

export function emptyCategoryDraft(type: CategoryType): CategoryDraft {
  return { name: "", icon: "", hue: "coral", type };
}

export function categoryDraftFromCategory(category: Category): CategoryDraft {
  return { name: category.name, icon: category.icon ?? "", hue: categoryHue(category.name, category.color), type: category.type };
}

export type CategoryErrors = { name?: string };

export function validateCategoryDraft(draft: CategoryDraft): { name: string; errors: CategoryErrors } {
  const name = draft.name.trim();
  const errors: CategoryErrors = {};
  if (!name) errors.name = "Give the category a name.";
  else if (name.length > CATEGORY_NAME_MAX) errors.name = `Keep the name under ${CATEGORY_NAME_MAX} characters.`;
  return { name, errors };
}

export function toCategoryCreate(draft: CategoryDraft, name: string): CategoryCreate {
  const icon = draft.icon.trim();
  return { name, type: draft.type, color: HUES[draft.hue].bar, ...(icon ? { icon } : {}) };
}

// Compared by hue, not by the stored hex: an uncoloured category (color null,
// hue derived from its name) must not gain an explicit color on an unrelated
// save, only when the swatch actually changes.
type CategoryFields = { name: string; icon: string | null; hue: Hue };
const categoryFieldsOf = (category: Category): CategoryFields => ({
  name: category.name,
  icon: category.icon,
  hue: categoryHue(category.name, category.color),
});

/** PATCH body: only what changed (type is fixed and never sent). */
export function categoryEditPatch(category: Category, draft: CategoryDraft, name: string): CategoryUpdate {
  const diff = diffFields(categoryFieldsOf(category), { name, icon: draft.icon.trim() || null, hue: draft.hue });
  const patch: CategoryUpdate = {};
  if (diff.name !== undefined) patch.name = diff.name;
  if (diff.icon !== undefined) patch.icon = diff.icon;
  if (diff.hue !== undefined) patch.color = HUES[draft.hue].bar;
  return patch;
}

export function categoryDraftKey(draft: CategoryDraft): string {
  return JSON.stringify([draft.name.trim(), draft.icon.trim(), draft.hue, draft.type]);
}

// ── Payees ──────────────────────────────────────────────────────

export const PAYEE_NAME_MAX = 255; // backend PayeeCreate.name / PayeeUpdate.name

export type PayeeDraft = { name: string; type: CategoryType };

export function emptyPayeeDraft(type: CategoryType): PayeeDraft {
  return { name: "", type };
}

export function payeeDraftFromPayee(payee: Payee): PayeeDraft {
  return { name: payee.name, type: payee.type };
}

export type PayeeErrors = { name?: string };

export function validatePayeeDraft(draft: PayeeDraft): { name: string; errors: PayeeErrors } {
  const name = draft.name.trim();
  const errors: PayeeErrors = {};
  if (!name) errors.name = "Give the payee a name.";
  else if (name.length > PAYEE_NAME_MAX) errors.name = `Keep the name under ${PAYEE_NAME_MAX} characters.`;
  return { name, errors };
}

export function payeeDraftKey(draft: PayeeDraft): string {
  return JSON.stringify([draft.name.trim(), draft.type]);
}

// ── Shared: create-returns-existing detection ──────────────────
// POST /categories and POST /payees return the existing active row when the
// name (case-insensitive) already exists instead of failing, so the caller
// can tell "created" from "already had this one" by checking beforehand.

export function findByName<T extends { name: string }>(items: readonly T[], name: string): T | undefined {
  const needle = name.trim().toLowerCase();
  return items.find((item) => item.name.toLowerCase() === needle);
}
