import { authenticate, isError } from '@/lib/api';
import { NextResponse } from 'next/server';
import SftpClient from 'ssh2-sftp-client';

export const runtime = 'nodejs';

/** GET /api/recordings/[filename] — stream a recording from the Asterisk server via SFTP. */
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
  const remotePath = `${dir}/${filename}`;

  const sftp = new SftpClient();
  try {
    await sftp.connect({
      host: process.env.ASTERISK_SSH_HOST,
      port: Number(process.env.ASTERISK_SSH_PORT || 22),
      username: process.env.ASTERISK_SSH_USER,
      password: process.env.ASTERISK_SSH_PASSWORD,
    });

    const buffer = (await sftp.get(remotePath)) as Buffer;
    await sftp.end();

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
    try { await sftp.end(); } catch { /* ignore */ }
    console.error('[recordings] SFTP fetch failed:', e?.message ?? e);
    return NextResponse.json(
      { error: 'Recording not found or unreachable' },
      { status: 404 },
    );
  }
}