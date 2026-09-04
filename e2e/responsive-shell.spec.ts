import { expect, test, type Locator, type Page } from "@playwright/test";

type ShellStyles = {
  backgroundColor: string;
  borderRadius: string;
  maxWidth: string;
};

async function shellStyles(locator: Locator): Promise<ShellStyles> {
  return locator.evaluate((element) => {
    const styles = window.getComputedStyle(element);

    return {
      backgroundColor: styles.backgroundColor,
      borderRadius: styles.borderRadius,
      maxWidth: styles.maxWidth,
    };
  });
}

async function openApp(page: Page) {
  await page.goto("/");
  await expect(page.getByTestId("app-shell")).toBeVisible();
  await expect(page.getByTestId("home-adventure-map")).toBeVisible();
  await expect(page.getByTestId("home-logo")).toBeVisible();
  await expect(page.getByText("Four worlds. Endless stories.")).toHaveCount(0);
  await expect(page.getByTestId("button-start")).toBeVisible();
  await expect(page.getByText(/^Build:/)).toHaveCount(0);
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => window.localStorage.clear());
});

test("mobile keeps the app full-width without desktop chrome", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openApp(page);

  const viewport = page.getByTestId("app-viewport");
  const shell = page.getByTestId("app-shell");
  const box = await shell.boundingBox();

  expect(box).not.toBeNull();
  expect(box?.x).toBe(0);
  expect(box?.y).toBe(0);
  expect(box?.width).toBe(390);
  expect(await shellStyles(viewport)).toMatchObject({
    backgroundColor: "rgba(0, 0, 0, 0)",
    maxWidth: "none",
  });
  expect(await shellStyles(shell)).toMatchObject({
    backgroundColor: "rgba(0, 0, 0, 0)",
    borderRadius: "0px",
    maxWidth: "none",
  });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
});

test("desktop centers StoryLingo in a contained mobile shell", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await openApp(page);

  const viewport = page.getByTestId("app-viewport");
  const shell = page.getByTestId("app-shell");
  const box = await shell.boundingBox();

  expect(box).not.toBeNull();
  expect(box?.x).toBe(480);
  expect(box?.y).toBe(16);
  expect(box?.width).toBe(480);
  expect(await shellStyles(viewport)).toMatchObject({
    backgroundColor: "rgb(221, 235, 250)",
  });
  expect(await shellStyles(shell)).toMatchObject({
    backgroundColor: "rgb(248, 245, 255)",
    borderRadius: "28px",
    maxWidth: "480px",
  });

  await page.getByTestId("button-start").click();
  const storyCards = page.getByTestId(/^card-story-/);
  await expect(storyCards.first()).toBeVisible();

  const cardBoxes = await storyCards.evaluateAll((cards) =>
    cards.map((card) => {
      const rect = card.getBoundingClientRect();
      return { left: rect.left, right: rect.right, width: rect.width };
    }),
  );

  expect(cardBoxes.length).toBeGreaterThanOrEqual(4);
  for (const card of cardBoxes) {
    expect(card.left).toBeGreaterThanOrEqual(box?.x ?? 0);
    expect(card.right).toBeLessThanOrEqual((box?.x ?? 0) + (box?.width ?? 0));
    expect(card.width).toBeLessThan(box?.width ?? Number.POSITIVE_INFINITY);
  }
});

test("legacy expired-trial data no longer blocks story access", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "@storytale_subscription",
      JSON.stringify({
        status: "none",
        freeTrialEndDate: "2020-01-01T00:00:00.000Z",
      }),
    );
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await openApp(page);

  await page.getByTestId("button-start").click();
  await page.getByTestId("card-story-peter-pan").click();

  await expect(page.getByTestId("button-talk")).toBeVisible();
  await expect(page.getByText(/trial|subscribe|payment/i)).toHaveCount(0);
});

test("settings no longer exposes payment or subscription controls", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openApp(page);

  await page.getByTestId("button-start").click();
  await page.getByTestId("button-settings").click();

  await expect(
    page.getByText("Terms of Service", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Privacy Policy", { exact: true })).toBeVisible();
  await expect(
    page.getByText(/trial|subscription|premium|restore purchases|payment/i),
  ).toHaveCount(0);
});

test("crossing the desktop breakpoint toggles the shell immediately", async ({
  page,
}) => {
  await page.setViewportSize({ width: 767, height: 900 });
  await openApp(page);

  const viewport = page.getByTestId("app-viewport");
  const shell = page.getByTestId("app-shell");

  await expect.poll(async () => (await shell.boundingBox())?.width).toBe(767);
  expect((await shellStyles(viewport)).backgroundColor).toBe(
    "rgba(0, 0, 0, 0)",
  );

  await page.setViewportSize({ width: 768, height: 900 });

  await expect.poll(async () => (await shell.boundingBox())?.width).toBe(480);
  await expect.poll(async () => (await shell.boundingBox())?.x).toBe(144);
  expect((await shellStyles(viewport)).backgroundColor).toBe(
    "rgb(221, 235, 250)",
  );
});
