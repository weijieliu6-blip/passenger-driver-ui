# 訂單流程擴展與司機登入系統 - 實現完成

## ✅ 已完成所有任務

### 1. 數據庫變更 ✅
- ✅ 創建 `driver_info` 表（司機公開資料）
- ✅ `orders` 表添加 5 個新字段：`driver_id`, `confirmed_price`, `price_currency`, `price_confirmed_at`, `estimated_fare`
- ✅ `order_status` 枚舉擴展：新增 `price_confirmed` 狀態
- ✅ 創建評分自動更新觸發器
- ✅ 創建接單數自動更新觸發器
- ✅ 配置完整的 RLS 策略
- 📄 文件：`supabase/migrations/20260919_order_v3_driver_info.sql`
- 📄 文件：`supabase/migrations/20260919_order_v3_driver_info_transaction.sql`（帶 transaction）

### 2. 類型補齊 ✅
- ✅ `MembershipTier` 類型導出
- ✅ `UserRole` 類型導出
- ✅ `PriceCurrency` 類型導出
- ✅ `DriverInfo` 介面導出
- ✅ `Order` 介面補齊（包含所有新字段）
- ✅ `ConfirmPriceInput` 介面新增
- 📄 文件：`lib/supabase.ts`

### 3. Auth Server ✅
- ✅ 新增 `getCurrentDriver(request)` 函數
- ✅ 新增 `getCurrentUser(request)` 函數
- ✅ 司機專屬介面 `DriverProfileAuth`
- 📄 文件：`lib/auth-server.ts`

### 4. API 端點 ✅
- ✅ `POST /api/driver/orders/[orderNumber]/confirm-price` - 司機確認價格
- ✅ `POST /api/orders/[orderNumber]/rebook` - 重新預約
- ✅ `GET /api/drivers/[driverId]` - 司機公開詳情
- ✅ `POST /api/grab/[token]` - 升級為要求司機登入
- ✅ `GET /api/orders/[orderNumber]` - 增強：返回 driver 信息
- ✅ `POST /api/orders/create` - 保存 `estimated_fare`
- ✅ `POST /api/auth/register` - 支援 `role: 'driver'` 註冊
- ✅ `POST /api/auth/login` - 不限制角色
- ✅ `GET /api/auth/me` - 返回通用用戶信息

### 5. 乘客訂單詳情頁 ✅
- ✅ 顯示狀態 badge：pending / grabbed / price_confirmed / completed / cancelled
- ✅ **顯示確認價格 + 幣種標明**（HK$ 或 ¥）
- ✅ **顯示預估車資**（對比確認價格）
- ✅ 司機信息卡片可點擊跳轉到司機詳情頁
- ✅ 司機頭像、姓名、評分、車輛、駕齡、接單數
- ✅ **「聯繫司機」電話按鈕** + **「聯繫平台」按鈕**
- ✅ 訂單操作按鈕（修改/取消）
- ✅ 評分區塊
- 📄 文件：`app/order/[orderNumber]/page.tsx`

### 6. Profile 重新預約 ✅
- ✅ 已取消訂單卡片添加「重新預約」按鈕
- ✅ 點擊後調用 rebook API，數據 prefill 到首頁
- ✅ 進行中訂單卡片可點擊跳轉到詳情頁
- ✅ 顯示已確認價格徽章
- 📄 文件：`app/passenger/profile/page.tsx`

### 7. 司機登入頁 ✅
- ✅ 與乘客登入頁同樣 UI
- ✅ 角色限定為 `driver`（登入時驗證）
- ✅ 支持電郵註冊
- ✅ 支持香港 +852 / 內地 +86 手機註冊
- ✅ 自動判斷登入輸入類型（電郵/電話）
- ✅ 註冊後引導完善資料
- 📄 文件：`app/driver/login/page.tsx`

### 8. 司機訂單詳情頁（報價表單）✅
- ✅ 顯示訂單完整信息
- ✅ **金額輸入 + 幣種下拉**（HKD/CNY）
- ✅ 可選填：車輛型號、駕齡
- ✅ 實時預覽報價顯示
- ✅ 報價成功跳轉到司機中心
- ✅ 已報價狀態顯示確認的價格
- ✅ 聯繫乘客電話按鈕
- 📄 文件：`app/driver/orders/[orderNumber]/page.tsx`

### 9. 司機詳情頁（公開）✅
- ✅ 司機頭像、姓名、會員等級徽章
- ✅ 評分星級 + 接單數
- ✅ 車輛信息（型號、車牌遮蔽、駕齡、載客容量）
- ✅ 聯繫按鈕（致電司機、聯繫平台）
- ✅ 乘客評價列表（最新 5 條）
- 📄 文件：`app/passenger/driver/[driverId]/page.tsx`

