import { query } from './db';

/** All settings as a key/value map. */
export async function getSettings(): Promise<Record<string, string>> {
  const rows = await query<{ setting_key: string; setting_value: string }>(
    'SELECT setting_key, setting_value FROM settings',
  );
  const out: Record<string, string> = {};
  for (const r of rows) out[r.setting_key] = r.setting_value;
  return out;
}

/** Upsert a batch of settings. */
export async function updateSettings(pairs: Record<string, string>) {
  for (const [k, v] of Object.entries(pairs)) {
    await query(
      `INSERT INTO settings (setting_key, setting_value) VALUES (?,?)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
      [k, v],
    );
  }
}
