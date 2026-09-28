# 第一階段開發計劃：微信群派單系統

## 📋 目標
建立微信小程序乘客端 + 微信群派單機制，快速積累種子用戶。

---

## 🎯 核心功能清單

### 1. 微信小程序 - 乘客端

#### 1.1 用戶系統
- [ ] 微信授權登錄（獲取用戶基本信息）
- [ ] 手機號綁定（用於司機聯繫）
- [ ] 用戶資料頁面
  - 常用地址管理
  - 歷史訂單查看

#### 1.2 訂單創建
- [ ] 首頁表單
  - 方向選擇：回香港 / 回內地
  - 出發地選擇（二級聯動）
    - 香港：九龍/新界/港島 → 具體區域
    - 內地：深圳/汕尾 → 具體地點
  - 目的地選擇（同上）
  - 車型選擇：4座/7座/8座
    - 香港線路自動禁用4座車
  - 出發時間選擇器
  - 乘車人數（1-7人）
  - 行李數量（0-10件）
  - 備註信息（可選）

- [ ] 訂單確認頁
  - 訂單詳情展示
  - 價格預估（可選功能）
  - 提交按鈕

#### 1.3 訂單管理
- [ ] 訂單列表頁
  - 全部/待接單/進行中/已完成
  - 訂單狀態實時更新
  
- [ ] 訂單詳情頁
  - 完整訂單信息
  - 接單司機聯繫方式（接單後顯示）
  - 訂單取消按鈕（待接單狀態）
  - 一鍵撥打司機電話

---

### 2. 後端 API 開發

#### 2.1 訂單相關 API
```typescript
POST   /api/orders/create          // 創建訂單
GET    /api/orders/list            // 獲取用戶訂單列表
GET    /api/orders/:id             // 獲取訂單詳情
PUT    /api/orders/:id/cancel      // 取消訂單
POST   /api/orders/:id/push        // 推送訂單到微信群
```

#### 2.2 搶單相關 API
```typescript
GET    /api/grab/:token            // 獲取搶單頁面數據（驗證token）
POST   /api/grab/:token            // 確認搶單
```

---

### 3. 微信推送功能

#### 3.1 企業微信機器人（推薦方案）

**優點**：
- 官方支持，穩定可靠
- 免費，無限制
- 支持 Markdown 格式
- 可以發送鏈接

**推送消息模板**：
```markdown
🚗 **新訂單通知 #12345**

📍 **路線**
深圳灣口岸 → 香港九龍尖沙咀

⏰ **時間**: 2026-09-20 10:30

👥 **乘客**: 3人 | 🧳 **行李**: 2件 | 🚙 **車型**: 7座車

💰 **預估價格**: HKD $800

---
[👉 立即搶單](https://your-domain.com/grab/abc123xyz)
```

**實現步驟**：
1. 在企業微信創建群組
2. 添加群機器人，獲取 Webhook URL
3. 訂單創建後調用 Webhook 推送
4. 環境變數存儲 Webhook URL

#### 3.2 備選方案：個人微信機器人
- 使用 Wechaty 框架
- 風險：可能被封號
- 不推薦作為主要方案

---

### 4. 搶單頁面

#### 4.1 頁面路由
```
/grab/[token]
```

#### 4.2 頁面功能
- [ ] Token 驗證
  - 檢查 token 是否有效
  - 檢查訂單是否已被搶
  - 檢查訂單是否已取消

- [ ] 訂單信息展示
  ```
  ✅ 訂單詳情
  - 出發地/目的地
  - 出發時間
  - 乘車人數、行李
  - 車型要求
  - 備註信息
  
  ⚠️ 隱藏乘客手機號（接單後顯示）
  ```

- [ ] 司機信息快速填寫
  ```
  姓名: [____]
  電話: [____]
  車牌: [粵B12345]
  車型確認: [7座車 ✓]
  ```

- [ ] 一鍵搶單
  - 提交司機信息
  - 併發控制（防止重複接單）
  - 接單成功 → 顯示乘客電話
  - 來晚了 → 顯示"訂單已被搶"

#### 4.3 搶單成功頁
```
✅ 搶單成功！

乘客聯繫方式：
📱 +852 9123 4567

訂單詳情：
[完整訂單信息]

🔔 溫馨提示
- 請及時聯繫乘客確認行程
- 準時到達接送地點
- 提供優質服務，累積好評
```

---

## 🗄️ 數據庫設計

### orders 表（簡化版）

```sql
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- 乘客信息
  passenger_wechat_id TEXT NOT NULL,        -- 微信 openid
  passenger_name TEXT NOT NULL,
  passenger_phone TEXT NOT NULL,
  
  -- 訂單信息
  direction TEXT NOT NULL,                  -- 'to_hk' | 'to_mainland'
  pickup_location TEXT NOT NULL,
  pickup_area TEXT NOT NULL,
  dropoff_location TEXT NOT NULL,
  dropoff_area TEXT NOT NULL,
  departure_time TIMESTAMPTZ NOT NULL,
  
  -- 乘車詳情
  passengers INT NOT NULL CHECK (passengers >= 1 AND passengers <= 7),
  luggage INT NOT NULL CHECK (luggage >= 0),
  vehicle_type TEXT NOT NULL CHECK (vehicle_type IN ('4_seat', '7_seat', '8_seat')),
  notes TEXT,
  
  -- 搶單相關
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'grabbed', 'completed', 'cancelled')),
  grab_token TEXT UNIQUE NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL,
  
  -- 司機信息（搶單後填寫）
  driver_name TEXT,
  driver_phone TEXT,
  driver_vehicle TEXT,
  grabbed_at TIMESTAMPTZ,
  
  -- 時間戳
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- 索引
  CONSTRAINT check_grabbed_info CHECK (
    (status = 'grabbed' AND driver_name IS NOT NULL AND driver_phone IS NOT NULL)
    OR status != 'grabbed'
  )
);

-- 創建索引
CREATE INDEX idx_orders_passenger ON orders(passenger_wechat_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_grab_token ON orders(grab_token);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
```

