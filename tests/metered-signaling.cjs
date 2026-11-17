const http = require('node:http');
const { randomUUID } = require('node:crypto');
const { WebSocketServer } = require('ws');
const clients = new Map();
const channels = new Map();
const json = (socket, data) => { if (socket.readyState === 1) socket.send(JSON.stringify(data)); };
const server = http.createServer((request, response) => {
  if (request.url === '/drop') { for (const socket of clients.values()) socket.terminate(); response.end('ok'); return; }
  response.end('Local Metered protocol test harness');
});
const wss = new WebSocketServer({ server });
wss.on('connection', (socket, request) => {
  const url = new URL(request.url, 'http://localhost');
  if (url.searchParams.get('key') !== 'pk_live_clearcall_test') { socket.close(4001); return; }
  const id = randomUUID(); clients.set(id, socket);
  json(socket, { type: 'welcome', peerId: id, expiresAt: null, serverTime: Math.floor(Date.now()/1000), maxMessageSize: 65536, metadata: { iceServers: [] } });
  socket.on('message', raw => {
    const message = JSON.parse(raw.toString());
    if (message.type === 'ping') { json(socket, { type: 'pong' }); return; }
    if (message.type === 'subscribe') {
      const group = channels.get(message.channel) || new Set();
      const existing = [...group].map(peerId => ({ peerId }));
      group.add(id); channels.set(message.channel, group);
      json(socket, { type: 'ack', requestId: message.requestId });
      json(socket, { type: 'presence', channel: message.channel, joined: existing, left: [] });
      for (const other of group) if (other !== id) json(clients.get(other), { type: 'presence', channel: message.channel, joined: [{peerId:id}], left: [] });
      return;
    }
    if (message.type === 'send') {
      const receiver = clients.get(message.toPeerId ?? message.to);
      if (!receiver) { json(socket, { type:'error', requestId:message.requestId, code:'peer_not_found' }); return; }
      json(receiver, { type:'direct', from:id, data:message.data });
    } else if (message.type === 'publish') {
      for (const other of channels.get(message.channel) || []) if (other !== id) json(clients.get(other), { type:'message', from:id, channel:message.channel, data:message.data });
    }
    json(socket, { type:'ack', requestId:message.requestId });
  });
  socket.on('close', () => {
    clients.delete(id);
    for (const [channel, group] of channels) {
      if (!group.delete(id)) continue;
      for (const other of group) json(clients.get(other), {type:'presence',channel,joined:[],left:[{peerId:id}]});
      if (!group.size) channels.delete(channel);
    }
  });
});
server.listen(19117);
