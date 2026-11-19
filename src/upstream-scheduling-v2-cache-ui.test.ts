import { describe, expect, test } from "bun:test";
import { readdirSync } from "node:fs";

const read = (path: string) => Bun.file(new URL(path, import.meta.url)).text();

describe("upstream scheduling v2 probe cache UI", () => {
  test("separates automatic and manual probe cache summaries", async () => {
    const [html, script] = await Promise.all([
      read("../static/upstream-scheduling-v2.html"),
      read("../static/upstream-scheduling-v2.js"),
    ]);

    expect(html).toContain('id="v2-probe-cache-title"');
    expect(html).toContain('data-trigger="automatic"');
    expect(html).toContain('data-trigger="manual"');
    expect(html).toContain('id="v2-probe-auto-denom"');
    expect(html).toContain('id="v2-probe-manual-denom"');
    expect(script).toContain("renderProbeCacheSummary(history.cacheSummary");
    expect(script).toContain("已知 ${number(known)} 条 · 分母 ${number(known)}");
    expect(script).toContain("'本页无探活请求'");
    expect(script).toContain("'无请求'");
  });

  test("renders round cache fields and expandable account evidence", async () => {
    const script = await read("../static/upstream-scheduling-v2.js");

    expect(script).toContain("探活缓存命中");
    expect(script).toContain("缓存读取 / 重新计费");
    expect(script).toContain("data-probe-detail=");
    expect(script).toContain("data-probe-detail-row=");
    expect(script).toContain('data-label="开始时间"');
    expect(script).toContain('data-label="缓存读取 token"');
    expect(script).toContain('probe-detail-data-row');
    expect(script).toContain("probe-detail-table");
    expect(script).toContain("probe-account-name");
    expect(script).toContain("detail.cacheState === 'miss' ? '未命中'");
    expect(script).toContain("Number(cache.hitCount ?? 0) > 0 ? 'hit' : 'miss'");
    expect(script).toContain("本轮未保存逐账号缓存证据");
    expect(script).toContain("命中 ${number(cache.hitCount)} · 未命中 ${number(cache.missCount)} · 未知 ${number(cache.unknownCount)} · 分母 ${number(known)}");
  });

  test("keeps the mobile scope switch visible and lets long account names wrap", async () => {
    const css = await read("../static/styles.css");

    expect(css).toContain("@media (max-width: 560px)");
    expect(css).toContain(".score-profile-switch { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); width: 100%; overflow: visible; }");
    expect(css).toContain(".probe-cache-table { min-width: 1280px; }");
    expect(css).toContain('.probe-cache-rate[data-state="miss"]');
    expect(css).toContain(".probe-detail-table .probe-account-name");
    expect(css).toContain("overflow-wrap: anywhere");
    expect(css).toContain(".probe-cache-table tr.probe-main-row { display: grid;");
    expect(css).toContain(".table-pagination .section-state { min-width: 0; white-space: normal;");
  });

  test("busts the frontend module cache with the new page revision", async () => {
    const [html, app] = await Promise.all([
      read("../static/upstream-scheduling-v2.html"),
      read("../static/app.js"),
    ]);

    const styleRevision = /\/styles\.css\?v=([^"]+)/u.exec(html)?.[1];
    const appRevision = /\/app\.js\?v=([^"]+)/u.exec(html)?.[1];
    if (!styleRevision || !appRevision) throw new Error("page revision is missing from the V2 HTML");
    expect(app).toContain(`upstream-scheduling-v2.js?v=${appRevision}`);

    const pageNames = readdirSync(new URL("../static/", import.meta.url)).filter((name) => name.endsWith(".html"));
    const pages = await Promise.all(pageNames.map((name) => read(`../static/${name}`)));
    const pageRevisions = pages
      .map((page) => /\/styles\.css\?v=([^"]+)/u.exec(page)?.[1])
      .filter((revision): revision is string => Boolean(revision));
    expect(pageRevisions.length).toBeGreaterThan(0);
    expect(new Set(pageRevisions)).toEqual(new Set([styleRevision]));
  });
});
