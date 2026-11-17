import { test, expect } from '@playwright/test';

test('simple home and invitation need one click and no reply codes', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.route('**/api/join', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ code: 'NOT_CONFIGURED', error: 'Сервис звонков ещё не подключён.' }) }));
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Создать звонок' })).toBeVisible();
  await expect(page.getByText('Код комнаты', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Позвонить без сервера подключения' })).toHaveCount(0);
  await page.screenshot({ path: 'tests/artifacts/simple-home.png' });
  const room = 'ABCDEFGH2345ABCDEFGH2345';
  await page.goto(`/?room=${room}`);
  await expect(page.getByText('Вас пригласили на видеозвонок')).toBeVisible();
  await page.screenshot({ path: 'tests/artifacts/simple-invitation.png' });
  const request = page.waitForRequest(r => r.url().endsWith('/api/join'));
  await page.getByRole('button', { name: 'Войти в звонок' }).click();
  expect((await request).postDataJSON()).toEqual({ room });
  await expect(page.getByText('Сервис звонков ещё не подключён.')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});
