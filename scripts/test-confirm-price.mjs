#!/usr/bin/env node
// 直接用 Supabase REST API（service role key）模擬司機報價

const SUPABASE_URL = 'https://vuuamydahzhpajjdvokl.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

if (!SERVICE_KEY) {
  console.log('❌ 缺少 SUPABASE_SERVICE_ROLE_KEY 環境變數');
  console.log('請用 Vercel env var 值，或從本地 .env.local 取');
  process.exit(1);
}

(async () => {
  console.log('=== 模擬司機報價（直接更新 DB） ===');
  console.log();

  // 訂單 ORD20260928004 已被司機 eb0898b8... 搶走
  // 現在模擬他填寫 HK$ 850 報價

  const update = {
    confirmed_price: 850,
    price_currency: 'HKD',
    price_confirmed_at: new Date().toISOString(),
    status: 'price_confirmed',
  };

  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/orders?order_number=eq.ORD20260928004`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        Prefer: 'return=representation',
      },
      body: JSON.stringify(update),
    }
  );

  if (r.ok) {
    const updated = await r.json();
    console.log(`✅ HTTP ${r.status}`);
    console.log(`訂單 ORD20260928004 已從 grabbed → price_confirmed`);
    console.log(`報價: HK$ ${update.confirmed_price}`);
    console.log();
    console.log('更新後狀態:');
    console.log(JSON.stringify(updated[0], null, 2));
  } else {
    const errText = await r.text();
    console.log(`❌ HTTP ${r.status}: ${errText}`);
  }
})();
