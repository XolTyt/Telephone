import { test, expect } from '@playwright/test';

test('one-link managed SDK call exchanges real media, survives signaling drop and rejects a third caller', async ({ context, page }) => {
  test.setTimeout(90000);
  const errors: string[] = []; context.on('page', p => p.on('pageerror', e => errors.push(e.message)));
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {writeText: async (url: string) => {
      (window as unknown as { sharedUrl?: string }).sharedUrl = url;
    }} });
  });
  await context.route('**/api/call-config', route => route.fulfill({ contentType:'application/json', body:JSON.stringify({ apiKey:'pk_live_clearcall_test', version:'e2e' }) }));
  await page.goto('/');
  await expect(page.getByRole('button', { name:'Создать звонок' })).toBeVisible();
  await page.getByRole('button', { name:'Создать звонок' }).click();
  await expect(page.getByRole('heading', { name:'Ждём собеседника' })).toBeVisible();
  await page.getByRole('button', { name:'Скопировать ссылку' }).click();
  const url = await page.evaluate(() => (window as unknown as { sharedUrl: string }).sharedUrl);
  expect(new URL(url).searchParams.get('room')).toMatch(/^[A-HJ-NP-Z2-9]{24}$/);
  const guest = await context.newPage(); await guest.goto(url);
  await guest.getByRole('button', { name:'Войти в звонок' }).click();
  for (const phone of [page, guest]) {
    await expect.poll(() => phone.locator('.remote-video').evaluate((v:HTMLVideoElement) => v.videoWidth), {timeout:20000}).toBeGreaterThanOrEqual(1920);
    expect(await phone.locator('.remote-video').evaluate((v:HTMLVideoElement) => (v.srcObject as MediaStream).getAudioTracks().some(t => t.readyState === 'live'))).toBe(true);
  }
  await page.getByRole('button', { name:'Выключить микрофон' }).click();
  await page.getByRole('button', { name:'Переключить камеру' }).click();
  await expect(page.getByRole('button', { name:'Переключить камеру' })).toBeEnabled();
  expect(await page.locator('.local-video').evaluate((v:HTMLVideoElement) => (v.srcObject as MediaStream).getAudioTracks()[0].enabled)).toBe(false);
  await page.locator('summary').click();
  await expect(page.getByLabel('Статистика качества')).toContainText('Приём:', {timeout:10000});
  await page.screenshot({path:'tests/artifacts/managed-call.png'});
  const third = await context.newPage(); await third.goto(url); await third.getByRole('button', {name:'Войти в звонок'}).click();
  await expect(third.getByText('В этом звонке уже два человека.', {exact:false})).toBeVisible({timeout:10000});
  await third.close();
  for (const phone of [page, guest]) {
    await expect(phone.getByRole('status', { name: '' }).filter({hasText:'На связи'})).toHaveCount(1);
  }
  await page.request.get('http://localhost:19117/drop');
  for (const phone of [page,guest]) await expect.poll(() => phone.locator('.remote-video').evaluate((v:HTMLVideoElement) => v.videoWidth), {timeout:20000}).toBeGreaterThan(0);
  await guest.getByRole('button', {name:'Завершить звонок'}).click();
  await expect(page.getByRole('heading', {name:'Собеседник вышел. Ждём возвращения'})).toBeVisible({timeout:15000});
  expect(errors).toEqual([]);
});
