import { handleBending } from './api.js';
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname.startsWith('/bending/api/')) return await handleBending(request, env);
      if (url.pathname === '/bending') return Response.redirect(`${url.origin}/bending/`, 308);
      url.pathname = url.pathname.replace(/^\/bending\//, '/');
      return await env.ASSETS.fetch(new Request(url, request));
    } catch (error) {
      console.error(error);
      return Response.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
    }
  },
};
