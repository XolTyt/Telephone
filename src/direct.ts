export interface DirectSignal {
  v: 1;
  room: string;
  created: number;
  type: 'offer' | 'answer';
  sdp: string;
}
const MAX_BYTES = 64000;

export async function signalLink(signal: DirectSignal): Promise<string> {
  const raw = new TextEncoder().encode(JSON.stringify(signal));
  let bytes: Uint8Array = raw;
  let format = 'j';
  if (typeof CompressionStream !== 'undefined') {
    bytes = new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer());
    format = 'z';
  }
  const encoded = btoa(Array.from(bytes, b => String.fromCharCode(b)).join('')).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const url = new URL(window.location.href);
  url.search = '';
  url.hash = `direct=${format}${encoded}`;
  return url.href;
}

export async function readSignal(input: string): Promise<DirectSignal> {
  let url: URL;
  try { url = new URL(input.trim()); }
  catch { throw new Error('Вставьте полную ссылку ClearCall, полученную от собеседника.'); }
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Вставьте полную ссылку ClearCall.');
  const token = new URLSearchParams(url.hash.slice(1)).get('direct') ?? '';
  if (token.length < 2 || token.length > MAX_BYTES || !/^[jz][A-Za-z0-9_-]+$/.test(token)) throw new Error('Ссылка неполная или повреждена. Попросите отправить её целиком.');
  const bytes = Uint8Array.from(atob(token.slice(1).replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
  let decoded: Uint8Array = bytes;
  if (token[0] === 'z') {
    if (typeof DecompressionStream === 'undefined') throw new Error('Обновите браузер для открытия этой ссылки.');
    const reader = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate')).getReader();
    const chunks: Uint8Array[] = []; let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > MAX_BYTES) throw new Error('Ссылка слишком большая.');
        chunks.push(value);
      }
    } finally { await reader.cancel().catch(() => {}); }
    decoded = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { decoded.set(chunk, offset); offset += chunk.length; }
  }
  let packet: DirectSignal;
  try { packet = JSON.parse(new TextDecoder().decode(decoded)); }
  catch { throw new Error('Ссылка повреждена. Попросите отправить её целиком.'); }
  if (packet?.v !== 1 || !/^[A-HJ-NP-Z2-9]{12}$/.test(packet.room) || !['offer', 'answer'].includes(packet.type)
    || typeof packet.sdp !== 'string' || !packet.sdp.startsWith('v=0\r\n') || packet.sdp.length > 60000
    || typeof packet.created !== 'number' || packet.created > Date.now() + 300000 || Date.now() - packet.created > 7200000) {
    throw new Error('Приглашение неверно или устарело. Создайте новое.');
  }
  return packet;
}

export function hasDirectLink(): boolean {
  return new URLSearchParams(window.location.hash.slice(1)).has('direct');
}

export function gatherCandidates(pc: RTCPeerConnection, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout>;
    const cleanup = () => {
      clearTimeout(timer);
      pc.removeEventListener('icegatheringstatechange', changed);
      signal.removeEventListener('abort', aborted);
    };
    const finish = () => { cleanup(); resolve(); };
    const changed = () => { if (pc.iceGatheringState === 'complete') finish(); };
    const aborted = () => { cleanup(); reject(new DOMException('Cancelled', 'AbortError')); };
    pc.addEventListener('icegatheringstatechange', changed);
    signal.addEventListener('abort', aborted, { once: true });
    // Unreachable STUN must not block sharing indefinitely; keep gathered candidates.
    timer = setTimeout(finish, 12000);
    if (signal.aborted) aborted(); else changed();
  });
}
