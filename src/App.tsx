import { lazy, Suspense, useState } from 'react';
import Lobby from './components/Lobby';
import CallRoom from './components/CallRoom';
import SetupGuide from './components/SetupGuide';
import { roomFromUrl } from './rtc';
import type { QualitySettings } from './types';
import DirectRoom from './components/DirectRoom';
import { hasDirectLink } from './direct';
import SimpleLobby from './components/SimpleLobby';
const SimpleCall = lazy(() => import('./components/SimpleCall'));

export default function App() {
  return import.meta.env.VITE_CALL_ENGINE === 'livekit' ? <SimpleApp /> : <LegacyApp />;
}

function SimpleApp() {
  const [roomId, setRoomId] = useState(roomFromUrl);
  const [inCall, setInCall] = useState(false);
  return <div className="min-h-screen gradient-bg mesh-gradient">
    {inCall ? <Suspense fallback={<p role="status" className="p-8 text-center">Готовим звонок…</p>}><SimpleCall roomId={roomId} onLeave={() => {
      setInCall(false); setRoomId('');
      const url = new URL(window.location.href); url.search = ''; url.hash = ''; window.history.replaceState(null, '', url);
    }} /></Suspense> : <SimpleLobby initialRoom={roomId.length === 24 ? roomId : ''} onJoin={room => { setRoomId(room); setInCall(true); }} />}
  </div>;
}

function LegacyApp() {
  const [page, setPage] = useState<'lobby' | 'call' | 'guide' | 'direct'>(() => hasDirectLink() ? 'direct' : 'lobby');
  const [directIncoming, setDirectIncoming] = useState(() => hasDirectLink() ? window.location.href : '');
  const [roomId, setRoomId] = useState(roomFromUrl);
  const [isHost, setIsHost] = useState(false);
  const [settings, setSettings] = useState<QualitySettings>({ resolution: '1080', fps: 30, videoBitrate: 8000, audioBitrate: 128 });
  const startDirect = () => { setDirectIncoming(''); setPage('direct'); };
  const leave = () => {
    setRoomId(''); setIsHost(false); setPage('lobby'); setDirectIncoming('');
    const url = new URL(window.location.href); url.searchParams.delete('room'); url.hash = ''; window.history.replaceState(null, '', url);
  };
  return <div className="min-h-screen gradient-bg mesh-gradient">
    {page === 'lobby' && <Lobby initialRoom={roomId} onJoinCall={(id, host) => {
      setRoomId(id); setIsHost(host); setPage('call');
    }} onDirectCall={startDirect} onShowGuide={() => setPage('guide')} settings={settings} onSettingsChange={setSettings} />}
    {page === 'call' && <CallRoom roomId={roomId} isHost={isHost} settings={settings} onLeave={leave} onDirectCall={startDirect} />}
    {page === 'direct' && <DirectRoom settings={settings} incoming={directIncoming} onLeave={leave} />}
    {page === 'guide' && <SetupGuide onBack={() => setPage('lobby')} />}
  </div>;
}
