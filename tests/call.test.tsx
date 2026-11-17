import { EventEmitter } from 'node:events';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import CallRoom from '../src/components/CallRoom';

const peers: any[] = [];
vi.mock('peerjs', () => ({ default: class extends EventEmitter {
  open = true; destroyed = false; disconnected = false;
  call = vi.fn(); destroy = vi.fn(() => { this.destroyed = true; }); reconnect = vi.fn();
  constructor(...args: any[]) { super(); peers.push(this); }
} }));
class Track { enabled = true; kind: string; stop = vi.fn(); constructor(kind: string) { this.kind = kind; } }
class Stream {
  tracks: Track[];
  constructor(tracks = [new Track('video'), new Track('audio')]) { this.tracks = [...tracks]; }
  getTracks() { return this.tracks; }
  getAudioTracks() { return this.tracks.filter(t => t.kind === 'audio'); }
  getVideoTracks() { return this.tracks.filter(t => t.kind === 'video'); }
  addTrack(t: Track) { this.tracks.push(t); } removeTrack(t: Track) { this.tracks = this.tracks.filter(x => x !== t); }
}
const settings = { resolution: '1080', fps: 30, videoBitrate: 8000, audioBitrate: 128 };
let streams: Stream[];
beforeEach(() => {
  peers.length = 0; streams = [];
  vi.stubGlobal('isSecureContext', true); vi.stubGlobal('MediaStream', Stream);
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: vi.fn(async (constraints: any) => {
    const stream = new Stream(constraints.audio === false ? [new Track('video')] : undefined); streams.push(stream); return stream;
  }) } });
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
function call() {
  const c = new EventEmitter() as any;
  const sender = { track: streams[0].getVideoTracks()[0], replaceTrack: vi.fn().mockResolvedValue(undefined) };
  c.peerConnection = new EventTarget();
  c.peerConnection.getSenders = () => [sender];
  c.answer = vi.fn(); c.close = vi.fn(() => c.emit('close'));
  return { c, sender };
}
async function mount() {
  const view = render(<CallRoom roomId="ABCDEFGH2345" isHost onLeave={() => {}} settings={settings} />);
  await waitFor(() => expect(peers.length).toBe(1));
  return view;
}
it('attaches the remote stream to the mounted video and stops resources on unmount', async () => {
  const view = await mount(); const { c } = call(); const incoming = new Stream();
  act(() => { peers[0].emit('call', c); c.emit('stream', incoming); });
  expect(document.querySelector('.remote-video')?.srcObject).toBe(incoming);
  expect(c.answer).toHaveBeenCalledWith(streams[0]);
  view.unmount();
  expect(streams[0].getTracks().every(t => t.stop.mock.calls.length > 0)).toBe(true);
  expect(peers[0].destroy).toHaveBeenCalled();
});
it('switches only video and preserves microphone mute state', async () => {
  await mount(); const { c, sender } = call(); act(() => peers[0].emit('call', c));
  fireEvent.click(screen.getByRole('button', { name: 'Выключить микрофон' }));
  const audio = streams[0].getAudioTracks()[0];
  fireEvent.click(screen.getByRole('button', { name: 'Переключить камеру' }));
  await waitFor(() => expect(sender.replaceTrack).toHaveBeenCalled());
  expect(audio.stop).not.toHaveBeenCalled(); expect(audio.enabled).toBe(false);
  expect(navigator.mediaDevices.getUserMedia).toHaveBeenLastCalledWith(expect.objectContaining({ audio: false, video: expect.objectContaining({ facingMode: { ideal: 'environment' } }) }));
});
it('releases a camera granted after the screen was closed', async () => {
  let resolve!: (stream: Stream) => void;
  const pending = new Promise<Stream>(r => { resolve = r; });
  vi.mocked(navigator.mediaDevices.getUserMedia).mockReturnValue(pending as any);
  const view = render(<CallRoom roomId="ABCDEFGH2345" isHost onLeave={() => {}} settings={settings} />);
  await waitFor(() => expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled());
  view.unmount(); const late = new Stream(); await act(async () => resolve(late));
  expect(late.getTracks().every(t => t.stop.mock.calls.length > 0)).toBe(true);
  expect(peers.length).toBe(0);
});
it('offers a playback button when the browser blocks autoplay', async () => {
  vi.mocked(HTMLMediaElement.prototype.play).mockRejectedValue(new Error('gesture required'));
  await mount(); const { c } = call(); act(() => { peers[0].emit('call', c); c.emit('stream', new Stream()); });
  expect(await screen.findByRole('button', { name: 'Включить видео и звук' })).toBeTruthy();
});
