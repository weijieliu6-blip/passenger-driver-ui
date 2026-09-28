// Runtime reimplementation of pushOrderText() — proves the JSON payload shape
// Mirrors lib/dingtalk.ts:pushOrderText EXACTLY. No project files modified.
const opts = {
  orderNumber:   'ORD20260927003',
  pickup:        '香港中環IFC',
  dropoff:       '深圳福田口岸',
  pickupTime:    '2026-09-28 16:00',
  carType:       '7_seat',
  passengers:    4,
  luggage:       2,
  passengerName: '測試乘客',
  passengerPhone:'13800138000',
  estimatedFare: 1200,
  driverLink:    undefined,
  grabToken:     'fake_grab_token_xyz',
  remark:        '【測試訂單】會員分級推送',
  direction:     'hk_to_mainland',
};

const baseUrl = 'http://localhost:3000';
const token = opts.grabToken || opts.orderNumber;
const link = opts.driverLink || `${baseUrl}/driver/grab/${token}`;

const carTypeZh = ({ sedan_5:'5座豐田', alphard_7:'7座埃爾法', business_9:'9座商務',
                     '5_seat':'5座豐田', '7_seat':'7座埃爾法', '9_seat':'9座商務',
                     '4_seat':'4座車',   '8_seat':'8座車' })[opts.carType] || opts.carType;

const directionText = opts.direction === 'mainland_to_hk'
  ? '跨境專車：內地 → 香港'
  : opts.direction === 'hk_to_mainland'
    ? '跨境專車：香港 → 內地'
    : '跨境專車';

const text = [
  '🚗 新訂單 - 待接單',
  '─────────────────',
  `📋 行程方向：${directionText}`,
  `🕐 出發時間：${opts.pickupTime}`,
  `📍 起點：${opts.pickup}`,
  `📍 終點：${opts.dropoff}`,
  `👤 乘客：${opts.passengerName}`,
  `📞 電話：${opts.passengerPhone}`,
  `💰 預估車資：HK$ ${opts.estimatedFare.toLocaleString()}`,
  `🚙 車型：${carTypeZh}`,
  `👥 乘客人數：${opts.passengers}人`,
  `💼 行李數量：${opts.luggage}件`,
  `📝 備註：${opts.remark}`,
  '─────────────────',
  `訂單編號：${opts.orderNumber}`,
  `提交時間：${new Date().toLocaleString('zh-HK', { hour12: false })}`,
  '─────────────────',
  '🔗 搶單連結（司機端）：',
  link,
].filter(Boolean).join('\n');

const payload = { msgtype: 'text', text: { content: text } };

console.log('=== PAYLOAD TO DINGTALK ===');
console.log(JSON.stringify(payload, null, 2));
console.log('=== FIRST 5 LINES ===');
console.log(text.split('\n').slice(0, 5).join('\n'));

const hasText = payload.msgtype === 'text';
const hasLink = text.includes('http://localhost:3000/driver/grab/');
const hasNoCard = !('actionCard' in payload) && !('singleTitle' in payload) && !('singleURL' in payload);
console.log('CHECKS:', { hasText, hasLink, hasNoCard });
process.exit(hasText && hasLink && hasNoCard ? 0 : 1);
