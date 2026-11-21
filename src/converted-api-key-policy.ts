import { normalizeUpstreamWallet } from "./upstream-valuation";

export interface FailoverTemplateRule {
  error_code: number;
  keywords: string[];
  duration_minutes: number;
  description?: string;
}

export interface ConvertedApiKeyPolicyConfig {
  platforms: string[];
  baseUrls: string[];
  poolMode: boolean;
  tempUnschedulableEnabled: boolean;
}

export interface ApiKeyTemplatePolicy {
  converted: boolean;
  poolMode?: boolean;
  tempUnschedulableEnabled: boolean;
  rules: FailoverTemplateRule[];
}

export const EMPTY_CONVERTED_API_KEY_POLICY: ConvertedApiKeyPolicyConfig = {
  platforms: [],
  baseUrls: [],
  poolMode: true,
  tempUnschedulableEnabled: false,
};

export function matchesConvertedApiKeyPolicy(
  policy: ConvertedApiKeyPolicyConfig,
  platform: unknown,
  baseUrl: unknown,
): boolean {
  const normalizedPlatform = String(platform ?? "").trim().toLowerCase();
  const normalizedBaseUrl = normalizeUpstreamWallet(baseUrl);
  return normalizedPlatform !== ""
    && normalizedBaseUrl !== ""
    && policy.platforms.includes(normalizedPlatform)
    && policy.baseUrls.includes(normalizedBaseUrl);
}

export function apiKeyTemplatePolicy(
  policy: ConvertedApiKeyPolicyConfig,
  platform: unknown,
  baseUrl: unknown,
  platformRules: FailoverTemplateRule[],
): ApiKeyTemplatePolicy {
  const normalizedPlatform = String(platform ?? "").trim().toLowerCase();
  if (matchesConvertedApiKeyPolicy(policy, normalizedPlatform, baseUrl)) {
    return {
      converted: true,
      poolMode: policy.poolMode,
      tempUnschedulableEnabled: policy.tempUnschedulableEnabled,
      rules: policy.tempUnschedulableEnabled ? platformRules : [],
    };
  }
  return {
    converted: false,
    ...(normalizedPlatform === "grok" || normalizedPlatform === "opencode_go"
      ? {}
      : { poolMode: normalizedPlatform === "anthropic" }),
    tempUnschedulableEnabled: true,
    rules: platformRules,
  };
}
