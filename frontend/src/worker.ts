interface Env {
  API: { fetch(request: Request): Promise<Response> };
  ASSETS: { fetch(request: Request): Promise<Response> };
}

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/api/v1/dashboard' || url.pathname === '/api/v1/scrape') {
      url.pathname = url.pathname.slice('/api'.length);
      return env.API.fetch(new Request(url, request));
    }
    return env.ASSETS.fetch(request);
  },
};
