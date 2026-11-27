import { expect, test } from 'bun:test';
import { AdminHttpClient } from './admin-http-client';
import { loadConfig } from './config';

test('history client distinguishes malformed response from round failure without echoing the response body', async () => {
  const server = Bun.serve({ port: 0, hostname: '127.0.0.1', fetch: () => new Response('private upstream contents', { status: 502 }) });
  const config = loadConfig(new URL('../config/api2business.example.yaml', import.meta.url).pathname);
  const previous = process.env.API2BUSINESS_TEST_HISTORY_TOKEN;
  process.env.API2BUSINESS_TEST_HISTORY_TOKEN = 'fixture';
  try {
    const client = new AdminHttpClient(config, { mode: 'http', baseUrl: server.url.href, adminToken: { envKey: 'API2BUSINESS_TEST_HISTORY_TOKEN' } });
    await expect(client.idleProbeHistory(1, 'codex')).rejects.toThrow(/^Api2Business API .* returned HTTP 502: invalid JSON$/);
  } finally {
    server.stop(true);
    if (previous === undefined) delete process.env.API2BUSINESS_TEST_HISTORY_TOKEN;
    else process.env.API2BUSINESS_TEST_HISTORY_TOKEN = previous;
  }
});
