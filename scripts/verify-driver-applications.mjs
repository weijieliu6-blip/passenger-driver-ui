#!/usr/bin/env node
// 驗證 driver_applications table 是否真的存在於 DB
import fs from 'node:fs';

const env = fs.readFileSync('C:/Users/weiji/.cursor/project_prd.md/.env.local', 'utf8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim();
const sk = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)[1].trim();

// 嘗試 select 一筆 (因為 service_role 會 bypass RLS，但表不存在會報 404)
const r = await fetch(url + '/rest/v1/driver_applications?select=id&limit=1', {
  headers: { apikey: sk, Authorization: 'Bearer ' + sk },
});
const result = await r.json();
console.log(`HTTP ${r.status}`);
console.log('回應:', JSON.stringify(result, null, 2).substring(0, 500));

if (r.status === 200) {
  console.log('\n✅ driver_applications 表存在');
} else {
  console.log('\n❌ driver_applications 表不存在');
}
