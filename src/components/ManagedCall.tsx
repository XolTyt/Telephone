import { useCallback, useEffect, useRef, useState } from 'react';
import { MeteredPeer, type RemotePeer } from '@metered-ca/realtime';
import { applyQuality, cameraConstraints, invitation } from '../rtc';
import Video from './Video';

const quality = { resolution: '1080', fps: 30, videoBitrate: 8000, audioBitrate: 128 };
function explanation(error: unknown): string {
  const code = (error as { code?: string; closeCode?: number })?.code ?? (error as { closeCode?: number })?.closeCode ?? (error as Error)?.name;
  if (code === 'action_not_permitted' || code === 'channel_not_authorized' || code === 4003) return 'Сервер отклонил разрешения приложения. Владельцу нужно включить Send, Subscribe, Publish и Presence у ключа.';
  if (code === 4001 || code === 4002 || code === 4012) return 'Ключ сервера звонков недействителен или отключён. Владельцу приложения нужно проверить настройку.';
  if (code === 'over_message_quota' || code === 4010 || code === 4011) return 'Достигнут лимит сервиса звонков. Попробуйте позже; владелец может проверить квоты.';
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError') return 'Разрешите камеру и микрофон в настройках браузера и нажмите «Подключиться снова».';
    if (error.name === 'NotFoundError') return 'На устройстве не найдена камера или микрофон.';
    if (error.name === 'NotReadableError') return 'Камера занята другим приложением. Закройте его и повторите вход.';
  }
  return 'Не удалось подключиться к звонку. Проверьте интернет и нажмите «Подключиться снова». Данные проверки доступны ниже.';
}

