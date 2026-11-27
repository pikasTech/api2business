import { expect, test } from "bun:test";
import { assertAccountProbeScope } from "./account-probe-l0";

test("math-probe accepts Gemini and rejects unsupported scopes", () => {
  expect(() => assertAccountProbeScope("math-probe", "gemini")).not.toThrow();
  expect(() => assertAccountProbeScope("math-probe", "unsupported"))
    .toThrow("accounts math-probe does not support scope unsupported");
});
