import fs from "node:fs";
import net from "node:net";
import { EventEmitter, once } from "node:events";

import type { RpcRequest, RpcServerMessage } from "../protocol/messages.js";

export interface TransportConnection {
	id: number;
	socket: net.Socket;
}

interface DaemonTransportEventMap {
	connection: [connection: TransportConnection];
	disconnect: [connection: TransportConnection];
	request: [connection: TransportConnection, request: RpcRequest];
	invalidMessage: [connection: TransportConnection, rawMessage: string, error: Error];
	error: [error: Error];
}

export interface DaemonTransportOptions {
	socketPath: string;
}

export class DaemonTransport extends EventEmitter<DaemonTransportEventMap> {
	private readonly socketPath: string;
	private readonly server: net.Server;
	private readonly connections = new Map<net.Socket, TransportConnection>();
	private readonly buffers = new Map<net.Socket, string>();
	private nextConnectionId = 1;

	constructor(options: DaemonTransportOptions) {
		super();
		this.socketPath = options.socketPath;
		this.server = net.createServer((socket) => {
			const connection: TransportConnection = {
				id: this.nextConnectionId,
				socket,
			};
			this.nextConnectionId += 1;
			this.connections.set(socket, connection);
			this.buffers.set(socket, "");
			this.emit("connection", connection);

			socket.on("data", (chunk) => {
				this.handleData(connection, chunk);
			});
			socket.on("close", () => {
				this.connections.delete(socket);
				this.buffers.delete(socket);
				this.emit("disconnect", connection);
			});
			socket.on("error", (error) => {
				this.emit("error", error);
			});
		});
		this.server.on("error", (error) => {
			this.emit("error", error);
		});
	}

	async start(): Promise<void> {
		if (process.platform !== "win32" && fs.existsSync(this.socketPath)) {
			fs.rmSync(this.socketPath, { force: true });
		}

		this.server.listen(this.socketPath);
		await once(this.server, "listening");
	}

	async close(): Promise<void> {
		for (const connection of this.connections.values()) {
			connection.socket.destroy();
		}
		this.connections.clear();
		this.buffers.clear();

		if (this.server.listening) {
			this.server.close();
			await once(this.server, "close");
		}

		if (process.platform !== "win32" && fs.existsSync(this.socketPath)) {
			fs.rmSync(this.socketPath, { force: true });
		}
	}

	send(connection: TransportConnection, message: RpcServerMessage): boolean {
		return connection.socket.write(`${JSON.stringify(message)}\n`);
	}

	private handleData(connection: TransportConnection, chunk: Buffer | string): void {
		const previousBuffer = this.buffers.get(connection.socket) ?? "";
		const buffer = `${previousBuffer}${chunk.toString()}`;
		const lines = buffer.split("\n");
		const remainder = lines.pop() ?? "";
		this.buffers.set(connection.socket, remainder);

		for (const line of lines) {
			const trimmed = line.trim();
			if (!trimmed) {
				continue;
			}

			try {
				const request = JSON.parse(trimmed) as RpcRequest;
				this.emit("request", connection, request);
			} catch (error) {
				this.emit("invalidMessage", connection, trimmed, error as Error);
			}
		}
	}
}
