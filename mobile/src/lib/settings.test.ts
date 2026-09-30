import assert from "node:assert/strict";
import { test } from "node:test";

import {
  CATEGORY_NAME_MAX,
  CURRENCY_OPTIONS,
  categoryDraftFromCategory,
  categoryDraftKey,
  categoryEditPatch,
  currencyOptions,
  currencyTag,
  displayName,
  emptyCategoryDraft,
  emptyPayeeDraft,
  findByName,
  PAYEE_NAME_MAX,
  payeeDraftFromPayee,
  payeeDraftKey,
  payeeInitial,
  pickIcon,
  PROFILE_NAME_MAX,
  profileDraftFromProfile,
  profileDraftKey,
  profileEditPatch,
  regionLabel,
  sinceLabel,
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

test("currencyOptions keeps the four as-is, and appends a saved currency that is not one of them", () => {
  assert.equal(currencyOptions("USD").length, CURRENCY_OPTIONS.length);
  const withExtra = currencyOptions("AED");
  assert.equal(withExtra.length, CURRENCY_OPTIONS.length + 1);
  assert.deepEqual(withExtra.at(-1), { value: "AED", label: "AED" });
});

// ── Profile tab ─────────────────────────────────────────────────

test("displayName is the full name, else the part of the email before the @", () => {
  assert.equal(displayName("  Bhagy Parmar ", "b@dau.ac.in"), "Bhagy Parmar");
  assert.equal(displayName(null, "bhagy@dau.ac.in"), "bhagy");
  assert.equal(displayName("   ", "bhagy@dau.ac.in"), "bhagy");
  assert.equal(displayName(null, undefined), "");
});

test("sinceLabel names the month and year, and is empty for a bad date", () => {
  assert.equal(sinceLabel("2026-08-15T12:00:00Z"), "since Aug 2026");
  assert.equal(sinceLabel("not a date"), "");
});

test("regionLabel shows the code, its symbol and the zone; an unknown code has no symbol to show", () => {
  assert.equal(currencyTag("INR"), "INR ₹");
  assert.equal(regionLabel("INR", "Asia/Kolkata"), "INR ₹ · Asia/Kolkata");
  assert.equal(regionLabel("USD", "UTC"), "USD $ · UTC");
  assert.equal(regionLabel("AED", "Asia/Dubai"), "AED · Asia/Dubai");
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

test("toCategoryCreate saves the picked glyph's key as the icon", () => {
  assert.equal(toCategoryCreate({ name: "Chai", icon: "coffee", hue: "amber", type: "expense" }, "Chai").icon, "coffee");
});

test("a new category starts with no icon", () => {
  assert.equal(emptyCategoryDraft("income").icon, "");
});

test("pickIcon chooses a glyph, switches to another, and clears when the chosen one is tapped again", () => {
  assert.equal(pickIcon("", "coffee"), "coffee");
  assert.equal(pickIcon("coffee", "fuel"), "fuel");
  assert.equal(pickIcon("coffee", "coffee"), "");
  assert.equal(pickIcon("🍕", "coffee"), "coffee"); // an older emoji icon is simply replaced
});

test("categoryEditPatch is empty when nothing changed, even for an uncoloured category", () => {
  const c = category({ name: "Food", icon: null, color: null }); // hue falls back to the seeded "coral"
  const draft = categoryDraftFromCategory(c);
  assert.deepEqual(categoryEditPatch(c, draft, "Food"), {});
});

test("categoryEditPatch carries only what changed, and color only when the hue changed", () => {
  const c = category({ name: "Food", icon: null, color: null });
  const draft = categoryDraftFromCategory(c);
  const iconPatch = categoryEditPatch(c, { ...draft, icon: "coffee" }, "Food");
  assert.deepEqual(iconPatch, { icon: "coffee" });
  const huePatch = categoryEditPatch(c, { ...draft, hue: "sky" }, "Food");
  assert.deepEqual(huePatch, { color: "#6FA8DC" });
  assert.ok(!("type" in huePatch));
});

test("categoryEditPatch clears a saved icon with null, and leaves an untouched older emoji icon alone", () => {
  const withKey = category({ icon: "food" });
  assert.deepEqual(categoryEditPatch(withKey, { ...categoryDraftFromCategory(withKey), icon: "" }, "Food"), { icon: null });
  const withEmoji = category({ icon: "🍕" });
  assert.deepEqual(categoryEditPatch(withEmoji, categoryDraftFromCategory(withEmoji), "Food"), {});
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

test("payeeInitial is the first character upper-cased, whole for an emoji, and ? for a blank name", () => {
  assert.equal(payeeInitial("  swiggy"), "S");
  assert.equal(payeeInitial("7-Eleven"), "7");
  assert.equal(payeeInitial("🍕 Pizza"), "🍕");
  assert.equal(payeeInitial("   "), "?");
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
