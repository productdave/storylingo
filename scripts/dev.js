const fs = require("node:fs");
const { spawn } = require("node:child_process");

if (fs.existsSync(".env") && typeof process.loadEnvFile === "function") {
  process.loadEnvFile(".env");
}

const isWindows = process.platform === "win32";
const npmCommand = isWindows ? "npm.cmd" : "npm";
const npxCommand = isWindows ? "npx.cmd" : "npx";
const apiHost =
  process.env.EXPO_PUBLIC_DOMAIN || `127.0.0.1:${process.env.PORT || "5000"}`;
const childEnvironment = {
  ...process.env,
  EXPO_PUBLIC_DOMAIN: apiHost,
};
const children = [];
let shuttingDown = false;

function start(command, args) {
  const child = spawn(command, args, {
    stdio: "inherit",
    env: childEnvironment,
    detached: !isWindows,
  });
  children.push(child);
  child.on("exit", (code, signal) => {
    if (shuttingDown) return;
    if (code === 0 && !signal) {
      shutdown(0);
      return;
    }
    const reason = signal ? `signal ${signal}` : `exit code ${code ?? 1}`;
    console.error(`\nA StoryLingo development service stopped (${reason}).`);
    shutdown(code ?? 1);
  });
  return child;
}

function stop(child) {
  if (!child.pid || child.killed) return;
  try {
    if (isWindows) child.kill("SIGTERM");
    else process.kill(-child.pid, "SIGTERM");
  } catch {
    // The child may already have stopped.
  }
}

function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  children.forEach(stop);
  setTimeout(() => process.exit(exitCode), 100);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
process.on("SIGHUP", () => shutdown(0));

console.log("Starting StoryLingo locally...");
console.log("Web: http://localhost:8081");
console.log(`API: http://${apiHost}`);
console.log(
  process.env.OPENAI_API_KEY
    ? "Voice: OpenAI key found"
    : "Voice: add OPENAI_API_KEY to .env to test speech",
);

start(npmCommand, ["run", "server:dev"]);
start(npxCommand, ["expo", "start", "--web", "--localhost"]);
