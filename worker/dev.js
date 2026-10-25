import { handleBending } from './api.js';
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname.startsWith('/bending/api/')) return await handleBending(request, env);
      if (url.pathname === '/bending') return Response.redirect(`${url.origin}/bending/`, 308);
      url.pathname = url.pathname.replace(/^\/bending\//, '/');
      const response = await env.ASSETS.fetch(new Request(url, request));
      const headers = new Headers(response.headers);
      headers.set('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; connect-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'");
      return new Response(response.body, { status: response.status, headers });
    } catch (error) {
      console.error(error);
      return Response.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
    }
  },
};
