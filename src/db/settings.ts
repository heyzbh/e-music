import { getDb, notify } from './index';

export async function getSetting(key: string): Promise<string | null> {
  const db = await getDb();
  return (await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', key))?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    key,
    value,
  );
  notify('settings');
}

