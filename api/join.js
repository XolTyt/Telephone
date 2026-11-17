import { randomUUID } from 'node:crypto';
import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ error: 'Method not allowed' });
  }
  // Browser clients can only ask this endpoint for a room-scoped token.
  // No credentials, identities, or permissions from the request are trusted.
  const room = request.body?.room;
  if (typeof room !== 'string' || !/^[A-HJ-NP-Z2-9]{24}$/.test(room)) {
    return response.status(400).json({ error: 'Приглашение устарело или повреждено. Создайте новый звонок.' });
  }
  const url = process.env.LIVEKIT_URL;
  const key = process.env.LIVEKIT_API_KEY;
  const secret = process.env.LIVEKIT_API_SECRET;
  if (!url || !key || !secret) {
    return response.status(503).json({ error: 'Сервис звонков ещё не настроен. Попросите владельца сайта завершить подключение.', code: 'NOT_CONFIGURED' });
  }
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'wss:') throw new Error('Invalid service URL');
    const service = new RoomServiceClient(url.replace(/^wss:/, 'https:'), key, secret, { requestTimeout: 15 });
    await service.createRoom({ name: room, maxParticipants: 2, emptyTimeout: 300, departureTimeout: 60 });
    const token = new AccessToken(key, secret, { identity: randomUUID(), ttl: '15m' });
    token.addGrant({ roomJoin: true, room, canPublish: true, canSubscribe: true, canPublishData: false });
    const jwt = await token.toJwt();
    return response.status(200).json({ url, token: jwt });
  } catch {
    return response.status(502).json({ error: 'Не удалось подготовить звонок. Попробуйте ещё раз. Если ошибка повторяется, владельцу сайта нужно проверить подключение LiveKit.' });
  }
}