### 10. Grab 頁面真實接入 ✅
- ✅ `GET /api/grab/[token]` 查詢訂單
- ✅ `POST /api/grab/[token]` 要求司機登入
- ✅ 未登入司機：顯示登入引導，按鈕跳轉登入頁
- ✅ 已登入司機：自動使用其帳號資料搶單
- ✅ 搶單成功跳轉到司機訂單詳情頁（去報價）
- ✅ 訂單已被搶/已過期/已取消的友好提示
- 📄 文件：`app/grab/[token]/page.tsx`

### 11. 端到端測試 ✅
- ✅ 創建測試腳本：`test-e2e-api.mjs`
- ✅ 涵蓋完整流程：乘客註冊 → 司機註冊 → 乘客下單 → 訂單查詢 → 司機搶單 → 司機報價 → 乘客查詢（含司機信息）→ 司機公開資料 → 取消 → 重新預約

### 12. 額外修復 ✅
- ✅ 重寫 `app/driver/dashboard/page.tsx`，修復結構性錯誤
- ✅ 新結構：司機中心 + 統計 + 待接/進行中/已完成訂單

## 📂 新增/修改文件清單

### 新增
- `supabase/migrations/20260919_order_v3_driver_info.sql`
- `supabase/migrations/20260919_order_v3_driver_info_transaction.sql`
- `app/api/driver/orders/[orderNumber]/confirm-price/route.ts`
- `app/api/orders/[orderNumber]/rebook/route.ts`
- `app/api/drivers/[driverId]/route.ts`
- `app/driver/login/page.tsx`
- `app/driver/orders/[orderNumber]/page.tsx`
- `app/passenger/driver/[driverId]/page.tsx`
- `test-e2e-api.mjs`

### 修改
- `lib/supabase.ts` - 補齊類型
- `lib/auth-server.ts` - 新增 `getCurrentDriver`、`getCurrentUser`
- `app/api/auth/register/route.ts` - 支持 driver 角色
- `app/api/auth/login/route.ts` - 不限制角色
- `app/api/auth/me/route.ts` - 通用用戶查詢
- `app/api/orders/create/route.ts` - 保存 estimated_fare
- `app/api/orders/[orderNumber]/route.ts` - 增強返回 driver 信息
- `app/api/grab/[token]/route.ts` - 要求司機登入
- `app/grab/[token]/page.tsx` - 接入真實 API
- `app/order/[orderNumber]/page.tsx` - 重寫訂單詳情頁
- `app/passenger/profile/page.tsx` - 添加重新預約按鈕
- `app/driver/dashboard/page.tsx` - 重寫為完整司機中心
- `app/confirm/page.tsx` - 傳入 estimatedFare 中間值

## 🎯 訂單狀態流轉（已實現）

```
乘客下單          司機搶單           司機報價           乘客接受          行程完成
pending ──→ grabbed ──→ price_confirmed ──→ accepted ──→ completed
   ↓             ↓              ↓                ↓
cancelled   cancelled      cancelled        cancelled
   ↓
重新預約 → pending
```

## 🧪 測試方式

### 在 Supabase Dashboard 執行 Migration
1. 登錄 https://supabase.com/dashboard
2. 進入 SQL Editor
3. 複製 `supabase/migrations/20260919_order_v3_driver_info_transaction.sql` 內容
4. 執行

### 本地測試完整流程
1. 重啟 dev server: `npm run dev`
2. 訪問 `http://localhost:3000`
3. 乘客端下單
4. 釘釘群會推送搶單鏈接
5. 司機點擊鏈接 → 跳轉到登入頁 → 註冊/登入 → 搶單 → 報價
6. 乘客查詢訂單，看到司機信息、報價

### API 測試
```bash
node test-e2e-api.mjs
```

## 🎨 UI 設計亮點

- **琥珀色主題**：司機端使用琥珀/橙色系區分於乘客端的青色
- **手機號碼格式顯示**：自動添加空格（例：9123 4567）
- **幣種標明**：HK$ 港幣（琥珀色），¥ 人民幣（橙色）
- **車牌遮蔽**：京• ****123 格式（保護隱私）
- **電話遮蔽**：1234****5678 格式
- **會員徽章**：鑽石會員（青藍）、黃金會員（金橙）
- **評分星級**：金色填充，未評分灰色
- **跳轉提示**：每一步都有清晰的視覺反饋

## ⚠️ 後續注意事項

1. **執行 Migration**：在 Supabase Dashboard SQL Editor 執行提供的 SQL 文件
2. **RLS 策略**：確保 `driver_info` 表的 RLS 已啟用（migration 已包含）
3. **司機首次搶單**會自動創建 `driver_info` 記錄
4. **評分自動更新**：當訂標完成評分後，`driver_info.rating` 會自動更新
5. **向後兼容**：所有新字段都用 `IF NOT EXISTS`，舊訂單不會出錯
