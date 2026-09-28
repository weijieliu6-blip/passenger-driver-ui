#!/usr/bin/env node
// 套用 SQL migration 到 Supabase DB
import fs from 'node:fs';

const env = fs.readFileSync('C:/Users/weiji/.cursor/project_prd.md/.env.local', 'utf8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim();
const sk = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)[1].trim();

const sqlFile = process.argv[2];
if (!sqlFile) {
  console.log('Usage: node apply-migration.mjs <path-to-sql>');
  process.exit(1);
}

const sql = fs.readFileSync(sqlFile, 'utf8');
console.log(`套用 ${sqlFile} (${sql.length} chars)...`);

const r = await fetch(url + '/rest/v1/rpc/exec_sql', {
  method: 'POST',
  headers: { apikey: sk, Authorization: 'Bearer ' + sk, 'Content-Type': 'application/json' },
  body: JSON.stringify({ sql }),
});
console.log(`HTTP ${r.status}`);
const txt = await r.text();
console.log(txt.substring(0, 500));
