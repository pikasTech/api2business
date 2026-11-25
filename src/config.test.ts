import { describe, expect, test } from "bun:test";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parse } from "yaml";
import { loadConfig } from "./config";

const configDir = resolve(import.meta.dir, "../config");

type ExampleConfig = {
  operations: {
    upstreamSchedulingV2: {
      modelSyncPolicy?: Record<string, unknown>;
      scopes: Record<string, Record<string, unknown>>;
    };
  };
};

function loadExampleWithMutation(mutator: (raw: ExampleConfig) => void) {
  const raw = parse(readFileSync(join(configDir, "api2business.example.yaml"), "utf8")) as ExampleConfig;
  mutator(raw);
  const path = join(configDir, `.platform-validation-${process.pid}-${Date.now()}.yaml`);
  writeFileSync(path, JSON.stringify(raw), { mode: 0o600 });
  try {
    return loadConfig(path);
  } finally {
    rmSync(path, { force: true });
  }
}

function loadExampleWithOpencode(platform: string) {
  return loadExampleWithMutation((raw) => {
    const codex = raw.operations.upstreamSchedulingV2.scopes.codex;
    raw.operations.upstreamSchedulingV2.scopes.opencode = {
      ...codex,
      platform,
      eligibleGroupIds: [191],
    };
  });
}

