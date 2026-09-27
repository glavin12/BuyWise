import assert from "node:assert/strict";
import { test } from "node:test";

import {
  CATEGORY_NAME_MAX,
  categoryDraftFromCategory,
  categoryDraftKey,
  categoryEditPatch,
  emptyCategoryDraft,
  emptyPayeeDraft,
  findByName,
  PAYEE_NAME_MAX,
  payeeDraftFromPayee,
  payeeDraftKey,
  PROFILE_NAME_MAX,
  profileDraftFromProfile,
  profileDraftKey,
  profileEditPatch,
  TIMEZONE_OPTIONS,
  timezoneOptions,
  toCategoryCreate,
  validateCategoryDraft,
  validatePayeeDraft,
  validateProfileDraft,
} from "./settings.ts";
import type { Category, Payee, UserProfile } from "./types";

function profile(extra: Partial<UserProfile> = {}): UserProfile {
  return {
    id: "u1",
    full_name: "Ann",
    currency: "INR",
    income_type: null,
    salary_day: null,
    timezone: "Asia/Kolkata",
    onboarding_complete: true,
    savings_target_percent: null,
    investment_style: null,
    budget_alerts: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...extra,
  };
}

function category(extra: Partial<Category> = {}): Category {
  return {
    id: "c1",
    name: "Food",
    type: "expense",
    icon: null,
    color: null,
    is_active: true,
    created_at: null,
    updated_at: null,
    ...extra,
  };
}

function payee(extra: Partial<Payee> = {}): Payee {
  return { id: "p1", name: "Amazon", normalized_name: "amazon", type: "expense", created_at: null, updated_at: null, ...extra };
}

// ── Profile ─────────────────────────────────────────────────────

test("validateProfileDraft trims and accepts an empty name", () => {
  const { name, errors } = validateProfileDraft({ name: "  Ann  ", currency: "INR", timezone: "UTC" });
  assert.equal(name, "Ann");
  assert.deepEqual(errors, {});
  assert.deepEqual(validateProfileDraft({ name: "", currency: "INR", timezone: "UTC" }).errors, {});
});

test("validateProfileDraft rejects a name over the limit", () => {
  const { errors } = validateProfileDraft({ name: "x".repeat(PROFILE_NAME_MAX + 1), currency: "INR", timezone: "UTC" });
  assert.ok(errors.name);
});

test("profileEditPatch sends only the changed fields", () => {
  const p = profile();
  const draft = profileDraftFromProfile(p);
  assert.deepEqual(profileEditPatch(p, draft, "Ann"), {});
  assert.deepEqual(profileEditPatch(p, { ...draft, currency: "USD" }, "Ann"), { currency: "USD" });
  assert.deepEqual(profileEditPatch(p, draft, "Ben"), { full_name: "Ben" });
});

test("profileDraftKey ignores untrimmed whitespace", () => {
  assert.equal(profileDraftKey({ name: "Ann ", currency: "INR", timezone: "UTC" }), profileDraftKey({ name: "Ann", currency: "INR", timezone: "UTC" }));
});

test("timezoneOptions keeps the curated list as-is when the zone is already in it", () => {
  assert.equal(timezoneOptions("Asia/Kolkata").length, TIMEZONE_OPTIONS.length);
});

test("timezoneOptions appends the profile's zone when it's missing", () => {
  const withExtra = timezoneOptions("Pacific/Auckland");
  assert.equal(withExtra.length, TIMEZONE_OPTIONS.length + 1);
  assert.ok(withExtra.some((z) => z.value === "Pacific/Auckland"));
});

// ── Categories ──────────────────────────────────────────────────

test("validateCategoryDraft requires a name within the limit", () => {
  assert.ok(validateCategoryDraft(emptyCategoryDraft("expense")).errors.name);
  assert.ok(validateCategoryDraft({ name: "x".repeat(CATEGORY_NAME_MAX + 1), icon: "", hue: "coral", type: "expense" }).errors.name);
  assert.deepEqual(validateCategoryDraft({ name: "Snacks", icon: "", hue: "coral", type: "expense" }).errors, {});
});

test("toCategoryCreate omits a blank icon and saves the hue's bar hex", () => {
  const created = toCategoryCreate({ name: "Snacks", icon: "  ", hue: "mint", type: "expense" }, "Snacks");
  assert.equal(created.icon, undefined);
  assert.equal(created.color, "#6FCF97");
  assert.equal(created.type, "expense");
});

test("categoryEditPatch is empty when nothing changed, even for an uncoloured category", () => {
  const c = category({ name: "Food", icon: null, color: null }); // hue falls back to the seeded "coral"
  const draft = categoryDraftFromCategory(c);
  assert.deepEqual(categoryEditPatch(c, draft, "Food"), {});
});

test("categoryEditPatch carries only what changed, and color only when the hue changed", () => {
  const c = category({ name: "Food", icon: null, color: null });
  const draft = categoryDraftFromCategory(c);
  const iconPatch = categoryEditPatch(c, { ...draft, icon: "🍕" }, "Food");
  assert.deepEqual(iconPatch, { icon: "🍕" });
  const huePatch = categoryEditPatch(c, { ...draft, hue: "sky" }, "Food");
  assert.deepEqual(huePatch, { color: "#6FA8DC" });
  assert.ok(!("type" in huePatch));
});

test("categoryDraftKey changes with the hue", () => {
  const draft = emptyCategoryDraft("expense");
  assert.notEqual(categoryDraftKey(draft), categoryDraftKey({ ...draft, hue: "sky" }));
});

// ── Payees ──────────────────────────────────────────────────────

test("validatePayeeDraft requires a name within the limit", () => {
  assert.ok(validatePayeeDraft(emptyPayeeDraft("expense")).errors.name);
  assert.ok(validatePayeeDraft({ name: "x".repeat(PAYEE_NAME_MAX + 1), type: "expense" }).errors.name);
  const { name, errors } = validatePayeeDraft({ name: "  Uber  ", type: "expense" });
  assert.equal(name, "Uber");
  assert.deepEqual(errors, {});
});

test("payeeDraftFromPayee and payeeDraftKey round-trip", () => {
  const p = payee();
  assert.deepEqual(payeeDraftFromPayee(p), { name: "Amazon", type: "expense" });
  assert.equal(payeeDraftKey(payeeDraftFromPayee(p)), payeeDraftKey({ name: " Amazon ", type: "expense" }));
});

// ── Shared ──────────────────────────────────────────────────────

test("findByName matches case-insensitively and ignores surrounding whitespace", () => {
  const items = [category({ id: "a", name: "Food" }), category({ id: "b", name: "Travel" })];
  assert.equal(findByName(items, "  FOOD  ")?.id, "a");
  assert.equal(findByName(items, "Groceries"), undefined);
});
