#!/usr/bin/env node
// 本地執行 lib/dingtalk.ts 的 pushOrderText 來預覽實際發送的訊息內容
// 用環境變數模擬生產環境
process.env.DRIVER_SITE_URL = 'https://hk-mainland-taxi.com';

(async () => {
  // 用 dynamic import 來載入 TypeScript (用 tsx)
  let pushOrderText;
  try {
    const mod = await import('../lib/dingtalk.ts');
    pushOrderText = mod.pushOrderText;
  } catch (e) {
    console.log('❌ TypeScript loader not available. 改用 compiled source:');
    // 看實際訊息的最簡單辦法 — 直接複製 pushOrderText 邏輯
  }

  const opts = {
    orderNumber: 'ORD20260928007',
    grabToken: '4604507124218183aa64ce2101f5667cae7fddc152e2763717ad0dd5928bdd70',
    direction: 'hk_to_mainland',
    pickup: '上環港澳碼頭 中環',
    dropoff: '深圳灣口岸 南山',
    pickupTime: '2026-09-29 18:00',
    carType: '7_seat',
    passengers: 2,
    luggage: 2,
    passengerName: '測試確認',
    passengerPhone: '99999999',
    estimatedFare: 800,
    remark: '',
    testMode: true,
  };

  if (pushOrderText) {
    const result = await pushOrderText(opts);
    console.log('推送結果:', JSON.stringify(result, null, 2));
  } else {
    console.log('無法直接 import .ts，改用其他方式預覽訊息');
  }
})();
