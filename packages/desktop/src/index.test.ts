import test from "node:test";
import assert from "node:assert/strict";
import { DESKTOP_PRODUCT_NAME } from "./shared/constants.js";

test("desktop constants are exported", () => {
  assert.equal(DESKTOP_PRODUCT_NAME, "Datacenter Tycoon");
});
