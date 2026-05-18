declare namespace Bun {
  type FetchHandler = (request: Request) => Response | Promise<Response>;

  interface Server {
    stop(closeActiveConnections?: boolean): void;
  }

  interface ServeOptions {
    fetch: FetchHandler;
    hostname?: string;
    port?: number;
  }

  function serve(options: ServeOptions): Server;
}

declare const Bun: {
  serve: typeof Bun.serve;
};
