import assert from "node:assert/strict";
import { test } from "node:test";
import { createApp } from "./index.js";

test("createApp returns a JSON 404 for unknown routes", async () => {
  const app = createApp();
  const response = await app.fetch(new Request("http://localhost/unknown"));
  const payload = (await response.json()) as {
    error: { code: string; message: string };
  };

  assert.equal(response.status, 404);
  assert.equal(payload.error.code, "NOT_FOUND");
  assert.match(payload.error.message, /GET \/unknown/);
});
