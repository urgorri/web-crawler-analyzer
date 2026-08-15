declare module "portscanner" {
  const portscanner: any;
  export = portscanner;
}

declare module "grab.js" {
  const grabber: any;
  export = grabber;
}

declare module "nodejs-traceroute" {
  export default class Traceroute {
    constructor(ipVersion?: string, sendwait?: number);
    on(event: string, callback: (...args: any[]) => void): this;
    trace(domainName: string): void;
  }
}
