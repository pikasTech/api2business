import { expect, test } from "bun:test";
import { collectSchedulingRuntime, parseSchedulingRuntimeQuery, projectSchedulingRuntime } from "./scheduling-runtime-evidence";

test("runtime evidence projects only numeric operational fields, never credentials or arbitrary strings", () => {
  expect(projectSchedulingRuntime({ group: { "3": { current_in_use: 4, max_capacity: 16, waiting_in_queue: 2, credentials: { api_key: "SECRET" }, platform: "openai" } }, account: [{ account_id: 41, is_available: false, token: "SECRET", name: "private" }] })).toEqual({ group: { "3": { current_in_use: 4, max_capacity: 16, waiting_in_queue: 2 } }, account: [{ account_id: 41, is_available: false }] });
});

test("runtime evidence isolates a failed source and preserves successful live evidence", async () => {
  const calls: string[] = [];
  const result = await collectSchedulingRuntime({
    async request<T>() { return { version: "v0.2.17", secret: "SECRET" } as T; },
    async getOpsAccountAvailability(group, platform) { calls.push(`${group}:${platform}`); return { group: { "3": { available_count: 2 } } }; },
    async getOpsConcurrency() { throw new Error("Sub2API GET /admin/ops/concurrency failed: HTTP 404 secret text"); },
  }, 3, "openai");
  expect(calls).toEqual(["3:openai"]);
  expect(result.complete).toBeFalse();
  expect(result.availability.data).toEqual({ group: { "3": { available_count: 2 } } });
  expect(result.concurrency).toMatchObject({ status: "unavailable", httpStatus: 404, data: null });
  expect(JSON.stringify(result)).not.toContain("secret");
  expect(result.nativeVersion).toMatchObject({ status: "available", data: { version: "v0.2.17" } });
  expect(JSON.stringify(result)).not.toContain("SECRET");
});

test("runtime evidence validates before making native calls", async () => {
  const client = { async request<T>(): Promise<T> { throw Error("called"); }, async getOpsAccountAvailability() { throw Error("called"); }, async getOpsConcurrency() { throw Error("called"); } };
  await expect(collectSchedulingRuntime(client, 0, "openai")).rejects.toThrow("positive group");
  await expect(collectSchedulingRuntime(client, 3, "wrong")).rejects.toThrow("positive group");
  expect(parseSchedulingRuntimeQuery("193", "command_code")).toEqual({ groupId: 193, platform: "command_code" });
  expect(parseSchedulingRuntimeQuery("191", "opencode_go")).toEqual({ groupId: 191, platform: "opencode_go" });
  expect(parseSchedulingRuntimeQuery("0193", "openai")).toEqual({ groupId: 193, platform: "openai" });
  expect(parseSchedulingRuntimeQuery(193, "command_code")).toEqual({ groupId: 193, platform: "command_code" });
  expect(parseSchedulingRuntimeQuery(String(Number.MAX_SAFE_INTEGER), "openai")).toEqual({
    groupId: Number.MAX_SAFE_INTEGER,
    platform: "openai",
  });
  for (const invalidGroup of [
    null, undefined, "", " ", " 193", "193 ", "+193", "-193", "1e3", "0x10", "193.0",
    "0", "00", String(Number.MAX_SAFE_INTEGER + 1), Number.MAX_SAFE_INTEGER + 1,
  ]) {
    expect(() => parseSchedulingRuntimeQuery(invalidGroup, "openai")).toThrow("positive group ID");
  }
  expect(() => parseSchedulingRuntimeQuery(null, "command_code")).toThrow("positive group ID");
  expect(() => parseSchedulingRuntimeQuery("193", "commandcode")).toThrow("command_code");
});

test("runtime evidence accepts configured non-OpenAI key platforms", async () => {
  const calls: string[] = [];
  const client = {
    async request<T>() { return { version: "v0.2.17" } as T; },
    async getOpsAccountAvailability(group: number, platform: string) { calls.push(`${group}:${platform}`); return { account: [{ account_id: 1583, is_available: true }] }; },
    async getOpsConcurrency() { return { current_in_use: 0, max_capacity: 10 }; },
  };
  await expect(collectSchedulingRuntime(client, 193, "command_code")).resolves.toMatchObject({
    groupId: 193,
    platform: "command_code",
    complete: true,
  });
  await expect(collectSchedulingRuntime(client, 191, "opencode_go")).resolves.toMatchObject({ complete: true });
  expect(calls).toEqual(["193:command_code", "191:opencode_go"]);
});

test("native version failure does not discard live capacity evidence", async () => {
  const result = await collectSchedulingRuntime({
    async request<T>() { return { version: "private secret string" } as T; },
    async getOpsAccountAvailability() { return { available_count: 2 }; },
    async getOpsConcurrency() { return { waiting_in_queue: 0 }; },
  }, 3, "openai");
  expect(result.complete).toBeTrue();
  expect(result.nativeVersion).toMatchObject({ status: "unavailable", data: null });
  expect(JSON.stringify(result)).not.toContain("private");
});
