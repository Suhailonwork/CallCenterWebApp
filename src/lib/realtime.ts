// Server-side helper to push real-time updates to connected clients.
// The Socket.io server instance is attached to globalThis by server.mjs.

/** Tell every connected client that data in a given scope changed. */
export function broadcastChange(scope: 'calls' | 'breaks') {
  const io = (globalThis as any).__ccio;
  if (io && typeof io.emit === 'function') {
    io.emit('data-changed', { scope });
  }
}
