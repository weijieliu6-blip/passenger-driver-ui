#!/usr/bin/env node
// 推廣廣告：平台、司機招募、優惠，三合一
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

const text = `🎉 中港車預約平台正式上線！\n\n---\n\n🚖 **【旅客】跨境專車 一鍵預約**\n• 香港 ↔ 深圳灣 / 蓮塘 / 沙頭角 / 落馬洲\n• 5 座豐田 / 7 座埃爾法 / 9 座商務\n• 平均 2 小時內有司機回覆\n• 7×24 全時段，節假日照常\n\n👉 即刻預約：https://hk-mainland-taxi.com\n\n---\n\n🚙 **【司機】誠徵跨境車司機**\n• 月入穩定，多勞多得\n• 平台直派單，無抽成壓力\n• 接單自由、時間彈性\n• 只需 5 年駕齡 + 合法跨境證件\n\n👉 掃碼 / 報名：https://hk-mainland-taxi.com/driver\n\n---\n\n🎁 **【首單優惠】新人立減 HK$50**\n• 新註冊旅客首張訂單自動扣減\n• 推廣碼：WELCOME50\n• 有效期：即日起至 2026-10-31\n\n---\n\n📱 釘釘 24h 搶單，平均回覆 2 小時內\n🌟 中港出行，就找中港車！`;

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
