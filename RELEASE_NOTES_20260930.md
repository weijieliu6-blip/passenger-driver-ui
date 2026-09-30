# 新功能 Release Notes（2026-09-30）

## 📋 三大新功能已上線

### ① 地點搜尋 + 精確地址
- **DB 新表**：`public.locations`（內建 30+ 熱門 POI）
  - 香港：港島/九龍/新界、大嶼山迪士尼、機場
  - 內地：皇崗/深圳灣/蓮塘口岸、深圳/廣州/珠海/東莞主要區域
  - 地址：含地址、座標（lat/lng）
- **API**：`GET /api/locations/search?q=&region=&category=`
  - 模糊匹配中英文（ILIKE）
  - 無匹配自動顯示手動輸入框
- **前端**：`components/location-autocomplete.tsx`
  - debounced 250ms 搜尋
  - 下拉顯示熱門 POI
  - 找不到時可手動輸入詳細地址
- **訂單擴充**：`pickup_address`、`dropoff_address`、`pickup_lat`、`pickup_lng`、`dropoff_lat`、`dropoff_lng`

### ② 預估價格（真實行情）
- **DB 新表**：`public.pricing_rules`（30+ 條熱門路線）
- **DB 新函數**：`public.get_pricing_estimate(p_pickup_zone, p_dropoff_zone, p_vehicle_type, p_departure_time)`
  - 雙向 fallback（A→B 或 B→A 都能查到）
  - 自動判斷夜間加成（HK 時間 22:00-07:00）
  - 回傳 JSON：base_price / night_surcharge / total_price / estimated_minutes / notes
- **API**：`POST /api/pricing/estimate`
- **前端**：`components/pricing-badge.tsx`
  - 即時估算（debounced 300ms）
  - 顯示總價、夜間加成、車程時間
- **價格行情**（2026 真實市場，參考捷達/KKday/Holimood/永東/HKGCB）

| 路線 | 7座商務 | 4座舒適 |
|---|---|---|
| 港島/九龍 ⇄ 深圳福田/南山/羅湖 | HK$ 900-1,000 | HK$ 700-800 |
| 港島/九龍 ⇄ 深圳機場 | HK$ 1,000-1,200 | HK$ 800-900 |
| 港島/九龍 ⇄ 廣州天河 | HK$ 2,400-2,500 | HK$ 1,900-2,000 |
| 港島/九龍 ⇄ 珠海拱北/香洲 | HK$ 1,700-1,800 | HK$ 1,400 |
| 港島/九龍 ⇄ 東莞 | HK$ 1,400-1,500 | HK$ 1,200 |

夜間加成：+HK$ 150-300 ｜ 加停靠點：+HK$ 100-500 ｜ 兒童座椅：+HK$ 100

### ③ 即時文字訊息（乘客 ↔ 司機）
- **DB 新表**：`public.order_messages`
  - 欄位：sender_id, sender_role（passenger/driver/admin/system）, content, read_at
  - RLS：訂單的乘客/司機/管理員可讀寫
  - Realtime 訂閱 INSERT 事件
- **API**：`GET/POST /api/orders/[orderNumber]/messages`
- **前端**：`components/order-chat.tsx`
  - 浮動按鈕（右下角）
  - Supabase Realtime 即時接收
  - 自動 polling fallback（15s）
  - 訊息已讀標記
- **整合頁面**：
  - `/passenger/orders/[orderNumber]` — 司機接單後顯示
  - `/driver/orders/[orderNumber]` — 有乘客時顯示

### ④ AI 客服 + 人工轉接
- **DB 新表**：`public.cs_conversations` + `public.cs_messages`
  - 會話狀態：`ai` / `human_needed` / `human_active` / `closed`
- **FAQ 知識庫**：`lib/cs-faq.ts`（11 條）
  - 取消/價格/時間/行李/人數/孩童/口岸/安全/付款/人工/招呼
  - 關鍵字匹配 + 信心評分
