import type { Env } from './env';
import type { GreenwaldMachine } from './types';

/** Fetch the Greenwald room-view endpoint and return parsed JSON */
export async function fetchGreenwaldRoomView(env: Env): Promise<GreenwaldMachine[]> {
  const url = 'https://gpay.gi-web.net/api/v2/room-view';
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': env.GREENWALD_AUTHKEY,
      'Cookie': env.GREENWALD_COOKIE,
      'User-Agent': env.GREENWALD_UA,
    },
  });
  if (!response.ok) {
    throw Object.assign(new Error(`Greenwald fetch failed with ${response.status}`), { response });
  }
  const data = (await response.json()) as GreenwaldMachine[];
  return Array.isArray(data) ? data : [];
}