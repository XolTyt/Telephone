import { useEffect, useRef } from 'react';

export default function Video({ stream, local = false, hidden = false, onBlocked }: {
  stream: MediaStream | null; local?: boolean; hidden?: boolean; onBlocked?: () => void;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    video.srcObject = stream;
    if (stream) void video.play().catch(() => onBlocked?.());
    return () => { video.srcObject = null; };
  }, [stream, onBlocked]);
  return <video ref={ref} autoPlay playsInline muted={local} className={`${local ? 'local-video' : 'remote-video'} ${hidden ? 'invisible' : ''}`} />;
}
