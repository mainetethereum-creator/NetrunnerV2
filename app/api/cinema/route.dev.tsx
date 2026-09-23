import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const runtime = 'nodejs';

/** Local capture sink; the .dev.tsx route is absent from production builds. */
export async function POST(request: Request) {
  const url = new URL(request.url);
  if (process.env.CYBERBASE_DEV_TOOLS !== '1' ||
      !['localhost', '127.0.0.1'].includes(url.hostname) ||
      request.headers.get('origin') !== url.origin) return new Response('Unavailable', { status: 403 });
  const shot = url.searchParams.get('shot') ?? '';
  const frame = url.searchParams.get('frame') ?? '';
  if (!/^(preview|shot)[0-7]$/.test(shot) || !/^\d{1,4}$/.test(frame) || Number(frame) > 599) {
    return new Response('Invalid frame', { status: 400 });
  }
  if (request.headers.get('content-type') !== 'image/jpeg') return new Response('JPEG required', { status: 415 });
  const bytes = Buffer.from(await request.arrayBuffer());
  if (bytes.length > 8_000_000 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return new Response('Invalid JPEG', { status: 413 });
  const directory = path.join(process.cwd(), 'output', 'trailer', 'frames', shot);
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, `${frame.padStart(4, '0')}.jpg`), bytes);
  return new Response('Saved');
}
