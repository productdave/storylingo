import assert from "node:assert/strict";
import test from "node:test";
import { resolveApiUrl } from "./query-client";

test("production web builds use the page origin when no API domain is injected", () => {
  assert.equal(
    resolveApiUrl({
      nodeEnv: "production",
      browserOrigin: "https://storylingo.example",
    }),
    "https://storylingo.example/",
  );
});

test("an explicit API domain overrides the browser origin", () => {
  assert.equal(
    resolveApiUrl({
      configuredDomain: "api.storylingo.example",
      nodeEnv: "production",
      browserOrigin: "https://storylingo.example",
    }),
    "https://api.storylingo.example/",
  );
});

test("local development keeps its separate API server default", () => {
  assert.equal(
    resolveApiUrl({ nodeEnv: "development" }),
    "http://127.0.0.1:5000/",
  );
});

test("non-browser production callers still require an API domain", () => {
  assert.throws(
    () => resolveApiUrl({ nodeEnv: "production" }),
    /API domain is unavailable/,
  );
});
