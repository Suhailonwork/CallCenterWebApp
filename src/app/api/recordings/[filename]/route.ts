import { authenticate, isError } from '@/lib/api';
import { NextResponse } from 'next/server';
import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

export const runtime = 'nodejs';

/**
 * GET /api/recordings/[filename]
 * Streams a call recording straight from the local Asterisk recording directory.
 * (App and Asterisk run on the same server, so no SFTP/remote fetch is needed.)
 */
export async function GET(
  _req: Request,
  { params }: { params: { filename: string } },
) {
  const u = await authenticate(['admin']);
  if (isError(u)) return u;

  const filename = decodeURIComponent(params.filename);

  // Security: only allow simple recording filenames. No paths, no traversal.
  if (!/^[A-Za-z0-9._-]+\.wav$/.test(filename)) {
    return NextResponse.json({ error: 'Invalid filename' }, { status: 400 });
  }

  const dir = process.env.ASTERISK_RECORDING_DIR || '/var/spool/asterisk/recording';
  const fullPath = join(dir, filename);

  try {
    const info = await stat(fullPath);
    if (!info.isFile()) {
      return NextResponse.json({ error: 'Not a file' }, { status: 404 });
    }

    const buffer = await readFile(fullPath);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/wav',
        'Content-Length': String(buffer.length),
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (e: any) {
    console.error('[recordings] read failed:', e?.message ?? e);
    return NextResponse.json(
      { error: 'Recording not found' },
      { status: 404 },
    );
  }
}
