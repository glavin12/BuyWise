import assert from "node:assert/strict";
import { test } from "node:test";

import { ApiError, isNotFound, MSG, stopsBatch, userMessage } from "./errors.ts";

test("a backend explanation for a rejected request is shown with the action", () => {
  const err = new ApiError(400, "Category not found");
  assert.equal(userMessage(err, "save this expense"), "We couldn't save this expense. Category not found");
  assert.equal(
    userMessage(new ApiError(422, MSG.invalid), "save this expense"),
    `We couldn't save this expense. ${MSG.invalid}`
  );
});

test("404 says the item is gone, whatever the backend wrote", () => {
  assert.equal(userMessage(new ApiError(404, "Transaction not found"), "open this"), MSG.notFound);
});

test("409 is a duplicate, or 'still processing' for a chat send", () => {
  assert.equal(
    userMessage(new ApiError(409, "This conflicts with an existing record."), "save this category"),
    `We couldn't save this category. ${MSG.duplicate}`
  );
  assert.equal(userMessage(new ApiError(409, "Still processing this message"), "send"), MSG.busy);
});

test("429 uses Retry-After when the server sent it", () => {
  assert.equal(userMessage(new ApiError(429, MSG.rateLimited, 12), "save"), "Too many requests. Please wait 12 seconds and try again.");
  assert.equal(userMessage(new ApiError(429, MSG.rateLimited), "save"), MSG.rateLimited);
});

test("network, timeout, expired session and server errors keep their own friendly text", () => {
  for (const [status, message] of [[0, MSG.network], [0, MSG.timeout], [401, MSG.expired], [500, MSG.server], [503, MSG.server]] as const) {
    assert.equal(userMessage(new ApiError(status, message), "save"), message);
  }
});

test("anything that is not an ApiError never leaks its text", () => {
  assert.equal(userMessage(new Error("AxiosError: Request failed with status code 422"), "save"), MSG.server);
  assert.equal(userMessage("boom", "save"), MSG.server);
  assert.equal(userMessage(undefined, "save"), MSG.server);
});

test("ApiError keeps instanceof and its fields", () => {
  const err = new ApiError(429, "x", 3);
  assert.ok(err instanceof ApiError && err instanceof Error);
  assert.deepEqual([err.name, err.status, err.retryAfter], ["ApiError", 429, 3]);
});

test("isNotFound is true only for a 404 ApiError", () => {
  assert.equal(isNotFound(new ApiError(404, "x")), true);
  assert.equal(isNotFound(new ApiError(400, "x")), false);
  assert.equal(isNotFound(new Error("404")), false);
  assert.equal(isNotFound(null), false);
});

test("stopsBatch is true only for failures every remaining item would hit too", () => {
  for (const status of [0, 401, 429]) assert.equal(stopsBatch(new ApiError(status, "x")), true, String(status));
  for (const status of [400, 404, 409, 422, 500]) assert.equal(stopsBatch(new ApiError(status, "x")), false, String(status));
  assert.equal(stopsBatch(new Error("boom")), false);
});
