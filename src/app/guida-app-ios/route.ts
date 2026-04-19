import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';

export async function GET() {
  const htmlPath = path.join(process.cwd(), 'public', 'guida-app-ios.html');
  const html = await readFile(htmlPath, 'utf-8');
  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
