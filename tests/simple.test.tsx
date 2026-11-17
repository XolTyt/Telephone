import { EventEmitter } from 'node:events';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ rooms: [] as any[], create: vi.fn() }));
vi.mock('livekit-client', () => ({
  Room: class extends EventEmitter {
    remoteParticipants = new Map();
    localParticipant = { publishTrack: vi.fn().mockResolvedValue({}) };
    connect = vi.fn().mockResolvedValue(undefined); disconnect = vi.fn().mockResolvedValue(undefined);
    constructor() { super(); mocks.rooms.push(this); }
  },
  RoomEvent: { TrackSubscribed: 'track', TrackUnsubscribed: 'untrack', ParticipantConnected: 'joined', ParticipantDisconnected: 'left', Reconnecting: 'reconnecting', Reconnected: 'reconnected', Disconnected: 'disconnected' },
  Track: { Kind: { Audio: 'audio', Video: 'video' } },
  createLocalTracks: mocks.create,
}));
import App from '../src/App';
class Stream {
  tracks: any[];
  constructor(tracks: any[] = []) { this.tracks = [...tracks]; }
  getTracks() { return this.tracks; }
}
let tracks: any[];
beforeEach(() => {
  mocks.rooms.length = 0;
  mocks.create.mockReset();
  vi.stubEnv('VITE_CALL_ENGINE', 'livekit'); vi.stubGlobal('isSecureContext', true); vi.stubGlobal('MediaStream', Stream);
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: vi.fn() } });
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
  window.history.replaceState(null, '', '/');
  tracks = ['audio', 'video'].map(kind => ({ kind, mediaStreamTrack: { kind }, stop: vi.fn(), isMuted: false, mute: vi.fn().mockResolvedValue(undefined), unmute: vi.fn().mockResolvedValue(undefined), restartTrack: vi.fn().mockResolvedValue(undefined) }));
  mocks.create.mockResolvedValue(tracks);
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ token: 'signed-token', url: 'wss://test.livekit.cloud' }) }));
});
afterEach(() => { cleanup(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
it('creates a one-link call with no codes or reply-link steps', async () => {
  render(<App />);
  expect(screen.queryByText('Код комнаты')).toBeNull();
  expect(screen.queryByText('Позвонить без сервера подключения')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Создать звонок' }));
  await screen.findByText('Ждём собеседника');
  expect(mocks.rooms[0].connect).toHaveBeenCalledWith('wss://test.livekit.cloud', 'signed-token');
  const request = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string);
  expect(request.room).toMatch(/^[A-HJ-NP-Z2-9]{24}$/);
  expect(mocks.rooms[0].localParticipant.publishTrack).toHaveBeenCalledTimes(2);
});
it('an invited guest only presses Join and enters the same room', async () => {
  const room = 'ABCDEFGH2345ABCDEFGH2345'; window.history.replaceState(null, '', `/?room=${room}`);
  render(<App />); fireEvent.click(screen.getByRole('button', { name: 'Войти в звонок' }));
  await screen.findByText('Ждём собеседника');
  expect(fetch).toHaveBeenCalledWith('/api/join', expect.objectContaining({ body: JSON.stringify({ room }) }));
});
it('shows missing setup clearly without opening the camera', async () => {
  vi.mocked(fetch).mockResolvedValue({ ok: false, json: async () => ({ error: 'Настройте сервис', code: 'NOT_CONFIGURED' }) } as any);
  render(<App />); fireEvent.click(screen.getByRole('button', { name: 'Создать звонок' }));
  expect(await screen.findByText('Настройте сервис')).toBeTruthy();
  expect(mocks.create).not.toHaveBeenCalled();
});
it('stops local tracks, disconnects, and keeps audio when switching the camera', async () => {
  const view = render(<App />); fireEvent.click(screen.getByRole('button', { name: 'Создать звонок' }));
  await screen.findByText('Ждём собеседника');
  fireEvent.click(screen.getByRole('button', { name: 'Выключить микрофон' }));
  await waitFor(() => expect(tracks[0].mute).toHaveBeenCalled());
  fireEvent.click(screen.getByRole('button', { name: 'Переключить камеру' }));
  await waitFor(() => expect(tracks[1].restartTrack).toHaveBeenCalledWith({ facingMode: 'environment' }));
  expect(tracks[0].stop).not.toHaveBeenCalled();
  view.unmount(); expect(tracks.every(t => t.stop.mock.calls.length)).toBeTruthy();
  expect(mocks.rooms[0].disconnect).toHaveBeenCalled();
});
it('releases camera tracks granted after the call is closed', async () => {
  let resolve!: (tracks: any[]) => void;
  mocks.create.mockReturnValue(new Promise(r => { resolve = r; }));
  const view = render(<App />); fireEvent.click(screen.getByRole('button', { name: 'Создать звонок' }));
  await waitFor(() => expect(mocks.create).toHaveBeenCalled()); view.unmount();
  await act(async () => resolve(tracks)); expect(tracks.every(t => t.stop.mock.calls.length)).toBeTruthy();
});
