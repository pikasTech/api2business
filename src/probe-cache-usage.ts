export function probeCacheUsage(value: unknown) {
  const usage = value as Record<string, unknown> | null;
  for (const field of ["input_tokens_details.cached_tokens", "prompt_tokens_details.cached_tokens", "cache_read_input_tokens", "cache_read_tokens", "cached_tokens", "prompt_cache_hit_tokens"]) {
    const tokens = field.split(".").reduce<unknown>((current, key) => (current as Record<string, unknown> | null)?.[key], usage);
    if (typeof tokens === "number" && Number.isSafeInteger(tokens) && tokens >= 0) return { cacheReadTokens: tokens, cacheReadField: field, cacheHit: tokens > 0 };
  }
  return { cacheReadTokens: null, cacheReadField: null, cacheHit: null };
}
