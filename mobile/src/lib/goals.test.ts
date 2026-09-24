import assert from "node:assert/strict";
import { test } from "node:test";

import {
  contributionPreview,
  countdown,
  emptyGoalDraft,
  featuredGoal,
  goalDraftFromGoal,
  goalDraftKey,
  goalEditPatch,
  justAchieved,
  placeGoal,
  percentOf,
  toGoalCreate,
  validateGoalDraft,
} from "./goals.ts";
import type { Goal, GoalsListResponse } from "./types";

function goal(extra: Partial<Goal> = {}): Goal {
  return {
    id: "g1",
    title: "Emergency fund",
    description: null,
    category_id: null,
    category: null,
    goal_type: "emergency_fund",
    priority: "medium",
    target_amount: 10000000,
    display_target_amount: 100000,
    current_amount: 2500000,
    display_current_amount: 25000,
    progress_percent: 25,
    remaining_amount: 7500000,
    display_remaining_amount: 75000,
    target_date: null,
    monthly_needed_to_hit_target: null,
    display_monthly_needed_to_hit_target: null,
    days_remaining_in_month: 6,
    status: "active",
    ...extra,
  };
}

test("featuredGoal: highest priority wins, ties keep list order", () => {
  const low = goal({ id: "low", priority: "low" });
  const med1 = goal({ id: "med1", priority: "medium" });
  const high1 = goal({ id: "high1", priority: "high" });
  const high2 = goal({ id: "high2", priority: "high" });
  const none = goal({ id: "none", priority: null });
  assert.equal(featuredGoal([low, med1, high1, high2])?.id, "high1");
  assert.equal(featuredGoal([low, med1])?.id, "med1");
  assert.equal(featuredGoal([none, low])?.id, "low");
  assert.equal(featuredGoal([goal({ id: "a", priority: "weird" }), none])?.id, "a"); // unknown ranks as none; first wins
  assert.equal(featuredGoal([]), undefined);
});

test("countdown: days left, due today, and Past due once the date has gone", () => {
  assert.deepEqual(countdown("2026-09-25", "2026-09-24"), { label: "1 day left", overdue: false });
  assert.deepEqual(countdown("2026-12-31", "2026-09-24"), { label: "98 days left", overdue: false });
  assert.deepEqual(countdown("2026-09-24", "2026-09-24"), { label: "Due today", overdue: false });
  assert.deepEqual(countdown("2026-09-23", "2026-09-24"), { label: "Past due", overdue: true });
  assert.equal(countdown(null, "2026-09-24"), null);
  assert.equal(countdown("not a date", "2026-09-24"), null);
});

test("percentOf and contributionPreview use integer maths and may pass 100", () => {
  assert.equal(percentOf(2500000, 10000000), 25);
  assert.equal(percentOf(1, 3), 33);
  assert.equal(percentOf(5, 0), 0);
  const preview = contributionPreview(2500000, 10000000, 8000000);
  assert.deepEqual(preview, { total: 10500000, percent: 105, achieves: true });
  assert.deepEqual(contributionPreview(2500000, 10000000, 100), { total: 2500100, percent: 25, achieves: false });
  assert.equal(contributionPreview(9999999, 10000000, 1).achieves, true); // exactly the target
});

test("justAchieved is true only for active -> completed", () => {
  assert.equal(justAchieved({ status: "active" }, { status: "completed" }), true);
  assert.equal(justAchieved({ status: "completed" }, { status: "completed" }), false);
  assert.equal(justAchieved({ status: "active" }, { status: "active" }), false);
  assert.equal(justAchieved({ status: "completed" }, { status: "active" }), false);
  assert.equal(justAchieved({ status: "active" }, { status: "archived" }), false);
});

