# Supabase 數據庫配置指南

## 📋 目錄
1. [創建 Supabase 項目](#1-創建-supabase-項目)
2. [執行數據庫遷移](#2-執行數據庫遷移)
3. [配置環境變量](#3-配置環境變量)
4. [測試數據庫連接](#4-測試數據庫連接)
5. [常用查詢示例](#5-常用查詢示例)

---

## 1. 創建 Supabase 項目

### 步驟 1：註冊 Supabase 帳號
1. 訪問 [https://supabase.com](https://supabase.com)
2. 點擊 "Start your project"
3. 使用 GitHub 或 Email 註冊（**推薦 GitHub**）

### 步驟 2：創建新項目
1. 點擊 "New Project"
2. 填寫項目信息：
   ```
   Organization: 選擇或創建組織
   Name: gangzhong-zhuanche (港中專車)
   Database Password: [生成強密碼並保存]
   Region: Northeast Asia (Seoul) - 最接近香港
   Pricing Plan: Free (免費版足夠)
   ```
3. 點擊 "Create new project"
4. 等待 1-2 分鐘，項目初始化完成

### 步驟 3：獲取 API 密鑰
項目創建完成後：
1. 進入項目首頁
2. 點擊左側 **Settings** → **API**
3. 複製以下信息（稍後需要）：
   ```
   Project URL: https://xxxxx.supabase.co
   anon public key: eyJhbGc...
   service_role key: eyJhbGc... (謹慎保管，不要洩露)
   ```

---

## 2. 執行數據庫遷移

### 方法 1：使用 Supabase Dashboard（推薦，最簡單）

1. 在 Supabase 項目中，點擊左側 **SQL Editor**
2. 點擊 **New query**
3. 複製 `supabase/migrations/20260918_create_orders_table.sql` 的完整內容
4. 粘貼到編輯器中
5. 點擊右下角 **Run** 按鈕
6. 看到 "Success. No rows returned" 即表示成功

### 方法 2：使用 Supabase CLI（高級用戶）

```bash
# 安裝 Supabase CLI
npm install -g supabase

# 登錄
supabase login

# 初始化項目
supabase init

# 關聯到你的遠程項目
supabase link --project-ref your-project-ref

# 執行遷移
supabase db push
```

### 驗證表創建成功

1. 點擊左側 **Table Editor**
2. 應該看到 `orders` 表
3. 點擊表名，查看列結構：
   ```
   ✓ id (bigint, primary key)
   ✓ created_at (timestamptz)
   ✓ order_number (varchar)
   ✓ status (order_status)
   ✓ grab_token (varchar)
   ... 等 30+ 個字段
   ```

---

## 3. 配置環境變量

### 步驟 1：創建 `.env.local` 文件

在項目根目錄創建 `.env.local`：

```bash
# Supabase 配置
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...

# Service Role Key（僅用於服務端 API）
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

# 企業微信 Webhook（稍後配置）
WECHAT_WEBHOOK_URL=

# 網站域名（用於生成搶單鏈接）
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### 步驟 2：安裝 Supabase 客戶端

```bash
npm install @supabase/supabase-js
```

### 步驟 3：創建 Supabase 客戶端工具

創建 `lib/supabase.ts`：

```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// 客戶端（瀏覽器端使用）
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// 服務端客戶端（API 路由中使用，擁有完整權限）
export const supabaseAdmin = createClient(
  supabaseUrl,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)
```

### 步驟 4：添加到 `.gitignore`

確保 `.env.local` 已在 `.gitignore` 中：

```
# 環境變量
.env*.local
.env
```

---

## 4. 測試數據庫連接

### 方法 1：在 Supabase Dashboard 測試

在 **SQL Editor** 中運行：

```sql
-- 測試插入一條訂單
INSERT INTO orders (
  order_number,
  grab_token,
  grab_token_expires_at,
  direction,
  pickup_location,
  dropoff_location,
  departure_time,
  passengers,
  vehicle_type,
  passenger_phone
) VALUES (
  'ORD20260918001',
  generate_grab_token(),
  NOW() + INTERVAL '24 hours',
  'to_hk',
  '深圳',
  '九龍',
  NOW() + INTERVAL '2 days',
  3,
  '7_seat',
  '13800138000'
);

-- 查詢剛插入的訂單
SELECT 
  id,
  order_number,
  status,
  grab_token,
  pickup_location,
  dropoff_location,
  created_at
FROM orders
ORDER BY created_at DESC
LIMIT 1;
```

### 方法 2：創建 API 測試腳本

創建 `scripts/test-db.ts`：

```typescript
import { supabaseAdmin } from '../lib/supabase'

async function testDatabase() {
  try {
    console.log('🔍 測試數據庫連接...')
    
    // 查詢訂單表
    const { data, error } = await supabaseAdmin
      .from('orders')
      .select('id, order_number, status, created_at')
      .limit(5)
    
    if (error) {
      console.error('❌ 數據庫錯誤:', error)
      return
    }
    
    console.log('✅ 數據庫連接成功！')
    console.log('📊 最近的訂單:')
    console.table(data)
    
  } catch (err) {
    console.error('❌ 測試失敗:', err)
  }
}

testDatabase()
```

運行測試：
```bash
npx tsx scripts/test-db.ts
```

---

## 5. 常用查詢示例

### 5.1 查詢待搶單的訂單

```sql
SELECT 
  id,
  order_number,
  pickup_location,
  dropoff_location,
  departure_time,
  passengers,
  vehicle_type,
  created_at
FROM orders
WHERE status = 'pending'
  AND grab_token_expires_at > NOW()
ORDER BY departure_time ASC;
```

### 5.2 查詢某個司機的訂單

```sql
SELECT 
  id,
  order_number,
  status,
  pickup_location,
  dropoff_location,
  departure_time,
  passengers,
  grabbed_at
FROM orders
WHERE driver_phone = '13800138000'
ORDER BY grabbed_at DESC;
```

### 5.3 統計每日訂單量

```sql
SELECT 
  DATE(created_at AT TIME ZONE 'Asia/Hong_Kong') as date,
  COUNT(*) as total_orders,
  COUNT(*) FILTER (WHERE status = 'grabbed') as grabbed_orders,
  COUNT(*) FILTER (WHERE status = 'pending') as pending_orders,
  COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_orders
FROM orders
GROUP BY DATE(created_at AT TIME ZONE 'Asia/Hong_Kong')
ORDER BY date DESC
LIMIT 30;
```

### 5.4 查詢過期未搶的訂單

```sql
SELECT 
  id,
  order_number,
  pickup_location,
  dropoff_location,
  departure_time,
  created_at
FROM orders
WHERE status = 'pending'
  AND grab_token_expires_at < NOW()
ORDER BY created_at DESC;
```

### 5.5 手動更新訂單狀態為已過期

```sql
UPDATE orders
SET status = 'expired',
    updated_at = NOW()
WHERE status = 'pending'
  AND grab_token_expires_at < NOW();
```

---

## 6. 數據庫安全配置

### 6.1 設置 Row Level Security (RLS)

為了保護數據，啟用 RLS：

```sql
-- 啟用 RLS
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- 創建策略：允許讀取所有訂單（用於搶單頁面）
CREATE POLICY "允許讀取所有訂單"
ON orders FOR SELECT
USING (true);

-- 創建策略：禁止客戶端直接插入（只能通過 API）
CREATE POLICY "禁止客戶端插入"
ON orders FOR INSERT
WITH CHECK (false);

-- 創建策略：禁止客戶端直接更新（只能通過 API）
CREATE POLICY "禁止客戶端更新"
ON orders FOR UPDATE
USING (false);
```

**重要**：所有訂單的創建和更新都應該通過 **API 路由** + **service_role key** 完成，這樣可以繞過 RLS 並確保數據安全。

---

## 7. 備份策略

Supabase 免費版提供：
- ✅ 自動每日備份（保留 7 天）
- ✅ 可手動創建備份

### 手動備份
1. 進入項目 **Settings** → **Database**
2. 點擊 **Database backups**
3. 點擊 **Create backup**

---

## 8. 監控和日誌

### 查看實時日誌
1. 點擊左側 **Logs**
2. 選擇 **Postgres Logs**
3. 可以看到所有數據庫查詢和錯誤

### 監控數據庫性能
1. 點擊左側 **Reports**
2. 查看：
   - API 請求量
   - 數據庫大小
   - 存儲使用情況

---

## 9. 常見問題

### Q1: 連接超時
**原因**：網絡問題或 API 密鑰錯誤  
**解決**：
1. 檢查 `.env.local` 配置是否正確
2. 確保 API 密鑰沒有多餘空格
3. 嘗試重啟開發服務器

### Q2: "relation does not exist" 錯誤
**原因**：表未創建  
**解決**：重新執行 SQL 遷移文件

### Q3: RLS 策略導致無法查詢
**原因**：Row Level Security 阻止訪問  
**解決**：
1. 在 API 路由中使用 `supabaseAdmin`（service_role key）
2. 檢查 RLS 策略是否正確

### Q4: 免費版限制
Supabase 免費版限制：
- ✅ 500 MB 數據庫存儲（足夠 10萬+ 訂單）
- ✅ 無限 API 請求
- ✅ 5 GB 帶寬/月
- ⚠️ 項目休眠：7 天無活動會暫停（重新訪問自動恢復）

---

## 10. 下一步

數據庫配置完成後，接下來可以：

1. ✅ **開發訂單創建 API** - `POST /api/orders/create`
2. ✅ **開發搶單 API** - `GET/POST /api/grab/[token]`
3. ✅ **配置企業微信推送** - 參考 `docs/WECHAT_PUSH_GUIDE.md`

---

**配置完成後，通知我，我們繼續開發訂單 API！** 🚀