describe("upstream scheduling v2 platform validation", () => {
  test("accepts a configured opencode_go scope alongside built-in platforms", () => {
    const config = loadExampleWithOpencode("opencode_go");
    expect(config.operations.upstreamSchedulingV2?.scopes.opencode.platform).toBe("opencode_go");
  });

  test("rejects an unsupported platform identifier", () => {
    expect(() => loadExampleWithOpencode("opencode")).toThrow(
      "operations.upstreamSchedulingV2.scopes.opencode.platform must be openai, anthropic, grok, deepseek, opencode_go, command_code, or gemini",
    );
  });

  test("accepts a Gemini scope and loads its failover template", () => {
    const config = loadConfig(join(configDir, "api2business.example.yaml"));
    expect(config.operations.upstreamSchedulingV2?.scopes.gemini).toMatchObject({
      platform: "gemini",
      eligibleGroupIds: [665],
    });
    expect(config.operations.upstreamManagement.failoverTemplates.gemini.platform).toBe("gemini");
    expect(config.sub2api.geminiPriorityPlan?.platform).toBe("gemini");
    expect(config.sub2api.idleProbe.platformModels?.gemini?.slice(0, 3)).toEqual([
      "gemini-4-argon", "gemini-4-hydrogen", "gemini-3.8-flash",
    ]);
    expect(config.operations.upstreamSchedulingV2?.scopes.gemini.features).toMatchObject({
      idleProbe: true,
      modelSyncAutomation: true,
      priorityAutomation: true,
    });
  });

  test("loads the converted API-key policy from owning YAML", () => {
    const config = loadConfig(join(configDir, "api2business.example.yaml"));
    expect(config.operations.upstreamManagement.convertedApiKeyPolicy).toEqual({
      platforms: ["deepseek"],
      baseUrls: ["https://sub.api2business.com"],
      poolMode: true,
      tempUnschedulableEnabled: false,
    });
  });

  test("loads cached idle-probe scopes for opencode and commandcode", () => {
    const config = loadConfig(join(configDir, "api2business.example.yaml"));
    expect(config.operations.upstreamSchedulingV2?.scopes.opencode).toMatchObject({
      platform: "opencode_go",
      eligibleGroupIds: [191],
      idleProbeCacheMode: "full",
      features: { idleProbe: true, priorityAutomation: true, modelSyncAutomation: false },
    });
    expect(config.operations.upstreamSchedulingV2?.scopes.commandcode).toMatchObject({
      platform: "command_code",
      eligibleGroupIds: [193],
      idleProbeCacheMode: "full",
      features: { idleProbe: true, priorityAutomation: true, modelSyncAutomation: false },
    });
    expect(config.sub2api.idleProbe.platformModels?.opencode_go?.slice(0, 3)).toEqual([
      "deepseek-v4.1-flash", "glm-5.3", "glm-5.2",
    ]);
    expect(config.sub2api.idleProbe.platformModels?.command_code?.slice(0, 3)).toEqual([
      "deepseek/deepseek-v4.1-flash", "gpt-6.1-sol", "gpt-6-sol",
    ]);
  });

  test("validates idleProbeCacheMode values", () => {
    const config = loadExampleWithMutation((raw) => {
      raw.operations.upstreamSchedulingV2.scopes.codex.idleProbeCacheMode = "compact";
    });
    expect(config.operations.upstreamSchedulingV2?.scopes.codex.idleProbeCacheMode).toBe("compact");
    expect(() => loadExampleWithMutation((raw) => {
      raw.operations.upstreamSchedulingV2.scopes.codex.idleProbeCacheMode = "bypass";
    })).toThrow("operations.upstreamSchedulingV2.scopes.codex.idleProbeCacheMode must be full or compact");
  });

  test("loads the enabled OpenCode Free scope without modifying Codex probe models", () => {
    const config = loadConfig(join(configDir, "api2business.example.yaml"));
    expect(config.operations.upstreamSchedulingV2?.scopes["opencode-free"]).toMatchObject({
      enabled: true, platform: "openai", eligibleGroupIds: [697],
      accountCapacity: 1,
      priorityPlan: {
        platform: "openai", eligibleGroupIds: [697],
        evidenceTargetAttempts: 50, evidenceTargetFirstTokenSamples: 20,
        minimumPriority: 100, maximumPriority: 300,
      },
      idleProbeIntervalSeconds: 3600, idleProbeCacheMode: "full", idleProbeCandidateLimit: 1,
      idleProbeModels: ["deepseek-v4.1-flash"],
      features: { idleProbe: true, priorityAutomation: true, modelSyncAutomation: false },
    });
    expect(config.operations.upstreamSchedulingV2?.scopes.codex.idleProbeModels).toBeUndefined();
    for (const invalid of [[], ["flash", "FLASH"]]) {
      expect(() => loadExampleWithMutation((raw) => {
        raw.operations.upstreamSchedulingV2.scopes["opencode-free"].idleProbeModels = invalid;
      })).toThrow("idleProbeModels must contain unique model IDs");
    }
    expect(() => loadExampleWithMutation((raw) => {
      const policy = raw.operations.upstreamSchedulingV2.scopes["opencode-free"].priorityPlan as Record<string, unknown>;
      policy.platform = "grok";
    })).toThrow("operations.upstreamSchedulingV2.scopes.opencode-free.priorityPlan.platform must match");
    expect(() => loadExampleWithMutation((raw) => {
      const policy = raw.operations.upstreamSchedulingV2.scopes["opencode-free"].priorityPlan as Record<string, unknown>;
      policy.eligibleGroupIds = [2];
    })).toThrow("operations.upstreamSchedulingV2.scopes.opencode-free.priorityPlan.eligibleGroupIds must match");
  });

  test("enforces OpenCode Free shared-outlet probe limits", () => {
    expect(() => loadExampleWithMutation((raw) => {
      raw.operations.upstreamSchedulingV2.scopes["opencode-free"].accountCapacity = 2;
    })).toThrow("accountCapacity must be 1 for shared-outlet protection");
    expect(() => loadExampleWithMutation((raw) => {
      delete raw.operations.upstreamSchedulingV2.scopes["opencode-free"].accountCapacity;
    })).toThrow("accountCapacity must be 1 for shared-outlet protection");
    expect(() => loadExampleWithMutation((raw) => {
      raw.operations.upstreamSchedulingV2.scopes["opencode-free"].idleProbeCandidateLimit = 20;
    })).toThrow("idleProbeCandidateLimit must be 1 for shared-outlet protection");
    expect(() => loadExampleWithMutation((raw) => {
      delete raw.operations.upstreamSchedulingV2.scopes["opencode-free"].idleProbeCandidateLimit;
    })).toThrow("idleProbeCandidateLimit must be 1 for shared-outlet protection");
    expect(() => loadExampleWithMutation((raw) => {
      raw.operations.upstreamSchedulingV2.scopes["opencode-free"].idleProbeIntervalSeconds = 180;
    })).toThrow("idleProbeIntervalSeconds must be at least 3600 for shared-outlet protection");
    expect(() => loadExampleWithMutation((raw) => {
      delete raw.operations.upstreamSchedulingV2.scopes["opencode-free"].idleProbeIntervalSeconds;
    })).toThrow("idleProbeIntervalSeconds must be at least 3600 for shared-outlet protection");
  }, 15000);
});

