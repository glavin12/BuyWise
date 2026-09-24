import assert from "node:assert/strict";
import { test } from "node:test";

import { isUuid } from "./ids.ts";

test("isUuid accepts UUIDs and nothing else", () => {
  assert.ok(isUuid("0193a5e0-7c1a-7b2e-8f3d-9a1b2c3d4e5f"));
  assert.ok(isUuid("0193A5E0-7C1A-7B2E-8F3D-9A1B2C3D4E5F"));
  for (const bad of ["", "abc", "0193a5e0-7c1a-7b2e-8f3d-9a1b2c3d4e5", "../../etc", "0193a5e0-7c1a-7b2e-8f3d-9a1b2c3d4e5f/edit", undefined, null, 42, ["x"]]) {
    assert.equal(isUuid(bad), false, String(bad));
  }
});
