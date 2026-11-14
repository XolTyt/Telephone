import { useState } from 'react';

interface SetupGuideProps {
  onBack: () => void;
}

export default function SetupGuide({ onBack }: SetupGuideProps) {
  const [activeTab, setActiveTab] = useState<'quick' | 'advanced' | 'server'>('quick');

  return (
    <div className="min-h-screen p-4 md:p-8 fade-in">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Назад
          </button>
          <h1 className="text-2xl font-bold text-white">Как запустить ClearCall</h1>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto scrollbar-hide">
          {[
            { id: 'quick', label: '⚡ Быстрый старт', desc: '5 минут' },
            { id: 'advanced', label: '🔧 Продвинутый', desc: 'Свой сервер' },
            { id: 'server', label: '🌐 Через интернет', desc: 'Для мамы из РБ' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-3 rounded-xl text-left min-w-[140px] transition-all ${
                activeTab === tab.id
                  ? 'bg-indigo-500/20 border border-indigo-400/50 text-indigo-200'
                  : 'bg-white/5 border border-white/10 text-slate-400 hover:border-white/30'
              }`}
            >
              <div className="font-medium text-sm">{tab.label}</div>
              <div className="text-xs opacity-60 mt-0.5">{tab.desc}</div>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="glass-card p-6 md:p-8">
          {activeTab === 'quick' && <QuickStart />}
          {activeTab === 'advanced' && <AdvancedSetup />}
          {activeTab === 'server' && <InternetSetup />}
        </div>
      </div>
    </div>
  );
}

function QuickStart() {
  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center shrink-0 mt-0.5">
          <span className="text-indigo-300 font-bold text-sm">1</span>
        </div>
        <div>
          <h3 className="text-white font-semibold">Открой на ПК</h3>
          <p className="text-slate-400 text-sm mt-1">
            Открой этот сайт в браузере Chrome на своём ПК. У тебя RTX 4060 — потянет любое качество!
          </p>
        </div>
      </div>

      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center shrink-0 mt-0.5">
          <span className="text-indigo-300 font-bold text-sm">2</span>
        </div>
        <div>
          <h3 className="text-white font-semibold">Создай комнату</h3>
          <p className="text-slate-400 text-sm mt-1">
            Нажми "Создать комнату" и разреши доступ к камере и микрофону.
          </p>
        </div>
      </div>

      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center shrink-0 mt-0.5">
          <span className="text-indigo-300 font-bold text-sm">3</span>
        </div>
        <div>
          <h3 className="text-white font-semibold">Отправь код</h3>
          <p className="text-slate-400 text-sm mt-1">
            Скопируй код комнаты и отправь маме/сыну. Они откроют сайт на телефоне и введут код.
          </p>
          <div className="mt-2 p-3 bg-black/30 rounded-lg border border-white/10">
            <p className="text-xs text-slate-500">💡 Сайт работает в любом мобильном браузере Chrome/Safari</p>
          </div>
        </div>
      </div>

      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center shrink-0 mt-0.5">
          <span className="text-indigo-300 font-bold text-sm">4</span>
        </div>
        <div>
          <h3 className="text-white font-semibold">Настрой качество</h3>
          <p className="text-slate-400 text-sm mt-1">
            В настройках выбери 1080p или выше, 30-60 FPS, и битрейт 8000+ Кбит/с для максимальной чёткости.
          </p>
        </div>
      </div>

      {/* Comparison */}
      <div className="mt-8 p-4 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 rounded-xl border border-indigo-500/20">
        <h4 className="text-white font-semibold mb-3">📊 Сравнение качества</h4>
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-red-500/10 rounded-lg border border-red-500/20">
            <p className="text-red-300 text-sm font-medium">❌ WhatsApp / MAX</p>
            <p className="text-slate-400 text-xs mt-1">480p, 500 Кбит/с, мыло</p>
          </div>
          <div className="p-3 bg-green-500/10 rounded-lg border border-green-500/20">
            <p className="text-green-300 text-sm font-medium">✅ ClearCall</p>
            <p className="text-slate-400 text-xs mt-1">1080p+, 8-20 Мбит/с, кристалл</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function AdvancedSetup() {
  return (
    <div className="space-y-6">
      <div className="p-4 bg-amber-500/10 rounded-xl border border-amber-500/20 mb-6">
        <p className="text-amber-200 text-sm">
          ⚠️ Для работы через интернет (не только в одной Wi-Fi сети) нужен свой signaling сервер. 
          PeerJS по умолчанию использует публичный сервер, но для стабильности лучше свой.
        </p>
      </div>

      <h3 className="text-white font-semibold text-lg">Свой signaling сервер на ПК</h3>

      <div className="space-y-4">
        <div>
          <h4 className="text-indigo-300 font-medium mb-2">1. Установи Node.js</h4>
          <p className="text-slate-400 text-sm">Скачай с <span className="text-indigo-400">nodejs.org</span> (LTS версия)</p>
        </div>

        <div>
          <h4 className="text-indigo-300 font-medium mb-2">2. Создай папку для сервера</h4>
          <div className="bg-black/40 rounded-lg p-4 border border-white/10">
            <code className="text-green-300 text-sm font-mono">
              mkdir clearcall-server<br />
              cd clearcall-server<br />
              npm init -y<br />
              npm install peerjs
            </code>
          </div>
        </div>

        <div>
          <h4 className="text-indigo-300 font-medium mb-2">3. Создай файл server.js</h4>
          <div className="bg-black/40 rounded-lg p-4 border border-white/10 overflow-x-auto">
            <pre className="text-green-300 text-sm font-mono">{`const { PeerServer } = require('peer');

const peerServer = PeerServer({
  port: 9000,
  path: '/myapp',
  config: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ]
  }
});

console.log('🚀 ClearCall сервер запущен на порту 9000');`}</pre>
          </div>
        </div>

        <div>
          <h4 className="text-indigo-300 font-medium mb-2">4. Запусти сервер</h4>
          <div className="bg-black/40 rounded-lg p-4 border border-white/10">
            <code className="text-green-300 text-sm font-mono">node server.js</code>
          </div>
        </div>

        <div>
          <h4 className="text-indigo-300 font-medium mb-2">5. Открой порты в роутере</h4>
          <p className="text-slate-400 text-sm">
            Пробрось порт 9000 на свой ПК в настройках роутера (Port Forwarding).
            Также открой порты для WebRTC: UDP 10000-60000.
          </p>
        </div>
      </div>
    </div>
  );
}

function InternetSetup() {
  return (
    <div className="space-y-6">
      <div className="p-4 bg-green-500/10 rounded-xl border border-green-500/20 mb-6">
        <p className="text-green-200 text-sm">
          🌍 Для звонков с мамой из Беларуси через интернет — нужен публичный IP или туннель.
          С твоим интернетом 500 Мбит/с это будет работать отлично!
        </p>
      </div>

      <h3 className="text-white font-semibold text-lg">Варианты для интернета</h3>

      <div className="space-y-4">
        {/* Option 1 */}
        <div className="p-4 bg-white/5 rounded-xl border border-white/10">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-green-400 font-bold">Вариант A:</span>
            <span className="text-white font-medium">Публичный IP</span>
            <span className="quality-badge hd text-xs">Проще всего</span>
          </div>
          <p className="text-slate-400 text-sm">
            Позвони провайдеру и попроси публичный IP (обычно +100-200₽/мес). 
            Тогда signaling сервер будет доступен из интернета напрямую.
          </p>
          <div className="mt-3 p-3 bg-black/30 rounded-lg">
            <p className="text-xs text-slate-500">
              💡 Проверь: зайди на 2ip.ru — если IP совпадает с тем, что показывает роутер, у тебя уже публичный IP!
            </p>
          </div>
        </div>

        {/* Option 2 */}
        <div className="p-4 bg-white/5 rounded-xl border border-white/10">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-indigo-400 font-bold">Вариант B:</span>
            <span className="text-white font-medium">Без публичного IP</span>
          </div>
          <p className="text-slate-400 text-sm">
            Используй публичный PeerJS сервер (работает из коробки!) или облачный VPS.
            WebRTC сам найдёт путь через NAT с помощью STUN/TURN серверов.
          </p>
          <div className="mt-3 p-3 bg-black/30 rounded-lg">
            <p className="text-xs text-slate-500">
              💡 Это приложение УЖЕ работает через публичный PeerJS сервер — можно пользоваться прямо сейчас!
            </p>
          </div>
        </div>

        {/* Option 3 */}
        <div className="p-4 bg-white/5 rounded-xl border border-white/10">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-purple-400 font-bold">Вариант C:</span>
            <span className="text-white font-medium">Облачный VPS</span>
            <span className="quality-badge fhd text-xs">Надёжнее</span>
          </div>
          <p className="text-slate-400 text-sm">
            Арендуй VPS (Timeweb, Selectel, ~200₽/мес) и разверни signaling сервер там.
            Тогда всё будет работать стабильно 24/7 без зависимости от твоего ПК.
          </p>
        </div>
      </div>

      {/* Tips */}
      <div className="mt-8 p-4 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 rounded-xl border border-indigo-500/20">
        <h4 className="text-white font-semibold mb-3">💡 Советы для лучшего качества</h4>
        <ul className="space-y-2 text-sm text-slate-300">
          <li className="flex items-start gap-2">
            <span className="text-indigo-400">•</span>
            Используй Chrome на ПК — лучшая поддержка WebRTC кодеков
          </li>
          <li className="flex items-start gap-2">
            <span className="text-indigo-400">•</span>
            На телефоне тоже открой в Chrome (не в встроенном браузере)
          </li>
          <li className="flex items-start gap-2">
            <span className="text-indigo-400">•</span>
            Поставь 1080p + 30 FPS + 8000 Кбит/с — идеально для мобильных
          </li>
          <li className="flex items-start gap-2">
            <span className="text-indigo-400">•</span>
            Если видео тормозит — снизь до 720p, но оставь высокий битрейт
          </li>
          <li className="flex items-start gap-2">
            <span className="text-indigo-400">•</span>
            Подключи ПК по кабелю к роутеру (не Wi-Fi) для стабильности
          </li>
        </ul>
      </div>

      {/* Hardware check */}
      <div className="mt-6 p-4 bg-green-500/10 rounded-xl border border-green-500/20">
        <h4 className="text-green-300 font-semibold mb-2">✅ Твоё железо — отлично подходит!</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
          <div className="p-2 bg-black/20 rounded-lg">
            <p className="text-slate-400">CPU</p>
            <p className="text-white font-medium">Ryzen 5 5600</p>
            <p className="text-green-400 text-xs">Кодирование VP9 ✓</p>
          </div>
          <div className="p-2 bg-black/20 rounded-lg">
            <p className="text-slate-400">GPU</p>
            <p className="text-white font-medium">RTX 4060 8GB</p>
            <p className="text-green-400 text-xs">NVENC ✓</p>
          </div>
          <div className="p-2 bg-black/20 rounded-lg">
            <p className="text-slate-400">Интернет</p>
            <p className="text-white font-medium">500 Мбит/с</p>
            <p className="text-green-400 text-xs">Хватит на 4K ✓</p>
          </div>
        </div>
      </div>
    </div>
  );
}
