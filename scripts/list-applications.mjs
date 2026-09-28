#!/usr/bin/env node
// 查看 driver_applications 表的所有資料
import fs from 'node:fs';

const env = fs.readFileSync('C:/Users/weiji/.cursor/project_prd.md/.env.local', 'utf8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim();
const sk = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)[1].trim();

const r = await fetch(url + '/rest/v1/driver_applications?select=id,name,phone,plate,car_type,driving_years,city,has_cross_border_permit,status,created_at&order=created_at.desc', {
  headers: { apikey: sk, Authorization: 'Bearer ' + sk },
});
const list = await r.json();
console.log(`總共 ${list.length} 筆申請:\n`);
for (const o of list) {
  console.log(`[${o.status.padEnd(8)}] ${o.name} (${o.phone}) | ${o.plate} | ${o.car_type} | 駕齡 ${o.driving_years}年 | 城市 ${o.city || '-'} | 跨境證件 ${o.has_cross_border_permit ? '✓' : '✗'} | ${o.created_at}`);
}
