import { useState } from 'react';

interface SetupGuideProps {
  onBack: () => void;
}

export default function SetupGuide({ onBack }: SetupGuideProps) {
  const [activeStep, setActiveStep] = useState(0);

  const steps = [
    {
      title: 'Открой сайт на ПК',
      icon: '💻',
      color: 'from-blue-500 to-cyan-500',
    },
    {
      title: 'Создай комнату',
      icon: '🏠',
      color: 'from-indigo-500 to-purple-500',
    },
    {
      title: 'Отправь код',
      icon: '📱',
      color: 'from-purple-500 to-pink-500',
    },
    {
      title: 'Звони!',
      icon: '📞',
      color: 'from-green-500 to-emerald-500',
    },
  ];

  return (
    <div className="min-h-screen p-4 md:p-8 fade-in">
      <div className="max-w-2xl mx-auto">
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
        </div>

        <h1 className="text-3xl font-bold text-white mb-2">Как запустить ClearCall</h1>
        <p className="text-slate-400 mb-8">Пошаговая инструкция — 4 простых шага</p>

        {/* Progress steps */}
        <div className="flex items-center gap-2 mb-8">
          {steps.map((step, i) => (
            <div key={i} className="flex items-center gap-2 flex-1">
              <button
                onClick={() => setActiveStep(i)}
                className={`w-10 h-10 rounded-full flex items-center justify-center text-lg transition-all shrink-0 ${
                  activeStep === i
                    ? `bg-gradient-to-r ${step.color} scale-110 shadow-lg`
                    : activeStep > i
                    ? 'bg-green-500/20 border border-green-500/50'
                    : 'bg-white/5 border border-white/10'
                }`}
              >
                {activeStep > i ? '✓' : step.icon}
              </button>
              {i < steps.length - 1 && (
                <div className={`h-0.5 flex-1 rounded ${activeStep > i ? 'bg-green-500/50' : 'bg-white/10'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step content */}
        <div className="glass-card p-6 md:p-8 slide-up" key={activeStep}>
          {activeStep === 0 && <Step0 />}
          {activeStep === 1 && <Step1 />}
          {activeStep === 2 && <Step2 />}
          {activeStep === 3 && <Step3 />}
        </div>

        {/* Navigation */}
        <div className="flex justify-between mt-6">
          <button
            onClick={() => setActiveStep(Math.max(0, activeStep - 1))}
            disabled={activeStep === 0}
            className="px-4 py-2 rounded-xl text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            ← Назад
          </button>
          <button
            onClick={() => setActiveStep(Math.min(steps.length - 1, activeStep + 1))}
            disabled={activeStep === steps.length - 1}
            className="btn-primary px-6 py-2 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Далее →
          </button>
        </div>

        {/* Quick reference */}
        <div className="mt-8 glass-card p-6">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <span className="text-xl">⚡</span> Краткая шпаргалка
          </h3>
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-3">
              <span className="text-indigo-400 font-mono text-xs bg-indigo-500/10 px-2 py-1 rounded">ПК</span>
              <p className="text-slate-300">Открой этот сайт в <b className="text-white">Chrome</b> → «Создать комнату» → разреши камеру</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-purple-400 font-mono text-xs bg-purple-500/10 px-2 py-1 rounded">ЖЕНА</span>
              <p className="text-slate-300">Открой этот же сайт на телефоне → «Присоединиться» → введи код</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-pink-400 font-mono text-xs bg-pink-500/10 px-2 py-1 rounded">СЫН</span>
              <p className="text-slate-300">То же самое — открой сайт на телефоне и введи тот же код</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-green-400 font-mono text-xs bg-green-500/10 px-2 py-1 rounded">МАМА</span>
              <p className="text-slate-300">Отправь ей ссылку на этот сайт + код комнаты (в WhatsApp/Telegram)</p>
            </div>
          </div>
        </div>

        {/* Settings recommendation */}
        <div className="mt-4 glass-card p-6">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <span className="text-xl">🎯</span> Рекомендуемые настройки
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3 bg-indigo-500/10 rounded-xl border border-indigo-500/20 text-center">
              <p className="text-2xl mb-1">📺</p>
              <p className="text-indigo-300 font-bold">1080p</p>
              <p className="text-slate-500 text-xs">Full HD</p>
            </div>
            <div className="p-3 bg-purple-500/10 rounded-xl border border-purple-500/20 text-center">
              <p className="text-2xl mb-1">🎬</p>
              <p className="text-purple-300 font-bold">30 FPS</p>
              <p className="text-slate-500 text-xs">Плавность</p>
            </div>
            <div className="p-3 bg-green-500/10 rounded-xl border border-green-500/20 text-center">
              <p className="text-2xl mb-1">📡</p>
              <p className="text-green-300 font-bold">8000</p>
              <p className="text-slate-500 text-xs">Кбит/с видео</p>
            </div>
            <div className="p-3 bg-amber-500/10 rounded-xl border border-amber-500/20 text-center">
              <p className="text-2xl mb-1">🔊</p>
              <p className="text-amber-300 font-bold">128</p>
              <p className="text-slate-500 text-xs">Кбит/с аудио</p>
            </div>
          </div>
          <p className="text-slate-500 text-xs mt-3">
            💡 С твоим интернетом 500 Мбит/с можно ставить хоть 4K, но для мобильных лучше 1080p — стабильнее.
          </p>
        </div>

        {/* FAQ */}
        <div className="mt-4 glass-card p-6">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <span className="text-xl">❓</span> Частые вопросы
          </h3>
          <div className="space-y-4">
            <div>
              <p className="text-indigo-300 font-medium text-sm">Нужно ли что-то устанавливать?</p>
              <p className="text-slate-400 text-sm mt-1">Нет! Просто открой сайт в браузере Chrome. На ПК и на телефонах.</p>
            </div>
            <div>
              <p className="text-indigo-300 font-medium text-sm">Мама из Беларуси — это будет работать?</p>
              <p className="text-slate-400 text-sm mt-1">Да! WebRTC работает через интернет. Нужен только Chrome на телефоне и интернет.</p>
            </div>
            <div>
              <p className="text-indigo-300 font-medium text-sm">Почему качество лучше чем в MAX/WhatsApp?</p>
              <p className="text-slate-400 text-sm mt-1">Мессенджеры сжимают видео до 480p и 500 Кбит/с. ClearCall передаёт до 20 Мбит/с без сжатия — картинка в 10-40 раз детальнее.</p>
            </div>
            <div>
              <p className="text-indigo-300 font-medium text-sm">Сколько человек может быть в звонке?</p>
              <p className="text-slate-400 text-sm mt-1">Сейчас до 3 человек (ты + 2 участника). ПК выступает как «хаб» — принимает и раздаёт видео.</p>
            </div>
            <div>
              <p className="text-indigo-300 font-medium text-sm">Не работает — что делать?</p>
              <p className="text-slate-400 text-sm mt-1">1) Убедись что все в Chrome. 2) Разреши доступ к камере. 3) Проверь что код комнаты совпадает. 4) Перезагрузи страницу.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Step0() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="text-3xl">💻</span>
        <div>
          <h2 className="text-xl font-bold text-white">Шаг 1: Открой сайт на ПК</h2>
          <p className="text-slate-400 text-sm">На своём компьютере с Windows</p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="p-4 bg-blue-500/10 rounded-xl border border-blue-500/20">
          <p className="text-blue-200 text-sm font-medium mb-2">Открой этот сайт в браузере Google Chrome</p>
          <p className="text-slate-400 text-sm">
            Chrome — лучший браузер для WebRTC. Он поддерживает все кодеки и даёт максимальное качество.
          </p>
        </div>

        <div className="p-4 bg-white/5 rounded-xl border border-white/10">
          <p className="text-white text-sm font-medium mb-2">⚠️ Важно:</p>
          <ul className="text-slate-400 text-sm space-y-1">
            <li>• Подключи ПК <b className="text-white">кабелем</b> к роутеру (не Wi-Fi) — стабильнее</li>
            <li>• Закрой другие вкладки, которые едят интернет (YouTube, торренты)</li>
            <li>• Убедись что камера и микрофон не заняты другими программами</li>
          </ul>
        </div>

        <div className="p-4 bg-green-500/10 rounded-xl border border-green-500/20">
          <p className="text-green-200 text-sm">
            ✅ Когда браузер попросит доступ к камере и микрофону — нажми «Разрешить»
          </p>
        </div>
      </div>
    </div>
  );
}

function Step1() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="text-3xl">🏠</span>
        <div>
          <h2 className="text-xl font-bold text-white">Шаг 2: Создай комнату</h2>
          <p className="text-slate-400 text-sm">Нажми кнопку на главной странице</p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="p-4 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
          <p className="text-indigo-200 text-sm font-medium mb-2">Нажми «Создать комнату»</p>
          <p className="text-slate-400 text-sm">
            Система автоматически сгенерирует 6-значный код (например: <code className="text-indigo-300 bg-black/30 px-1 rounded">A3K7NP</code>)
          </p>
        </div>

        <div className="p-4 bg-white/5 rounded-xl border border-white/10">
          <p className="text-white text-sm font-medium mb-2">📋 Настрой качество (кнопка «Качество» на главной):</p>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <div className="p-2 bg-black/20 rounded-lg text-center">
              <p className="text-xs text-slate-500">Разрешение</p>
              <p className="text-white font-bold">1080p</p>
            </div>
            <div className="p-2 bg-black/20 rounded-lg text-center">
              <p className="text-xs text-slate-500">FPS</p>
              <p className="text-white font-bold">30</p>
            </div>
            <div className="p-2 bg-black/20 rounded-lg text-center">
              <p className="text-xs text-slate-500">Видео</p>
              <p className="text-white font-bold">8000 Кбит/с</p>
            </div>
            <div className="p-2 bg-black/20 rounded-lg text-center">
              <p className="text-xs text-slate-500">Аудио</p>
              <p className="text-white font-bold">128 Кбит/с</p>
            </div>
          </div>
        </div>

        <div className="p-4 bg-amber-500/10 rounded-xl border border-amber-500/20">
          <p className="text-amber-200 text-sm">
            💡 Ты увидишь своё видео в маленьком окошке справа — это нормально. Большой экран пока пуст, пока не подключится кто-то.
          </p>
        </div>
      </div>
    </div>
  );
}

function Step2() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="text-3xl">📱</span>
        <div>
          <h2 className="text-xl font-bold text-white">Шаг 3: Отправь код</h2>
          <p className="text-slate-400 text-sm">Жене, сыну и маме</p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="p-4 bg-purple-500/10 rounded-xl border border-purple-500/20">
          <p className="text-purple-200 text-sm font-medium mb-2">Скопируй код комнаты</p>
          <p className="text-slate-400 text-sm">
            Нажми на плашку с кодом внизу экрана — она скопируется в буфер обмена.
          </p>
          <div className="mt-3 flex items-center gap-2 justify-center">
            <div className="bg-black/40 px-4 py-2 rounded-lg border border-white/10">
              <code className="text-white font-mono text-lg tracking-wider">A3K7NP</code>
            </div>
            <span className="text-slate-500 text-sm">← примерно так выглядит</span>
          </div>
        </div>

        <div className="p-4 bg-white/5 rounded-xl border border-white/10">
          <p className="text-white text-sm font-medium mb-3">Отправь каждому:</p>
          <div className="space-y-2">
            <div className="flex items-center gap-3 p-2 bg-black/20 rounded-lg">
              <span>👩</span>
              <div>
                <p className="text-white text-sm font-medium">Жене (она дома)</p>
                <p className="text-slate-400 text-xs">Отправь код в Telegram/WhatsApp</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-2 bg-black/20 rounded-lg">
              <span>👦</span>
              <div>
                <p className="text-white text-sm font-medium">Сыну</p>
                <p className="text-slate-400 text-xs">Отправь код + ссылку на сайт</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-2 bg-black/20 rounded-lg">
              <span>👵</span>
              <div>
                <p className="text-white text-sm font-medium">Маме (Беларусь)</p>
                <p className="text-slate-400 text-xs">Отправь код + ссылку на сайт в WhatsApp/Telegram</p>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 bg-green-500/10 rounded-xl border border-green-500/20">
          <p className="text-green-200 text-sm font-medium mb-2">Что они должны сделать на телефоне:</p>
          <ol className="text-slate-400 text-sm space-y-1 list-decimal list-inside">
            <li>Открыть этот сайт в <b className="text-white">Chrome</b> (на iPhone — Safari)</li>
            <li>Нажать «Присоединиться»</li>
            <li>Ввести код комнаты</li>
            <li>Разрешить доступ к камере</li>
          </ol>
        </div>
      </div>
    </div>
  );
}

function Step3() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="text-3xl">🎉</span>
        <div>
          <h2 className="text-xl font-bold text-white">Шаг 4: Звони!</h2>
          <p className="text-slate-400 text-sm">Всё готово — наслаждайся качеством</p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="p-6 bg-gradient-to-r from-green-500/10 to-emerald-500/10 rounded-xl border border-green-500/20 text-center">
          <div className="text-4xl mb-3">📹</div>
          <p className="text-green-200 font-medium">Когда все подключатся — вы увидите друг друга в Full HD!</p>
          <p className="text-slate-400 text-sm mt-2">Без мыла, без артефактов, без задержек</p>
        </div>

        <div className="p-4 bg-white/5 rounded-xl border border-white/10">
          <p className="text-white text-sm font-medium mb-3">🎮 Управление во время звонка:</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center gap-2 p-2 bg-black/20 rounded-lg">
              <span className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-sm">🎤</span>
              <span className="text-slate-300 text-sm">Микрофон вкл/выкл</span>
            </div>
            <div className="flex items-center gap-2 p-2 bg-black/20 rounded-lg">
              <span className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-sm">📷</span>
              <span className="text-slate-300 text-sm">Камера вкл/выкл</span>
            </div>
            <div className="flex items-center gap-2 p-2 bg-black/20 rounded-lg">
              <span className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-sm">🔄</span>
              <span className="text-slate-300 text-sm">Переключить камеру</span>
            </div>
            <div className="flex items-center gap-2 p-2 bg-black/20 rounded-lg">
              <span className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-sm">⛶</span>
              <span className="text-slate-300 text-sm">Полный экран</span>
            </div>
          </div>
        </div>

        <div className="p-4 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
          <p className="text-indigo-200 text-sm font-medium mb-2">📊 Сравнение с мессенджерами:</p>
          <div className="space-y-2">
            <div className="flex items-center justify-between p-2 bg-red-500/10 rounded-lg">
              <span className="text-red-300 text-sm">❌ WhatsApp / MAX / Telegram</span>
              <span className="text-slate-400 text-xs">480p • 500 Кбит/с</span>
            </div>
            <div className="flex items-center justify-between p-2 bg-green-500/10 rounded-lg">
              <span className="text-green-300 text-sm">✅ ClearCall</span>
              <span className="text-slate-400 text-xs">1080p • 8000 Кбит/с</span>
            </div>
          </div>
          <p className="text-slate-500 text-xs mt-2">Разница в качестве — как между DVD и Blu-Ray 🎬</p>
        </div>

        <div className="p-4 bg-amber-500/10 rounded-xl border border-amber-500/20">
          <p className="text-amber-200 text-sm">
            💡 <b>Совет:</b> чтобы снова позвонить — просто открой сайт и нажми «Присоединиться» с тем же кодом. 
            Или создай новую комнату — код будет другой.
          </p>
        </div>
      </div>
    </div>
  );
}