test("validateGoalDraft: name, target and saved rules", () => {
  const valid = { ...emptyGoalDraft(), title: " Trip ", target: "60000", saved: "" };
  assert.deepEqual(validateGoalDraft(valid), { target: 6000000, saved: 0, errors: {} });
  assert.equal(validateGoalDraft({ ...valid, title: "  " }).errors.title, "Give the goal a name.");
  assert.equal(validateGoalDraft({ ...valid, target: "" }).errors.target, "Enter a target amount.");
  assert.equal(validateGoalDraft({ ...valid, target: "0" }).errors.target, "The target must be more than 0.");
  assert.equal(validateGoalDraft({ ...valid, target: "1e5" }).target, null);
  assert.equal(validateGoalDraft({ ...valid, saved: "12.5" }).saved, 1250);
  assert.match(validateGoalDraft({ ...valid, saved: "-1" }).errors.saved ?? "", /valid amount/);
  assert.match(validateGoalDraft({ ...valid, title: "x".repeat(256) }).errors.title ?? "", /under 255/);
});

test("toGoalCreate sends only what was filled in", () => {
  const draft = { ...emptyGoalDraft(), title: " Goa trip ", target: "60000", saved: "1000", type: "vacation" as const, date: "2027-01-15", description: " Beach " };
  assert.deepEqual(toGoalCreate(draft, 6000000, 100000), {
    title: "Goa trip",
    target_amount: 6000000,
    current_amount: 100000,
    goal_type: "vacation",
    priority: "medium",
    target_date: "2027-01-15",
    description: "Beach",
  });
  const bare = toGoalCreate({ ...emptyGoalDraft(), title: "Bare", target: "5", priority: null }, 500, 0);
  assert.deepEqual(bare, { title: "Bare", target_amount: 500, current_amount: 0 });
});

test("an unchanged goal edit is an empty patch; only changed fields are sent", () => {
  const g = goal({ description: "Six months of costs", target_date: "2027-03-01" });
  const draft = goalDraftFromGoal(g);
  assert.deepEqual(goalEditPatch(g, draft, g.target_amount, g.current_amount), {});
  assert.deepEqual(goalEditPatch(g, { ...draft, target: "80000" }, 8000000, g.current_amount), { target_amount: 8000000 });
  assert.deepEqual(goalEditPatch(g, { ...draft, date: null, priority: "high" }, g.target_amount, g.current_amount), {
    target_date: null,
    priority: "high",
  });
});

test("legacy goal values the API no longer accepts read as not set, so they are never re-sent", () => {
  const g = goal({ goal_type: "saving-for-house", priority: "urgent" });
  const draft = goalDraftFromGoal(g);
  assert.equal(draft.type, null);
  assert.equal(draft.priority, null);
  assert.deepEqual(goalEditPatch(g, draft, g.target_amount, g.current_amount), {});
});

test("goalDraftKey ignores whitespace-only edits", () => {
  const g = goal();
  assert.equal(goalDraftKey(goalDraftFromGoal(g)), goalDraftKey({ ...goalDraftFromGoal(g), title: "Emergency fund  " }));
  assert.notEqual(goalDraftKey(goalDraftFromGoal(g)), goalDraftKey({ ...goalDraftFromGoal(g), target: "1" }));
});

test("placeGoal puts a saved goal in the list for its status and out of the others", () => {
  const list = (status: string, goals: Goal[]): GoalsListResponse => ({ status, count: goals.length, goals });
  const a = goal({ id: "a" });
  const b = goal({ id: "b" });

  // updated in place: same position, new numbers
  const raised = goal({ id: "a", current_amount: 5 });
  assert.deepEqual(placeGoal(list("active", [a, b]), raised, "active").goals, [raised, b]);

  // reached its target: leaves Active, joins Achieved
  const done = goal({ id: "a", status: "completed" });
  assert.deepEqual(placeGoal(list("active", [a, b]), done, "active"), list("active", [b]));
  assert.deepEqual(placeGoal(list("completed", [b]), done, "completed").goals, [b, done]);

  // raised its target again: leaves Achieved, joins Active
  const reopened = goal({ id: "a", status: "active" });
  assert.equal(placeGoal(list("completed", [done]), reopened, "completed").count, 0);

  // archived: in no list
  const archived = goal({ id: "a", status: "archived" });
  assert.equal(placeGoal(list("active", [a, b]), archived, "active").count, 1);
  assert.equal(placeGoal(list("completed", [done]), archived, "completed").count, 0);
});
