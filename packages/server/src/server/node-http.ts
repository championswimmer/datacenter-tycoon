import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { Readable } from "node:stream";
import type { ServerApp } from "./app.js";

export function createNodeHttpServer(app: ServerApp): Server {
  return createServer(async (incoming, outgoing) => {
    try {
      const request = await toRequest(incoming);
      const response = await app.fetch(request);
      await writeResponse(outgoing, response);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown startup error";
      outgoing.statusCode = 500;
      outgoing.setHeader("content-type", "application/json; charset=utf-8");
      outgoing.end(
        JSON.stringify({
          error: {
            code: "INTERNAL_SERVER_ERROR",
            message,
          },
        }),
      );
    }
  });
}

async function toRequest(incoming: IncomingMessage): Promise<Request> {
  const headers = new Headers();

  for (const [name, value] of Object.entries(incoming.headers)) {
    if (Array.isArray(value)) {
      for (const entry of value) {
        headers.append(name, entry);
      }
      continue;
    }

    if (value !== undefined) {
      headers.set(name, value);
    }
  }

  const origin = `http://${incoming.headers.host ?? "localhost"}`;
  const url = new URL(incoming.url ?? "/", origin);
  const body = hasRequestBody(incoming.method)
    ? (Readable.toWeb(incoming) as ReadableStream<Uint8Array>)
    : undefined;
  const init: RequestInit & { duplex?: "half" } = {
    method: incoming.method,
    headers,
  };

  if (body !== undefined) {
    init.body = body;
    init.duplex = "half";
  }

  return new Request(url, init);
}

async function writeResponse(outgoing: ServerResponse, response: Response): Promise<void> {
  outgoing.statusCode = response.status;

  for (const [name, value] of response.headers) {
    outgoing.setHeader(name, value);
  }

  if (!response.body || response.status === 204 || response.status === 304) {
    outgoing.end();
    return;
  }

  const body = Buffer.from(await response.arrayBuffer());
  outgoing.end(body);
}

function hasRequestBody(method: string | undefined): boolean {
  return method !== undefined && method !== "GET" && method !== "HEAD";
}
