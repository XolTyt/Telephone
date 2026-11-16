import type { QualitySettings } from './types';

export function cameraConstraints(settings: QualitySettings, front: boolean): MediaTrackConstraints {
  const height = Number(settings.resolution);
  return {
    facingMode: { ideal: front ? 'user' : 'environment' },
    width: { ideal: Math.round(height * 16 / 9) },
    height: { ideal: height },
    frameRate: { ideal: settings.fps, max: settings.fps },
  };
}

export function roomFromUrl(): string {
  const room = new URL(window.location.href).searchParams.get('room') ?? '';
  return /^[A-Z2-9]{12}$/.test(room.toUpperCase()) ? room.toUpperCase() : '';
}

export function createRoom(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from(crypto.getRandomValues(new Uint8Array(12)), n => alphabet[n % 32]).join('');
}

export function invitation(room: string): string {
  const url = new URL(window.location.href);
  url.search = '';
  url.hash = '';
  url.searchParams.set('room', room);
  return url.href;
}

export async function iceConfiguration(signal: AbortSignal): Promise<RTCConfiguration> {
  const iceServers: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }];
  if (import.meta.env.VITE_ICE_SERVERS_URL) {
    const controller = new AbortController();
    const cancel = () => controller.abort();
    signal.addEventListener('abort', cancel, { once: true });
    if (signal.aborted) controller.abort();
    const timeout = setTimeout(cancel, 15000);
    let response: Response;
    try {
      response = await fetch(import.meta.env.VITE_ICE_SERVERS_URL, { signal: controller.signal, credentials: 'same-origin' });
    } finally {
      clearTimeout(timeout);
      signal.removeEventListener('abort', cancel);
    }
    if (!response.ok) throw new Error('Не удалось получить настройки сервера связи. Попробуйте ещё раз.');
    const data: unknown = await response.json();
    if (!Array.isArray(data) || !data.length || !data.every(s => s && typeof s === 'object' && 'urls' in s)) {
      throw new Error('Сервер вернул неверные настройки связи.');
    }
    iceServers.push(...data as RTCIceServer[]);
  } else if (import.meta.env.VITE_TURN_URLS) {
    iceServers.push({
      urls: import.meta.env.VITE_TURN_URLS.split(',').map((url: string) => url.trim()).filter(Boolean),
      username: import.meta.env.VITE_TURN_USERNAME,
      credential: import.meta.env.VITE_TURN_CREDENTIAL,
    });
  }
  return { iceServers, iceCandidatePoolSize: 2 };
}

export const hasTurnConfiguration = Boolean(import.meta.env.VITE_ICE_SERVERS_URL || import.meta.env.VITE_TURN_URLS);

export async function applyQuality(pc: RTCPeerConnection, settings: QualitySettings): Promise<boolean> {
  const results = await Promise.allSettled(pc.getSenders().filter(s => s.track).map(async sender => {
    const params = sender.getParameters();
    if (!params.encodings?.length) return;
    for (const encoding of params.encodings) {
      encoding.maxBitrate = (sender.track?.kind === 'video' ? settings.videoBitrate : settings.audioBitrate) * 1000;
      if (sender.track?.kind === 'video') encoding.maxFramerate = settings.fps;
    }
    if (sender.track?.kind === 'video') params.degradationPreference = 'maintain-resolution';
    try {
      await sender.setParameters(params);
    } catch (error) {
      // Some mobile engines support bitrate but not degradationPreference.
      if (sender.track?.kind !== 'video') throw error;
      delete params.degradationPreference;
      await sender.setParameters(params);
    }
  }));
  return results.every(r => r.status === 'fulfilled');
}
