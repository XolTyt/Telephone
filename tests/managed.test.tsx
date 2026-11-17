import { EventEmitter } from 'node:events';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ peers: [] as any[], join: vi.fn() }));
vi.mock('@metered-ca/realtime', () => ({ MeteredPeer: class extends EventEmitter {
  state = 'idle'; remotePeers = []; addStream = vi.fn(); replaceTrack = vi.fn().mockResolvedValue(undefined);
  close = vi.fn(async () => { this.state = 'closed'; }); sendTo = vi.fn().mockResolvedValue(undefined);
  join = async (...args: any[]) => { await mocks.join(...args); this.state = 'joined'; };
  constructor() { super(); mocks.peers.push(this); }
} }));
import ManagedCall from '../src/components/ManagedCall';
class Track { enabled = true; stop = vi.fn(); applyConstraints = vi.fn().mockResolvedValue(undefined); getSettings = () => ({frameRate:30}); constructor(public kind: string) {} }
class Stream {
  tracks: Track[]; constructor(tracks = [new Track('video'),new Track('audio')]) { this.tracks=[...tracks]; }
  getTracks() {return this.tracks;} getVideoTracks() {return this.tracks.filter(t=>t.kind==='video');}
  getAudioTracks() {return this.tracks.filter(t=>t.kind==='audio');}
  addTrack(t:Track) {this.tracks.push(t);} removeTrack(t:Track) {this.tracks=this.tracks.filter(x=>x!==t);}
}
let streams: Stream[];
beforeEach(() => {
  streams=[]; mocks.peers.length=0; mocks.join.mockReset().mockResolvedValue(undefined);
  vi.stubGlobal('isSecureContext',true); vi.stubGlobal('MediaStream',Stream);
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({apiKey:'pk_live_clearcall_test',version:'test'})}));
  Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:vi.fn(async (constraints:any)=>{
    const stream=new Stream(constraints.audio===false?[new Track('video')]:undefined);streams.push(stream);return stream;
  })}});
  vi.spyOn(HTMLMediaElement.prototype,'play').mockResolvedValue();
});
afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.useRealTimers();});
it('changes FPS without rejoining or replacing media and reports a camera limited to 30 FPS', async()=>{
  render(<ManagedCall roomId="ABCDEFGH2345ABCDEFGH2345" onLeave={()=>{}}/>);
  await screen.findByRole('heading',{name:'Ждём собеседника'});
  fireEvent.click(screen.getByRole('button',{name:'Выключить микрофон'}));
  fireEvent.click(screen.getByRole('button',{name:'60 FPS'}));
  await screen.findByText(/Эта камера сейчас выдаёт 30 FPS/);
  expect(streams[0].getVideoTracks()[0].applyConstraints).toHaveBeenCalledWith({frameRate:{ideal:60,max:60}});
  expect(streams[0].getAudioTracks()[0].enabled).toBe(false);
  expect(mocks.join).toHaveBeenCalledTimes(1); expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1);
  streams[0].getVideoTracks()[0].applyConstraints.mockRejectedValueOnce(new Error('unsupported'));
  fireEvent.click(screen.getByRole('button',{name:'30 FPS'}));
  await screen.findByText('Не удалось изменить FPS. Звонок продолжается с прежними настройками.');
  expect(screen.getByRole('button',{name:'60 FPS ✓'}).getAttribute('aria-pressed')).toBe('true');
});
it('joins the same named room and releases resources when leaving', async()=>{
  const view=render(<ManagedCall roomId="ABCDEFGH2345ABCDEFGH2345" onLeave={()=>{}}/>);
  await screen.findByRole('heading',{name:'Ждём собеседника'});
  expect(mocks.join).toHaveBeenCalledWith('clearcall-ABCDEFGH2345ABCDEFGH2345');
  expect(mocks.peers[0].addStream).toHaveBeenCalledWith(streams[0]);view.unmount();
  expect(streams[0].getTracks().every(t=>t.stop.mock.calls.length)).toBe(true);expect(mocks.peers[0].close).toHaveBeenCalled();
});
it('does not ask for camera permissions before service setup exists', async()=>{
  vi.mocked(fetch).mockResolvedValue({ok:false,json:async()=>({code:'NOT_CONFIGURED'})} as any);
  render(<ManagedCall roomId="ABCDEFGH2345ABCDEFGH2345" onLeave={()=>{}}/>);
  await screen.findByText('Сервис звонков ещё не подключён владельцем приложения. Настройки камеры менять не нужно.');
  expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();expect(mocks.peers).toHaveLength(0);
});
it('reports missing Send permission without exposing service error text', async()=>{
  mocks.join.mockRejectedValueOnce(Object.assign(new Error('private-token-must-not-appear'),{name:'action_not_permitted'}));
  render(<ManagedCall roomId="ABCDEFGH2345ABCDEFGH2345" onLeave={()=>{}}/>);
  await screen.findByText(/Владельцу нужно включить Send/);expect(document.body.textContent).not.toContain('private-token-must-not-appear');
});
it('stops a permission grant that arrives after the call is closed', async()=>{
  let resolve!:(s:Stream)=>void;
  vi.mocked(navigator.mediaDevices.getUserMedia).mockReturnValue(new Promise(r=>{resolve=r;}) as any);
  const view=render(<ManagedCall roomId="ABCDEFGH2345ABCDEFGH2345" onLeave={()=>{}}/>);
  await waitFor(()=>expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled());view.unmount();
  const stream=new Stream();await act(async()=>resolve(stream));expect(stream.getTracks().every(t=>t.stop.mock.calls.length)).toBe(true);
});
it('restores the existing camera if the other camera is unavailable, keeping muted audio', async()=>{
  render(<ManagedCall roomId="ABCDEFGH2345ABCDEFGH2345" onLeave={()=>{}}/>);
  await screen.findByRole('heading',{name:'Ждём собеседника'});
  fireEvent.click(screen.getByRole('button',{name:'Выключить микрофон'}));
  const audio=streams[0].getAudioTracks()[0];
  vi.mocked(navigator.mediaDevices.getUserMedia).mockRejectedValueOnce(new Error('no back camera'));
  fireEvent.click(screen.getByRole('button',{name:'Переключить камеру'}));
  await screen.findByText('Другую камеру включить не удалось. Возвращена прежняя камера.');
  expect(audio.stop).not.toHaveBeenCalled();expect(audio.enabled).toBe(false);
  expect(mocks.peers[0].replaceTrack).toHaveBeenCalled();
});
it('times out a hung configuration request and does not start a late connection', async()=>{
  vi.useFakeTimers();let resolve!:(r:any)=>void;
  vi.mocked(fetch).mockReturnValue(new Promise(r=>{resolve=r;}));
  render(<ManagedCall roomId="ABCDEFGH2345ABCDEFGH2345" onLeave={()=>{}}/>);
  await act(async()=>{await vi.advanceTimersByTimeAsync(25000);});
  expect(screen.getByText('Сервер звонков не ответил за 25 секунд. Попробуйте снова или другую сеть.')).toBeTruthy();
  await act(async()=>resolve({ok:true,json:async()=>({apiKey:'pk_live_clearcall_test'})}));
  expect(mocks.peers).toHaveLength(0);
});
