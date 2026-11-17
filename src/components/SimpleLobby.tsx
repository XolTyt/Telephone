import { useState } from 'react';
import { createRoom } from '../rtc';
interface Props { initialRoom: string; onJoin: (room: string) => void }
export default function SimpleLobby({ initialRoom, onJoin }: Props) {
  const [room] = useState(() => initialRoom || createRoom() + createRoom());
  return <main className="min-h-screen flex items-center justify-center p-5">
    <section className="glass-card p-7 w-full max-w-md text-center space-y-5">
      <div className="text-5xl" aria-hidden="true">📹</div><h1 className="text-4xl font-bold text-indigo-300">ClearCall</h1>
      <p className="text-slate-300">{initialRoom ? 'Вас пригласили на видеозвонок' : 'Позвоните близкому человеку'}</p>
      <button className="btn-primary w-full py-4" onClick={() => onJoin(room)}>{initialRoom ? 'Войти в звонок' : 'Создать звонок'}</button>
      <p className="text-sm text-slate-400">{initialRoom ? 'Нажмите кнопку и разрешите камеру и микрофон.' : 'Создайте звонок и отправьте ссылку собеседнику. Ему достаточно открыть её и нажать «Войти».'}</p>
      <p className="text-xs text-slate-500">Без регистрации. Для двух человек.</p>
    </section>
  </main>;
}
