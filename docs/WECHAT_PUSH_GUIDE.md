# 微信推送方案指南

## 🎯 目標
當乘客提交訂單後，自動推送消息到指定微信群，司機點擊鏈接即可搶單。

---

## 📋 方案對比

### 方案 A：企業微信群機器人（推薦 ⭐⭐⭐⭐⭐）

#### 優點
✅ 官方支持，穩定可靠  
✅ 完全免費，無消息限制  
✅ 支持 Markdown 富文本格式  
✅ 可發送點擊鏈接  
✅ 配置簡單，5分鐘搞定  
✅ 不會被封號  

#### 缺點
❌ 需要企業微信（但個人也可免費註冊）  
❌ 消息只能發送到企業微信群  

#### 適用場景
✅ **適合本項目**：司機群體穩定，可引導加入企業微信群

---

### 方案 B：個人微信機器人

#### 優點
✅ 可以發送到普通微信群  
✅ 使用現有微信群，無需遷移  

#### 缺點
❌ 非官方，有封號風險  
❌ 需要額外服務器運行機器人  
❌ 穩定性差，微信協議經常變化  
❌ 技術複雜度高  

#### 適用場景
❌ **不推薦**：風險高，維護成本大

---

### 方案 C：微信服務號模板消息

#### 優點
✅ 官方支持  
✅ 可直接推送到個人微信  

#### 缺點
❌ 需要認證服務號（¥300/年）  
❌ 需要用戶先關注服務號  
❌ 模板消息格式限制多  
❌ 無法發送到群聊  

#### 適用場景
🤔 **可作為補充**：用於通知乘客訂單狀態更新

---

## 🚀 推薦實施方案

### 主方案：企業微信群機器人
用於司機搶單通知

### 輔助方案：微信服務號
用於通知乘客（接單成功、司機信息等）

---

## 📱 企業微信群機器人配置指南

### Step 1: 註冊企業微信

#### 個人註冊（推薦）
1. 訪問 [企業微信官網](https://work.weixin.qq.com/)
2. 點擊「企業註冊」
3. 選擇「我的企業少於50人」
4. 填寫基本信息：
   - 企業名稱：港中專車
   - 管理員姓名：你的名字
   - 手機號：你的手機號
5. 微信掃碼驗證
6. 完成註冊 ✅

**費用**：完全免費

---

### Step 2: 創建企業微信群

1. 打開企業微信 App
2. 點擊右上角 「+」 → 「發起群聊」
3. 選擇要邀請的司機（或先創建空群）
4. 群名稱：「港中專車 - 訂單推送群」

---

### Step 3: 添加群機器人

1. 在企業微信群中，點擊右上角「...」
2. 點擊「群機器人」
3. 點擊「添加群機器人」
4. 設置機器人信息：
   - 機器人名稱：訂單通知助手
   - 頭像：可自定義
5. 複製 **Webhook 地址**（重要！）

示例 Webhook：
```
https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

---

### Step 4: 配置環境變數

在項目的 `.env.local` 文件中添加：

```env
# 企業微信群機器人 Webhook
WECHAT_WEBHOOK_URL=https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=你的key
```

---

### Step 5: 測試推送

創建測試腳本 `test-wechat-push.ts`：

```typescript
async function testWechatPush() {
  const webhookUrl = process.env.WECHAT_WEBHOOK_URL
  
  const message = {
    msgtype: 'markdown',
    markdown: {
      content: `## 🚗 測試消息
      
**這是一條測試消息**

如果你看到這條消息，說明配置成功！

<@all>`  // @所有人
    }
  }
  
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(message)
  })
  
  const result = await response.json()
  console.log(result)  // { errcode: 0, errmsg: 'ok' }
}

testWechatPush()
```

執行測試：
```bash
npx tsx test-wechat-push.ts
```

如果企業微信群收到消息，配置成功 ✅

---

## 📝 訂單推送消息模板

### 標準消息格式

```typescript
// lib/wechat-notifier.ts

