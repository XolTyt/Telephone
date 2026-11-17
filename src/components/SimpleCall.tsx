import { useCallback, useEffect, useRef, useState } from 'react';
import { Room, RoomEvent, Track, createLocalTracks, type LocalTrack, type LocalVideoTrack, type RemoteTrack } from 'livekit-client';
import { invitation } from '../rtc';
import Video from './Video';

interface Props { roomId: string; onLeave: () => void }
export default function SimpleCall({ roomId, onLeave }: Props) {
  const [local, setLocal] = useState<MediaStream | null>(null);
  const [remote, setRemote] = useState<MediaStream | null>(null);
  const [status, setStatus] = useState('Подключаемся…');
  const [error, setError] = useState('');
  const [setup, setSetup] = useState(false);
  const [notice, setNotice] = useState('');
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const [front, setFront] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [ready, setReady] = useState(false);
  const roomRef = useRef<Room | null>(null);
  const tracksRef = useRef<LocalTrack[]>([]);
  const busyRef = useRef(false);
  const epoch = useRef(0);
  const playbackBlocked = useCallback(() => setBlocked(true), []);

  useEffect(() => {
    let disposed = false;
    const generation = ++epoch.current;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);
    const room = new Room({
      adaptiveStream: false, dynacast: true,
      videoCaptureDefaults: { resolution: { width: 1920, height: 1080, frameRate: 30 }, facingMode: 'user' },
      publishDefaults: { videoEncoding: { maxBitrate: 8_000_000, maxFramerate: 30 }, simulcast: true },
    });
    roomRef.current = room;
    const remoteTracks = new Map<string, MediaStreamTrack>();
    const updateRemote = () => { if (!disposed) setRemote(remoteTracks.size ? new MediaStream([...remoteTracks.values()]) : null); };
    room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
      remoteTracks.set(track.sid ?? track.mediaStreamTrack.id, track.mediaStreamTrack); updateRemote();
      if (!disposed) setStatus('На связи');
    });
    room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
      remoteTracks.delete(track.sid ?? track.mediaStreamTrack.id); updateRemote();
    });
    room.on(RoomEvent.ParticipantConnected, () => { if (!disposed) setStatus('Собеседник подключается…'); });
    room.on(RoomEvent.ParticipantDisconnected, () => { if (!disposed) { remoteTracks.clear(); updateRemote(); setStatus('Собеседник вышел. Можно войти по той же ссылке.'); } });
    room.on(RoomEvent.Reconnecting, () => { if (!disposed) setStatus('Восстанавливаем связь…'); });
    room.on(RoomEvent.Reconnected, () => { if (!disposed) { setStatus('Связь восстановлена'); setError(''); } });
    room.on(RoomEvent.Disconnected, () => {
      if (!disposed) { setReady(false); setRemote(null); setStatus('Связь прервалась'); setError('Нажмите «Подключиться снова». Если в звонке уже два человека, дождитесь завершения разговора.'); }
    });
    const start = async () => {
      setStatus('Подключаемся…'); setError(''); setNotice(''); setSetup(false); setReady(false); setLocal(null); setRemote(null);
      try {
        if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) throw new Error('Откройте ссылку HTTPS в Chrome или Safari.');
        const response = await fetch('/api/join', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ room: roomId }), signal: controller.signal });
        const credentials = await response.json();
        if (disposed) return;
        if (!response.ok) {
          setSetup(credentials.code === 'NOT_CONFIGURED');
          throw new Error(credentials.error || 'Не удалось подготовить звонок.');
        }
        if (typeof credentials.url !== 'string' || !credentials.url.startsWith('wss://') || typeof credentials.token !== 'string') throw new Error('Сервис звонков вернул неверный ответ.');
        clearTimeout(timeout);
        await room.connect(credentials.url, credentials.token);
        if (disposed) { await room.disconnect(); return; }
        const tracks = await createLocalTracks({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          video: { resolution: { width: 1920, height: 1080, frameRate: 30 }, facingMode: 'user' },
        });
        if (disposed || generation !== epoch.current) { tracks.forEach(t => t.stop()); return; }
        tracksRef.current = tracks;
        setLocal(new MediaStream(tracks.map(t => t.mediaStreamTrack)));
        setMuted(false); setVideoOff(false); setFront(true);
        await Promise.all(tracks.map(track => room.localParticipant.publishTrack(track)));
        if (disposed) return;
        setReady(true); setStatus(room.remoteParticipants.size ? 'На связи' : 'Ждём собеседника');
      } catch (e) {
        if (disposed) return;
        tracksRef.current.forEach(t => t.stop()); tracksRef.current = []; setLocal(null);
        room.removeAllListeners(); await room.disconnect();
        setError(e instanceof DOMException && e.name === 'NotAllowedError' ? 'Разрешите камеру и микрофон в настройках браузера, затем повторите вход.'
          : e instanceof DOMException && e.name === 'AbortError' ? 'Сервис звонков не ответил вовремя. Попробуйте ещё раз.'
          : e instanceof Error ? e.message : 'Не удалось подключиться. Попробуйте ещё раз.');
        setStatus('Не удалось начать звонок');
      } finally { clearTimeout(timeout); }
    };
    void start();
    return () => {
      disposed = true; ++epoch.current; controller.abort(); clearTimeout(timeout);
      room.removeAllListeners(); void room.disconnect();
      tracksRef.current.forEach(t => t.stop()); tracksRef.current = [];
      if (roomRef.current === room) roomRef.current = null;
    };
  }, [roomId, attempt]);

  useEffect(() => {
    if (!('wakeLock' in navigator)) return;
    let disposed = false;
    let lock: WakeLockSentinel | undefined;
    const request = async () => {
      if (document.visibilityState !== 'visible' || (lock && !lock.released)) return;
      try {
        const acquired = await navigator.wakeLock.request('screen');
        if (disposed) await acquired.release(); else lock = acquired;
      } catch { /* Browser policy and low battery can prevent screen locking. */ }
    };
    void request(); document.addEventListener('visibilitychange', request);
    return () => { disposed = true; document.removeEventListener('visibilitychange', request); void lock?.release(); };
  }, []);

  const share = async () => {
    const url = invitation(roomId);
    try {
      if (navigator.share) await navigator.share({ title: 'Видеозвонок ClearCall', url });
      else { await navigator.clipboard.writeText(url); setNotice('Ссылка скопирована — отправьте её собеседнику.'); }
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) setNotice(`Скопируйте ссылку: ${url}`);
    }
  };
  const toggle = async (kind: Track.Kind) => {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      const track = tracksRef.current.find(t => t.kind === kind);
      if (!track) return;
      const disabled = track.isMuted;
      if (disabled) await track.unmute(); else await track.mute();
      if (kind === Track.Kind.Audio) setMuted(!disabled); else setVideoOff(!disabled);
    } catch { setNotice('Не удалось изменить состояние камеры или микрофона. Попробуйте ещё раз.'); }
    finally { busyRef.current = false; }
  };
  const switchCamera = async () => {
    if (busyRef.current) return;
    busyRef.current = true; setSwitching(true);
    const generation = epoch.current;
    try {
      const track = tracksRef.current.find(t => t.kind === Track.Kind.Video) as LocalVideoTrack | undefined;
      if (!track) return;
      await track.restartTrack({ facingMode: front ? 'environment' : 'user' });
      if (generation !== epoch.current) return;
      setFront(!front); setLocal(new MediaStream(tracksRef.current.map(t => t.mediaStreamTrack)));
    } catch { if (generation === epoch.current) setNotice('Не удалось переключить камеру. Продолжайте звонок с текущей камерой.'); }
    finally { busyRef.current = false; if (generation === epoch.current) setSwitching(false); }
  };
  return <main className="call-screen">
    <div className="remote-stage"><Video stream={remote} onBlocked={playbackBlocked} />
      {!remote && <div className="call-placeholder"><div className="text-5xl mb-4">📹</div><h1 className="text-xl font-semibold">{status}</h1>
        <p className="text-slate-300 max-w-md mt-3">{error || (ready ? 'Отправьте ссылку собеседнику. Ему нужно только открыть её и нажать «Войти».' : 'Сейчас подготовим звонок.')}</p>
        {error && !setup && <button className="btn-primary mt-4" onClick={() => setAttempt(n => n + 1)}>Подключиться снова</button>}
      </div>}
    </div>
    {local && <div className="local-preview"><Video stream={local} local hidden={videoOff} />{videoOff && <span className="absolute inset-0 flex items-center justify-center text-xs">Камера выключена</span>}</div>}
    <div className="call-header"><span className="quality-badge fhd">ClearCall</span>{ready && remote && <span className="text-xs text-slate-300">{status}</span>}</div>
    <div className="call-footer">
      {notice && <p role="status" className="call-notice">{notice}</p>}
      {blocked && <button className="btn-primary mb-3" onClick={async () => {
        const result = await Promise.allSettled(Array.from(document.querySelectorAll('video'), video => video.play())); setBlocked(result.some(r => r.status === 'rejected'));
        await roomRef.current?.startAudio().catch(() => {});
      }}>Включить звук и видео</button>}
      {ready && <button className="room-link mb-4" onClick={share}>Отправить ссылку</button>}
      <div className="flex justify-center gap-3">
        {local && <><button className={`btn-control ${muted ? 'active' : ''}`} aria-label={muted ? 'Включить микрофон' : 'Выключить микрофон'} onClick={() => toggle(Track.Kind.Audio)}>{muted ? '🔇' : '🎤'}</button><button className={`btn-control ${videoOff ? 'active' : ''}`} aria-label={videoOff ? 'Включить камеру' : 'Выключить камеру'} onClick={() => toggle(Track.Kind.Video)}>📹</button><button className="btn-control" aria-label="Переключить камеру" disabled={switching} onClick={switchCamera}>🔄</button></>}
        <button className="btn-danger" aria-label="Завершить звонок" onClick={onLeave}>☎</button>
      </div>
    </div>
  </main>;
}
