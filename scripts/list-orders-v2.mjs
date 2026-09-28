#!/usr/bin/env node
import fs from 'node:fs';

const env = fs.readFileSync('C:/Users/weiji/.cursor/project_prd.md/.env.local', 'utf8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim();
const sk = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)[1].trim();

const r = await fetch(url + '/rest/v1/orders?select=id,order_number,status,passenger_phone,passenger_name,created_at&order=created_at.desc&limit=30', {
  headers: { apikey: sk, Authorization: 'Bearer ' + sk },
});
const list = await r.json();
console.log('total:', list.length);
console.log('---');
for (const o of list) {
  console.log(o.order_number, '|', String(o.status).padEnd(15), '|', o.passenger_name, '|', o.passenger_phone, '|', o.created_at);
}
