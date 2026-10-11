declare module "portscanner" {
  export interface PortscannerOptions {
    host?: string;
    timeout?: number;
  }
  export function checkPortStatus(
    port: number,
    options: PortscannerOptions,
    callback: (err: unknown, status: string) => void
  ): void;
  export function checkPortStatus(
    port: number,
    host: string,
    callback: (err: unknown, status: string) => void
  ): void;
  const portscanner: {
    checkPortStatus: typeof checkPortStatus;
  };
  export default portscanner;
}

declare module "grab.js" {
  export interface GrabberInstance {
    run(): Promise<{ banner?: Buffer | string }>;
  }
  export function grab(
    host: string,
    port: number,
    options?: { timeout?: number }
  ): GrabberInstance;
  const grabber: {
    grab: typeof grab;
  };
  export default grabber;
}

declare module "nodejs-traceroute" {
  export interface RawHop {
    hop?: number | string;
    ip?: string;
    rtt1?: string | number;
    rtt2?: string | number;
    rtt3?: string | number;
  }
  export default class Traceroute {
    constructor(ipVersion?: string, sendwait?: number);
    on(event: "hop", callback: (hop: RawHop) => void): this;
    on(event: "close", callback: (code: number) => void): this;
    on(event: "error", callback: (error: Error) => void): this;
    on(event: string, callback: (...args: unknown[]) => void): this;
    trace(domainName: string): void;
  }
}

