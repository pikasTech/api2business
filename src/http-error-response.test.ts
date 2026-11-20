import { describe, expect, test } from "bun:test";
import { errorResponse, parseJsonObjectBody } from "./http";

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

  test("maps a disallowed recentCallLimit to an actionable 400 instead of a generic 500", async () => {
    const message = "recentCallLimit must be one of: 100, 500, 1000, 2000, 5000";
    const result = await errorStatus(new Error(message));
    expect(result.status).toBe(400);
    expect(result.body).toEqual({ ok: false, error: message });
  });
});

describe("request body parsing", () => {
  test("empty body stays an empty object for query-only endpoints", () => {
    expect(parseJsonObjectBody("   ")).toEqual({});
  });

  test("malformed JSON reports the parse cause instead of an empty object", () => {
    expect(() => parseJsonObjectBody('{"ok":')).toThrow(/^请求正文不是合法 JSON: /);
  });

  test("non-object JSON is rejected with an actionable message", () => {
    expect(() => parseJsonObjectBody("[1,2]")).toThrow("请求正文必须是 JSON 对象");
  });
});
