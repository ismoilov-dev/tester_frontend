export type Msg = { type: string; data?: any; ts?: string };

const NO_RECONNECT = [4401, 4403, 4404, 4410];

export class Socket {
  private ws?: WebSocket;
  private tries = 0;
  private closedByUs = false;
  private timer?: ReturnType<typeof setTimeout>;

  constructor(
    private url: () => string | Promise<string>,
    private onMessage: (m: Msg) => void,
    private onState?: (open: boolean, closeCode?: number) => void,
  ) {}

  async connect() {
    this.closedByUs = false;
    clearTimeout(this.timer);
    const url = await this.url();
    if (this.closedByUs) return;
    const ws = new WebSocket(url);
    this.ws = ws;
    ws.onopen = () => { this.tries = 0; this.onState?.(true); };
    ws.onmessage = e => {
      try { this.onMessage(JSON.parse(e.data)); } catch { /* noto'g'ri JSON */ }
    };
    ws.onclose = e => {
      if (this.ws !== ws) return;
      this.onState?.(false, e.code);
      if (this.closedByUs || NO_RECONNECT.includes(e.code)) return; // qayta ulanmang
      const delay = Math.min(30000, 1000 * 2 ** this.tries++) + Math.random() * 500;
      this.timer = setTimeout(() => this.connect(), delay);
    };
  }

  send(type: string, data?: unknown) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, data }));
      return true;
    }
    return false;
  }

  close() {
    this.closedByUs = true;
    clearTimeout(this.timer);
    this.ws?.close();
  }

  get isOpen() { return this.ws?.readyState === WebSocket.OPEN; }
}

export const wsBase = "wss://tester-backend.duckdns.org/ws";
