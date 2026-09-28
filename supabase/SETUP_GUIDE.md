# Supabase 配置完整指南

本指南將幫助你完整配置 Supabase，從創建項目到啟用所有功能。

## 📋 配置步驟總覽

1. ✅ 創建 Supabase 項目
2. ✅ 執行數據庫結構 SQL
3. ✅ 執行 Auth 配置 SQL
4. ✅ 配置手機號登入（Phone Auth）
5. ✅ 啟用 Realtime
6. ✅ 配置環境變數
7. ✅ 測試數據庫連接

---

## 第一步：創建 Supabase 項目

### 1. 註冊/登入 Supabase
訪問 [https://supabase.com](https://supabase.com) 並登入你的帳號。

### 2. 創建新項目
1. 點擊 "New Project"
2. 填寫以下信息：
   - **Name**: `cross-border-car-booking`（或你喜歡的名字）
   - **Database Password**: 設置一個強密碼並保存
   - **Region**: 選擇 `Singapore` 或 `Hong Kong`（距離用戶最近的區域）
   - **Pricing Plan**: 選擇 Free（免費版）或 Pro（專業版）
3. 點擊 "Create new project" 並等待 1-2 分鐘

---

## 第二步：執行數據庫結構 SQL

### 1. 打開 SQL Editor
1. 在左側導航欄，點擊 "SQL Editor"
2. 點擊 "New Query"

### 2. 執行 schema.sql
1. 打開 `supabase/schema.sql` 文件
2. 複製全部內容
3. 粘貼到 Supabase SQL Editor
4. 點擊右下角的 "Run" 按鈕
5. 等待執行完成，應該看到 "Success. No rows returned"

### 3. 驗證表是否創建成功
1. 在左側導航欄，點擊 "Table Editor"
2. 你應該看到 3 個表：
   - `users`
   - `drivers_profile`
   - `orders`

---

## 第三步：執行 Auth 配置 SQL

### 1. 打開 SQL Editor
重複上一步的操作。

### 2. 執行 auth.sql
1. 打開 `supabase/auth.sql` 文件
2. 複製全部內容
3. 粘貼到 Supabase SQL Editor
4. 點擊 "Run"

---

## 第四步：配置手機號登入（Phone Auth）

### 1. 啟用 Phone Provider
1. 在左側導航欄，點擊 "Authentication" → "Providers"
2. 找到 "Phone" 並點擊
3. 啟用 "Enable Phone provider"

### 2. 配置短信服務商（SMS Provider）

#### 選項 A：使用 Twilio（推薦用於生產環境）
1. 註冊 [Twilio](https://www.twilio.com) 帳號
2. 獲取以下信息：
   - Account SID
   - Auth Token
   - Twilio Phone Number
3. 在 Supabase Phone Provider 設置中：
   - SMS Provider: 選擇 "Twilio"
   - 填入 Twilio 憑證
4. 點擊 "Save"

#### 選項 B：使用 Supabase 內建（開發測試）
1. 在開發階段，可以使用 Supabase 的測試模式
2. 啟用 "Enable Phone provider" 即可
3. 注意：測試模式有限制，不適合生產環境

### 3. 自定義短信模板（可選）
在 "Message Template" 中自定義驗證碼短信內容：
```
您的驗證碼是：{{ .Token }}
有效期 5 分鐘。
```

---

## 第五步：啟用 Realtime

### 1. 打開 Replication 設置
1. 在左側導航欄，點擊 "Database" → "Replication"
2. 找到 `orders` 表
3. 將 `orders` 表的 Realtime 開關打開（變為綠色）

### 2. 驗證 Realtime 是否啟用
打開開發者工具控制台，連接 Supabase 後應該能看到訂閱成功的日志。

---

## 第六步：配置環境變數

### 1. 獲取 API 密鑰
1. 在左側導航欄，點擊 "Settings" → "API"
2. 複製以下兩個值：
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon public**: `eyJxxx...`（很長的字符串）

### 2. 更新 .env.local
在項目根目錄的 `.env.local` 文件中，替換以下內容：

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
```

⚠️ **重要**：替換後需要重啟開發服務器！

---

## 第七步：測試數據庫連接

### 1. 啟動開發服務器
```bash
npm run dev
```

### 2. 測試流程
1. 打開瀏覽器訪問 `http://localhost:3000`
2. 填寫訂單表單並提交
3. 如果看到 "請先登入" 提示，說明連接成功但需要登入

---

## 🧪 創建測試數據

### 1. 創建測試乘客
在 SQL Editor 中執行：

```sql
-- 方法 1: 使用 Supabase Auth UI 註冊真實用戶（推薦）
-- 在 Authentication → Users → Add User 中創建用戶

-- 方法 2: 直接插入（僅測試）
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  phone,
  phone_confirmed_at,
  raw_user_meta_data,
  created_at,
  updated_at
)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'passenger@test.com',
  crypt('test123456', gen_salt('bf')),
  NOW(),
  '12345678',
  NOW(),
  '{"role": "passenger", "name": "測試乘客"}',
  NOW(),
  NOW()
);
```

### 2. 創建測試司機
```sql
-- 先創建 auth.users
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  phone,
  phone_confirmed_at,
  raw_user_meta_data,
  created_at,
  updated_at
)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  'driver-test-uuid-1',
  'authenticated',
  'authenticated',
  'driver1@test.com',
  crypt('test123456', gen_salt('bf')),
  NOW(),
  '87654321',
  NOW(),
  '{"role": "driver", "name": "測試司機（鑽石）"}',
  NOW(),
  NOW()
);

-- 然後創建司機資料
-- 注意：由於有 trigger，users 表會自動創建
-- 但我們需要手動創建 drivers_profile
INSERT INTO public.drivers_profile (
  user_id,
  membership_tier,
  vehicle_plate,
  vehicle_type,
  max_passengers,
  max_luggage,
  rating
)
VALUES (
  'driver-test-uuid-1',
  'diamond',
  'ABC123',
  '7座商務車',
  7,
  4,
  4.9
);
```

---

## 🔍 常見問題排查

### Q1: "請先登入" 提示
**原因**: 用戶未登入，Supabase Auth 無法識別當前用戶。

**解決方案**:
1. 實現登入功能（見下方 "實現登入功能" 部分）
2. 或者暫時使用測試用戶（不推薦生產環境）

### Q2: RLS 策略導致查詢失敗
**原因**: Row Level Security 阻止了未授權的查詢。

**解決方案**:
1. 確保用戶已登入
2. 檢查 RLS 策略是否正確
3. 在開發階段可以臨時禁用 RLS（不推薦）：
```sql
ALTER TABLE public.orders DISABLE ROW LEVEL SECURITY;
```

### Q3: Realtime 訂閱無響應
**原因**: Realtime 未啟用或配置錯誤。

**解決方案**:
1. 確認 `orders` 表的 Realtime 已啟用
2. 檢查瀏覽器控制台是否有錯誤
3. 確保 Supabase 客戶端初始化正確

### Q4: 手機號登入失敗
**原因**: SMS Provider 未配置或額度不足。

**解決方案**:
1. 確認 Twilio 配置正確
2. 檢查 Twilio 帳號餘額
3. 開發階段使用 Magic Link（郵箱登入）替代

---

## 🚀 下一步：實現登入功能

為了讓應用完整運行，你需要創建登入頁面。我們將在下一步實現：
- `/login` 頁面
- 手機號驗證碼登入
- 用戶角色選擇（乘客/司機）
- 自動跳轉邏輯

---

## 📚 參考資源

- [Supabase 官方文檔](https://supabase.com/docs)
- [Row Level Security 指南](https://supabase.com/docs/guides/auth/row-level-security)
- [Realtime 訂閱指南](https://supabase.com/docs/guides/realtime)
- [Phone Auth 配置](https://supabase.com/docs/guides/auth/phone-login)

---

## ✅ 配置檢查清單

完成配置後，請確認以下項目：

- [ ] Supabase 項目已創建
- [ ] `schema.sql` 已執行成功
- [ ] `auth.sql` 已執行成功
- [ ] 3 個表（users, drivers_profile, orders）已創建
- [ ] Phone Auth 已啟用
- [ ] Realtime 已為 orders 表啟用
- [ ] `.env.local` 已配置正確的 API 密鑰
- [ ] 開發服務器可以連接到 Supabase
- [ ] （可選）測試數據已創建

---

恭喜！你的 Supabase 數據庫已完全配置好。接下來可以實現登入功能和完整的業務邏輯。