---

## 🔐 安全機制

### 1. Token 安全
```typescript
// 生成搶單 token
function generateGrabToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

// Token 有效期：24 小時
const tokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
```

### 2. 併發控制
```typescript
// 使用數據庫事務保證原子性
async function grabOrder(token: string, driverInfo: DriverInfo) {
  const result = await supabase
    .from('orders')
    .update({
      status: 'grabbed',
      driver_name: driverInfo.name,
      driver_phone: driverInfo.phone,
      driver_vehicle: driverInfo.vehicle,
      grabbed_at: new Date().toISOString()
    })
    .eq('grab_token', token)
    .eq('status', 'pending')  // 只更新待接單狀態
    .select()
    .single()
  
  if (!result.data) {
    throw new Error('訂單已被搶或不存在')
  }
  
  return result.data
}
```

### 3. 敏感信息保護
- 搶單頁面不顯示乘客電話（接單成功後才顯示）
- Token 一次性有效（已搶訂單的 token 失效）
- 訂單取消後 token 立即失效

---

## 📱 技術選型

### 微信小程序框架
**方案對比**：

| 方案 | 優點 | 缺點 | 推薦度 |
|------|------|------|--------|
| **原生開發** | 性能最好、功能完整 | 開發效率低 | ⭐⭐⭐ |
| **Taro** | React 語法、跨端支持 | 體積稍大 | ⭐⭐⭐⭐⭐ |
| **uni-app** | Vue 語法、生態豐富 | 部分新特性支持慢 | ⭐⭐⭐⭐ |

**推薦：Taro 3.x**
- 使用 React + TypeScript
- 與 Next.js 代碼風格統一
- 後續可復用組件邏輯

### 搶單頁面
- Next.js App Router 路由
- 服務端渲染（SSR）
- 移動端優先響應式設計

---

## 🚀 開發順序

### Week 1: 基礎搭建
- [ ] Supabase 數據庫表創建
- [ ] 訂單 API 開發（創建/查詢/取消）
- [ ] 搶單 API 開發（驗證/接單）

### Week 2: 微信推送
- [ ] 企業微信機器人配置
- [ ] 推送消息格式設計
- [ ] 訂單推送邏輯對接
- [ ] 搶單頁面開發（Web 版）

### Week 3: 小程序開發 - 基礎功能
- [ ] Taro 項目初始化
- [ ] 微信登錄對接
- [ ] 訂單表單頁面
- [ ] 訂單確認頁面

### Week 4: 小程序開發 - 訂單管理
- [ ] 訂單列表頁面
- [ ] 訂單詳情頁面
- [ ] 訂單狀態實時更新
- [ ] 一鍵撥打功能

### Week 5: 測試與優化
- [ ] 功能測試（下單-推送-搶單-完成）
- [ ] 併發測試（多人搶單）
- [ ] UI/UX 優化
- [ ] 性能優化

### Week 6: 上線準備
- [ ] 小程序提交審核
- [ ] 生產環境配置
- [ ] 監控和日誌配置
- [ ] 運營文檔準備

---

## 📊 運營指標

### 關鍵指標（KPI）
- **用戶增長**: 每週新增註冊用戶數
- **訂單量**: 日均訂單數
- **搶單率**: 訂單被搶比例（目標 > 95%）
- **完單率**: 已接訂單完成比例（目標 > 90%）
- **用戶留存**: 7日留存、30日留存

### 階段目標
**第一個月**:
- 累積 50+ 註冊用戶
- 日均訂單 3-5 單
- 搶單率 > 90%

**第二個月**:
- 累積 100+ 註冊用戶
- 日均訂單 8-10 單
- 用戶留存 > 30%

**第三個月**:
- 累積 200+ 註冊用戶
- 日均訂單 15+ 單
- 準備開放司機註冊

---

## 💰 初期成本預估

### 技術成本
- Supabase 免費版: $0/月
- 域名 + SSL: ~$20/年
- 雲服務器（備用）: $5-10/月
- **月度成本**: < $10

### 運營成本
- 微信小程序認證: ¥300/年
- 初期推廣預算: 根據實際情況

### 人力成本
- 全職開發 1 人（6週開發週期）
- 兼職運營 1 人

---

## 🎯 成功標準

### 進入第二階段條件
滿足以下任意一項即可開放司機端：

1. **用戶規模**: 累積 100+ 活躍用戶
2. **訂單量**: 日均訂單穩定 ≥ 10 單
3. **市場驗證**: 搶單率 > 95%，說明供不應求

---

## 📝 注意事項

### 法律合規
- [ ] 乘客隱私保護（符合 GDPR / 個人信息保護法）
- [ ] 微信小程序平台規則
- [ ] 跨境運營資質（運營主體註冊地）

### 風險控制
- [ ] 惡意搶單防護（驗證碼 / 人機驗證）
- [ ] 虛假訂單識別
- [ ] 糾紛處理機制（客服流程）

### 技術風險
- [ ] 微信推送失敗備用方案（短信通知）
- [ ] 數據備份策略
- [ ] 服務降級預案

---

**準備好開始開發了嗎？** 🚀
