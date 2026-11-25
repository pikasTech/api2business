export interface LaneLockEvidence {
  classification: "lane_locked";
  failureScope: "shared-outlet";
  accountScoped: false;
  accountSwitchCanBypass: false;
  recordedAt: string | null;
  liftsAt: string | null;
  timingStatus: "complete" | "partial" | "unavailable";
  timingEvidence: {
    recordedAtText: string | null;
    liftsAtText: string | null;
  };
  matchedPhrases: string[];
}

interface LaneLockInput {
  messageText: string;
  statusCode?: number | null;
}

const LANE_SHUT_PHRASE = "our free model is holding this lane shut locally";
const FREE_LIMIT_PHRASE = "free usage limit reached";
const TIMESTAMP_PATTERN = String.raw`20\d{2}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2}| UTC| GMT)?`;

function labeledTimestamp(text: string, label: string): string | null {
  const match = text.match(new RegExp(String.raw`\b${label}\b\s*(?:at|:|=)?\s*(${TIMESTAMP_PATTERN})`, "iu"));
  return match?.[1]?.trim() ?? null;
}

function normalizedTimestamp(value: string | null): string | null {
  if (!value) return null;
  const normalized = value.replace(" ", "T").replace(/\s+(UTC|GMT)$/u, "Z");
  if (!/(?:Z|[+-]\d{2}:\d{2})$/u.test(normalized)) return null;
  const parsed = Date.parse(normalized);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

export function detectLaneLock(input: LaneLockInput): LaneLockEvidence | null {
  const sourceText = input.messageText;
  const text = sourceText.toLowerCase();
  const laneShut = text.includes(LANE_SHUT_PHRASE);
  const freeLimit = text.includes(FREE_LIMIT_PHRASE);
  const openCodeMarker = text.includes("opencode.ai") || text.includes("opencode go");
  const statusCode = input.statusCode == null ? null : Number(input.statusCode);
  if (!laneShut && !(freeLimit && (statusCode === 429 || openCodeMarker))) return null;

  const recordedAtText = labeledTimestamp(sourceText, "recorded\\s+at") ?? labeledTimestamp(sourceText, "recorded");
  const liftsAtText = labeledTimestamp(sourceText, "lifts\\s+at") ?? labeledTimestamp(sourceText, "lifts");
  const recordedAt = normalizedTimestamp(recordedAtText);
  const liftsAt = normalizedTimestamp(liftsAtText);
  const timingStatus = recordedAt && liftsAt ? "complete" : recordedAt || liftsAt ? "partial" : "unavailable";

  return {
    classification: "lane_locked",
    failureScope: "shared-outlet",
    accountScoped: false,
    accountSwitchCanBypass: false,
    recordedAt,
    liftsAt,
    timingStatus,
    timingEvidence: { recordedAtText, liftsAtText },
    matchedPhrases: [
      ...(laneShut ? [LANE_SHUT_PHRASE] : []),
      ...(freeLimit ? [FREE_LIMIT_PHRASE] : []),
    ],
  };
}
