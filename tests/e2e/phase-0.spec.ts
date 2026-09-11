import { expect, test } from '@playwright/test';

test('Vietnamese home renders DB content and SEO', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const response = await page.goto('/');
  expect(response?.status()).toBe(200);
  expect(response?.request().redirectedFrom()).toBeNull();
  await expect(page).toHaveURL('http://kimmyphungmakeup.localhost:3000/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Vẻ đẹp mang dấu ấn riêng.');
  await expect(page).toHaveTitle('Kimmy Phùng Makeup | Trang điểm tôn nét riêng');
  await expect(page.locator('html')).toHaveAttribute('lang', 'vi');
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /Kimmy Phùng Makeup/);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'http://kimmyphungmakeup.localhost:3000/');
  await expect(page.locator('link[hreflang="vi"]')).toHaveAttribute('href', 'http://kimmyphungmakeup.localhost:3000/');
  await expect(page.locator('link[hreflang="x-default"]')).toHaveAttribute('href', 'http://kimmyphungmakeup.localhost:3000/');
  await expect(page.locator('link[hreflang="en"]')).toHaveAttribute('href', 'http://kimmyphungmakeup.localhost:3000/en');
  expect(errors).toEqual([]);
});

test('language navigation retains the translated About page', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Về Kimmy', exact: false }).click();
  await expect(page).toHaveURL('http://kimmyphungmakeup.localhost:3000/gioi-thieu');
  await page.getByRole('link', { name: 'English', exact: true }).click();
  await expect(page).toHaveURL(/\/en\/about$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('It starts with you.');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('link[hreflang="vi"]')).toHaveAttribute('href', 'http://kimmyphungmakeup.localhost:3000/gioi-thieu');
  await expect(page.locator('link[hreflang="x-default"]')).toHaveAttribute('href', 'http://kimmyphungmakeup.localhost:3000/gioi-thieu');
  await page.getByRole('link', { name: 'Tiếng Việt', exact: true }).click();
  await expect(page).toHaveURL('http://kimmyphungmakeup.localhost:3000/gioi-thieu');
  await expect(page.locator('html')).toHaveAttribute('lang', 'vi');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'http://kimmyphungmakeup.localhost:3000/gioi-thieu');
  await page.getByRole('link', { name: 'Về trang chủ' }).click();
  await expect(page).toHaveURL('http://kimmyphungmakeup.localhost:3000/');
  await page.getByRole('link', { name: 'English', exact: true }).click();
  await page.getByRole('link', { name: 'About Kimmy' }).click();
  await page.getByRole('link', { name: 'Back to home' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Beauty that feels like you.');
});

test('demo domain uses its own content and actual available translations', async ({ page }) => {
  const response = await page.goto('http://demo.localhost:3000');
  expect(response?.request().redirectedFrom()).toBeNull();
  await expect(page).toHaveURL('http://demo.localhost:3000/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Một không gian. Nhiều ý tưởng.');
  await expect(page.getByRole('link', { name: 'English', exact: true })).toHaveCount(0);
  await expect(page.locator('link[hreflang="en"]')).toHaveCount(0);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'http://demo.localhost:3000/');
  await expect(page.locator('link[hreflang="x-default"]')).toHaveAttribute('href', 'http://demo.localhost:3000/');
});

test('unregistered domain gives its own 404', async ({ page }) => {
  const response = await page.goto('http://khac.localhost:3000');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Website chưa được đăng ký');
});

for (const path of ['/fr', '/missing', '/en/gioi-thieu', '/page.with.dots']) {
  test(`missing route ${path} returns a real 404`, async ({ page }) => {
    const response = await page.goto(path);
    expect(response?.status()).toBe(404);
    // Next.js can emit noindex both for a 404 rewrite and its notFound boundary.
    const directives = await page.locator('meta[name="robots"]').evaluateAll((elements) => elements.map((element) => element.getAttribute('content') ?? ''));
    expect(directives.length).toBeGreaterThan(0);
    expect(directives.every((value) => value.split(',').map((item) => item.trim()).includes('noindex'))).toBe(true);
  });
}

test('missing demo English translation is 404', async ({ page }) => {
  expect((await page.goto('http://demo.localhost:3000/en'))?.status()).toBe(404);
});

test('responsive layout stays inside the viewport in light and dark modes', async ({ page }) => {
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    await page.goto('/en');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/home-${colorScheme}-${test.info().project.name}.png`, fullPage: true });
  }
});

test('forged tenant and forwarded-host headers cannot select a different site', async ({ request }) => {
  const resolve = await request.get(`http://localhost:${process.env.E2E_API_PORT ?? '4000'}/api/v1/sites/resolve?domain=kimmyphungmakeup.localhost`);
  const kimmy = await resolve.json();
  const response = await request.get('http://localhost:3000/', { headers: { host: 'demo.localhost:3000', 'x-site-id': kimmy.id, 'x-forwarded-host': 'kimmyphungmakeup.localhost:3000' } });
  expect(response.status()).toBe(200);
  const html = await response.text();
  expect(html).toContain('Một không gian. Nhiều ý tưởng.');
  expect(html).not.toContain('Vẻ đẹp mang dấu ấn riêng.');
});

test('concurrent tenant requests do not contaminate cached content', async ({ request }) => {
  await Promise.all(Array.from({ length: 12 }, async (_, i) => {
    const demo = i % 2 === 0;
    const response = await request.get('http://localhost:3000/', { headers: { host: `${demo ? 'demo' : 'kimmyphungmakeup'}.localhost:3000` } });
    expect(response.status()).toBe(200);
    expect(await response.text()).toContain(demo ? 'Một không gian. Nhiều ý tưởng.' : 'Vẻ đẹp mang dấu ấn riêng.');
  }));
});

test('explicit default prefixes permanently redirect once and preserve query strings', async ({ request }) => {
  for (const [path, target] of [['/vi', '/'], ['/vi/gioi-thieu?from=test', '/gioi-thieu?from=test']]) {
    const response = await request.get(`http://localhost:3000${path}`, { headers: { host: 'kimmyphungmakeup.localhost:3000', 'x-forwarded-host': 'attacker.example' }, maxRedirects: 0 });
    expect(response.status()).toBe(301);
    expect(response.headers().location).toBe(`http://kimmyphungmakeup.localhost:3000${target}`);
    const canonical = await request.get(`http://localhost:3000${target}`, { headers: { host: 'kimmyphungmakeup.localhost:3000' }, maxRedirects: 0 });
    expect(canonical.status()).toBe(200);
    expect(canonical.headers().location).toBeUndefined();
  }
  const demo = await request.get('http://localhost:3000/vi', { headers: { host: 'demo.localhost:3000' }, maxRedirects: 0 });
  expect(demo.status()).toBe(301);
  expect(demo.headers().location).toBe('http://demo.localhost:3000/');
});

test('browser language and locale cookie do not override the site default', async ({ page }) => {
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });
  await page.context().addCookies([{ name: 'NEXT_LOCALE', value: 'en', domain: 'kimmyphungmakeup.localhost', path: '/' }]);
  const response = await page.goto('/?from=language-test');
  expect(response?.status()).toBe(200);
  expect(response?.request().redirectedFrom()).toBeNull();
  await expect(page).toHaveURL('http://kimmyphungmakeup.localhost:3000/?from=language-test');
  await expect(page.locator('html')).toHaveAttribute('lang', 'vi');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Vẻ đẹp mang dấu ấn riêng.');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'http://kimmyphungmakeup.localhost:3000/');
});
