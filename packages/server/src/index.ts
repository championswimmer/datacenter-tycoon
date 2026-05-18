import { VERSION } from "@datacenter-tycoon/game-logic";
import { fileURLToPath } from "node:url";
import { createServerApp } from "./server/app.js";
import { createNodeHttpServer } from "./server/node-http.js";

export function createApp() {
  return createServerApp({ routes: [] });
}

export function startServer(port = 3000): ReturnType<typeof createNodeHttpServer> {
  const app = createApp();
  const server = createNodeHttpServer(app);

  server.listen(port, () => {
    console.log(`Datacenter Tycoon server listening on :${port} (game-logic v${VERSION})`);
  });

  return server;
}

if (isDirectExecution(import.meta.url)) {
  startServer();
}

function isDirectExecution(moduleUrl: string): boolean {
  const entrypoint = process.argv[1];

  return entrypoint !== undefined && fileURLToPath(moduleUrl) === entrypoint;
}
