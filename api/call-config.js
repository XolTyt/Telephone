import { publishableKey } from '../config/call-service.js';
// This is a publishable browser key, never a Metered sk_ secret.
export default function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ error: 'Method not allowed' });
  }
  const key = (process.env.METERED_PUBLISHABLE_KEY ?? publishableKey).trim();
  if (!/^pk_live_[A-Za-z0-9_-]{8,256}$/.test(key)) {
    return response.status(503).json({ code: 'NOT_CONFIGURED', error: 'Владелец приложения ещё не подключил сервер звонков.' });
  }
  const domain = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return response.status(200).json({ apiKey: key, version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || 'development',
    ...(domain ? { publicOrigin: `https://${domain}` } : {}) });
}
