#!/usr/bin/env node
// 推廣廣告：更新版本 - 司機招募 + 旅客下單，鏈接都正確
import crypto from 'node:crypto';
import fs from 'node:fs';

const env = fs.readFileSync('C:/Users/weiji/.cursor/project_prd.md/.env.local', 'utf8');
const WEBHOOK = env.match(/DINGTALK_WEBHOOK_URL=(.+)/)[1].trim();
const SECRET = env.match(/DINGTALK_SECRET=(.+)/)[1].trim();

function sign(timestamp, secret) {
  const str = `${timestamp}\n${secret}`;
  return crypto.createHmac('sha256', secret).update(str).digest('base64');
}

const timestamp = Date.now();
const signEnc = encodeURIComponent(sign(timestamp, SECRET));
const url = WEBHOOK + (WEBHOOK.includes('?') ? '&' : '?') + `timestamp=${timestamp}&sign=${signEnc}`;

const text = `🚖 中港車預約平台 — 正式上線！\n\n✨ 旅客端 + 司機端 雙端齊發，跨境出行一鍵搞定 🚀\n\n---\n\n🌟 【旅客】跨境專車 一鍵預約\n• 香港 ↔ 深圳灣 / 蓮塘 / 沙頭角 / 落馬洲\n• 5 座豐田 / 7 座埃爾法 / 9 座商務\n• 釘釘 24h 搶單，平均 2 小時內有司機回覆\n• 全時段預約，節假日照常\n\n👉 即刻預約：https://hk-mainland-taxi.com\n\n---\n\n🚙 【司機】誠徵跨境車司機\n• 月入穩定，多勞多得\n• 平台直派單，零中間抽成\n• 接單自由，時間彈性\n• 需 3 年以上駕齡 + 跨境證件\n\n👉 馬上加入：https://hk-mainland-taxi.com/driver\n📋 填表 5 分鐘，24 小時內回覆培訓安排\n\n---\n\n📊 平台數據\n✅ 釘釘即時搶單系統\n✅ 24h 全時段覆蓋\n✅ 0% 中間抽成\n✅ 專業客服支援\n\n---\n\n💼 客服聯繫\n📞 +852 熱線支援\n🌐 https://hk-mainland-taxi.com\n\n---\n\n🌟 中港出行，就找中港車！`;

// 預覽模式：先看文案
if (process.argv.includes('--preview')) {
  console.log('=== 廣告文案預覽 ===\n');
  console.log(text);
  process.exit(0);
}

// 釘釘 text msgtype 支援簡單 markdown（粗體、換行）
const payload = { msgtype: 'text', text: { content: text } };

console.log('=== 推送中 ===');

const r = await fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
});
const result = await r.json();
console.log(`HTTP ${r.status}`);
console.log('釘釘回應:', JSON.stringify(result, null, 2));
