import { useState } from 'react';
import Lobby from './components/Lobby';
import CallRoom from './components/CallRoom';
import SetupGuide from './components/SetupGuide';

type Page = 'lobby' | 'call' | 'guide';

interface QualitySettings {
  resolution: string;
  fps: number;
  videoBitrate: number;
  audioBitrate: number;
}

function App() {
  const [page, setPage] = useState<Page>('lobby');
  const [roomId, setRoomId] = useState('');
  const [isHost, setIsHost] = useState(false);
  const [settings, setSettings] = useState<QualitySettings>({
    resolution: '1080',
    fps: 30,
    videoBitrate: 4000,
    audioBitrate: 128,
  });

  const handleJoinCall = (id: string, host: boolean) => {
    setRoomId(id);
    setIsHost(host);
    setPage('call');
  };

  const handleLeaveCall = () => {
    setRoomId('');
    setIsHost(false);
    setPage('lobby');
  };

  return (
    <div className="min-h-screen gradient-bg mesh-gradient">
      {page === 'lobby' && (
        <Lobby
          onJoinCall={handleJoinCall}
          onShowGuide={() => setPage('guide')}
          settings={settings}
          onSettingsChange={setSettings}
        />
      )}
      {page === 'call' && (
        <CallRoom
          roomId={roomId}
          isHost={isHost}
          onLeave={handleLeaveCall}
          settings={settings}
        />
      )}
      {page === 'guide' && (
        <SetupGuide onBack={() => setPage('lobby')} />
      )}
    </div>
  );
}

export default App;
