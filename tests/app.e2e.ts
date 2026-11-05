import { test, expect, type Page } from '@playwright/test';

async function navigate(page: Page, name: string) {
  await page.getByRole('navigation', { name: /주 메뉴/ }).filter({ visible: true }).getByRole('button', { name, exact: true }).click();
}
test('device records survive reload, backup/restore, and offline launch', async ({ page, context }) => {
  await page.goto('/budget_manager/');
  await expect(page.getByRole('heading', { name: /오늘의 나/ })).toBeVisible();
  await page.getByRole('button', { name: '첫 자산 입력' }).click();
  await page.getByLabel('항목 이름').fill('테스트 통장');
  await page.getByLabel('현재 잔액').fill('1000');
  await page.getByRole('button', { name: '저장하기', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.reload();
  await navigate(page, '나의 자산');
  await expect(page.getByRole('button', { name: /테스트 통장/ })).toBeVisible();
  await navigate(page, '월 예산');
  for (const item of [{ kind: 'income', name: '테스트 급여', amount: '300' }, { kind: 'expense', name: '테스트 생활비', amount: '180' }, { kind: 'saving', name: '테스트 저축', amount: '70' }, { kind: 'investment', name: '테스트 투자', amount: '30' }]) {
    await page.getByRole('button', { name: '예산 항목 추가', exact: true }).click();
    await page.getByLabel('분류').selectOption(item.kind);
    await page.getByLabel('항목 이름').fill(item.name);
    await page.getByLabel('매달 금액').fill(item.amount);
    await page.getByRole('button', { name: '저장하기', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  }
  await expect(page.locator('.budget-equation')).toContainText('20만원');
  await navigate(page, '미래 그리기');
  await page.getByRole('button', { name: '1년', exact: true }).click();
  await expect(page.locator('.forecast-main .chart-heading')).toContainText('24,400,000원');
  await navigate(page, '기록과 백업');
  await page.getByRole('button', { name: '이번 달 기록', exact: true }).click();
  await page.getByRole('button', { name: '기록 남기기', exact: true }).click();
  await expect(page.getByRole('table')).toContainText('1,000만원');
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: '백업 내보내기' }).click();
  const file = await downloaded;
  const path = await file.path();
  expect(path).toBeTruthy();
  await page.getByLabel('백업 파일 선택').setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{"app":"bad"}') });
  await expect(page.getByRole('alert')).toContainText('모아에서 내보낸');
  await page.getByRole('button', { name: '오류 알림 닫기' }).click();
  await page.getByLabel('백업 파일 선택').setInputFiles(path!);
  await page.getByRole('button', { name: '백업으로 교체', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: '예시 둘러보기' }).click();
  await page.getByRole('button', { name: '내 기록으로', exact: true }).click();
  await navigate(page, '나의 자산');
  await expect(page.getByRole('button', { name: /테스트 통장/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /생활비 통장/ })).toHaveCount(0);
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await navigate(page, '나의 자산');
  await expect(page.getByRole('button', { name: /테스트 통장/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('demo edits never persist to real records', async ({ page }) => {
  await page.goto('/budget_manager/');
  await page.getByRole('button', { name: '예시 둘러보기' }).click();
  await navigate(page, '나의 자산');
  await page.getByRole('button', { name: /생활비 통장/ }).click();
  await page.getByLabel('현재 잔액').fill('999');
  await page.getByRole('button', { name: '저장하기', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: '첫 자산 입력' })).toBeVisible();
});
