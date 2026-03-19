import { Page } from "playwright/test";

export async function loginAs(page: Page, email: string, password: string) {
    await page.goto('/login');
    await page.fill('[data-testid=email-login]', email);
    await page.fill('[data-testid=password-login]', password);
    await page.click('[data-testid=login-button]');
    await page.waitForURL('**/');
}

export async function setupGame(pages: Page[]): Promise<string> {
    await pages[0].goto('/');
    await Promise.all([
        pages[0].waitForURL(/\/game\/.+/),
        pages[0].click('[data-testid="create-room-button"]')
    ]);
    const gameUrl = pages[0].url();

    // navigate all other pages to the game room
    for (const page of pages.slice(1)) {
        await page.goto(gameUrl);
        await page.waitForLoadState('networkidle');
    }

    // join teams sequentially to avoid race conditions
    await pages[0].locator('[data-testid="team-1-button"]').waitFor({ state: 'visible' });
    await pages[0].click('[data-testid="team-1-button"]');

    await pages[1].locator('[data-testid="team-1-button"]').waitFor({ state: 'visible' });
    await pages[1].click('[data-testid="team-1-button"]');

    await pages[2].locator('[data-testid="team-2-button"]').waitFor({ state: 'visible' });
    await pages[2].click('[data-testid="team-2-button"]');

    await pages[3].locator('[data-testid="team-2-button"]').waitFor({ state: 'visible' });
    await pages[3].click('[data-testid="team-2-button"]');

    return gameUrl;
}

export async function createGame(page: Page): Promise<string> {
    await page.goto('/');
    await Promise.all([
        page.waitForURL(/\/game\/.+/),
        page.click('[data-testid="create-room-button"]')
    ]);
    return page.url();
}