import type { QualitySettings } from '../types';
import { useState } from 'react';
import { createRoom, hasTurnConfiguration } from '../rtc';

interface Props {
  initialRoom: string;
  onJoinCall: (id: string, host: boolean) => void;
  onShowGuide: () => void;
  settings: QualitySettings;
  onSettingsChange: (settings: QualitySettings) => void;
}
export default function Lobby({ initialRoom, onJoinCall, onShowGuide, settings, onSettingsChange }: Props) {
  const [room, setRoom] = useState(initialRoom);
  const [showSettings, setShowSettings] = useState(false);
  const valid = /^[A-Z2-9]{12}$/.test(room);
  return <main className="min-h-screen flex flex-col items-center justify-center p-5">
    <div className="text-center mb-8"><div className="text-5xl mb-4">📹</div><h1 className="text-4xl font-bold text-indigo-300">ClearCall</h1><p className="text-slate-400 mt-3">Видеосвязь между двумя телефонами</p></div>
    <div className="glass-card p-6 w-full max-w-md space-y-4">
      {initialRoom && <p className="text-indigo-200">Вас пригласили в звонок. Разрешите доступ к камере и микрофону после входа.</p>}
      <button className="btn-primary w-full" onClick={() => onJoinCall(createRoom(), true)}>Создать комнату</button>
      <p className="text-sm text-slate-400 text-center">или войдите по приглашению / коду</p>
      <label className="block text-sm text-slate-300" htmlFor="room">Код комнаты</label>
      <input id="room" className="input-field font-mono text-center tracking-wider" autoCapitalize="characters" autoCorrect="off" spellCheck={false} maxLength={12} placeholder="12 символов" value={room} onChange={e => setRoom(e.target.value.toUpperCase().replace(/[^A-Z2-9]/g, ''))} onKeyDown={e => { if (e.key === 'Enter' && valid) onJoinCall(room, false); }} />
      <button className="btn-primary w-full disabled:opacity-40" disabled={!valid} onClick={() => onJoinCall(room, false)}>Войти в звонок</button>
      <p className="text-xs text-slate-400">Android: откройте в Chrome. iPhone: в Safari. Держите страницу открытой во время разговора.</p>
    </div>
    <div className="flex gap-5 my-5"><button onClick={() => setShowSettings(!showSettings)} className="text-indigo-300">Качество</button><button onClick={onShowGuide} className="text-indigo-300">Как позвонить</button></div>
    {showSettings && <section className="glass-card p-6 w-full max-w-md space-y-4">
      <h2 className="font-semibold text-lg">Настройки отправки видео</h2>
      <label className="block">Разрешение<select className="input-field mt-2" value={settings.resolution} onChange={e => onSettingsChange({ ...settings, resolution: e.target.value })}>{['720', '1080', '1440', '2160'].map(r => <option key={r} value={r}>{r}p</option>)}</select></label>
      <label className="block">Частота кадров<select className="input-field mt-2" value={settings.fps} onChange={e => onSettingsChange({ ...settings, fps: Number(e.target.value) })}>{[15, 24, 30, 60].map(n => <option key={n}>{n}</option>)}</select></label>
      <label className="block">Максимум видео: {settings.videoBitrate / 1000} Мбит/с<input className="w-full mt-2" type="range" min={1000} max={20000} step={500} value={settings.videoBitrate} onChange={e => onSettingsChange({ ...settings, videoBitrate: Number(e.target.value) })} /></label>
      <label className="block">Максимум аудио<select className="input-field mt-2" value={settings.audioBitrate} onChange={e => onSettingsChange({ ...settings, audioBitrate: Number(e.target.value) })}>{[64, 128, 192, 256].map(n => <option key={n} value={n}>{n} Кбит/с</option>)}</select></label>
      <p className="text-xs text-slate-400">По умолчанию 1080p, 30 FPS, до 8 Мбит/с. Камера и сеть могут ограничить качество. Фактические параметры отображаются во время звонка. Видео передаётся со сжатием WebRTC.</p>
    </section>}
    {!hasTurnConfiguration && <p className="max-w-md text-xs text-amber-200/80 mt-4">Сервер ретрансляции TURN ещё не настроен. В некоторых сетях звонки будут недоступны.</p>}
  </main>;
}
