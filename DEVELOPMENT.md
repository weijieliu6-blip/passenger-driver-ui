# 中港車預約平台 - 開發指南

## 📋 項目概述

這是一個連接香港到汕尾的跨境包車/拼車預約平台 MVP。

- **零抽成撮合**: 乘客線下付款給司機，平台不抽成
- **司機訂閱制**: 通過司機月費訂閱獲得收益
- **分級派單**: 鑽石/黃金/免費三級會員，不同等級不同接單優先權

---

## 🚀 快速開始

### 1. 安裝依賴
```bash
npm install
```

### 2. 配置 Supabase
1. 按照 `supabase/SETUP_GUIDE.md` 創建 Supabase 項目
2. 執行 `supabase/schema.sql` 創建數據庫表
3. 執行 `supabase/auth.sql` 配置認證
4. 將 Supabase URL 和 API Key 填入 `.env.local`

### 3. 啟動開發服務器
```bash
npm run dev
```

訪問 [http://localhost:3000](http://localhost:3000)

---

## 📁 項目結構

```
project_prd.md/
├── app/                          # Next.js App Router 頁面
│   ├── page.tsx                  # 乘客首頁（訂單表單）
│   ├── confirm/page.tsx          # 訂單確認頁面
│   ├── driver/
│   │   ├── dashboard/page.tsx    # 司機接單大廳
│   │   └── profile/page.tsx      # 司機個人資料
│   ├── layout.tsx                # 全局佈局
│   └── globals.css               # 全局樣式
├── lib/                          # 工具函數庫
│   ├── supabase.ts               # Supabase 客戶端和類型定義
│   ├── pricing.ts                # 價格計算邏輯
│   ├── membership.ts             # 會員等級邏輯
│   └── utils.ts                  # 通用工具函數
├── supabase/                     # Supabase 配置文件
│   ├── schema.sql                # 數據庫結構 SQL
│   ├── auth.sql                  # Auth 配置 SQL
│   ├── README.md                 # Supabase 使用說明
│   └── SETUP_GUIDE.md            # 完整配置指南
├── .env.local                    # 環境變數（需要手動配置）
├── package.json
├── tailwind.config.js
├── tsconfig.json
└── README.md                     # 項目總覽
```

---

## 🎯 核心功能

### ✅ 已完成功能

#### 乘客端
- [x] 訂單表單（出發地、目的地、時間、人數、行李）
- [x] 價格預覽
- [x] 訂單確認頁面
- [x] 線下付款提示

#### 司機端
- [x] 實時訂單列表
- [x] 根據會員等級延遲顯示（鑽石0秒、黃金15秒、免費30秒）
- [x] 訂單按乘客評分排序
- [x] 一鍵接單
- [x] 個人資料管理
- [x] 車輛信息編輯
- [x] 會員等級展示

#### 技術實現
- [x] Supabase 數據庫結構
- [x] Row Level Security (RLS) 策略
- [x] Realtime 訂閱（實時派單）
- [x] 會員分級派單邏輯
- [x] 響應式設計（手機/桌面適配）

### ⏳ 待實現功能

#### 登入功能（重要）
- [ ] `/login` 頁面
- [ ] 手機號驗證碼登入
- [ ] 角色選擇（乘客/司機）
- [ ] Auth 狀態管理
- [ ] 自動跳轉邏輯

#### 訂單管理
- [ ] 乘客查看訂單狀態
- [ ] 司機查看已接訂單列表
- [ ] 訂單取消功能
- [ ] 訂單完成功能

#### 會員升級
- [ ] 會員升級支付頁面
- [ ] 支付集成（微信支付/支付寶）
- [ ] 訂閱管理

#### 評價系統
- [ ] 乘客評價司機
- [ ] 司機評價乘客
- [ ] 評分顯示和統計

---

## 🛠 技術架構

### 前端
- **框架**: Next.js 16 (App Router)
- **語言**: TypeScript
- **UI**: Tailwind CSS + 自定義設計系統
- **圖標**: Lucide React

### 後端
- **BaaS**: Supabase
  - PostgreSQL 數據庫
  - 內建 Auth
  - Realtime 訂閱
  - Row Level Security

### 設計系統
- **配色**: 深色主題，深海軍藍/石墨灰底色
- **強調色**: 青色 (Cyan) + 青綠色 (Teal)
- **輔助色**: 橙色（提示/升級）
- **圓角**: 卡片 8-16px，按鈕 8px
- **陰影**: 控制在最小，青色發光效果

---

## 📊 數據庫結構

### users 表
```sql
- id: uuid (主鍵)
- role: 'passenger' | 'driver' | 'admin'
- phone: text (唯一)
- name: text
- avatar_url: text (可選)
- created_at: timestamp
```

### drivers_profile 表
```sql
- id: uuid (主鍵)
- user_id: uuid (外鍵 → users.id)
- membership_tier: 'free' | 'gold' | 'diamond'
- rating: decimal (0-5)
- vehicle_plate: text
- vehicle_type: text
- max_passengers: int
- max_luggage: int
- created_at: timestamp
```

### orders 表
```sql
- id: uuid (主鍵)
- passenger_id: uuid (外鍵 → users.id)
- pickup_location: text
- dropoff_location: text
- departure_time: timestamp
- status: 'pending' | 'accepted' | 'completed' | 'cancelled'
- price_hkd: decimal
- driver_id: uuid (外鍵 → users.id，可為空)
- passenger_rating: decimal (用於排序)
- created_at: timestamp
- accepted_at: timestamp (可選)
```

---

## 🔐 權限策略 (RLS)

### users 表
- ✅ 所有人可讀取
- ✅ 用戶只能更新自己

### drivers_profile 表
- ✅ 所有人可讀取
- ✅ 司機只能更新自己（不能改會員等級）
- ✅ 管理員可修改任何司機

### orders 表
- ✅ 乘客只能看自己的訂單
- ✅ 司機可看所有 pending 訂單
- ✅ 司機可看自己接的訂單
- ✅ 乘客可創建訂單
- ✅ 司機可接單

---

## 🎨 派單邏輯實現

### 會員分級延遲
```typescript
// lib/membership.ts
function shouldShowOrder(
  membershipTier: 'free' | 'gold' | 'diamond',
  orderCreatedAt: string
): boolean {
  const elapsed = (now - createdAt) / 1000
  
  switch (tier) {
    case 'diamond': return elapsed >= 0   // 立即顯示
    case 'gold':    return elapsed >= 15  // 15秒後
    case 'free':    return elapsed >= 30  // 30秒後
  }
}
```

### 訂單排序
1. 同級別內按 `passenger_rating` 降序
2. 評分相同按 `created_at` 升序（先來先服務）

---

## 🧪 測試流程

### 1. 測試乘客端
1. 訪問 `http://localhost:3000`
2. 填寫訂單表單
3. 點擊"查看預估價格"
4. 確認訂單信息
5. 提交訂單（需要先登入）

### 2. 測試司機端
1. 訪問 `http://localhost:3000/driver/dashboard`
2. 查看實時訂單列表
3. 測試不同會員等級的延遲效果
4. 點擊"立即接單"
5. 訪問 `/driver/profile` 編輯資料

### 3. 測試 Realtime
1. 打開兩個瀏覽器窗口
2. 窗口 A：乘客端提交訂單
3. 窗口 B：司機端自動刷新看到新訂單

---

## 📝 環境變數

`.env.local` 文件內容：
```env
NEXT_PUBLIC_SUPABASE_URL=你的Supabase項目URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=你的Supabase匿名密鑰
```

⚠️ **重要**: 修改環境變數後需要重啟開發服務器！

---

## 🚧 待辦事項優先級

### 🔴 高優先級（MVP 必須）
1. **實現登入功能** - 否則無法創建訂單
2. **完善錯誤處理** - 更好的用戶體驗
3. **添加加載狀態** - 網絡請求時的 Loading UI

### 🟡 中優先級（增強體驗）
4. 訂單狀態追蹤
5. 司機查看已接訂單列表
6. 訂單取消功能
7. 響應式優化（手機端）

### 🟢 低優先級（未來擴展）
8. 會員升級支付
9. 評價系統
10. 推送通知
11. 聊天功能

---

## 🐛 已知問題

1. **登入功能未實現** - 當前無法創建真實訂單
2. **Auth 狀態未持久化** - 刷新頁面後需要重新登入
3. **缺少錯誤邊界** - 某些錯誤可能導致白屏

---

## 💡 開發建議

### 代碼風格
- 使用 TypeScript 嚴格模式
- 所有組件使用函數式組件
- 優先使用 Tailwind CSS，避免內聯樣式
- 使用 `async/await` 處理異步操作

### 性能優化
- 使用 Next.js Image 組件優化圖片
- 合理使用 `use client` 指令
- 避免不必要的重渲染

### 安全性
- 所有用戶輸入需要驗證
- 使用 Supabase RLS 控制數據訪問
- 不在前端存儲敏感信息

---

## 📞 技術支持

### 文檔資源
- [Next.js 官方文檔](https://nextjs.org/docs)
- [Supabase 官方文檔](https://supabase.com/docs)
- [Tailwind CSS 文檔](https://tailwindcss.com/docs)

### 常見問題
參考 `supabase/SETUP_GUIDE.md` 中的"常見問題排查"部分。

---

## 🎉 MVP 完成標準

當以下功能全部可用時，MVP 即可發布：

- ✅ 乘客可以提交訂單
- ✅ 司機可以看到訂單（根據會員等級延遲）
- ✅ 司機可以接單
- ⏳ 用戶可以登入/註冊
- ⏳ 訂單狀態可追蹤
- ⏳ 基本錯誤處理完善

---

**祝開發順利！** 🚀