- **AI 邏輯**：`app/api/cs/message/route.ts`
  - 高信心 → 直接回覆 FAQ
  - 中信心 → 呼叫 Claude API（若 ARK_API_KEY 已設定）
  - 低信心 / 特定關鍵字 → 升級人工（status → human_needed）
- **API**：
  - `POST /api/cs/message` — 用戶發送
  - `GET /api/cs/conversations` — 取得會話列表
  - `GET /api/cs/conversations/[id]/messages` — 取得訊息
  - `POST /api/admin/cs/reply` — Admin 回覆
  - `GET /api/admin/cs/queue` — Admin 待辦佇列
- **前端**：
  - `components/cs-widget.tsx` — 乘客浮動客服入口（首頁右下角）
  - `/admin/cs` — Admin 後台（左側佇列 + 右側對話）

---

## 🚀 部署步驟

### Step 1：執行 SQL（必要）
到 **Supabase Dashboard → SQL Editor**，依序執行：

1. `supabase/migrations/20260930_pricing_and_locations.sql`（建表 + RPC）
2. `supabase/seed_locations_and_pricing.sql`（內建 POI + 行情價）
3. `supabase/migrations/20260930_order_messages.sql`（即時訊息）
4. `supabase/migrations/20260930_cs_conversations.sql`（客服）

### Step 2：環境變數（建議）
`.env.local`：
```
INTERNAL_API_SECRET=...
INTERNAL_MIGRATION_SECRET=...
ARK_API_KEY=...   # 可選；客服 AI 用（沒設則只用 FAQ）
```

### Step 3：部署
```bash
vercel --prod
```

---

## 🧪 測試

```bash
# 端到端測試（含所有新功能）
node scripts/test-new-features.mjs

# 僅地點 + 價格
node scripts/test-pricing-locations.mjs
```

預期結果：全部 25+ 個 assertion 通過。

---

## 📊 結構總覽

| 模組 | API 數 | 元件數 | DB 表/函數數 |
|---|---|---|---|
| 地點搜尋 | 1 | 1 | 1 表 |
| 預估價格 | 1 | 1 | 1 表 + 1 RPC |
| 即時訊息 | 1 | 1 | 1 表 |
| AI 客服 | 4 | 2 | 2 表 |
| **合計** | **7** | **5** | **5 表 + 1 RPC** |

---

## 🎯 使用流程

### 乘客下單（含新功能）
1. 在 `/` 選擇方向（HK→內地 或 內地→HK）
2. **（新）** 點「使用精確地點搜尋 + 系統估算價」
3. **（新）** 搜尋或手動輸入詳細地址（兩端都要）
4. **（新）** 即時看到系統估算價（含夜間加成）
5. 確認 → 跳轉 `/confirm` → 送出訂單
6. 司機接單後，在訂單頁右下角有 💬 即時通訊
7. 全程右下角有 🟢 AI 客服入口（可轉人工）

### 司機接單（含新功能）
1. 在訂單詳情頁看到完整地址（不只區域）
2. 右下角 💬 即時通訊，可與乘客直接對話
3. 看見 `estimated_fare`（系統估算）作為報價參考

### Admin 客服後台
1. 進入 `/admin/cs`
2. 左側看到待回覆佇列（自動 15s polling）
3. 點選會話 → 右側對話框
4. 點「送出」直接回覆用戶
5. 點「關閉會話」結束對話

---

## ⚠️ 注意事項

1. **Migration 必須先執行**，否則 API 會 500
2. **ARK_API_KEY 可選**：沒設定就走純 FAQ fallback（仍可用）
3. **Realtime 必須開啟**：Supabase Dashboard → Database → Replication → 確認 `order_messages` 與 `cs_messages` 都在 publication 中
4. **RLS 已嚴格化**：乘客/司機只能存取自己相關訂單的訊息與會話
5. **舊訂單向後相容**：`pickup_address`/`dropoff_address` 等都是 nullable，舊訂單不受影響