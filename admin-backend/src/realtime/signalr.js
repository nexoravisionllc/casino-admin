import crypto from 'node:crypto';
import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { log } from '../lib/log.js';

/**
 * A small ASP.NET Core SignalR-compatible hub server, so the existing
 * @microsoft/signalr browser clients keep working unchanged.
 *
 * Implements the negotiate handshake (versions 0 and 1), the JSON hub protocol
 * (version 1) and the WebSockets, ServerSentEvents and LongPolling transports.
 * Hub methods are matched case-insensitively and receive the connection as
 * their first argument. Streaming and stateful reconnect are not supported
 * (they are not advertised, so clients don't use them).
 */

const RS = '\x1e'; // record separator that terminates every protocol message

const MessageType = {
  Invocation: 1,
  StreamItem: 2,
  Completion: 3,
  StreamInvocation: 4,
  CancelInvocation: 5,
  Ping: 6,
  Close: 7,
};

const KEEP_ALIVE_MS = 15_000; // server -> client ping interval (client expects one within 30s)
const CLIENT_TIMEOUT_MS = 30_000; // drop clients silent for this long (they ping every 15s)
const CONNECT_TIMEOUT_MS = 30_000; // negotiated but never connected
const LONG_POLL_MS = 90_000; // client gives up on a poll after 100s
const TOMBSTONE_MS = 10_000; // keep closed connections so a last long poll gets 204, not 404

const newId = () => crypto.randomBytes(16).toString('base64url');

class Connection {
  constructor(hub) {
    this.hub = hub;
    this.connectionId = newId();
    this.connectionToken = newId();
    this.transport = null; // 'ws' | 'sse' | 'lp'
    this.handshaken = false;
    this.closed = false;
    this.inbox = '';
    this.groups = new Set();
    this.lastSeen = Date.now();
    this.ws = null;
    this.sse = null;
    this.pending = []; // long polling: frames waiting for the next poll
    this.poll = null; // long polling: the held GET response
    this.pollTimer = null;
    this.keepAlive = null;
    this.connectTimer = setTimeout(() => { if (!this.transport) this.close(null, false); }, CONNECT_TIMEOUT_MS);
  }

  // ---- outgoing ----

  send(message) {
    this.write(JSON.stringify(message) + RS);
  }

  write(frame) {
    if (this.closed) return;
    switch (this.transport) {
      case 'ws':
        if (this.ws.readyState === WebSocket.OPEN) this.ws.send(frame);
        break;
      case 'sse':
        this.sse.write(frame.split('\n').map((line) => `data: ${line}\r\n`).join('') + '\r\n');
        break;
      case 'lp':
        this.pending.push(frame);
        this.flushPoll();
        break;
    }
  }

  flushPoll() {
    if (!this.poll || this.pending.length === 0) return;
    const res = this.poll;
    this.endPoll();
    res.status(200).type('text/plain').send(this.pending.splice(0).join(''));
  }

  endPoll() {
    clearTimeout(this.pollTimer);
    this.poll = null;
    this.pollTimer = null;
  }

  // ---- incoming ----

  receive(text) {
    if (this.closed) return;
    this.lastSeen = Date.now();
    this.inbox += text;
    let i;
    while (!this.closed && (i = this.inbox.indexOf(RS)) !== -1) {
      const record = this.inbox.slice(0, i);
      this.inbox = this.inbox.slice(i + 1);
      if (this.handshaken) this.dispatch(record);
      else this.handshake(record);
    }
  }

  handshake(record) {
    let req;
    try { req = JSON.parse(record); } catch { req = null; }
    if (!req || typeof req.protocol !== 'string') {
      this.write(JSON.stringify({ error: 'Handshake request is invalid.' }) + RS);
      return this.close(null, false);
    }
    if (req.protocol !== 'json') {
      this.write(JSON.stringify({ error: `The protocol '${req.protocol}' is not supported.` }) + RS);
      return this.close(null, false);
    }
    this.handshaken = true;
    this.write('{}' + RS);
    this.keepAlive = setInterval(() => {
      if (Date.now() - this.lastSeen > CLIENT_TIMEOUT_MS) this.close(null, false);
      else this.send({ type: MessageType.Ping });
    }, KEEP_ALIVE_MS);
  }

