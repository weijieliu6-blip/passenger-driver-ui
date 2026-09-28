#!/usr/bin/env node
// 模擬新訂單 + 搶單，觀察 runtime logs 是否真的有推送 notifyOrderGrabbed

const API_ORDERS = 'https://hk-mainland-taxi.com/api/orders/create';
const API_GRAB = 'https://hk-mainland-taxi.com/api/driver/grab';

// 先下單
const order = {
  direction: 'mainland_to_hk',
  pickupLocation: '深圳北站',
  pickupArea: '龍華',
  dropoffLocation: '香港西九龍站',
  dropoffArea: '西九龍',
  departureTime: '2026-09-29 19:00',
  passengers: 2,
  luggage: 2,
  vehicleType: '7_seat',
  passengerName: '通知測試',
  passengerPhone: '96668888',
  estimatedFare: 1000,
  testMode: true,
};

(async () => {
  // 1) 下單
  console.log('=== 1) 下單 ===');
  const r1 = await fetch(API_ORDERS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(order),
  });
  const o = await r1.json();
  console.log(`HTTP ${r1.status}, orderNumber=${o.order?.orderNumber}, token=${o.order?.grabToken?.substring(0, 16)}...`);

  // 2) 搶單 (用一個新 staff_id 模擬另一個司機)
  console.log('\n=== 2) 司機搶單 ===');
  const driver = {
    staff_id: 'test_driver_notify_002',
    name: '通知測試司機',
    phone: '91122334',
    plate: 'NTFY-002',
    car_type: 'alphard_7',
    driving_years: 6,
    seats: 7,
  };
  const r2 = await fetch(`${API_GRAB}/${o.order.grabToken}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(driver),
  });
  const g = await r2.json();
  console.log(`HTTP ${r2.status}`);
  console.log(`Response: ${JSON.stringify(g, null, 2)}`);
  console.log(`\n訂單號: ${o.order.orderNumber}`);
  console.log(`司機: ${driver.name} (${driver.plate})`);
  console.log('\n✅ 完成 — 現在請到 Vercel logs 看 "notifyOrderGrabbed" 或 "釘釘" 是否被呼叫');
})();
