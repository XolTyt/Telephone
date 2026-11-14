import { useState } from 'react';

interface QualitySettings {
  resolution: string;
  fps: number;
  videoBitrate: number;
  audioBitrate: number;
}

interface LobbyProps {
  onJoinCall: (id: string, host: boolean) => void;
  onShowGuide: () => void;
  settings: QualitySettings;
  onSettingsChange: (s: QualitySettings) => void;
}

export default function Lobby({ onJoinCall, onShowGuide, settings, onSettingsChange }: LobbyProps) {
  const [roomInput, setRoomInput] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [mode, setMode] = useState<'create' | 'join' | null>(null);

  const generateRoomId = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const handleCreate = () => {
    const id = generateRoomId();
    onJoinCall(id, true);
  };

  const handleJoin = () => {
    if (roomInput.trim().length >= 4) {
      onJoinCall(roomInput.trim().toUpperCase(), false);
    }
  };

  const resolutions = [
    { value: '720', label: '720p HD', badge: 'hd' },
    { value: '1080', label: '1080p Full HD', badge: 'fhd' },
    { value: '1440', label: '1440p 2K', badge: 'uhd' },
    { value: '2160', label: '2160p 4K', badge: 'uhd' },
  ];

  const fpsOptions = [15, 24, 30, 60];
  const bitrateOptions = [2000, 4000, 6000, 8000, 12000, 16000, 20000];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 fade-in">
      {/* Logo */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 mb-4 pulse-ring">
          <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        </div>
        <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
          ClearCall
        </h1>
        <p className="text-slate-400 mt-2 text-lg">Видеозвонки без потери качества</p>
      </div>

      {/* Main Card */}
      <div className="glass-card p-8 w-full max-w-md">
        {!mode && (
          <div className="space-y-4 slide-up">
            <button
              onClick={() => setMode('create')}
              className="btn-primary w-full flex items-center justify-center gap-3 py-4"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Создать комнату
            </button>
            <button
              onClick={() => setMode('join')}
              className="w-full py-4 rounded-xl border border-indigo-500/30 text-indigo-300 font-semibold text-lg hover:bg-indigo-500/10 transition-all flex items-center justify-center gap-3"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Присоединиться
            </button>
          </div>
        )}

        {mode === 'create' && (
          <div className="space-y-6 slide-up">
            <div className="text-center">
              <h2 className="text-xl font-semibold text-white">Создать комнату</h2>
              <p className="text-slate-400 text-sm mt-1">
                Отправьте код комнаты маме и сыну
              </p>
            </div>
            <button onClick={handleCreate} className="btn-primary w-full py-4 text-lg">
              🚀 Создать и войти
            </button>
            <button
              onClick={() => setMode(null)}
              className="w-full text-slate-400 hover:text-white transition-colors text-sm"
            >
              ← Назад
            </button>
          </div>
        )}

        {mode === 'join' && (
          <div className="space-y-6 slide-up">
            <div className="text-center">
              <h2 className="text-xl font-semibold text-white">Войти в комнату</h2>
              <p className="text-slate-400 text-sm mt-1">
                Введите код комнаты
              </p>
            </div>
            <input
              type="text"
              value={roomInput}
              onChange={(e) => setRoomInput(e.target.value.toUpperCase())}
              placeholder="Код комнаты (напр. A3K7NP)"
              className="input-field text-center text-xl tracking-widest font-mono"
              maxLength={6}
              onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
            />
            <button
              onClick={handleJoin}
              disabled={roomInput.trim().length < 4}
              className="btn-primary w-full py-4 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Войти
            </button>
            <button
              onClick={() => setMode(null)}
              className="w-full text-slate-400 hover:text-white transition-colors text-sm"
            >
              ← Назад
            </button>
          </div>
        )}
      </div>

      {/* Settings & Guide buttons */}
      <div className="flex gap-4 mt-6">
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-700 text-slate-300 hover:border-indigo-500/50 hover:text-indigo-300 transition-all text-sm"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Качество
        </button>
        <button
          onClick={onShowGuide}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-700 text-slate-300 hover:border-indigo-500/50 hover:text-indigo-300 transition-all text-sm"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Как запустить
        </button>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="glass-card p-6 w-full max-w-md mt-4 slide-up">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Настройки качества
          </h3>

          {/* Resolution */}
          <div className="mb-4">
            <label className="text-sm text-slate-300 mb-2 block">Разрешение видео</label>
            <div className="grid grid-cols-2 gap-2">
              {resolutions.map((r) => (
                <button
                  key={r.value}
                  onClick={() => onSettingsChange({ ...settings, resolution: r.value })}
                  className={`py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                    settings.resolution === r.value
                      ? 'bg-indigo-500/30 border border-indigo-400 text-indigo-200'
                      : 'bg-white/5 border border-white/10 text-slate-400 hover:border-white/30'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {/* FPS */}
          <div className="mb-4">
            <label className="text-sm text-slate-300 mb-2 block">Частота кадров (FPS)</label>
            <div className="flex gap-2">
              {fpsOptions.map((fps) => (
                <button
                  key={fps}
                  onClick={() => onSettingsChange({ ...settings, fps })}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                    settings.fps === fps
                      ? 'bg-indigo-500/30 border border-indigo-400 text-indigo-200'
                      : 'bg-white/5 border border-white/10 text-slate-400 hover:border-white/30'
                  }`}
                >
                  {fps}
                </button>
              ))}
            </div>
          </div>

          {/* Video Bitrate */}
          <div className="mb-4">
            <label className="text-sm text-slate-300 mb-2 block">
              Видео битрейт: <span className="text-indigo-300 font-semibold">{settings.videoBitrate} Кбит/с</span>
            </label>
            <input
              type="range"
              min="1000"
              max="20000"
              step="500"
              value={settings.videoBitrate}
              onChange={(e) => onSettingsChange({ ...settings, videoBitrate: Number(e.target.value) })}
              className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
            <div className="flex justify-between text-xs text-slate-500 mt-1">
              <span>1 Мбит/с</span>
              <span>20 Мбит/с</span>
            </div>
          </div>

          {/* Audio Bitrate */}
          <div>
            <label className="text-sm text-slate-300 mb-2 block">
              Аудио битрейт: <span className="text-indigo-300 font-semibold">{settings.audioBitrate} Кбит/с</span>
            </label>
            <div className="flex gap-2">
              {[64, 128, 192, 256, 320].map((br) => (
                <button
                  key={br}
                  onClick={() => onSettingsChange({ ...settings, audioBitrate: br })}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                    settings.audioBitrate === br
                      ? 'bg-indigo-500/30 border border-indigo-400 text-indigo-200'
                      : 'bg-white/5 border border-white/10 text-slate-400 hover:border-white/30'
                  }`}
                >
                  {br}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Quality indicator */}
      <div className="mt-6 flex items-center gap-3">
        <span className="quality-badge fhd">
          <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse"></span>
          {settings.resolution === '720' ? 'HD' : settings.resolution === '1080' ? 'Full HD' : settings.resolution === '1440' ? '2K' : '4K'}
        </span>
        <span className="text-slate-500 text-sm">{settings.fps} FPS • {settings.videoBitrate} Кбит/с</span>
      </div>
    </div>
  );
}
