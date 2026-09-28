#!/usr/bin/env node
// 列出所有測試訂單（電話尾號有規則，標 testMode 等）
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://bkppccdyfjlsblwmcjhy.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_KEY) {
  console.error('❌ 缺少 SUPABASE_SERVICE_ROLE_KEY，請確認 .env.local');
  process.exit(1);
}

(async () => {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/orders?select=id,order_number,status,passenger_phone,passenger_name,created_at,test_mode&order=created_at.desc&limit=30`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
  const list = await r.json();
  console.log(`總共 ${list.length} 筆訂單：\n`);
  for (const o of list) {
    console.log(`#${o.order_number} | ${o.status.padEnd(15)} | ${o.passenger_name?.padEnd(10)} | ${o.passenger_phone} | ${o.created_at} | testMode=${o.test_mode ?? '?'}`);
  }
})();
