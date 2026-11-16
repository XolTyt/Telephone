import { useState } from 'react';
import Lobby from './components/Lobby';
import CallRoom from './components/CallRoom';
import SetupGuide from './components/SetupGuide';
import { roomFromUrl } from './rtc';
import type { QualitySettings } from './types';

export default function App() {
  const [page, setPage] = useState<'lobby' | 'call' | 'guide'>('lobby');
  const [roomId, setRoomId] = useState(roomFromUrl);
  const [isHost, setIsHost] = useState(false);
  const [settings, setSettings] = useState<QualitySettings>({ resolution: '1080', fps: 30, videoBitrate: 8000, audioBitrate: 128 });
  return <div className="min-h-screen gradient-bg mesh-gradient">
    {page === 'lobby' && <Lobby initialRoom={roomId} onJoinCall={(id, host) => {
      setRoomId(id); setIsHost(host); setPage('call');
    }} onShowGuide={() => setPage('guide')} settings={settings} onSettingsChange={setSettings} />}
    {page === 'call' && <CallRoom roomId={roomId} isHost={isHost} settings={settings} onLeave={() => {
      setRoomId(''); setIsHost(false); setPage('lobby');
      const url = new URL(window.location.href); url.searchParams.delete('room'); window.history.replaceState(null, '', url);
    }} />}
    {page === 'guide' && <SetupGuide onBack={() => setPage('lobby')} />}
  </div>;
}
