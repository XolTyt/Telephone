import { createHmac, randomBytes } from 'node:crypto';

// coturn REST authentication: the shared secret never reaches the browser.
export default function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ error: 'Method not allowed' });
  }
  const urls = (process.env.TURN_URLS || '').split(',').map(s => s.trim()).filter(Boolean);
  const secret = process.env.TURN_SECRET;
  if (!urls.length || !secret || !urls.every(url => /^turns?:/.test(url))) {
    return response.status(503).json({ error: 'TURN is not configured' });
  }
  // Credentials remain valid for a long call, but are not permanent passwords.
  const username = `${Math.floor(Date.now() / 1000) + 86400}:${randomBytes(12).toString('hex')}`;
  const credential = createHmac('sha1', secret).update(username).digest('base64');
  return response.status(200).json([{ urls, username, credential }]);
}
