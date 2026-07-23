import fs from 'node:fs/promises';
import path from 'node:path';
import { pool } from '../src/db/pool.js';

async function main() {
  await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
  const dir = path.resolve('db/migrations');
  const files = (await fs.readdir(dir)).filter(f => f.endsWith('.sql')).sort();
  const applied = new Set((await pool.query('SELECT version FROM schema_migrations')).rows.map(r => r.version));
  for (const file of files) {
    if (applied.has(file)) { console.log(`skip ${file}`); continue; }
    console.log(`apply ${file}`);
    const sql = await fs.readFile(path.join(dir, file), 'utf8');
    await pool.query(sql);
    await pool.query('INSERT INTO schema_migrations(version) VALUES($1)', [file]);
  }
  console.log('migrations complete');
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => pool.end());
