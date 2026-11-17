import { useCallback, useEffect, useRef, useState } from 'react';
import Peer, { type MediaConnection } from 'peerjs';
import type { QualitySettings } from '../types';
import { applyQuality, cameraConstraints, hasTurnConfiguration, iceConfiguration, invitation } from '../rtc';
import Video from './Video';

interface Props { roomId: string; isHost: boolean; onLeave: () => void; settings: QualitySettings; onDirectCall?: () => void }
type State = 'connecting' | 'waiting' | 'connected' | 'error';

export default function CallRoom({ roomId, isHost, onLeave, settings, onDirectCall }: Props) {
  const [state, setState] = useState<State>('connecting');
  const [message, setMessage] = useState('');
  const [notice, setNotice] = useState('');
  const [local, setLocal] = useState<MediaStream | null>(null);
  const [remote, setRemote] = useState<MediaStream | null>(null);
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const [front, setFront] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [stats, setStats] = useState('Ожидание статистики');
  const [attempt, setAttempt] = useState(0);
  const peerRef = useRef<Peer | null>(null);
  const callRef = useRef<MediaConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const alive = useRef(false);
  const cameraBusy = useRef(false);
  const generation = useRef(0);
  const mutedRef = useRef(false);
  const videoOffRef = useRef(false);
  const playbackBlocked = useCallback(() => setBlocked(true), []);

  useEffect(() => {
    if (!('wakeLock' in navigator)) return;
    let active = true;
    let lock: WakeLockSentinel | undefined;
    const keepScreenOn = async () => {
      if (!active || document.visibilityState !== 'visible' || (lock && !lock.released)) return;
      try {
        const acquired = await navigator.wakeLock.request('screen');
        if (active) lock = acquired; else await acquired.release();
      } catch { /* Low battery and browser policy may prevent a wake lock. */ }
    };
    document.addEventListener('visibilitychange', keepScreenOn);
    void keepScreenOn();
    return () => {
      active = false;
      document.removeEventListener('visibilitychange', keepScreenOn);
      void lock?.release();
    };
  }, []);

  useEffect(() => {
    alive.current = true;
    generation.current += 1;
    let disposed = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let deadline: ReturnType<typeof setTimeout> | undefined;
    let recovery: ReturnType<typeof setTimeout> | undefined;
    let serverDeadline: ReturnType<typeof setTimeout> | undefined;
    const abort = new AbortController();
    let stream: MediaStream | null = null;
    let peer: Peer | null = null;
    const hostId = `clearcall-v2-${roomId}`;
    const clearDeadline = () => { clearTimeout(deadline); };
    const resetRemote = () => { setRemote(null); setSeconds(0); setStats('Ожидание статистики'); };
    const scheduleDial = () => {
      clearTimeout(retry);
      if (!disposed && !isHost) retry = setTimeout(dial, 3500);
    };
    const drop = (call: MediaConnection) => {
      if (callRef.current !== call) return;
      callRef.current = null;
      clearDeadline();
      clearTimeout(recovery);
      call.close();
      if (!disposed) { resetRemote(); setState('waiting'); scheduleDial(); }
    };
    const attach = (call: MediaConnection) => {
      callRef.current = call;
      setState('connecting');
      clearDeadline();
      deadline = setTimeout(() => {
        if (disposed || callRef.current !== call) return;
        setNotice('Связь не установлена. Проверьте интернет на обоих телефонах. Повторяем подключение.');
        drop(call);
      }, 25000);
      call.on('stream', incoming => {
        if (disposed || callRef.current !== call) return;
        clearDeadline();
        setRemote(incoming);
        setState('connected');
        setNotice('');
      });
      call.on('close', () => drop(call));
      call.on('error', () => drop(call));
      const pc = call.peerConnection;
      pc.addEventListener('connectionstatechange', () => {
        if (disposed || callRef.current !== call) return;
        if (pc.connectionState === 'connected') {
          clearTimeout(recovery);
          clearDeadline();
          setState('connected');
          void applyQuality(pc, settings).then(ok => {
            if (!disposed && !ok) setNotice('Браузер сам управляет частью параметров качества.');
          });
        } else if (pc.connectionState === 'failed') drop(call);
        else if (pc.connectionState === 'disconnected') {
          setState('connecting');
          clearTimeout(recovery);
          recovery = setTimeout(() => drop(call), 10000);
        }
      });
    };
    function dial() {
      if (disposed || !peer?.open || !stream || callRef.current) return;
      const call = peer.call(hostId, stream);
      if (call) attach(call); else scheduleDial();
    }
    const init = async () => {
      try {
        setState('connecting'); setMessage(''); setNotice(''); resetRemote();
        if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
          throw new Error('Для камеры нужна ссылка HTTPS. Откройте сайт в Safari или Chrome, вне встроенного браузера мессенджера.');
        }
        const config = await iceConfiguration(abort.signal);
        if (disposed) return;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: cameraConstraints(settings, true),
            audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          });
        } catch (error) {
          if (error instanceof DOMException && error.name === 'OverconstrainedError') {
            stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: true });
          } else throw error;
        }
        if (disposed) { stream.getTracks().forEach(t => t.stop()); return; }
        stream.getAudioTracks().forEach(t => { t.enabled = !mutedRef.current; });
        stream.getVideoTracks().forEach(t => { t.enabled = !videoOffRef.current; });
        streamRef.current = stream; setLocal(stream); setFront(true);
        const options = {
          config,
          ...(import.meta.env.VITE_PEER_HOST ? {
            host: import.meta.env.VITE_PEER_HOST,
            port: Number(import.meta.env.VITE_PEER_PORT || 443),
            path: import.meta.env.VITE_PEER_PATH || '/', secure: import.meta.env.VITE_PEER_SECURE !== 'false',
          } : {}),
        };
        peer = isHost ? new Peer(hostId, options) : new Peer(options);
        peerRef.current = peer;
        serverDeadline = setTimeout(() => {
          if (disposed || peer?.open) return;
          setMessage('Сервер подключения не отвечает из этой сети. Попробуйте звонок без сервера подключения.');
          setState('error');
          peer?.destroy();
        }, 20000);
        peer.on('open', () => {
          if (disposed) return;
          clearTimeout(serverDeadline);
          setNotice('');
          if (!callRef.current) setState('waiting');
          if (!isHost) dial();
        });
        peer.on('call', call => {
          if (disposed || !isHost || callRef.current || !stream) { call.close(); return; }
          // PeerJS creates the RTCPeerConnection when answering.
          call.answer(stream);
          attach(call);
        });
        peer.on('error', error => {
          if (disposed) return;
          clearTimeout(serverDeadline);
          if (error.type === 'peer-unavailable') {
            if (callRef.current) drop(callRef.current);
            setState('waiting');
            setNotice('Ждём первый телефон. Комната должна быть открыта на нём. Если комната занята, дождитесь завершения звонка.');
            scheduleDial();
          } else if (error.type === 'network' || error.type === 'server-error' || error.type === 'socket-error') {
            setNotice('Сервер связи недоступен. Проверьте интернет и нажмите «Переподключиться».');
            if (!callRef.current) { setMessage('Нет связи с сервером подключения.'); setState('error'); }
          } else {
            setMessage(error.type === 'unavailable-id' ? 'Эта комната уже открыта на другом устройстве. Создайте новую комнату.' : `Не удалось подключиться: ${error.message}`);
            setState('error');
          }
        });
        peer.on('disconnected', () => {
          if (disposed) return;
          clearTimeout(retry);
          retry = setTimeout(() => {
            if (!disposed && peer && !peer.destroyed && peer.disconnected) {
              try { peer.reconnect(); } catch { setNotice('Нажмите «Переподключиться», чтобы восстановить связь.'); }
            }
          }, 2000);
        });
      } catch (error) {
        if (disposed) return;
        const name = error instanceof DOMException ? error.name : '';
        const explanation = name === 'NotAllowedError' ? 'Разрешите камеру и микрофон в настройках браузера и повторите вход.'
          : name === 'NotFoundError' ? 'Камера или микрофон не найдены.'
          : name === 'NotReadableError' ? 'Камера занята другим приложением. Закройте его и повторите вход.'
          : error instanceof Error ? error.message : 'Не удалось запустить камеру.';
        setMessage(explanation); setState('error');
      }
    };
    const online = () => {
      if (peer?.disconnected && !peer.destroyed) { try { peer.reconnect(); } catch { /* manual retry remains available */ } }
      if (!isHost) scheduleDial();
    };
    window.addEventListener('online', online);
    void init();
    return () => {
      disposed = true; alive.current = false; abort.abort();
      clearTimeout(retry); clearTimeout(deadline); clearTimeout(recovery); clearTimeout(serverDeadline);
      window.removeEventListener('online', online);
      const call = callRef.current; callRef.current = null; call?.close();
      peer?.destroy(); peerRef.current = null;
      streamRef.current?.getTracks().forEach(t => t.stop());
      stream?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    };
  }, [roomId, isHost, settings, attempt]);

  useEffect(() => {
    if (state !== 'connected') return;
    const timer = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(timer);
  }, [state]);

  useEffect(() => {
    if (state !== 'connected') return;
    let active = true;
    let busy = false;
    const previous = new Map<string, { bytes: number; time: number }>();
    const timer = setInterval(async () => {
      const pc = callRef.current?.peerConnection;
      if (!pc || busy) return;
      busy = true;
      try {
        const report = await pc.getStats();
        const parts: string[] = [];
        report.forEach(item => {
          if ((item.type === 'inbound-rtp' || item.type === 'outbound-rtp') && (item.kind === 'video' || item.mediaType === 'video') && !item.isRemote) {
            const bytes = item.bytesReceived ?? item.bytesSent ?? 0;
            const last = previous.get(item.id);
            const rate = last && item.timestamp > last.time ? Math.max(0, (bytes - last.bytes) * 8 / (item.timestamp - last.time)) : null;
            previous.set(item.id, { bytes, time: item.timestamp });
            const direction = item.type === 'inbound-rtp' ? 'Приём' : 'Отправка';
            parts.push(`${direction}: ${item.frameWidth && item.frameHeight ? `${item.frameWidth}×${item.frameHeight}` : '—'} · ${Math.round(item.framesPerSecond ?? 0)} FPS${rate === null ? '' : ` · ${(rate / 1000).toFixed(1)} Мбит/с`}${item.qualityLimitationReason === 'bandwidth' ? ' · ограничено сетью' : ''}`);
          }
          if (item.type === 'transport' && item.selectedCandidatePairId) {
            const pair = report.get(item.selectedCandidatePairId);
            const candidate = pair && report.get(pair.localCandidateId);
            if (candidate) parts.push(candidate.candidateType === 'relay' ? 'Через TURN' : 'Прямое соединение');
          }
        });
        if (active) setStats(parts.join(' | ') || 'Браузер пока не предоставил статистику');
      } catch { /* stats are optional; the call continues */ }
      finally { busy = false; }
    }, 2000);
    return () => { active = false; clearInterval(timer); };
  }, [state]);

  const switchCamera = async () => {
    if (cameraBusy.current || !streamRef.current) return;
    cameraBusy.current = true; setSwitching(true);
    const currentGeneration = generation.current;
    const old = streamRef.current.getVideoTracks()[0];
    let replacement: MediaStream | null = null;
    try {
      // Mobile browsers often require releasing the old camera first. Audio stays alive.
      old?.stop();
      replacement = await navigator.mediaDevices.getUserMedia({ video: cameraConstraints(settings, !front), audio: false });
      if (!alive.current || generation.current !== currentGeneration) { replacement.getTracks().forEach(t => t.stop()); return; }
      const track = replacement.getVideoTracks()[0];
      track.enabled = !videoOffRef.current;
      const sender = callRef.current?.peerConnection.getSenders().find(s => s.track?.kind === 'video');
      if (sender) await sender.replaceTrack(track);
      if (!alive.current || generation.current !== currentGeneration) { track.stop(); return; }
      const stream = streamRef.current!;
      if (old) stream.removeTrack(old);
      stream.addTrack(track);
      setLocal(new MediaStream(stream.getTracks()));
      setFront(!front);
      if (callRef.current) await applyQuality(callRef.current.peerConnection, settings);
    } catch {
      replacement?.getTracks().forEach(t => t.stop());
      if (alive.current && generation.current === currentGeneration) {
        setNotice('Не удалось сменить камеру. Нажмите «Переподключиться», чтобы восстановить видео. Звук продолжает работать.');
      }
    } finally { cameraBusy.current = false; if (alive.current) setSwitching(false); }
  };

  const share = async () => {
    const url = invitation(roomId);
    try {
      if (navigator.share) await navigator.share({ title: 'Звонок ClearCall', url });
      else { await navigator.clipboard.writeText(url); setNotice('Ссылка скопирована. Отправьте её на второй телефон.'); }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) setNotice(`Скопируйте ссылку: ${url}`);
    }
  };
  const resume = async () => {
    const videos = Array.from(document.querySelectorAll('video'));
    const results = await Promise.allSettled(videos.map(v => v.play()));
    setBlocked(results.some(r => r.status === 'rejected'));
  };

  return <div className="call-screen">
    <div className="remote-stage">
      <Video stream={remote} onBlocked={playbackBlocked} />
      {!remote && <div className="call-placeholder">
        <div className="text-5xl mb-5">📹</div>
        <h1 className="text-xl font-semibold">{state === 'error' ? 'Не удалось начать звонок' : state === 'connecting' ? 'Подключение…' : 'Ожидаем второй телефон'}</h1>
        <p className="text-slate-400 mt-3 max-w-sm">{state === 'error' ? message : isHost ? 'Отправьте ссылку собеседнику и оставайтесь на этой странице.' : 'Первый телефон должен открыть комнату. Подключение повторяется автоматически.'}</p>
        {isHost && state !== 'error' && <button className="btn-primary mt-6" onClick={share}>Отправить ссылку</button>}
        {state === 'error' && onDirectCall && <button className="btn-primary mt-4" onClick={onDirectCall}>Позвонить без сервера подключения</button>}
      </div>}
    </div>
    <div className="call-header">
      <span className="quality-badge fhd">{state === 'connected' ? `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}` : state === 'connecting' ? 'Подключение' : 'ClearCall'}</span>
      <button className="text-xs text-slate-300 underline" onClick={() => setAttempt(n => n + 1)} disabled={switching}>Переподключиться</button>
    </div>
    <div className="local-preview"><Video stream={local} local hidden={videoOff} />{videoOff && <span className="absolute inset-0 flex items-center justify-center">Камера выключена</span>}</div>
    <div className="call-footer">
      {blocked && <button className="btn-primary mb-3" onClick={resume}>Включить видео и звук</button>}
      {notice && <p role="status" className="call-notice">{notice}</p>}
      {!hasTurnConfiguration && <p className="text-xs text-amber-200 mb-3">TURN не настроен: некоторые мобильные сети могут не соединиться.</p>}
      {state === 'connected' && <p className="text-xs text-slate-300 mb-3" aria-label="Статистика качества">{stats}</p>}
      <div className="flex justify-center gap-2 mb-3"><button className="room-link" onClick={share}>Поделиться ссылкой</button><span className="room-link font-mono">{roomId}</span></div>
      <div className="flex justify-center gap-3">
        <button className={`btn-control ${muted ? 'active' : ''}`} aria-label={muted ? 'Включить микрофон' : 'Выключить микрофон'} aria-pressed={muted} onClick={() => {
          mutedRef.current = !muted; setMuted(!muted); streamRef.current?.getAudioTracks().forEach(t => { t.enabled = !mutedRef.current; });
        }}>{muted ? '🔇' : '🎤'}</button>
        <button className={`btn-control ${videoOff ? 'active' : ''}`} aria-label={videoOff ? 'Включить камеру' : 'Выключить камеру'} aria-pressed={videoOff} onClick={() => {
          videoOffRef.current = !videoOff; setVideoOff(!videoOff); streamRef.current?.getVideoTracks().forEach(t => { t.enabled = !videoOffRef.current; });
        }}>{videoOff ? '🚫' : '📹'}</button>
        <button className="btn-danger" aria-label="Завершить звонок" onClick={onLeave}>☎</button>
        <button className="btn-control" aria-label="Переключить камеру" disabled={switching || !local} onClick={switchCamera}>{switching ? '…' : '🔄'}</button>
      </div>
    </div>
  </div>;
}
