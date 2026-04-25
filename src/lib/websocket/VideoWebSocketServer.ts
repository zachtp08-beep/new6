import WebSocket from 'ws';
import { ProcessingProgress } from '@/types';

interface WebSocketClient {
  ws: any;
  subscribedJobs: Set<string>;
  userId?: string;
}

export class VideoWebSocketServer {
  private wss: any;
  private clients: Map<string, WebSocketClient> = new Map();
  private static instance: VideoWebSocketServer;

  private constructor(server?: any) {
    this.wss = new (WebSocket as any).Server({ noServer: true });
    this.setupConnectionHandling();
  }

  static getInstance(server?: any): VideoWebSocketServer {
    if (!VideoWebSocketServer.instance) {
      VideoWebSocketServer.instance = new VideoWebSocketServer(server);
    }
    if (server) {
      VideoWebSocketServer.instance.attachToServer(server);
    }
    return VideoWebSocketServer.instance;
  }

  attachToServer(server: any): void {
    server.on('upgrade', (request: any, socket: any, head: any) => {
      const pathname = request.url;
      if (pathname === '/api/websocket') {
        this.wss.handleUpgrade(request, socket, head, (ws: any) => {
          this.wss.emit('connection', ws, request);
        });
      } else {
        socket.destroy();
      }
    });
  }

  private setupConnectionHandling(): void {
    this.wss.on('connection', (ws: any, req: any) => {
      const clientId = this.generateClientId();
      const client: WebSocketClient = {
        ws,
        subscribedJobs: new Set()
      };
      this.clients.set(clientId, client);

      ws.on('message', (message: string) => {
        try {
          const data = JSON.parse(message);
          this.handleMessage(clientId, data);
        } catch (err) {
          this.sendError(clientId, 'Invalid message format');
        }
      });

      ws.on('close', () => {
        this.clients.delete(clientId);
      });

      ws.on('error', (err: any) => {
        console.error('WebSocket error:', err);
        this.clients.delete(clientId);
      });

      this.send(clientId, { type: 'connected', clientId });
    });
  }

  private handleMessage(clientId: string, data: any): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    switch (data.type) {
      case 'subscribe':
        if (data.jobId) {
          client.subscribedJobs.add(data.jobId);
          this.send(clientId, { type: 'subscribed', jobId: data.jobId });
        }
        break;
      case 'unsubscribe':
        if (data.jobId) {
          client.subscribedJobs.delete(data.jobId);
          this.send(clientId, { type: 'unsubscribed', jobId: data.jobId });
        }
        break;
      case 'subscribe-all':
        client.subscribedJobs.add('*');
        this.send(clientId, { type: 'subscribed-all' });
        break;
      case 'ping':
        this.send(clientId, { type: 'pong' });
        break;
      default:
        this.sendError(clientId, 'Unknown message type');
    }
  }

  broadcastProgress(progress: ProcessingProgress): void {
    this.clients.forEach((client, clientId) => {
      if (client.subscribedJobs.has('*') || client.subscribedJobs.has(progress.jobId)) {
        this.send(clientId, { type: 'progress', data: progress });
      }
    });
  }

  broadcastJobUpdate(jobId: string, status: any): void {
    this.clients.forEach((client, clientId) => {
      if (client.subscribedJobs.has('*') || client.subscribedJobs.has(jobId)) {
        this.send(clientId, { type: 'jobUpdate', jobId, data: status });
      }
    });
  }

  broadcastJobCompleted(jobId: string, result: any): void {
    this.clients.forEach((client, clientId) => {
      if (client.subscribedJobs.has('*') || client.subscribedJobs.has(jobId)) {
        this.send(clientId, { type: 'jobCompleted', jobId, data: result });
      }
    });
  }

  broadcastJobFailed(jobId: string, error: any): void {
    this.clients.forEach((client, clientId) => {
      if (client.subscribedJobs.has('*') || client.subscribedJobs.has(jobId)) {
        this.send(clientId, { type: 'jobFailed', jobId, error });
      }
    });
  }

  private send(clientId: string, message: any): void {
    const client = this.clients.get(clientId);
    if (client && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(message));
    }
  }

  private sendError(clientId: string, message: string): void {
    this.send(clientId, { type: 'error', message });
  }

  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  getClientCount(): number {
    return this.clients.size;
  }
}

export let videoWebSocketServer: VideoWebSocketServer | null = null;

export function initWebSocketServer(server?: any): VideoWebSocketServer {
  if (!videoWebSocketServer) {
    videoWebSocketServer = VideoWebSocketServer.getInstance(server);
  }
  return videoWebSocketServer;
}
