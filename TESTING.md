# Testing StoryLingo

100% test coverage is the key to great vibe coding. Tests let you move fast, trust your instincts, and ship with confidence—without them, vibe coding is just yolo coding. With tests, it's a superpower.

## Framework

StoryLingo uses Node's test runner for deterministic engine/API/content tests and Playwright Test with Chromium for browser-level responsive layout and user-flow coverage. The repository tracks the browser version in `package.json` and `package-lock.json`.

Install the matching browser after dependencies are installed:

```bash
npm ci
npx playwright install chromium
```

## Running tests

```bash
npm test
```

Use `npm run test:unit` or `npm run test:e2e` to run one layer. Use `npm run test:e2e:headed` when a visible browser helps diagnose a failure. Playwright starts the Expo web server automatically on port 4173.

GitHub Actions runs the Chromium suite for every pull request and every push to `main`. If a CI run fails, it keeps the Playwright HTML report, traces, screenshots, and videos as the `playwright-report` artifact for seven days.

## Test layers

- Engine and API tests live in `server/thinkGuess/*.test.ts`. They cover content validation, multilingual intent handling, deterministic transitions, concurrency, expiration, credential isolation, and secret non-disclosure.
- Pure client adaptation tests live in `client/lib/*.test.ts`.
- Browser tests live in `e2e/`. They cover the existing story path plus Think & Guess mode selection, hints, solving, replay, exit, microphone denial, expired-round recovery, and mobile/desktop containment.
- Smoke tests belong in the browser suite when their purpose is to prove the app loads and a critical path remains reachable.

## Conventions

- Name files `*.spec.ts` and describe behavior from the user's perspective.
- Prefer stable roles, labels, and `testID` selectors over CSS implementation details.
- Use Playwright's retrying `expect` assertions for asynchronous UI state.
- Assert visible behavior, dimensions, or outcomes rather than checking only that an element exists.
- Clear or seed browser storage explicitly when a test depends on first-run state.
