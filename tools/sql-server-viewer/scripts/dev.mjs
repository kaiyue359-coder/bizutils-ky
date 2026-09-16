import { spawn } from "node:child_process";
import { platform } from "node:os";

const isWindows = platform() === "win32";
const command = isWindows ? (process.env.ComSpec ?? "cmd.exe") : "npm";
const npmArgs = (scriptName) =>
  isWindows ? ["/d", "/s", "/c", "npm", "run", scriptName] : ["run", scriptName];

const commands = [
  ["api", command, npmArgs("dev:api")],
  ["web", command, npmArgs("dev:web")]
];

const children = commands.map(([name, command, args]) => {
  const child = spawn(command, args, {
    stdio: ["ignore", "pipe", "pipe"]
  });

  child.stdout.on("data", (data) => process.stdout.write(`[${name}] ${data}`));
  child.stderr.on("data", (data) => process.stderr.write(`[${name}] ${data}`));
  child.on("exit", (code) => {
    if (code && code !== 0) {
      process.exitCode = code;
    }
  });

  return child;
});

const shutdown = () => {
  for (const child of children) {
    child.kill();
  }
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
