import { createHmac } from 'node:crypto';
import { afterEach, expect, it, vi } from 'vitest';
import handler from '../api/ice.js';
afterEach(() => vi.unstubAllEnvs());
function response() {
  return { setHeader: vi.fn(), status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
}
it('issues coturn-compatible expiring credentials without disclosing the secret', () => {
  vi.stubEnv('TURN_URLS', 'turn:turn.example.com:3478,turns:turn.example.com:5349');
  vi.stubEnv('TURN_SECRET', 'test-shared-secret');
  const res = response(); handler({ method: 'GET' }, res);
  expect(res.status).toHaveBeenCalledWith(200);
  const [server] = res.json.mock.calls[0][0];
  expect(server.credential).toBe(createHmac('sha1', 'test-shared-secret').update(server.username).digest('base64'));
  expect(Number(server.username.split(':')[0])).toBeGreaterThan(Date.now() / 1000 + 86000);
  expect(JSON.stringify(server)).not.toContain('test-shared-secret');
  expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
});
it('fails clearly when TURN is not configured', () => {
  vi.stubEnv('TURN_SECRET', ''); const res = response(); handler({ method: 'GET' }, res);
  expect(res.status).toHaveBeenCalledWith(503);
});
it('rejects unsupported methods', () => {
  const res = response(); handler({ method: 'POST' }, res); expect(res.status).toHaveBeenCalledWith(405);
});
