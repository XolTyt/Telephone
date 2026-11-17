import { test, expect } from '@playwright/test';

test('direct invitation exchanges real media with PeerJS blocked and a delayed answer', async ({ context, page }) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  const sockets: string[] = [];
  const configure = (phone: typeof page) => {
    phone.on('pageerror', e => errors.push(e.message));
    phone.on('websocket', ws => {
      // Vite's development client still opens its own control socket.
      if (new URL(ws.url()).port !== '3000') sockets.push(ws.url());
    });
  };
  configure(page);
  await context.route('**://0.peerjs.com/**', route => route.abort());
  await context.route('**://localhost:9000/**', route => route.abort());
  await page.goto('/');
  await page.getByRole('button', { name: 'Позвонить без сервера подключения' }).click();
  await page.getByRole('button', { name: 'Подготовить приглашение' }).click();
  const invitation = page.getByLabel('Ссылка приглашения', { exact: true });
  await expect(invitation).toBeVisible({ timeout: 20000 });
  const link = await invitation.inputValue();
  expect(link).toContain('#direct=');
  const guest = await context.newPage(); configure(guest);
  await guest.goto(link);
  await guest.getByRole('button', { name: 'Подготовить ответ' }).click();
  const answer = guest.getByLabel('Ссылка ответа', { exact: true });
  await expect(answer).toBeVisible({ timeout: 20000 });
  const response = await answer.inputValue();
  const answerTab = await context.newPage(); configure(answerTab);
  await answerTab.goto(response);
  await expect(answerTab.getByRole('heading', { name: 'Это ответ на приглашение' })).toBeVisible();
  await expect(answerTab.getByLabel('Полученная ответная ссылка')).toHaveValue(response);
  await answerTab.close();
  // Simulate copying an answer through a messenger instead of instant signaling.
  await page.waitForTimeout(35000);
  await page.getByLabel('Ответная ссылка от собеседника', { exact: true }).fill(response);
  await page.getByRole('button', { name: 'Применить ответ и соединиться' }).click();
  for (const phone of [page, guest]) {
    await expect.poll(() => phone.locator('.remote-video').evaluate((v: HTMLVideoElement) => v.videoWidth), { timeout: 25000 }).toBeGreaterThan(0);
    expect(await phone.locator('.remote-video').evaluate((v: HTMLVideoElement) => (v.srcObject as MediaStream).getAudioTracks().some(t => t.readyState === 'live'))).toBe(true);
    expect(await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.getByRole('button', { name: 'Выключить микрофон' }).click();
  await page.getByRole('button', { name: 'Переключить камеру' }).click();
  await expect(page.getByRole('button', { name: 'Переключить камеру' })).toBeEnabled();
  expect(await page.locator('.local-video').evaluate((v: HTMLVideoElement) => (v.srcObject as MediaStream).getAudioTracks()[0].enabled)).toBe(false);
  await page.screenshot({ path: 'tests/artifacts/direct-call.png' });
  await guest.getByRole('button', { name: 'Завершить звонок' }).click();
  await expect(guest.getByRole('heading', { name: 'ClearCall', exact: true })).toBeVisible();
  expect(sockets).toEqual([]);
  expect(errors).toEqual([]);
});

test('a malformed invitation cannot start the camera', async ({ page }) => {
  await page.goto('/#direct=jINVALID');
  await expect(page.getByRole('alert')).toContainText('повреждено');
  await expect(page.getByRole('button', { name: 'Подготовить приглашение' })).toBeDisabled();
});