describe("model sync policy validation", () => {
  test.each(["deepseek", "opencode_go", "command_code"])(
    "rejects automatic model sync for disabled platform %s",
    (platform) => {
      expect(() => loadExampleWithMutation((raw) => {
        const codex = raw.operations.upstreamSchedulingV2.scopes.codex;
        raw.operations.upstreamSchedulingV2.scopes[`${platform.replaceAll("_", "-")}-scope`] = {
          ...codex,
          platform,
          features: { ...(codex.features as Record<string, unknown>), modelSyncAutomation: true },
        };
      })).toThrow(`modelSyncAutomation is forbidden for platform ${platform}`);
    },
  );

  test("still allows automatic model sync for OpenAI when policy is present", () => {
    const config = loadExampleWithMutation((raw) => {
      const features = raw.operations.upstreamSchedulingV2.scopes.codex.features as Record<string, unknown>;
      raw.operations.upstreamSchedulingV2.scopes.codex.features = { ...features, modelSyncAutomation: true };
    });
    expect(config.operations.upstreamSchedulingV2?.scopes.codex.features.modelSyncAutomation).toBe(true);
  });

  test("keeps legacy configurations without policy compatible only when automation is off", () => {
    const config = loadExampleWithMutation((raw) => {
      delete raw.operations.upstreamSchedulingV2.modelSyncPolicy;
      for (const scope of Object.values(raw.operations.upstreamSchedulingV2.scopes)) {
        scope.features = { ...(scope.features as Record<string, unknown>), modelSyncAutomation: false };
      }
    });
    expect(config.operations.upstreamSchedulingV2?.modelSyncPolicy).toBeUndefined();
  });

  test("does not silently open automation when policy is absent", () => {
    expect(() => loadExampleWithMutation((raw) => {
      delete raw.operations.upstreamSchedulingV2.modelSyncPolicy;
      const features = raw.operations.upstreamSchedulingV2.scopes.codex.features as Record<string, unknown>;
      raw.operations.upstreamSchedulingV2.scopes.codex.features = { ...features, modelSyncAutomation: true };
    })).toThrow("modelSyncPolicy is required");
  });

  test("accepts a timezone-qualified alias retention expiry", () => {
    const config = loadExampleWithMutation((raw) => {
      const canonicalModels = raw.operations.upstreamSchedulingV2.modelSyncPolicy?.canonicalModels as Record<string, Record<string, unknown>>;
      canonicalModels["deepseek-v4.1-flash"]!.retainAliasesUntil = "2026-11-26T00:00:00Z";
    });
    expect(config.operations.upstreamSchedulingV2?.modelSyncPolicy?.canonicalModels["deepseek-v4.1-flash"]?.retainAliasesUntil)
      .toBe("2026-11-26T00:00:00Z");
  });

  test("rejects an alias retention expiry without timezone", () => {
    expect(() => loadExampleWithMutation((raw) => {
      const canonicalModels = raw.operations.upstreamSchedulingV2.modelSyncPolicy?.canonicalModels as Record<string, Record<string, unknown>>;
      canonicalModels["deepseek-v4.1-flash"]!.retainAliasesUntil = "2026-11-26T00:00:00";
    })).toThrow("retainAliasesUntil must be an ISO-8601 timestamp with timezone");
  });
});
