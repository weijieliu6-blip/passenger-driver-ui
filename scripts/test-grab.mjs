#!/usr/bin/env node
// 模擬 1 位司機搶單測試

const API = 'https://hk-mainland-taxi.com/api/driver/grab';

// 訂單 1: 陳先生 ORD20260928004 (hk_to_mainland 中環→深圳灣)
const TOKEN = '0dc648145352487b766ddfdcf8155a23259328a37f2efcce8ca25fd914fab99d';

const driver = {
  staff_id: 'test_driver_weiji_001',
  name: '測試司機-偉',
  phone: '98765432',
  plate: 'TEST-001',
  car_type: 'alphard_7',
  driving_years: 8,
  seats: 7,
};

(async () => {
  console.log(`=== 模擬司機搶單測試 ===`);
  console.log(`訂單 token: ${TOKEN.substring(0, 16)}...`);
  console.log(`司機: ${driver.name} (${driver.plate})`);
  console.log();

  try {
    // 1) GET 確認訂單狀態
    console.log(`1) GET ${API}/${TOKEN.substring(0, 8)}...`);
    const r1 = await fetch(`${API}/${TOKEN}?staff_id=${driver.staff_id}`);
    const orderInfo = await r1.json();
    console.log(`   HTTP ${r1.status}`);
    console.log(`   success: ${orderInfo.success}`);
    console.log(`   order: ${orderInfo.order?.orderNumber}`);
    console.log(`   status: ${orderInfo.order?.status}`);
    console.log(`   existing driver: ${orderInfo.driver?.name || 'none'}`);
    console.log(`   needsRegistration: ${orderInfo.needsRegistration}`);

    if (!r1.ok) {
      console.log('   ❌ GET failed, abort');
      return;
    }

    // 2) POST 註冊 + 搶單
    console.log();
    console.log(`2) POST 註冊並搶單`);
    const r2 = await fetch(`${API}/${TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(driver),
    });
    const result = await r2.json();
    console.log(`   HTTP ${r2.status}`);
    console.log(JSON.stringify(result, null, 2));

    // 3) GET 確認訂單已 grabbed
    if (r2.ok) {
      console.log();
      console.log(`3) GET 確認訂單已 grabbed`);
      const r3 = await fetch(`${API}/${TOKEN}?staff_id=${driver.staff_id}`);
      const final = await r3.json();
      console.log(`   status: ${final.order?.status}`);
    }
  } catch (err) {
    console.log(`💥 EXCEPTION: ${err.message}`);
  }
})();
