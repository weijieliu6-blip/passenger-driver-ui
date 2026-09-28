#!/usr/bin/env node
// 1 張新訂單 - 測試新的搶單連結 + 不含車型
const order = {
  direction: 'hk_to_mainland',
  pickupLocation: '上環港澳碼頭',
  pickupArea: '上環',
  dropoffLocation: '深圳灣口岸',
  dropoffArea: '南山',
  departureTime: '2026-09-29 18:00',
  passengers: 2,
  luggage: 2,
  vehicleType: '7_seat',
  passengerName: '測試確認',
  passengerPhone: '99999999',
  estimatedFare: 800,
  testMode: true,
};

(async () => {
  console.log('=== 驗證新版釘釘訊息 ===');
  const r = await fetch('https://hk-mainland-taxi.com/api/orders/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(order),
  });
  const result = await r.json();
  console.log(`HTTP ${r.status}`);
  console.log(`訂單號: ${result.order?.orderNumber}`);
  console.log(`GrabToken: ${result.order?.grabToken}`);
  console.log();
  console.log('預期釘釘訊息格式:');
  console.log('  標題: 🧪 [測試] 新訂單 - 待接單');
  console.log('  包含: 起點/終點/時間/乘客/聯絡/車資/人數/行李');
  console.log('  ❌ 不再包含: 🚙 車型');
  console.log('  ✅ 搶單連結: https://hk-mainland-taxi.com/driver/grab/' + result.order?.grabToken);
})();
