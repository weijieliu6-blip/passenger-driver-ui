#!/usr/bin/env node
// 重新測試搶單後是否能推送到釘釘
const API_ORDERS = 'https://hk-mainland-taxi.com/api/orders/create';
const API_GRAB = 'https://hk-mainland-taxi.com/api/driver/grab';

const order = {
  direction: 'hk_to_mainland',
  pickupLocation: '中環碼頭',
  pickupArea: '中環',
  dropoffLocation: '深圳羅湖口岸',
  dropoffArea: '羅湖',
  departureTime: '2026-09-29 20:00',
  passengers: 1,
  luggage: 1,
  vehicleType: '7_seat',
  passengerName: '通知測試2',
  passengerPhone: '95554433',
  estimatedFare: 700,
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
  console.log(`orderNumber=${o.order?.orderNumber}, token=${o.order?.grabToken?.substring(0, 16)}...`);

  // 2) 搶單 (新司機)
  console.log('\n=== 2) 司機搶單 (新 staff_id) ===');
  const driver = {
    staff_id: 'test_driver_notify_004',
    name: '通知測試司機4',
    phone: '92233445',
    plate: 'NTFY-004',
    car_type: 'alphard_7',
    driving_years: 4,
    seats: 7,
  };
  const r2 = await fetch(`${API_GRAB}/${o.order.grabToken}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(driver),
  });
  const g = await r2.json();
  console.log(`HTTP ${r2.status}, success=${g.success}`);
  console.log(`訂單: ${o.order.orderNumber} ← 司機 ${driver.name} (${driver.plate})`);
  console.log('\n→ 等 5 秒讓 Vercel logs 處理，然後到 Vercel 看是否 ✅ 或 ❌');
})();