  dispatch(record) {
    let msg;
    try { msg = JSON.parse(record); } catch { msg = null; }
    if (!msg || typeof msg !== 'object') return this.close('Connection closed with an error. InvalidDataException: Invalid message.');

    switch (msg.type) {
      case MessageType.Invocation:
        return this.invoke(msg);
      case MessageType.StreamInvocation:
        return this.send({
          type: MessageType.Completion,
          invocationId: msg.invocationId,
          error: `Failed to invoke '${msg.target}' due to an error on the server. Streaming is not supported.`,
        });
      case MessageType.Close:
        return this.close(null, false);
      default:
        return; // Ping, CancelInvocation, StreamItem, Ack, Sequence: nothing to do
    }
  }

  async invoke({ invocationId, target, arguments: args }) {
    args = Array.isArray(args) ? args : [];
    const method = this.hub.method(target);
    let error = null;
    if (!method) {
      error = `Failed to invoke '${target}' due to an error on the server. HubException: Method does not exist.`;
    } else if (args.length !== method.length - 1) {
      error = `Failed to invoke '${target}' due to an error on the server. InvalidDataException: Invocation provides ${args.length} argument(s) but target expects ${method.length - 1}.`;
    } else {
      try {
        await method(this, ...args);
      } catch (err) {
        log.error(`Hub method '${target}' failed.`, err);
        error = `An unexpected error occurred invoking '${target}' on the server.`;
      }
    }
    // Non-blocking invocations (no id) get no completion.
    if (invocationId != null) {
      this.send(error
        ? { type: MessageType.Completion, invocationId, error }
        : { type: MessageType.Completion, invocationId, result: null });
    }
  }

  // ---- transports ----

  useWebSocket(ws) {
    this.transport = 'ws';
    this.ws = ws;
    clearTimeout(this.connectTimer);
    ws.on('message', (data) => this.receive(data.toString('utf8')));
    ws.on('close', () => this.close(null, false));
    ws.on('error', () => this.close(null, false));
  }

  useServerSentEvents(req, res) {
    this.transport = 'sse';
    this.sse = res;
    clearTimeout(this.connectTimer);
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
    });
    res.write(':\r\n\r\n'); // prompts the browser's EventSource "open"
    req.on('close', () => this.close(null, false));
  }

  longPoll(req, res) {
    this.lastSeen = Date.now();
    if (this.closed) {
      if (this.pending.length) return res.status(200).type('text/plain').send(this.pending.splice(0).join(''));
      return res.status(204).end();
    }
    // The first poll only confirms the connection.
    if (!this.transport) {
      this.transport = 'lp';
      clearTimeout(this.connectTimer);
      return res.status(200).type('text/plain').send('');
    }
    if (this.transport !== 'lp') return res.status(400).type('text/plain').send('Connection is not using long polling.');

    if (this.poll) {
      const previous = this.poll;
      this.endPoll();
      previous.status(200).type('text/plain').send('');
    }
    this.poll = res;
    if (this.pending.length) return this.flushPoll();

    this.pollTimer = setTimeout(() => {
      if (this.poll !== res) return;
      this.endPoll();
      res.status(200).type('text/plain').send('');
    }, LONG_POLL_MS);
    req.on('close', () => { if (this.poll === res) this.endPoll(); });
  }

  // ---- lifecycle ----

  close(error, sendClose = true) {
    if (this.closed) return;
    if (sendClose && this.handshaken) this.send(error ? { type: MessageType.Close, error } : { type: MessageType.Close });

    this.closed = true;
    clearTimeout(this.connectTimer);
    clearInterval(this.keepAlive);
    this.hub.detach(this);

    switch (this.transport) {
      case 'ws':
        if (this.ws.readyState === WebSocket.OPEN) this.ws.close(1000);
        break;
      case 'sse':
        this.sse.end();
        break;
      case 'lp':
        if (this.poll) {
          const res = this.poll;
          this.endPoll();
          if (this.pending.length) res.status(200).type('text/plain').send(this.pending.splice(0).join(''));
          else res.status(204).end();
        }
        break;
    }
  }
}