export async function pushOrderToWechat(order: Order) {
  const webhookUrl = process.env.WECHAT_WEBHOOK_URL
  
  if (!webhookUrl) {
    console.error('未配置企業微信 Webhook')
    return
  }
  
  const grabUrl = `${process.env.NEXT_PUBLIC_APP_URL}/grab/${order.grab_token}`
  
  const message = {
    msgtype: 'markdown',
    markdown: {
      content: `## 🚗 新訂單通知 #${order.id.slice(0, 8)}

**📍 路線**
${order.pickup_area} → ${order.dropoff_area}

**⏰ 出發時間**
${formatDateTime(order.departure_time)}

**👥 乘車信息**
人數：${order.passengers}人 | 行李：${order.luggage}件 | 車型：${getVehicleTypeName(order.vehicle_type)}

${order.notes ? `**📝 備註**\n${order.notes}\n` : ''}
---
[👉 點擊搶單](${grabUrl})

<@all>`  // @所有人
    }
  }
  
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message)
    })
    
    const result = await response.json()
    
    if (result.errcode !== 0) {
      throw new Error(`推送失敗：${result.errmsg}`)
    }
    
    console.log('✅ 訂單推送成功', order.id)
  } catch (error) {
    console.error('❌ 訂單推送失敗', error)
    // TODO: 發送告警通知管理員
  }
}

// 輔助函數
function getVehicleTypeName(type: string): string {
  const names = {
    '4_seat': '4座車',
    '7_seat': '7座車',
    '8_seat': '8座車'
  }
  return names[type] || type
}

function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleString('zh-HK', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}
```

---

### 消息示例（群內顯示效果）

```
🚗 新訂單通知 #a1b2c3d4

📍 路線
深圳灣口岸 → 香港九龍尖沙咀

⏰ 出發時間
09-20 10:30

👥 乘車信息
人數：3人 | 行李：2件 | 車型：7座車

📝 備註
需要嬰兒座椅

---
👉 點擊搶單

@所有人
```

---

## 🔔 進階功能

### 1. 接單成功通知

當司機搶單成功後，推送確認消息到群：

```typescript
export async function notifyOrderGrabbed(order: Order) {
  const message = {
    msgtype: 'markdown',
    markdown: {
      content: `## ✅ 訂單已接 #${order.id.slice(0, 8)}

**司機信息**
${order.driver_name} | ${order.driver_phone}

**路線**
${order.pickup_area} → ${order.dropoff_area}

**時間**
${formatDateTime(order.departure_time)}`
    }
  }
  
  await fetch(process.env.WECHAT_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(message)
  })
}
```

---

### 2. 訂單取消通知

```typescript
export async function notifyOrderCancelled(order: Order) {
  const message = {
    msgtype: 'text',
    text: {
      content: `❌ 訂單已取消 #${order.id.slice(0, 8)}\n路線：${order.pickup_area} → ${order.dropoff_area}`
    }
  }
  
  await fetch(process.env.WECHAT_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(message)
  })
}
```

---

### 3. 每日統計推送

```typescript
export async function pushDailySummary(stats: DailyStats) {
  const message = {
    msgtype: 'markdown',
    markdown: {
      content: `## 📊 今日訂單統計

**新增訂單**：${stats.totalOrders} 單
**已完成**：${stats.completedOrders} 單
**已取消**：${stats.cancelledOrders} 單
**待接單**：${stats.pendingOrders} 單

**搶單率**：${stats.grabRate}%
**完單率**：${stats.completeRate}%

繼續加油！🚀`
    }
  }
  
  await fetch(process.env.WECHAT_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(message)
  })
}
```

---

## ⚠️ 注意事項

### 消息頻率限制
- 每個機器人每分鐘最多發送 **20 條消息**
- 超過限制會返回錯誤碼 45009
- 建議批量訂單時增加延遲

### Webhook 安全
- 不要將 Webhook URL 提交到 Git
- 使用環境變數存儲
- 定期更換 Webhook（企業微信群設置中可重置）

### 消息格式
- Markdown 語法支持有限
- 支持：標題、加粗、鏈接
- 不支持：圖片、表格、代碼塊

### @所有人 權限
- 需要群主或管理員權限
- 如果機器人無權限，移除 `<@all>` 即可

---

## 🐛 常見問題

### Q1: 推送消息顯示亂碼
**A**: 確保請求頭設置 `Content-Type: application/json`，且字符編碼為 UTF-8

### Q2: 推送失敗，返回 errcode: 93000
**A**: Webhook URL 無效，請在企業微信群重新添加機器人

### Q3: 點擊鏈接無法跳轉
**A**: 確保鏈接使用 HTTPS，且域名已備案（如果在國內）

### Q4: 消息發送成功但群裡沒收到
**A**: 檢查機器人是否被移除群聊，或群聊是否被解散

---

## 📚 參考資料

- [企業微信機器人官方文檔](https://developer.work.weixin.qq.com/document/path/91770)
- [Markdown 格式說明](https://developer.work.weixin.qq.com/document/path/91770#markdown%E7%B1%BB%E5%9E%8B)

---

**配置完成後，就可以開始開發搶單頁面了！** 🚀
