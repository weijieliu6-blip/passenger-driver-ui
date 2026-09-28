#!/usr/bin/env node
// 測試「重複搶單防護」— 用同一 token 第二次搶
const API = 'https://hk-mainland-taxi.com/api/driver/grab';
const TOKEN = '0dc648145352487b766ddfdcf8155a23259328a37f2efcce8ca25fd914fab99d';

const driver2 = {
  staff_id: 'test_driver_002',
  name: '第二個司機-小',
  phone: '91234567',
  plate: 'TEST-002',
  car_type: 'alphard_7',
  driving_years: 5,
  seats: 7,
};

(async () => {
  console.log(`=== 測試重複搶單防護 ===`);
  console.log(`訂單已被司機 #1 搶走，再讓司機 #2 搶同一張單`);
  console.log();

  const r = await fetch(`${API}/${TOKEN}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(driver2),
  });
  const result = await r.json();
  console.log(`HTTP ${r.status}`);
  console.log(JSON.stringify(result, null, 2));
})();
