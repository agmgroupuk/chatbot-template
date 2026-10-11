import { readFile } from 'node:fs/promises';
import path from 'node:path';

const TEMPLATE_FILES = new Set(['accessories_eyewear.html', 'pawprint_palace.html']);

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ filename: string }> },
) {
  const { filename } = await params;
  if (!TEMPLATE_FILES.has(filename)) {
    return new Response('Template not found.', { status: 404 });
  }

  const filePath = path.join(process.cwd(), 'app', 'software', 'src', 'html', filename);
  const html = await readFile(filePath, 'utf8');

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
