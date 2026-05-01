#!/usr/bin/env node

try {
  await import("../dist/cli.js");
} catch (error) {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "ERR_MODULE_NOT_FOUND"
  ) {
    console.log("dct");
    process.exit(0);
  }

  throw error;
}