export default function ManagedCall({ roomId, onLeave }: { roomId: string; onLeave: () => void }) {
  const [local, setLocal] = useState<MediaStream | null>(null);
  const [remote, setRemote] = useState<MediaStream | null>(null);
  const [status, setStatus] = useState('Подключаемся…');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [ready, setReady] = useState(false);
  const [setupMissing, setSetupMissing] = useState(false);
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const [front, setFront] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [stats, setStats] = useState('');
  const [checks, setChecks] = useState<string[]>([]);
  const peerRef = useRef<MeteredPeer | null>(null);
  const selectedRef = useRef<RemotePeer | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const epoch = useRef(0);
  const busy = useRef(false);
  const publicOrigin = useRef('');
  const playbackBlocked = useCallback(() => setBlocked(true), []);

  useEffect(() => {
    let disposed = false;
    ++epoch.current;
    const abort = new AbortController();
    let peer: MeteredPeer | null = null;
    let deadline: ReturnType<typeof setTimeout> | undefined;
    let negotiationDeadline: ReturnType<typeof setTimeout> | undefined;
    let reconnectDeadline: ReturnType<typeof setTimeout> | undefined;
    const record = (text: string) => { if (!disposed) setChecks(previous => [...previous.slice(-11), text]); };
    const stop = () => {
      clearTimeout(deadline); clearTimeout(negotiationDeadline); clearTimeout(reconnectDeadline);
      selectedRef.current = null;
      streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null;
      if (peer) { peer.removeAllListeners(); void peer.close().catch(() => {}); }
      if (peerRef.current === peer) peerRef.current = null;
    };
    const fail = (text: string, code: string) => {
      if (disposed) return;
      ++epoch.current;
      record(code); setError(text); setStatus('Не удалось начать звонок'); setReady(false); setRemote(null); setLocal(null);
      stop();
    };
    const attach = (other: RemotePeer) => {
      if (disposed) return;
      if (selectedRef.current && selectedRef.current.id !== other.id) {
        // Close before the browser's queued negotiationneeded event can offer media.
        other.pc.close();
        void peer?.sendTo(other.id, { clearcall: 'busy', v: 1 }).catch(() => {});
        return;
      }
      selectedRef.current = other;
      setStatus('Соединяем телефоны…');
      record('Собеседник найден');
      clearTimeout(negotiationDeadline);
      negotiationDeadline = setTimeout(() => {
        if (!disposed && selectedRef.current === other && other.state !== 'connected') {
          record('Медиа ещё не установлены: проверьте TURN, сеть и разрешение Send');
          setError('Телефоны нашли друг друга, но видео пока не соединилось. Восстанавливаем связь; можно повторить подключение.');
        }
      }, 25000);
      other.on('stream-added', ({ stream }) => {
        if (!disposed && selectedRef.current === other) { setRemote(stream); setError(''); }
      });
      other.on('stream-removed', () => { if (!disposed && selectedRef.current === other) setRemote(null); });
      const apply = () => {
        if (disposed || selectedRef.current !== other) return;
        void applyQuality(other.pc as RTCPeerConnection, quality).then(ok => {
          if (!disposed && !ok) record('Часть параметров качества управляется браузером');
        });
      };
      other.on('state-change', ({ to }) => {
        if (disposed || selectedRef.current !== other) return;
        if (to === 'connected') { clearTimeout(negotiationDeadline); setStatus('На связи'); setError(''); record('Медиа подключены'); apply(); }
        else if (to === 'reconnecting') { setStatus('Восстанавливаем видео…'); record('Восстановление медиасоединения'); }
      });
      other.on('connection-reset', apply);
      other.on('negotiation-error', ({ err }) => {
        if (disposed || selectedRef.current !== other) return;
        record(`Медиа: ${err.name}`);
        if (err.name === 'IceRestartExhaustedError') fail('Не удалось восстановить медиасоединение. Нажмите «Подключиться снова».', 'Исчерпаны попытки ICE');
      });
      if (other.state === 'connected') apply();
    };
    const start = async () => {
      busy.current = false; setSwitching(false);
      setError(''); setNotice(''); setReady(false); setSetupMissing(false); setLocal(null); setRemote(null); setStats(''); setChecks([]); setStatus('Проверяем подключение…');
      deadline = setTimeout(() => {
        abort.abort(); fail('Сервер звонков не ответил за 25 секунд. Попробуйте снова или другую сеть.', 'Тайм-аут сервера');
      }, 25000);
      try {
        if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) throw new DOMException('HTTPS required', 'NotAllowedError');
        const response = await fetch('/api/call-config', { signal: abort.signal });
        const config = await response.json();
        if (disposed || abort.signal.aborted) return;
        if (!response.ok || !/^pk_live_[A-Za-z0-9_-]{8,256}$/.test(config.apiKey ?? '')) {
          setSetupMissing(true);
          fail('Сервис звонков ещё не подключён владельцем приложения. Настройки камеры менять не нужно.', 'Не настроен публичный ключ сервиса');
          return;
        }
        record(`Версия: ${config.version ?? 'неизвестна'}`);
        publicOrigin.current = typeof config.publicOrigin === 'string' && /^https:\/\//.test(config.publicOrigin) ? config.publicOrigin : '';
        record('Настройки получены');
        peer = new MeteredPeer({ apiKey: config.apiKey,
          ...(import.meta.env.MODE === 'e2e' && import.meta.env.VITE_TEST_SIGNAL_URL ? { url: import.meta.env.VITE_TEST_SIGNAL_URL } : {}),
          reconnect: { initialDelayMs: 500, maxDelayMs: 5000, maxAttempts: 12 }, inactivityTimeoutMs: 20000,
          rtcPeerConnectionFactory: config => {
            const urls = (config.iceServers ?? []).flatMap(s => typeof s.urls === 'string' ? [s.urls] : s.urls);
            record(urls.some(url => /^turns?:/.test(url)) ? 'TURN получен от сервиса' : 'TURN не выдан сервисом');
            const relayMode = new URLSearchParams(location.search).get('relay');
            const iceServers = relayMode === 'tls' ? (config.iceServers ?? []).flatMap(server => {
              const urls = (typeof server.urls === 'string' ? [server.urls] : server.urls).filter(url => /^turns:/.test(url));
              return urls.length ? [{ ...server, urls }] : [];
            }) : config.iceServers;
            return new RTCPeerConnection({ ...config, iceServers, ...(['1', 'tls'].includes(relayMode ?? '') ? { iceTransportPolicy: 'relay' as const } : {}) });
          },
        });
        peerRef.current = peer;
        peer.on('peer-joined', ({ peer: other }) => attach(other));
        peer.on('peer-left', ({ peer: other }) => {
          if (disposed || selectedRef.current?.id !== other.id) return;
          selectedRef.current = null; clearTimeout(negotiationDeadline); setRemote(null); setStats(''); setError(''); setStatus('Собеседник вышел. Ждём возвращения');
          record('Собеседник вышел');
        });
        peer.on('data', ({ data, senderPeerId }) => {
          // A rejected third participant must not be able to disconnect an existing pair.
          if ((data as { clearcall?: string })?.clearcall === 'busy' && selectedRef.current?.id === senderPeerId && selectedRef.current.state !== 'connected') {
            fail('В этом звонке уже два человека. Дождитесь завершения или создайте новый звонок.', 'Комната занята');
          }
        });
        peer.on('state-change', ({ to }) => {
          if (disposed) return;
          if (to === 'reconnecting') {
            setStatus('Восстанавливаем связь…'); record('Восстановление сервера');
            clearTimeout(reconnectDeadline);
            reconnectDeadline = setTimeout(() => {
              if (!disposed) setError('Восстановление занимает дольше обычного. Можно нажать «Подключиться снова».');
            }, 20000);
          }
          if (to === 'joined') {
            clearTimeout(reconnectDeadline);
            if (selectedRef.current?.state === 'connected') { setStatus('На связи'); setError(''); }
          }
        });
        peer.on('left', () => { if (!disposed) fail('Связь с сервером прервалась. Нажмите «Подключиться снова».', 'Сервер отключился'); });
        peer.on('error', ({ err }) => fail(explanation(err), `Сервер: ${err.name}`));
        await peer.join(`clearcall-${roomId}`);
        if (disposed || abort.signal.aborted || peerRef.current !== peer) return;
        clearTimeout(deadline);
        record('Сервер подключён');
        setStatus('Разрешите камеру и микрофон');
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: cameraConstraints(quality, true), audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
        } catch (e) {
          if (!(e instanceof DOMException) || e.name !== 'OverconstrainedError') throw e;
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: true });
        }
        if (disposed || peerRef.current !== peer) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream; setLocal(stream); setMuted(false); setVideoOff(false); setFront(true);
        peer.addStream(stream);
        record('Камера и микрофон подключены');
        setReady(true); setStatus(selectedRef.current ? 'Соединяем телефоны…' : 'Ждём собеседника');
      } catch (e) {
        if (!disposed && !abort.signal.aborted) fail(explanation(e), `Ошибка: ${(e as Error)?.name ?? 'unknown'}`);
      }
    };
    void start();
    return () => { disposed = true; ++epoch.current; abort.abort(); stop(); peerRef.current = null; };
  }, [roomId, attempt]);

  useEffect(() => {
    let live = true; let running = false;
    let current: RTCPeerConnection | null = null;
    const previous = new Map<string, { time: number; bytes: number }>();
    const timer = setInterval(async () => {
      const pc = selectedRef.current?.pc as RTCPeerConnection | undefined;
      if (!pc || running || pc.connectionState !== 'connected') return;
      if (current !== pc) { previous.clear(); current = pc; }
      running = true;
      try {
        const report = await pc.getStats(); const parts: string[] = [];
        report.forEach(item => {
          if ((item.type === 'inbound-rtp' || item.type === 'outbound-rtp') && (item.kind === 'video' || item.mediaType === 'video') && !item.isRemote) {
            const bytes = item.bytesSent ?? item.bytesReceived ?? 0; const last = previous.get(item.id);
            const rate = last && item.timestamp > last.time ? Math.max(0, (bytes - last.bytes) * 8 / (item.timestamp - last.time) / 1000).toFixed(1) : null;
            previous.set(item.id, { time: item.timestamp, bytes });
            parts.push(`${item.type === 'inbound-rtp' ? 'Приём' : 'Отправка'}: ${item.frameWidth ?? '—'}×${item.frameHeight ?? '—'} · ${Math.round(item.framesPerSecond ?? 0)} FPS${rate ? ` · ${rate} Мбит/с` : ''}${item.qualityLimitationReason === 'bandwidth' ? ' · ограничено сетью' : ''}`);
          }
          if (item.type === 'transport' && item.selectedCandidatePairId) {
            const pair = report.get(item.selectedCandidatePairId); const candidate = pair && report.get(pair.localCandidateId);
            if (candidate) parts.push(candidate.candidateType === 'relay' ? 'Через TURN' : 'Напрямую');
          }
        });
        if (live) setStats(parts.join(' | '));
      } catch { /* Stats must never interrupt media. */ }
      finally { running = false; }
    }, 2000);
    return () => { live = false; clearInterval(timer); };
  }, [attempt]);

  useEffect(() => {
    if (!('wakeLock' in navigator)) return;
    let live = true; let pending = false; let lock: WakeLockSentinel | undefined;
    const request = async () => {
      if (!live || pending || document.visibilityState !== 'visible' || (lock && !lock.released)) return;
      pending = true;
      try { const acquired = await navigator.wakeLock.request('screen'); if (live) lock = acquired; else await acquired.release(); } catch { /* Battery/browser policy */ }
      finally { pending = false; }
    };
    void request(); document.addEventListener('visibilitychange', request);
    return () => { live = false; document.removeEventListener('visibilitychange', request); void lock?.release(); };
  }, []);
  const share = async () => {
    const link = new URL(invitation(roomId));
    const url = publicOrigin.current ? new URL(`${link.pathname}${link.search}`, publicOrigin.current).href : link.href;
    try { if (navigator.share) await navigator.share({ title: 'Видеозвонок ClearCall', url }); else { await navigator.clipboard.writeText(url); setNotice('Ссылка скопирована. Отправьте её собеседнику.'); } }
    catch (e) { if (!(e instanceof DOMException && e.name === 'AbortError')) setNotice(`Скопируйте ссылку: ${url}`); }
  };
  const switchCamera = async () => {
    const stream = streamRef.current; const peer = peerRef.current;
    if (!stream || !peer || busy.current) return;
    busy.current = true; setSwitching(true); const generation = epoch.current;
    const old = stream.getVideoTracks()[0]; old?.stop();
    let acquired: MediaStream | null = null;
    try {
      let changed = true;
      try { acquired = await navigator.mediaDevices.getUserMedia({ video: cameraConstraints(quality, !front), audio: false }); }
      catch { changed = false; acquired = await navigator.mediaDevices.getUserMedia({ video: cameraConstraints(quality, front), audio: false }); }
      if (generation !== epoch.current) { acquired.getTracks().forEach(t => t.stop()); return; }
      const track = acquired.getVideoTracks()[0]; track.enabled = !videoOff;
      await peer.replaceTrack(old, track);
      if (generation !== epoch.current) { track.stop(); return; }
      stream.removeTrack(old); stream.addTrack(track); setLocal(new MediaStream(stream.getTracks()));
      if (changed) setFront(!front); else setNotice('Другую камеру включить не удалось. Возвращена прежняя камера.');
      if (selectedRef.current) await applyQuality(selectedRef.current.pc as RTCPeerConnection, quality);
    } catch { acquired?.getTracks().forEach(t => t.stop()); if (generation === epoch.current) setError('Не удалось восстановить камеру. Звук сохраняется; нажмите «Подключиться снова» для восстановления видео.'); }
    finally { if (generation === epoch.current) { busy.current = false; setSwitching(false); } }
  };
  return <main className="call-screen">
    <div className="remote-stage"><Video stream={remote} onBlocked={playbackBlocked} />
      {!remote && <div className="call-placeholder"><div className="text-5xl mb-4">📹</div><h1 className="text-xl font-semibold">{status}</h1><p className="text-slate-300 mt-3 max-w-md">{error || (ready ? 'Отправьте ссылку собеседнику. Ему достаточно открыть её и нажать «Войти».' : 'Сейчас подготовим звонок.')}</p></div>}
    </div>
    {local && <div className="local-preview"><Video stream={local} local hidden={videoOff} />{videoOff && <span className="absolute inset-0 flex items-center justify-center text-xs">Камера выключена</span>}</div>}
    <div className="call-header"><span className="quality-badge fhd">ClearCall</span>{remote && <span role="status" className="text-xs text-slate-300">{status}</span>}</div>
    <div className="call-footer">
      {notice && <p role="status" className="call-notice">{notice}</p>}
      {remote && error && <p role="alert" className="call-notice">{error}</p>}
      {error && !setupMissing && <button className="btn-primary mb-3" onClick={() => setAttempt(n => n + 1)}>Подключиться снова</button>}
      {blocked && <button className="btn-primary mb-3" onClick={async () => {
        const results = await Promise.allSettled(Array.from(document.querySelectorAll('video'), v => v.play())); setBlocked(results.some(r => r.status === 'rejected'));
      }}>Включить видео и звук</button>}
      {ready && <button className="btn-primary mb-4" onClick={share}>Отправить ссылку</button>}
      <div className="flex justify-center gap-3">
        {local && <><button className={`btn-control ${muted ? 'active' : ''}`} aria-label={muted ? 'Включить микрофон' : 'Выключить микрофон'} aria-pressed={muted} onClick={() => { streamRef.current?.getAudioTracks().forEach(t => { t.enabled = muted; }); setMuted(!muted); }}>{muted ? '🔇' : '🎤'}</button><button className={`btn-control ${videoOff ? 'active' : ''}`} aria-label={videoOff ? 'Включить камеру' : 'Выключить камеру'} aria-pressed={videoOff} onClick={() => { streamRef.current?.getVideoTracks().forEach(t => { t.enabled = videoOff; }); setVideoOff(!videoOff); }}>📹</button><button className="btn-control" aria-label="Переключить камеру" disabled={switching} onClick={switchCamera}>🔄</button></>}
        <button className="btn-danger" aria-label="Завершить звонок" onClick={onLeave}>☎</button>
      </div>
      <details className="call-details"><summary>Качество и проверка связи</summary><p aria-label="Статистика качества">{stats || 'Медиа ещё не подключены'}</p><p>Запрос: 1080p, 30 FPS, до 8 Мбит/с. Реальное качество зависит от камеры и сети.</p><ul>{checks.map((check, index) => <li key={index}>{check}</li>)}</ul><button className="room-link mt-2" onClick={async () => {
        try { await navigator.clipboard.writeText([...checks, stats].filter(Boolean).join('\n')); setNotice('Данные проверки скопированы. Можно отправить их владельцу приложения.'); }
        catch { setNotice('Не удалось скопировать данные. Можно сделать скриншот этого раздела.'); }
      }}>Скопировать данные проверки</button></details>
    </div>
  </main>;
}
