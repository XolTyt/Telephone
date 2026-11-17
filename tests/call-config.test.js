import { afterEach, expect, it, vi } from 'vitest';
import handler from '../api/call-config.js';
afterEach(() => vi.unstubAllEnvs());
const response = () => ({ setHeader:vi.fn(), status:vi.fn().mockReturnThis(), json:vi.fn().mockReturnThis() });
it('exposes only an explicitly publishable key and build version', () => {
  vi.stubEnv('METERED_PUBLISHABLE_KEY','pk_live_clearcall_test'); vi.stubEnv('VERCEL_GIT_COMMIT_SHA','1234567890');
  const res = response(); handler({method:'GET'},res);
  expect(res.status).toHaveBeenCalledWith(200);
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({apiKey:'pk_live_clearcall_test',version:'1234567'}));
  expect(res.setHeader).toHaveBeenCalledWith('Cache-Control','no-store');
});
it('never exposes an accidentally supplied secret key', () => {
  vi.stubEnv('METERED_PUBLISHABLE_KEY','sk_live_private_secret'); const res=response(); handler({method:'GET'},res);
  expect(res.status).toHaveBeenCalledWith(503); expect(JSON.stringify(res.json.mock.calls)).not.toContain('sk_live_private_secret');
});
it('reports missing configuration and rejects unsupported methods', () => {
  vi.stubEnv('METERED_PUBLISHABLE_KEY',''); const res=response(); handler({method:'GET'},res); expect(res.status).toHaveBeenCalledWith(503);
  const other=response(); handler({method:'POST'},other); expect(other.status).toHaveBeenCalledWith(405);
});
