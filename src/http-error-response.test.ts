import { describe, expect, test } from "bun:test";
import { errorResponse } from "./http";

async function errorStatus(error: Error): Promise<{ status: number; body: { ok: boolean; error: string } }> {
  const response = errorResponse(error);
  return {
    status: response.status,
    body: await response.json() as { ok: boolean; error: string },
  };
}

describe("management selector errors", () => {
  test("maps a non-unique account selector to a client-visible conflict", async () => {
    const result = await errorStatus(new Error("account selector did not resolve exactly once: 1507"));
    expect(result.status).toBe(409);
    expect(result.body).toEqual({ ok: false, error: "account selector did not resolve exactly once: 1507" });
  });

  test("maps an empty group selector to a client-visible conflict", async () => {
    const result = await errorStatus(new Error("group selector resolved no scoreable accounts: empty"));
    expect(result.status).toBe(409);
    expect(result.body).toEqual({ ok: false, error: "group selector resolved no scoreable accounts: empty" });
  });
});
