#!/usr/bin/env node
// 清測試訂單 (ORD19002 之後、2026-09-18 之前包含的真實訂單保留)
import fs from 'node:fs';

const env = fs.readFileSync('C:/Users/weiji/.cursor/project_prd.md/.env.local', 'utf8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim();
const sk = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)[1].trim();

const KEEP_ORDER_NUMBERS = ['ORD20260918001', 'ORD20260918002', 'ORD20260918003', 'ORD20260918004', 'ORD20260918005'];

// 1) 列出所有訂單
const r = await fetch(url + '/rest/v1/orders?select=id,order_number,created_at&order=created_at.asc', {
  headers: { apikey: sk, Authorization: 'Bearer ' + sk },
});
const all = await r.json();

const toDelete = all.filter(o => !KEEP_ORDER_NUMBERS.includes(o.order_number));
console.log(`總共 ${all.length} 筆訂單`);
console.log(`保留 ${KEEP_ORDER_NUMBERS.length} 筆真實訂單`);
console.log(`🗑️ 準備刪除 ${toDelete.length} 筆測試訂單:`);
for (const o of toDelete) {
  console.log(`  - ${o.order_number} (${o.created_at})`);
}

// 2) 確認 (透過 env var YES=1 跳過互動)
const forceYes = process.env.YES === '1' || process.argv.includes('--yes');
if (!forceYes) {
  const READLINE = await import('node:readline/promises');
  const rl = READLINE.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(`\n真的要刪除嗎？(yes/no): `);
  rl.close();
  if (answer.trim().toLowerCase() !== 'yes') {
    console.log('❌ 取消刪除');
    process.exit(0);
  }
}

// 3) 批量刪除 (每批 50 筆)
let deleted = 0;
for (let i = 0; i < toDelete.length; i += 50) {
  const batch = toDelete.slice(i, i + 50);
  const ids = batch.map(o => o.id);
  const del = await fetch(url + '/rest/v1/orders?id=in.(' + ids.join(',') + ')', {
    method: 'DELETE',
    headers: { apikey: sk, Authorization: 'Bearer ' + sk, Prefer: 'return=minimal' },
  });
  console.log(`  ✅ 刪除 ${batch.length} 筆 (HTTP ${del.status})`);
  deleted += batch.length;
}

console.log(`\n🎉 完成！共刪除 ${deleted} 筆測試訂單`);
