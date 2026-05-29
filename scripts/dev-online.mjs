import { spawn } from "node:child_process";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const children = new Set();
let shuttingDown = false;

function startWorkspace(name, args, color) {
  const child = spawn(npmCommand, args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: ["inherit", "pipe", "pipe"],
  });

  children.add(child);
  pipeStream(child.stdout, name, color);
  pipeStream(child.stderr, name, color);

  child.on("exit", (code, signal) => {
    children.delete(child);

    if (shuttingDown) {
      return;
    }

    const detail = signal ? `signal ${signal}` : `code ${code ?? 0}`;
    console.error(`${formatLabel(name, color)} exited with ${detail}; stopping the online dev loop.`);
    shutdown(code ?? 0);
  });

  return child;
}

function pipeStream(stream, name, color) {
  let buffered = "";

  stream.setEncoding("utf8");
  stream.on("data", (chunk) => {
    buffered += chunk;
    const lines = buffered.split(/\r?\n/);
    buffered = lines.pop() ?? "";

    for (const line of lines) {
      if (line.length > 0) {
        console.log(`${formatLabel(name, color)} ${line}`);
      }
    }
  });

  stream.on("end", () => {
    if (buffered.length > 0) {
      console.log(`${formatLabel(name, color)} ${buffered}`);
      buffered = "";
    }
  });
}

function formatLabel(name, color) {
  return `\u001b[${color}m[${name}]\u001b[0m`;
}

function shutdown(exitCode = 0) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  for (const child of children) {
    child.kill("SIGTERM");
  }

  setTimeout(() => {
    for (const child of children) {
      child.kill("SIGKILL");
    }
  }, 2_000).unref();

  process.exitCode = exitCode;
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

console.log("Starting Datacenter Tycoon online dev loop (server + web)…");
startWorkspace("server", ["run", "dev:server"], "35");
startWorkspace("web", ["run", "dev:web"], "36");