export class Hub {
  /** methods: { Name: (connection, ...args) => void | Promise } */
  constructor(methods) {
    this.methods = new Map(Object.entries(methods).map(([name, fn]) => [name.toLowerCase(), fn]));
    this.connections = new Map(); // connection token / id -> Connection
    this.groupMembers = new Map(); // group name -> Set<Connection>
  }

  method(name) {
    return typeof name === 'string' ? this.methods.get(name.toLowerCase()) : undefined;
  }

  addToGroup(connection, group) {
    if (connection.closed) return;
    if (!this.groupMembers.has(group)) this.groupMembers.set(group, new Set());
    this.groupMembers.get(group).add(connection);
    connection.groups.add(group);
  }

  /** Invoke a client-side handler on every connection in a group. */
  sendToGroup(group, target, ...args) {
    for (const connection of this.groupMembers.get(group) ?? []) {
      connection.send({ type: MessageType.Invocation, target, arguments: args });
    }
  }

  create(negotiateVersion = 1) {
    const connection = new Connection(this);
    // Version 1 clients address the connection by its token, version 0 by its id.
    this.connections.set(negotiateVersion >= 1 ? connection.connectionToken : connection.connectionId, connection);
    return connection;
  }

  detach(connection) {
    for (const group of connection.groups) {
      const members = this.groupMembers.get(group);
      members?.delete(connection);
      if (members?.size === 0) this.groupMembers.delete(group);
    }
    connection.groups.clear();
    setTimeout(() => {
      for (const [key, c] of this.connections) if (c === connection) this.connections.delete(key);
    }, TOMBSTONE_MS).unref();
  }

  /** Express router serving negotiate + the HTTP transports at `path`. */
  router(path) {
    const router = express.Router();

    router.post(`${path}/negotiate`, (req, res) => {
      const requested = Number.parseInt(req.query.negotiateVersion ?? '0', 10);
      const version = requested >= 1 ? 1 : 0;
      const connection = this.create(version);
      const body = {
        negotiateVersion: version,
        connectionId: connection.connectionId,
        availableTransports: [
          { transport: 'WebSockets', transferFormats: ['Text', 'Binary'] },
          { transport: 'ServerSentEvents', transferFormats: ['Text'] },
          { transport: 'LongPolling', transferFormats: ['Text', 'Binary'] },
        ],
      };
      if (version >= 1) body.connectionToken = connection.connectionToken;
      res.json(body);
    });

    const lookup = (req, res) => {
      const id = req.query.id;
      if (typeof id !== 'string' || !id) {
        res.status(400).type('text/plain').send('Connection ID required');
        return null;
      }
      const connection = this.connections.get(id);
      if (!connection) res.status(404).type('text/plain').send('No Connection with that ID');
      return connection ?? null;
    };

    router.get(path, (req, res) => {
      const connection = lookup(req, res);
      if (!connection) return;
      if ((req.get('accept') ?? '').includes('text/event-stream')) {
        if (connection.transport) return res.status(409).type('text/plain').send('Connection already started.');
        return connection.useServerSentEvents(req, res);
      }
      connection.longPoll(req, res);
    });

    router.post(path, express.text({ type: () => true, limit: '1mb' }), (req, res) => {
      const connection = lookup(req, res);
      if (!connection) return;
      if (connection.closed) return res.status(404).type('text/plain').send('No Connection with that ID');
      connection.receive(typeof req.body === 'string' ? req.body : '');
      res.status(200).end();
    });

    router.delete(path, (req, res) => {
      const connection = lookup(req, res);
      if (!connection) return;
      connection.close(null, false);
      res.status(202).end();
    });

    return router;
  }

  /** Accept WebSocket upgrades for `path` on the HTTP server. */
  attachWebSockets(server, path) {
    const wss = new WebSocketServer({ noServer: true });
    server.on('upgrade', (req, socket, head) => {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname.toLowerCase() !== path.toLowerCase()) return socket.destroy();

      const id = url.searchParams.get('id');
      let connection;
      if (id) {
        connection = this.connections.get(id);
        if (!connection || connection.transport || connection.closed) {
          socket.end('HTTP/1.1 404 Not Found\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');
          return;
        }
      } else {
        connection = this.create(); // skipNegotiation clients connect directly
      }
      wss.handleUpgrade(req, socket, head, (ws) => connection.useWebSocket(ws));
    });
  }
}
