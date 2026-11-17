export interface SnapshotCacheTelemetry {
  state: string | null;
  capturedAt: string | null;
  complete: boolean;
}

export interface SnapshotRefreshWaitOptions {
  read: () => Promise<Record<string, unknown>>;
  sleep?: (milliseconds: number) => Promise<void>;
  now?: () => number;
  timeoutMs?: number;
  intervalMs?: number;
}

export function snapshotCacheTelemetry(payload: Record<string, unknown>): SnapshotCacheTelemetry {
  const cache = payload.cache;
  const row = cache && typeof cache === "object" && !Array.isArray(cache)
    ? cache as Record<string, unknown>
    : {};
  return {
    state: row.state == null ? null : String(row.state),
    capturedAt: row.capturedAt == null ? null : String(row.capturedAt),
    complete: row.complete === true,
  };
}

/**
 * 普通 snapshot 读取遇到陈旧缓存时，API 会先返回旧读模型并异步重建。
 * 运维入口在这里有界等待该后台重建，避免每轮先拿到陈旧数据再手工 --refresh。
 * 重建失败、数据不完整或超过等待上限时，原样返回最后一次陈旧回执，绝不伪造新鲜。
 */
export async function readSnapshotAwaitingBackgroundRefresh(
  options: SnapshotRefreshWaitOptions,
): Promise<Record<string, unknown>> {
  const sleep = options.sleep ?? ((milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));
  const now = options.now ?? Date.now;
  const timeoutMs = options.timeoutMs ?? 10_000;
  const intervalMs = options.intervalMs ?? 1_000;

  let latest = await options.read();
  const initial = snapshotCacheTelemetry(latest);
  if (initial.state !== "stale" || !initial.complete) return latest;

  const deadline = now() + timeoutMs;
  while (now() < deadline) {
    await sleep(intervalMs);
    latest = await options.read();
    const current = snapshotCacheTelemetry(latest);
    if (current.state !== "stale" || current.capturedAt !== initial.capturedAt) return latest;
  }
  return latest;
}
