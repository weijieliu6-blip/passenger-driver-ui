#!/usr/bin/env node
// 直接複製 pushOrderText 的訊息構造邏輯，預覽實際會發送到釘釘的訊息
process.env.DRIVER_SITE_URL = 'https://hk-mainland-taxi.com';

const opts = {
  orderNumber: 'ORD20260928007',
  grabToken: '4604507124218183aa64ce2101f5667cae7fddc152e2763717ad0dd5928bdd70',
  direction: 'hk_to_mainland',
  pickup: '上環港澳碼頭',
  pickupArea: '上環',
  dropoff: '深圳灣口岸',
  dropoffArea: '南山',
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

const baseUrl =
  process.env.DRIVER_SITE_URL ||
  process.env.NEXT_PUBLIC_DRIVER_SITE_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  'http://localhost:3000';
const token = opts.grabToken || opts.orderNumber;
const link = opts.driverLink || `${baseUrl}/driver/grab/${token}`;

const directionText =
  opts.direction === 'mainland_to_hk'
    ? '跨境專車：內地 → 香港'
    : opts.direction === 'hk_to_mainland'
      ? '跨境專車：香港 → 內地'
      : '跨境專車';

const isTest = opts.testMode === true;
const headerLine = isTest ? '🧪 [測試] 新訂單 - 待接單' : '🚗 新訂單 - 待接單';

const pickupArea = opts.pickupArea ? `${opts.pickup} ${opts.pickupArea}` : opts.pickup;
const dropoffArea = opts.dropoffArea ? `${opts.dropoff} ${opts.dropoffArea}` : opts.dropoff;

const text = [
  headerLine,
  '─────────────────',
  `📋 行程方向：${directionText}`,
  `🕐 出發時間：${opts.pickupTime}`,
  `📍 起點：${pickupArea}`,
  `📍 終點：${dropoffArea}`,
  `👤 乘客：${opts.passengerName}`,
  `📞 電話：${opts.passengerPhone}`,
  `💰 預估車資：HK$ ${opts.estimatedFare ? opts.estimatedFare.toLocaleString() : '待確認'}`,
  `👥 乘客人數：${opts.passengers}人`,
  `💼 行李數量：${opts.luggage}件`,
  opts.remark ? `📝 備註：${opts.remark}` : '',
  '─────────────────',
  `訂單編號：${opts.orderNumber}`,
  `提交時間：${new Date().toLocaleString('zh-HK', { hour12: false })}`,
  '─────────────────',
  '🔗 搶單連結（司機端）：',
  link,
]
  .filter(Boolean)
  .join('\n');

console.log('========================================');
console.log('📱 實際發送到釘釘的訊息內容：');
console.log('========================================');
console.log(text);
console.log('========================================');
console.log('');
console.log('✅ 驗證項目：');
console.log(`  - [測試] 前綴: ${text.includes('[測試]') ? '✅' : '❌'}`);
console.log(`  - 含搶單連結: ${text.includes('https://hk-mainland-taxi.com/driver/grab/') ? '✅' : '❌'}`);
console.log(`  - 不含 localhost: ${!text.includes('localhost') ? '✅' : '❌'}`);
console.log(`  - 不含車型: ${!text.includes('車型') ? '✅' : '❌'}`);
console.log(`  - baseUrl: ${baseUrl}`);
console.log(`  - link: ${link}`);
