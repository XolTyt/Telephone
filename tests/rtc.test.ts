import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { createRoom, roomFromUrl, invitation, applyQuality, iceConfiguration } from '../src/rtc';

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
beforeEach(() => window.history.replaceState(null, '', '/'));
describe('invitations', () => {
  it('creates unpredictable 12-character room identifiers', () => {
    const rooms = new Set(Array.from({ length: 1000 }, createRoom));
    expect(rooms.size).toBe(1000);
    for (const room of rooms) expect(room).toMatch(/^[A-HJ-NP-Z2-9]{12}$/);
  });
  it('round-trips a room through a shareable link without extra parameters', () => {
    window.history.replaceState(null, '', '/?unrelated=secret#fragment');
    const room = createRoom();
    const url = invitation(room);
    expect(url).not.toContain('secret'); expect(url).not.toContain('#');
    window.history.replaceState(null, '', url);
    expect(roomFromUrl()).toBe(room);
  });
  it('rejects malformed invitation identifiers', () => {
    window.history.replaceState(null, '', '/?room=%3Cscript%3E');
    expect(roomFromUrl()).toBe('');
  });
});

describe('quality settings', () => {
  it('applies separate video and audio budgets and handles browser rejection', async () => {
    const video = { track: { kind: 'video' }, getParameters: () => ({ encodings: [{}] }), setParameters: vi.fn().mockResolvedValue(undefined) };
    const audio = { track: { kind: 'audio' }, getParameters: () => ({ encodings: [{}] }), setParameters: vi.fn().mockRejectedValue(new Error('unsupported')) };
    const pc = { getSenders: () => [video, audio] } as unknown as RTCPeerConnection;
    expect(await applyQuality(pc, { resolution: '1080', fps: 30, videoBitrate: 8000, audioBitrate: 128 })).toBe(false);
    expect(video.setParameters).toHaveBeenCalledWith({ encodings: [{ maxBitrate: 8000000, maxFramerate: 30 }], degradationPreference: 'maintain-resolution' });
    expect(audio.setParameters).toHaveBeenCalledWith({ encodings: [{ maxBitrate: 128000 }] });
  });
  it('does not invent an unnegotiated encoding', async () => {
    const setParameters = vi.fn();
    await applyQuality({ getSenders: () => [{ track: { kind: 'video' }, getParameters: () => ({}), setParameters }] } as unknown as RTCPeerConnection, { resolution: '1080', fps: 30, videoBitrate: 8000, audioBitrate: 128 });
    expect(setParameters).not.toHaveBeenCalled();
  });
  it('retains bitrate limits when a mobile browser rejects the quality preference', async () => {
    const setParameters = vi.fn().mockRejectedValueOnce(new Error('unsupported preference')).mockResolvedValueOnce(undefined);
    const pc = { getSenders: () => [{ track: { kind: 'video' }, getParameters: () => ({ encodings: [{}] }), setParameters }] } as unknown as RTCPeerConnection;
    expect(await applyQuality(pc, { resolution: '1080', fps: 30, videoBitrate: 8000, audioBitrate: 128 })).toBe(true);
    expect(setParameters).toHaveBeenLastCalledWith({ encodings: [{ maxBitrate: 8000000, maxFramerate: 30 }] });
  });
});

describe('ICE configuration', () => {
  it('loads temporary TURN credentials from the backend', async () => {
    vi.stubEnv('VITE_ICE_SERVERS_URL', '/api/ice');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => [{ urls: 'turn:example.com', username: 'temporary', credential: 'signed' }] }));
    const config = await iceConfiguration(new AbortController().signal);
    expect(config.iceServers).toContainEqual({ urls: 'turn:example.com', username: 'temporary', credential: 'signed' });
  });
  it('reports an unavailable credential endpoint', async () => {
    vi.stubEnv('VITE_ICE_SERVERS_URL', '/api/ice');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    await expect(iceConfiguration(new AbortController().signal)).rejects.toThrow('настройки');
  });
});
