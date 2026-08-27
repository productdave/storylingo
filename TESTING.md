# Testing StoryLingo

100% test coverage is the key to great vibe coding. Tests let you move fast, trust your instincts, and ship with confidence—without them, vibe coding is just yolo coding. With tests, it's a superpower.

## Framework

StoryLingo uses Playwright Test with Chromium for browser-level responsive layout and user-flow coverage. The repository tracks the Playwright version in `package.json` and `package-lock.json`.

Install the matching browser after dependencies are installed:

```bash
npm ci
npx playwright install chromium
```

## Running tests

```bash
npm test
```

Use `npm run test:e2e:headed` when a visible browser helps diagnose a failure. Playwright starts the Expo web server automatically on port 4173.

## Test layers

- Browser tests live in `e2e/` and cover responsive layouts, navigation, and critical user interactions.
- Integration tests should cover flows spanning screens or browser/runtime boundaries.
- Unit tests should be added for extracted pure logic when browser coverage would be unnecessarily slow or indirect.
- Smoke tests belong in the browser suite when their purpose is to prove the app loads and a critical path remains reachable.

## Conventions

- Name files `*.spec.ts` and describe behavior from the user's perspective.
- Prefer stable roles, labels, and `testID` selectors over CSS implementation details.
- Use Playwright's retrying `expect` assertions for asynchronous UI state.
- Assert visible behavior, dimensions, or outcomes rather than checking only that an element exists.
- Clear or seed browser storage explicitly when a test depends on first-run state.
