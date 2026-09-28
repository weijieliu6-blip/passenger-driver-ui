# Supabase 數據庫配置指南

## 📌 快速開始

### 1. 創建 Supabase 項目
1. 訪問 [Supabase Dashboard](https://supabase.com/dashboard)
2. 點擊 "New Project"
3. 填寫項目名稱、數據庫密碼、選擇區域（建議選擇 Singapore 或 Hong Kong 以獲得最佳性能）
4. 等待項目創建完成

### 2. 獲取 API 密鑰
1. 在項目設置中，進入 "Settings" → "API"
2. 複製以下兩個值：
   - `Project URL`（項目 URL）
   - `anon public`（匿名公開密鑰）
3. 將這些值填入 `.env.local` 文件：
```env
NEXT_PUBLIC_SUPABASE_URL=你的項目URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=你的anon密鑰
```

### 3. 執行數據庫結構
1. 在 Supabase Dashboard 中，進入 "SQL Editor"
2. 點擊 "New Query"
3. 複製 `supabase/schema.sql` 文件的全部內容
4. 粘貼到 SQL 編輯器中
5. 點擊 "Run" 執行

執行成功後，你將看到：
- ✅ 3 個表：`users`, `drivers_profile`, `orders`
- ✅ 多個索引以優化查詢
- ✅ Row Level Security (RLS) 策略
- ✅ 自動觸發器和函數

## 📊 數據庫表結構

### users 表
存儲所有用戶的基本信息（乘客、司機、管理員）

| 欄位 | 類型 | 說明 |
|------|------|------|
| id | uuid | 主鍵，關聯 Supabase Auth |
| role | text | 角色：passenger/driver/admin |
| phone | text | 手機號碼（唯一） |
| name | text | 姓名 |
| avatar_url | text | 頭像 URL（可選） |
| created_at | timestamp | 註冊時間 |

### drivers_profile 表
司機專屬資料和車輛信息

| 欄位 | 類型 | 說明 |
|------|------|------|
| id | uuid | 主鍵 |
| user_id | uuid | 外鍵關聯 users.id |
| membership_tier | text | 會員等級：free/gold/diamond |
| rating | decimal | 評分（0-5） |
| vehicle_plate | text | 車牌號碼 |
| vehicle_type | text | 車型 |
| max_passengers | int | 最大乘客數 |
| max_luggage | int | 最大行李數 |
| created_at | timestamp | 創建時間 |

### orders 表
訂單信息

| 欄位 | 類型 | 說明 |
|------|------|------|
| id | uuid | 主鍵 |
| passenger_id | uuid | 乘客 ID |
| pickup_location | text | 出發地 |
| dropoff_location | text | 目的地 |
| departure_time | timestamp | 出發時間 |
| status | text | 狀態：pending/accepted/completed/cancelled |
| price_hkd | decimal | 價格（港幣） |
| driver_id | uuid | 接單司機 ID（可為空） |
| passenger_rating | decimal | 乘客評分（用於排序） |
| created_at | timestamp | 創建時間 |
| accepted_at | timestamp | 接單時間（可選） |

## 🔐 權限策略（RLS）

### users 表
- ✅ 所有人可讀取基本信息
- ✅ 用戶只能更新自己的資料
- ✅ 新用戶可插入自己的記錄

### drivers_profile 表
- ✅ 所有人可查看司機資料
- ✅ 司機只能更新自己的資料（但不能改會員等級）
- ✅ 管理員可修改會員等級

### orders 表
- ✅ 乘客可查看自己的訂單
- ✅ 司機可查看所有 pending 訂單
- ✅ 司機可查看自己接的訂單
- ✅ 乘客可創建訂單
- ✅ 司機可接單
- ✅ 司機可完成/取消自己的訂單
- ✅ 乘客可取消自己的訂單

## 🔧 高級配置

### 啟用 Realtime（實時訂閱）
1. 在 Supabase Dashboard 中，進入 "Database" → "Replication"
2. 找到 `orders` 表
3. 啟用 Realtime（開關打開）
4. 這樣司機端就可以實時接收新訂單通知

### 配置 Auth（身份驗證）
1. 進入 "Authentication" → "Providers"
2. 啟用 "Phone" 提供商
3. 配置短信服務商（例如 Twilio）
4. 設置短信模板

## 🧪 測試數據

你可以在 SQL Editor 中插入測試數據：

```sql
-- 插入測試乘客（需要先通過 Supabase Auth 註冊）
-- 假設已有用戶 ID：'test-passenger-uuid'
INSERT INTO public.users (id, role, phone, name)
VALUES ('test-passenger-uuid', 'passenger', '12345678', '測試乘客');

-- 插入測試司機
INSERT INTO public.users (id, role, phone, name)
VALUES ('test-driver-uuid', 'driver', '87654321', '測試司機');

INSERT INTO public.drivers_profile (user_id, membership_tier, vehicle_plate, vehicle_type, max_passengers, max_luggage)
VALUES ('test-driver-uuid', 'gold', 'ABC123', '7座商務車', 7, 4);

-- 插入測試訂單
INSERT INTO public.orders (passenger_id, pickup_location, dropoff_location, departure_time, price_hkd)
VALUES ('test-passenger-uuid', '香港機場', '汕尾市區', NOW() + INTERVAL '2 hours', 800);
```

## 🚨 常見問題

### Q: RLS 策略導致查詢失敗？
A: 確保你已經通過 Supabase Auth 登錄，並且當前用戶的 `auth.uid()` 有效。

### Q: 如何測試不同會員等級的派單延遲？
A: 在前端實現延遲邏輯，數據庫只存儲 `created_at`，前端根據當前時間和會員等級判斷是否顯示。

### Q: 如何升級司機會員等級？
A: 只有管理員可以修改。你需要：
1. 創建一個 `role = 'admin'` 的用戶
2. 使用管理員帳號登錄
3. 執行更新 SQL 或通過管理後台修改

## 📚 參考資源

- [Supabase 官方文檔](https://supabase.com/docs)
- [Row Level Security 指南](https://supabase.com/docs/guides/auth/row-level-security)
- [Realtime 訂閱指南](https://supabase.com/docs/guides/realtime)
