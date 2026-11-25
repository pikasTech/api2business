import { expect, test } from "bun:test";
import { detectLaneLock } from "./lane-lock";

test("lane lock evidence preserves outlet semantics and both timestamps", () => {
  const evidence = detectLaneLock({
    statusCode: 429,
    messageText: [
      "Our free model is holding this lane shut locally.",
      "Free usage limit reached.",
      "recorded at 2026-11-25 09:30:00 UTC",
      "lifts at 2026-11-25T10:00:00.000Z",
    ].join(" "),
  });

  expect(evidence).toMatchObject({
    classification: "lane_locked",
    failureScope: "shared-outlet",
    accountScoped: false,
    accountSwitchCanBypass: false,
    recordedAt: "2026-11-25T09:30:00.000Z",
    liftsAt: "2026-11-25T10:00:00.000Z",
    timingStatus: "complete",
    matchedPhrases: [
      "our free model is holding this lane shut locally",
      "free usage limit reached",
    ],
  });
});

test("OpenCode free usage response remains lane-scoped without timing fields", () => {
  const evidence = detectLaneLock({
    statusCode: 429,
    messageText: "Free usage limit reached. Free models work in OpenCode (https://opencode.ai).",
  });

  expect(evidence).toMatchObject({
    classification: "lane_locked",
    recordedAt: null,
    liftsAt: null,
    timingStatus: "unavailable",
  });
});

test("generic rate limits and unrelated free-limit text are not lane locks", () => {
  expect(detectLaneLock({ statusCode: 429, messageText: "rate_limit_exceeded" })).toBeNull();
  expect(detectLaneLock({ statusCode: 200, messageText: "Free usage limit reached" })).toBeNull();
});

test("ambiguous timestamps are preserved as text but not normalized", () => {
  const evidence = detectLaneLock({
    statusCode: 429,
    messageText: "Free usage limit reached. recorded at 2026-11-25 09:30:00; lifts at 2026-11-25 10:00:00",
  });

  expect(evidence).toMatchObject({
    recordedAt: null,
    liftsAt: null,
    timingStatus: "unavailable",
    timingEvidence: {
      recordedAtText: "2026-11-25 09:30:00",
      liftsAtText: "2026-11-25 10:00:00",
    },
  });
});
