import { authenticate, isError } from '@/lib/api';
import { NextResponse } from 'next/server';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { queryOne } from '@/lib/db';
import { tlOwnsCampaign } from '@/lib/groups';

export const runtime = 'nodejs';

/**
 * GET /api/recordings/[filename]
 * Streams a call recording straight from the local Asterisk recording directory.
 * (App and Asterisk run on the same server, so no SFTP/remote fetch is needed.)
 *
 * Access: admin — any recording; TL — recordings of calls in their groups'
 * campaigns; employee — recordings of their own calls only.
 */
export async function GET(
  req: Request,
  { params }: { params: { filename: string } },
) {
  const u = await authenticate(['admin', 'tl', 'employee']);
  if (isError(u)) return u;

  const filename = decodeURIComponent(params.filename);

  // Security: only allow simple recording filenames. No paths, no traversal.
  if (!/^[A-Za-z0-9._-]+\.wav$/.test(filename)) {
    return NextResponse.json({ error: 'Invalid filename' }, { status: 400 });
  }

  // RBAC for non-admins: the recording must belong to a call they may see.
  if (u.role !== 'admin') {
    const call = await queryOne<{ id: number; employee_id: number; campaign_id: number | null }>(
      'SELECT id, employee_id, campaign_id FROM calls WHERE recording_url = ? LIMIT 1',
      [filename],
    );
    if (!call) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    if (u.role === 'employee' && call.employee_id !== u.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (u.role === 'tl') {
      const allowed = call.campaign_id != null && (await tlOwnsCampaign(u.id, call.campaign_id));
      if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  const dir = process.env.ASTERISK_RECORDING_DIR || '/var/spool/asterisk/recording';
  const fullPath = join(dir, filename);

  let size: number;
  try {
    const info = await stat(fullPath);
    if (!info.isFile()) {
      return NextResponse.json({ error: 'Not a file' }, { status: 404 });
    }
    size = info.size;
  } catch (e: any) {
    console.error('[recordings] read failed:', e?.message ?? e);
    return NextResponse.json({ error: 'Recording not found' }, { status: 404 });
  }

  const headers: Record<string, string> = {
    'Content-Type': 'audio/wav',
    'Accept-Ranges': 'bytes',
    'Content-Disposition': `inline; filename="${filename}"`,
    'Cache-Control': 'private, max-age=3600',
  };

  // <audio> seeks with Range requests (Safari will not play a file at all
  // without them). Answer those with just the requested bytes, and stream the
  // file instead of loading a whole recording into memory per request.
  let start = 0;
  let end = size - 1;
  let status = 200;
  const range = req.headers.get('range');
  if (range && size > 0) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    const unsatisfiable = () =>
      new NextResponse(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
    if (!m || (m[1] === '' && m[2] === '')) return unsatisfiable();
    if (m[1] === '') {
      start = Math.max(0, size - Number(m[2])); // suffix range: the last N bytes
    } else {
      start = Number(m[1]);
      if (m[2] !== '') end = Math.min(Number(m[2]), size - 1);
    }
    if (start > end || start >= size) return unsatisfiable();
    status = 206;
    headers['Content-Range'] = `bytes ${start}-${end}/${size}`;
  }
  headers['Content-Length'] = String(size === 0 ? 0 : end - start + 1);

  const body =
    size === 0
      ? null
      : (Readable.toWeb(createReadStream(fullPath, { start, end })) as unknown as ReadableStream);
  return new NextResponse(body, { status, headers });
}
