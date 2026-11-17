// @vitest-environment node
import { createHmac } from 'node:crypto';
import { afterEach, expect, it, vi } from 'vitest';
const createRoom = vi.hoisted(() => vi.fn().mockResolvedValue({}));
vi.mock('livekit-server-sdk', async importOriginal => ({
  ...await importOriginal(),
  RoomServiceClient: class { createRoom = createRoom; },
}));
import handler from '../api/join.js';
afterEach(() => { vi.unstubAllEnvs(); createRoom.mockClear(); });
function response() { return { setHeader: vi.fn(), status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() }; }
function configure() {
  vi.stubEnv('LIVEKIT_URL', 'wss://test.livekit.cloud');
  vi.stubEnv('LIVEKIT_API_KEY', 'test-key'); vi.stubEnv('LIVEKIT_API_SECRET', 'test-secret');
}
const room = 'ABCDEFGH2345ABCDEFGH2345';
it('creates a two-person room and a signed token scoped only to it', async () => {
  configure(); const res = response();
  await handler({ method: 'POST', body: { room, identity: 'admin', roomAdmin: true } }, res);
  expect(res.status).toHaveBeenCalledWith(200);
  expect(createRoom).toHaveBeenCalledWith({ name: room, maxParticipants: 2, emptyTimeout: 300, departureTimeout: 60 });
  const result = res.json.mock.calls[0][0];
  expect(result.url).toBe('wss://test.livekit.cloud');
  const [header, payload, signature] = result.token.split('.');
  expect(signature).toBe(createHmac('sha256', 'test-secret').update(`${header}.${payload}`).digest('base64url'));
  const claims = JSON.parse(Buffer.from(payload, 'base64url').toString());
  expect(claims.video).toEqual({ roomJoin: true, room, canPublish: true, canSubscribe: true, canPublishData: false });
  expect(claims.sub).not.toBe('admin'); expect(claims.exp - claims.nbf).toBeLessThanOrEqual(901);
  expect(JSON.stringify(result)).not.toContain('test-secret');
});
it('reports missing setup without contacting a service', async () => {
  vi.stubEnv('LIVEKIT_API_SECRET', ''); const res = response();
  await handler({ method: 'POST', body: { room } }, res);
  expect(res.status).toHaveBeenCalledWith(503); expect(createRoom).not.toHaveBeenCalled();
});
it('rejects malformed rooms and unsupported methods', async () => {
  configure(); const res = response(); await handler({ method: 'POST', body: { room: '<script>' } }, res);
  expect(res.status).toHaveBeenCalledWith(400); expect(createRoom).not.toHaveBeenCalled();
  const other = response(); await handler({ method: 'GET' }, other); expect(other.status).toHaveBeenCalledWith(405);
});
it('does not disclose credentials when the service fails', async () => {
  configure(); createRoom.mockRejectedValueOnce(new Error('test-secret')); const res = response();
  await handler({ method: 'POST', body: { room } }, res);
  expect(res.status).toHaveBeenCalledWith(502); expect(JSON.stringify(res.json.mock.calls)).not.toContain('test-secret');
});

