import { useEffect, useRef, useState, useCallback } from 'react';
import Peer, { MediaConnection } from 'peerjs';

interface QualitySettings {
  resolution: string;
  fps: number;
  videoBitrate: number;
  audioBitrate: number;
}

interface CallRoomProps {
  roomId: string;
  isHost: boolean;
  onLeave: () => void;
  settings: QualitySettings;
}

type ConnectionState = 'connecting' | 'waiting' | 'connected' | 'error';

export default function CallRoom({ roomId, isHost, onLeave, settings }: CallRoomProps) {
  const [connectionState, setConnectionState] = useState<ConnectionState>('connecting');
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isFrontCamera, setIsFrontCamera] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerRef = useRef<Peer | null>(null);
  const callRef = useRef<MediaConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const peerId = `clearcall-${roomId}-${isHost ? 'host' : 'guest'}`;
  const remotePeerId = `clearcall-${roomId}-${isHost ? 'guest' : 'host'}`;

  const getMediaConstraints = useCallback(() => {
    const res = Number(settings.resolution);
    return {
      video: {
        facingMode: isFrontCamera ? 'user' : 'environment',
        width: { ideal: res === 2160 ? 3840 : res === 1440 ? 2560 : res === 1080 ? 1920 : 1280 },
        height: { ideal: res === 2160 ? 2160 : res === 1440 ? 1440 : res === 1080 ? 1080 : 720 },
        frameRate: { ideal: settings.fps, max: settings.fps },
      },
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    };
  }, [settings, isFrontCamera]);

  const startLocalStream = useCallback(async () => {
    try {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia(getMediaConstraints());
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      return stream;
    } catch (err) {
      console.error('Error accessing media devices:', err);
      setError('Не удалось получить доступ к камере/микрофону. Проверьте разрешения.');
      setConnectionState('error');
      return null;
    }
  }, [getMediaConstraints]);

  const applyBitrate = useCallback((call: MediaConnection) => {
    // Apply bitrate settings via RTCPeerConnection
    const pc = call.peerConnection;
    pc.getSenders().forEach(sender => {
      if (sender.track?.kind === 'video') {
        const params = sender.getParameters();
        if (!params.encodings) params.encodings = [{}];
        params.encodings[0].maxBitrate = settings.videoBitrate * 1000;
        params.encodings[0].maxFramerate = settings.fps;
        sender.setParameters(params);
      }
      if (sender.track?.kind === 'audio') {
        const params = sender.getParameters();
        if (!params.encodings) params.encodings = [{}];
        params.encodings[0].maxBitrate = settings.audioBitrate * 1000;
        sender.setParameters(params);
      }
    });
  }, [settings]);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      const stream = await startLocalStream();
      if (!stream || !mounted) return;

      // Create peer with custom config for better quality
      const peer = new Peer(peerId, {
        debug: 1,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:stun3.l.google.com:19302' },
            { urls: 'stun:stun4.l.google.com:19302' },
          ],
          iceCandidatePoolSize: 10,
        },
      });

      peerRef.current = peer;

      peer.on('open', (id) => {
        console.log('My peer ID:', id);
        if (mounted) {
          if (isHost) {
            setConnectionState('waiting');
          } else {
            // Guest connects to host
            const call = peer.call(remotePeerId, stream);
            if (call) {
              callRef.current = call;
              setupCallHandlers(call);
            }
          }
        }
      });

      peer.on('call', (call) => {
        console.log('Incoming call');
        callRef.current = call;
        call.answer(stream);
        setupCallHandlers(call);
      });

      peer.on('error', (err) => {
        console.error('Peer error:', err);
        if (mounted) {
          if (err.type === 'peer-unavailable') {
            setError('Комната не найдена. Убедитесь, что хост создал комнату.');
            setConnectionState('error');
          } else if (err.type === 'unavailable-id') {
            // ID already taken, try with timestamp
            setError('Эта комната уже занята. Попробуйте другой код.');
            setConnectionState('error');
          } else {
            setError(`Ошибка подключения: ${err.message}`);
            setConnectionState('error');
          }
        }
      });

      peer.on('disconnected', () => {
        if (mounted) {
          console.log('Peer disconnected, trying to reconnect...');
          peer.reconnect();
        }
      });
    };

    init();

    return () => {
      mounted = false;
      if (callRef.current) {
        callRef.current.close();
      }
      if (peerRef.current) {
        peerRef.current.destroy();
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const setupCallHandlers = (call: MediaConnection) => {
    call.on('stream', (remoteStream) => {
      console.log('Received remote stream');
      setRemoteStream(remoteStream);
      setConnectionState('connected');
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
      }
      // Start call timer
      if (!timerRef.current) {
        timerRef.current = setInterval(() => {
          setCallDuration(prev => prev + 1);
        }, 1000);
      }
    });

    call.on('close', () => {
      console.log('Call closed');
      setConnectionState('waiting');
      setRemoteStream(null);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    });

    call.on('error', (err) => {
      console.error('Call error:', err);
      setError('Ошибка звонка');
    });

    // Apply bitrate after connection
    call.peerConnection.onconnectionstatechange = () => {
      if (call.peerConnection.connectionState === 'connected') {
        applyBitrate(call);
      }
    };
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTracks = localStreamRef.current.getVideoTracks();
      videoTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsVideoOff(!isVideoOff);
    }
  };

  const switchCamera = async () => {
    setIsFrontCamera(!isFrontCamera);
    const stream = await startLocalStream();
    if (stream && callRef.current) {
      const videoSender = callRef.current.peerConnection.getSenders().find(s => s.track?.kind === 'video');
      if (videoSender && stream.getVideoTracks()[0]) {
        await videoSender.replaceTrack(stream.getVideoTracks()[0]);
      }
    }
  };

  const copyRoomId = () => {
    navigator.clipboard.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLeave = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (callRef.current) callRef.current.close();
    if (peerRef.current) peerRef.current.destroy();
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }
    onLeave();
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen flex flex-col bg-black relative">
      {/* Remote video (full screen) */}
      <div className="flex-1 relative overflow-hidden">
        {connectionState === 'connected' && remoteStream ? (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-b from-slate-900 to-black">
            {connectionState === 'connecting' && (
              <div className="text-center fade-in">
                <div className="w-16 h-16 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-slate-300 text-lg">Подключение...</p>
              </div>
            )}
            {connectionState === 'waiting' && (
              <div className="text-center fade-in">
                <div className="w-20 h-20 rounded-full bg-indigo-500/20 flex items-center justify-center mx-auto mb-4 pulse-ring">
                  <svg className="w-10 h-10 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <p className="text-slate-300 text-lg font-medium">Ожидание подключения...</p>
                <p className="text-slate-500 text-sm mt-2">Отправьте код комнаты другому участнику</p>
              </div>
            )}
            {connectionState === 'error' && (
              <div className="text-center fade-in max-w-sm px-4">
                <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <p className="text-red-300 text-lg font-medium">Ошибка</p>
                <p className="text-slate-400 text-sm mt-2">{error}</p>
                <button onClick={handleLeave} className="btn-primary mt-4 px-6 py-2 text-sm">
                  Вернуться
                </button>
              </div>
            )}
          </div>
        )}

        {/* Local video (PiP) */}
        <div className="absolute top-4 right-4 w-32 h-44 md:w-40 md:h-56 rounded-2xl overflow-hidden shadow-2xl border-2 border-white/10">
          {isVideoOff ? (
            <div className="w-full h-full bg-slate-800 flex items-center justify-center">
              <svg className="w-8 h-8 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
            </div>
          ) : (
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          )}
          <div className="absolute bottom-2 left-2 right-2 text-center">
            <span className="text-xs text-white/70 bg-black/50 px-2 py-0.5 rounded-full">
              {isMuted ? '🔇 Вы' : '🎤 Вы'}
            </span>
          </div>
        </div>

        {/* Connection quality indicator */}
        {connectionState === 'connected' && (
          <div className="absolute top-4 left-4 flex items-center gap-2">
            <div className="flex items-center gap-1 bg-black/50 backdrop-blur-sm px-3 py-1.5 rounded-full">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
              <span className="text-xs text-green-300 font-medium">{formatDuration(callDuration)}</span>
            </div>
            <div className="quality-badge fhd text-xs">
              {settings.resolution === '720' ? 'HD' : settings.resolution === '1080' ? 'FHD' : settings.resolution === '1440' ? '2K' : '4K'}
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
        {/* Room code */}
        <div className="flex justify-center mb-4">
          <button
            onClick={copyRoomId}
            className="flex items-center gap-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full border border-white/10 hover:bg-white/20 transition-all"
          >
            <svg className="w-4 h-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
            </svg>
            <span className="text-sm font-mono text-white">
              {copied ? '✓ Скопировано!' : `Код: ${roomId}`}
            </span>
          </button>
        </div>

        {/* Control buttons */}
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={toggleMute}
            className={`btn-control ${isMuted ? 'active' : ''}`}
            title={isMuted ? 'Включить микрофон' : 'Выключить микрофон'}
          >
            {isMuted ? (
              <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            )}
          </button>

          <button
            onClick={toggleVideo}
            className={`btn-control ${isVideoOff ? 'active' : ''}`}
            title={isVideoOff ? 'Включить камеру' : 'Выключить камеру'}
          >
            {isVideoOff ? (
              <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            )}
          </button>

          {/* Hang up */}
          <button onClick={handleLeave} className="btn-danger">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z" />
            </svg>
          </button>

          {/* Switch camera */}
          <button
            onClick={switchCamera}
            className="btn-control"
            title="Переключить камеру"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>

          {/* Fullscreen */}
          <button
            onClick={() => {
              if (document.fullscreenElement) {
                document.exitFullscreen();
              } else {
                document.documentElement.requestFullscreen();
              }
            }}
            className="btn-control"
            title="Полный экран"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
