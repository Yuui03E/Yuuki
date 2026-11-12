import type { APIRoute } from 'astro';
import { getArchive, searchItems } from '../lib/archive';
export const prerender = true;
export const GET: APIRoute = async () => new Response(JSON.stringify(searchItems(await getArchive())), {
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
});
