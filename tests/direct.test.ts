import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Blob as NodeBlob } from 'node:buffer';
import { signalLink, readSignal, gatherCandidates } from '../src/direct';
const packet = { v: 1 as const, room: 'ABCDEFGH2345', created: Date.now(), type: 'offer' as const, sdp: 'v=0\r\na=test\r\n' };
beforeEach(() => vi.stubGlobal('Blob', NodeBlob));
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
describe('direct signaling links', () => {
  it('round trips an offer in the fragment, not the server query', async () => {
    const link = await signalLink(packet);
    const url = new URL(link);
    expect(url.search).toBe(''); expect(url.hash).toContain('direct=');
    expect(await readSignal(link)).toEqual(packet);
  });
  it('rejects malformed, oversized, expired and unsupported links', async () => {
    await expect(readSignal('javascript:alert(1)')).rejects.toThrow();
    await expect(readSignal('https://example.com/#direct=jINVALID')).rejects.toThrow();
    await expect(readSignal('https://example.com/#direct=j' + 'a'.repeat(65000))).rejects.toThrow();
    await expect(readSignal(await signalLink({ ...packet, created: Date.now() - 7300000 }))).rejects.toThrow('устарело');
    await expect(readSignal(await signalLink({ ...packet, sdp: '<script>' }))).rejects.toThrow();
  });
  it('does not wait forever for unreachable STUN, and removes listeners', async () => {
    vi.useFakeTimers();
    const pc = new EventTarget() as RTCPeerConnection;
    const remove = vi.spyOn(pc, 'removeEventListener');
    const promise = gatherCandidates(pc, new AbortController().signal);
    await vi.advanceTimersByTimeAsync(12000); await promise;
    expect(remove).toHaveBeenCalledWith('icegatheringstatechange', expect.any(Function));
  });
  it('aborts candidate collection when the call is closed', async () => {
    const pc = new EventTarget() as RTCPeerConnection;
    const controller = new AbortController();
    const promise = gatherCandidates(pc, controller.signal);
    controller.abort();
    await expect(promise).rejects.toThrow('Cancelled');
  });
});
