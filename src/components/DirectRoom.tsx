import { useCallback, useEffect, useRef, useState } from 'react';
import type { QualitySettings } from '../types';
import { applyQuality, cameraConstraints, createRoom, hasTurnConfiguration, iceConfiguration } from '../rtc';
import { gatherCandidates, readSignal, signalLink, type DirectSignal } from '../direct';
import Video from './Video';

interface Props { settings: QualitySettings; incoming: string; onLeave: () => void }
export default function DirectRoom({ settings, incoming, onLeave }: Props) {
  const [offer, setOffer] = useState<DirectSignal | null>(null);
  const [answerPage, setAnswerPage] = useState(false);
  const [prepared, setPrepared] = useState(!incoming);
  const [local, setLocal] = useState<MediaStream | null>(null);
  const [remote, setRemote] = useState<MediaStream | null>(null);
  const [link, setLink] = useState('');
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [state, setState] = useState('Подготовка');
  const [stats, setStats] = useState('');
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const [front, setFront] = useState(true);
  const [blocked, setBlocked] = useState(false);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const roomRef = useRef('');
  const mounted = useRef(true);
  const abort = useRef(new AbortController());
  const busyRef = useRef(false);
  const blockedPlayback = useCallback(() => setBlocked(true), []);

  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController(); abort.current = controller;
    if (incoming) void readSignal(incoming).then(packet => {
      if (!mounted.current) return;
      if (packet.type === 'answer') { setAnswerPage(true); setAnswer(incoming); }
      else setOffer(packet);
      setPrepared(true);
    }).catch(() => { if (mounted.current) setError('Приглашение повреждено или устарело. Попросите новую ссылку.'); });
    return () => {
      mounted.current = false; controller.abort(); pcRef.current?.close();
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, [incoming]);

  useEffect(() => {
    if (!remote) return;
    let active = true; let running = false;
    const previous = new Map<string, { time: number; bytes: number }>();
    const timer = setInterval(async () => {
      if (!pcRef.current || running) return;
      running = true;
      try {
        const report = await pcRef.current.getStats();
        const parts: string[] = [];
        report.forEach(s => {
          if (['inbound-rtp', 'outbound-rtp'].includes(s.type) && (s.kind === 'video' || s.mediaType === 'video')) {
            const bytes = s.bytesSent ?? s.bytesReceived ?? 0;
            const last = previous.get(s.id);
            const rate = last && s.timestamp > last.time ? Math.max(0, (bytes - last.bytes) * 8 / (s.timestamp - last.time) / 1000).toFixed(1) : null;
            previous.set(s.id, { time: s.timestamp, bytes });
            parts.push(`${s.type === 'inbound-rtp' ? 'Приём' : 'Отправка'}: ${s.frameWidth ?? '—'}×${s.frameHeight ?? '—'} · ${Math.round(s.framesPerSecond ?? 0)} FPS${rate ? ` · ${rate} Мбит/с` : ''}`);
          }
          if (s.type === 'transport' && s.selectedCandidatePairId) {
            const pair = report.get(s.selectedCandidatePairId); const candidate = pair && report.get(pair.localCandidateId);
            if (candidate) parts.push(candidate.candidateType === 'relay' ? 'Через TURN' : 'Прямое соединение');
          }
        });
        if (active) setStats(parts.join(' | '));
      } catch { /* Optional stats must not interrupt a call. */ }
      finally { running = false; }
    }, 2000);
    return () => { active = false; clearInterval(timer); };
  }, [remote]);

  const start = async () => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setError(''); setNotice(''); setState('Подготовка камеры и адресов соединения…');
    try {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) throw new Error('Откройте ссылку HTTPS в Chrome или Safari.');
      const config = await iceConfiguration(abort.current.signal);
      if (!mounted.current) return;
      const stream = await navigator.mediaDevices.getUserMedia({ video: cameraConstraints(settings, true), audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      if (!mounted.current) { stream.getTracks().forEach(t => t.stop()); return; }
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = stream; setLocal(stream); setFront(true); setMuted(false); setVideoOff(false);
      pcRef.current?.close();
      const pc = new RTCPeerConnection(config); pcRef.current = pc;
      const received = new MediaStream();
      pc.ontrack = event => {
        if (!mounted.current || pcRef.current !== pc) return;
        received.addTrack(event.track); setRemote(new MediaStream(received.getTracks()));
      };
      pc.onconnectionstatechange = () => {
        if (!mounted.current || pcRef.current !== pc) return;
        if (pc.connectionState === 'connected') { setState('На связи'); setError(''); void applyQuality(pc, settings); }
        else if (pc.connectionState === 'failed') {
          setError(hasTurnConfiguration ? 'Не удалось соединить телефоны. Проверьте сеть или создайте новое приглашение.' : 'Прямое соединение не прошло. Для этих сетей нужен TURN — обмен ссылками не обходит ограничения мобильного интернета.');
          setState('Не удалось соединиться');
        } else if (pc.connectionState === 'disconnected') setState('Связь прервалась. Ожидаем восстановления…');
        else if (pc.connectionState === 'connecting') setState('Соединяем телефоны…');
      };
      stream.getTracks().forEach(t => pc.addTrack(t, stream));
      roomRef.current = offer?.room ?? createRoom();
      if (offer) await pc.setRemoteDescription({ type: 'offer', sdp: offer.sdp });
      await pc.setLocalDescription(offer ? await pc.createAnswer() : await pc.createOffer());
      await gatherCandidates(pc, abort.current.signal);
      if (!mounted.current) return;
      const description = pc.localDescription;
      if (!description?.sdp) throw new Error('Не удалось подготовить приглашение. Попробуйте ещё раз.');
      const outgoing = await signalLink({ v: 1, room: roomRef.current, created: Date.now(), type: offer ? 'answer' : 'offer', sdp: description.sdp });
      if (mounted.current) { setLink(outgoing); setState(offer ? 'Отправьте ответ собеседнику' : 'Отправьте приглашение'); }
    } catch (e) {
      if (!mounted.current) return;
      pcRef.current?.close(); pcRef.current = null;
      streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null; setLocal(null);
      setError(e instanceof DOMException && e.name === 'NotAllowedError' ? 'Разрешите камеру и микрофон в браузере.' : e instanceof Error ? e.message : 'Не удалось подготовить звонок.');
    } finally { busyRef.current = false; if (mounted.current) setBusy(false); }
  };
  const accept = async () => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setError('');
    try {
      const packet = await readSignal(answer);
      if (packet.type !== 'answer' || packet.room !== roomRef.current) throw new Error('Нужна ответная ссылка именно на это приглашение.');
      const pc = pcRef.current;
      if (!pc || pc.signalingState !== 'have-local-offer') throw new Error('Приглашение уже использовано или комната закрыта. Создайте новое.');
      await pc.setRemoteDescription({ type: 'answer', sdp: packet.sdp });
      if (mounted.current) setState('Соединяем телефоны…');
    } catch (e) { if (mounted.current) setError(e instanceof Error ? e.message : 'Неверный ответ.'); }
    finally { busyRef.current = false; if (mounted.current) setBusy(false); }
  };
  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: offer ? 'Ответ на звонок ClearCall' : 'Приглашение ClearCall', url: link });
      else { await navigator.clipboard.writeText(link); setNotice('Ссылка скопирована. Отправьте её собеседнику.'); }
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) setNotice('Скопируйте ссылку из поля ниже.');
    }
  };
  const switchCamera = async () => {
    if (busyRef.current || !streamRef.current) return;
    busyRef.current = true; setBusy(true);
    let replacement: MediaStream | null = null;
    try {
      const old = streamRef.current.getVideoTracks()[0]; old?.stop();
      replacement = await navigator.mediaDevices.getUserMedia({ video: cameraConstraints(settings, !front), audio: false });
      if (!mounted.current) { replacement.getTracks().forEach(t => t.stop()); return; }
      const track = replacement.getVideoTracks()[0]; track.enabled = !videoOff;
      const sender = pcRef.current?.getSenders().find(s => s.track?.kind === 'video');
      if (sender) await sender.replaceTrack(track);
      if (!mounted.current) { track.stop(); return; }
      const stream = streamRef.current!; if (old) stream.removeTrack(old); stream.addTrack(track);
      setLocal(new MediaStream(stream.getTracks())); setFront(!front);
      if (pcRef.current) await applyQuality(pcRef.current, settings);
    } catch {
      replacement?.getTracks().forEach(t => t.stop());
      if (mounted.current) setError('Не удалось переключить камеру. Создайте новое приглашение для восстановления видео.');
    } finally { busyRef.current = false; if (mounted.current) setBusy(false); }
  };
  const connected = state === 'На связи';
  return <main className={connected ? 'call-screen' : 'direct-setup'}>
    {connected ? <div className="remote-stage"><Video stream={remote} onBlocked={blockedPlayback} /></div> : <div className="max-w-lg mx-auto p-5 pb-8">
      <h1 className="text-2xl font-bold mb-3">Звонок без сервера подключения</h1>
      <p className="text-slate-300 mb-4">Один раз обменяйтесь приглашением и ответом. Во время подготовки держите эту страницу открытой.</p>
      {answerPage ? <section className="glass-card p-5 space-y-3"><h2 className="font-semibold">Это ответ на приглашение</h2><p>Вернитесь в исходную вкладку звонка и вставьте эту ссылку в поле «Ответная ссылка». Не создавайте новую комнату.</p><textarea aria-label="Полученная ответная ссылка" readOnly value={answer} className="input-field text-xs" onFocus={e => e.currentTarget.select()} /></section>
        : <section className="glass-card p-5 space-y-4">
          {offer && <p className="text-indigo-200">Вас пригласили. Нажмите кнопку ниже, разрешите камеру и микрофон, затем отправьте ответ собеседнику.</p>}
          {!link && <button className="btn-primary w-full" disabled={busy || !prepared} onClick={start}>{busy ? 'Подготовка…' : offer ? 'Подготовить ответ' : 'Подготовить приглашение'}</button>}
          {link && <>
            <p>{offer ? 'Отправьте ответную ссылку тому, кто вас пригласил. Затем вернитесь сюда и ждите звонка.' : 'Отправьте приглашение собеседнику. Полученный от него ответ вставьте ниже.'}</p>
            <button className="btn-primary w-full" onClick={share}>{offer ? 'Отправить ответ' : 'Отправить приглашение'}</button>
            <label className="block text-sm">{offer ? 'Ответная ссылка' : 'Приглашение'}<textarea className="input-field text-xs mt-2" aria-label={offer ? 'Ссылка ответа' : 'Ссылка приглашения'} readOnly value={link} onFocus={e => e.currentTarget.select()} /></label>
            {!offer && <><label className="block text-sm" htmlFor="direct-answer">Ответная ссылка от собеседника</label><textarea id="direct-answer" className="input-field text-xs" value={answer} onChange={e => setAnswer(e.target.value)} placeholder="Вставьте ответ целиком" /><button className="btn-primary w-full" disabled={busy || !answer.trim()} onClick={accept}>Применить ответ и соединиться</button></>}
            <p className="text-xs text-slate-400">Если долго не соединяется, создайте новое приглашение. После закрытия страницы старые ссылки больше не работают.</p>
          </>}
          <p role="status" className="text-indigo-200">{state}</p>
        </section>}
      {local && <div className="direct-preview mt-4"><Video stream={local} local hidden={videoOff} /></div>}
      {!hasTurnConfiguration && <p className="text-xs text-amber-200 mt-4">TURN не настроен. Этот способ убирает зависимость от PeerJS, но для некоторых мобильных сетей всё равно понадобится ретранслятор.</p>}
    </div>}
    {connected && <div className="local-preview"><Video stream={local} local hidden={videoOff} /></div>}
    <div className={connected ? 'call-footer' : 'max-w-lg mx-auto px-5 pb-6 text-center'}>
      {error && <p role="alert" className="call-notice">{error}</p>}
      {notice && <p role="status" className="call-notice">{notice}</p>}
      {blocked && <button className="btn-primary mb-3" onClick={async () => {
        const results = await Promise.allSettled(Array.from(document.querySelectorAll('video'), v => v.play())); setBlocked(results.some(r => r.status === 'rejected'));
      }}>Включить видео и звук</button>}
      {connected && <p className="text-xs text-slate-300 mb-3" aria-label="Статистика качества">{stats}</p>}
      <div className="flex justify-center gap-3">
        {local && <><button className={`btn-control ${muted ? 'active' : ''}`} aria-label={muted ? 'Включить микрофон' : 'Выключить микрофон'} onClick={() => { streamRef.current?.getAudioTracks().forEach(t => { t.enabled = muted; }); setMuted(!muted); }}>{muted ? '🔇' : '🎤'}</button><button className={`btn-control ${videoOff ? 'active' : ''}`} aria-label={videoOff ? 'Включить камеру' : 'Выключить камеру'} onClick={() => { streamRef.current?.getVideoTracks().forEach(t => { t.enabled = videoOff; }); setVideoOff(!videoOff); }}>📹</button><button className="btn-control" disabled={busy} aria-label="Переключить камеру" onClick={switchCamera}>🔄</button></>}
        <button className="btn-danger" aria-label="Завершить звонок" onClick={onLeave}>☎</button>
      </div>
    </div>
  </main>;
}
