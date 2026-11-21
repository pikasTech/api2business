import { expect, test } from "bun:test";
import { apiKeyTemplatePolicy, matchesConvertedApiKeyPolicy } from "./converted-api-key-policy";

const policy = {
  platforms: ["deepseek"],
  baseUrls: ["https://sub.api2business.com"],
  poolMode: true,
  tempUnschedulableEnabled: false,
};

test("converted API-key policy matches only the platform and base URL intersection", () => {
  expect(matchesConvertedApiKeyPolicy(policy, "deepseek", "https://sub.api2business.com/v1")).toBe(true);
  expect(matchesConvertedApiKeyPolicy(policy, "openai", "https://sub.api2business.com")).toBe(false);
  expect(matchesConvertedApiKeyPolicy(policy, "deepseek", "https://api.deepseek.com")).toBe(false);
});

test("converted API-key policy disables platform temporary scheduling and enables pool mode", () => {
  const rules = [{ error_code: 429, keywords: ["rate limited"], duration_minutes: 3 }];
  expect(apiKeyTemplatePolicy(policy, "deepseek", "https://sub.api2business.com", rules)).toEqual({
    converted: true,
    poolMode: true,
    tempUnschedulableEnabled: false,
    rules: [],
  });
});

test("ordinary platform templates keep their existing pool mode semantics", () => {
  const rules = [{ error_code: 429, keywords: ["rate limited"], duration_minutes: 3 }];
  expect(apiKeyTemplatePolicy(policy, "deepseek", "https://api.deepseek.com", rules)).toMatchObject({
    converted: false,
    poolMode: false,
    tempUnschedulableEnabled: true,
    rules,
  });
  expect(apiKeyTemplatePolicy(policy, "anthropic", "https://api.anthropic.com", rules).poolMode).toBe(true);
  expect(apiKeyTemplatePolicy(policy, "grok", "https://api.x.ai", rules).poolMode).toBeUndefined();
});
