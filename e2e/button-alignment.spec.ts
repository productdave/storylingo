import { expect, test, type Locator, type Page } from "@playwright/test";

async function expectMinimumTouchTarget(locator: Locator) {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeGreaterThanOrEqual(44);
  expect(box!.height).toBeGreaterThanOrEqual(44);
}

async function expectHorizontallyCentered(locator: Locator, page: Page) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();
  expect(Math.abs(box!.x + box!.width / 2 - viewport!.width / 2)).toBeLessThan(
    1,
  );
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => window.localStorage.clear());
  await page.setViewportSize({ width: 390, height: 844 });
});

test("Think & Guess navigation controls stay centered and child-sized", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByTestId("card-think-guess").click();

  await expectMinimumTouchTarget(page.getByTestId("think-guess-back"));
  await expectMinimumTouchTarget(page.getByLabel("Settings"));
  for (const language of ["en", "zh", "es"]) {
    await expectMinimumTouchTarget(page.getByTestId(`language-${language}`));
  }
  await expectHorizontallyCentered(
    page.getByTestId("think-guess-language-switcher"),
    page,
  );

  const startButton = page.getByTestId("think-guess-start-game");
  await expect(startButton).toBeVisible();
  await expectMinimumTouchTarget(page.getByTestId("mode-i-guess"));
});

test("Story Adventure headers and secondary actions use the same 44px grid", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByTestId("button-start").click();

  await expectMinimumTouchTarget(
    page.getByRole("button", { name: "Home, back" }),
  );
  await expectMinimumTouchTarget(page.getByTestId("button-settings"));
  for (const language of ["en", "zh", "es"]) {
    await expectMinimumTouchTarget(page.getByTestId(`language-${language}`));
  }
  await expectHorizontallyCentered(
    page.getByTestId("think-guess-language-switcher"),
    page,
  );

  await page.getByTestId("card-story-snow-white").click();
  await expectMinimumTouchTarget(
    page.getByRole("button", { name: "Choose Your Story, back" }),
  );
  await expectMinimumTouchTarget(page.getByTestId("button-talk"));
  await expectMinimumTouchTarget(page.getByTestId("button-back"));
  await expectHorizontallyCentered(page.getByTestId("button-talk"), page);
  await expectHorizontallyCentered(page.getByTestId("button-back"), page);
});
