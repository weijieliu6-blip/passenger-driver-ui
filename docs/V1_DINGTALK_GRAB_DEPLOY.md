# v1 釘釘搶單 — 部署說明

> 對象：營運 / 後端
> 版本：v1（2026-09-27）
> 範圍：釘釘群推播 + H5 註冊搶單頁 + 後台最小版

---

## 1. 環境變數（補到 `.env.local`）

```env
# 已在 .env.local 的（不要動）
NEXT_PUBLIC_SUPABASE_URL=https://vuuamydahzhpajjdvokl.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
DINGTALK_WEBHOOK_URL=https://oapi.dingtalk.com/robot/send?access_token=2636db90898a49fb2e7da29d1b642564473a65da40471cdd68c986c12eb68ec6
DINGTALK_SECRET=SECca918ddf91049c4f55a35fad0fb8af1eab3ef390cc112e6422f2050c75c34a7b
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# 新增
NEXT_PUBLIC_DRIVER_SITE_URL=http://localhost:3000  # 與 SITE_URL 相同即可（H5 搶單頁在同一站）
INTERNAL_API_SECRET=<隨機長字串>                  # 用於 /api/dingtalk/push 內部端點
```

> `NEXT_PUBLIC_DRIVER_SITE_URL` 是 H5 搶單頁的對外網址；如果 driver-app 跟主站不同網域，把這裡改成 driver-app 的網址。

---

## 2. Supabase Migration

到 Supabase 控制台 → SQL Editor → 貼上以下檔案並執行：

- `supabase/migrations/20260927_v1_dingtalk_grab.sql`

做的事：
1. 建 `drivers` 表（司機池：dingtalk_staff_id / 車牌 / 車型 / 駕齡 / 座位 / 統計）
2. `orders` 表補 `grabbed_by_driver_id`、`dingtalk_pushed_at` 兩個欄位
3. 啟用 drivers RLS（公開可查、admin 可寫）

---

## 3. 釘釘群設定（用戶已有 → 跳過）

> 如果用戶之前的群已能用，這步可跳過。

新增群機器人：
1. 進入目標釘釘群 → 群設定 → 智能群助手 → 添加機器人 → 自定義
2. 安全設定：勾選「加簽」（強烈建議）→ 複製 SEC 開頭的 secret → 填到 `DINGTALK_SECRET`
3. 勾選同意 → 複製 webhook URL（含 access_token）→ 填到 `DINGTALK_WEBHOOK_URL`

> ⚠️ 自定義機器人默認只能發 text / link / markdown / actionCard 等幾種訊息類型。我們用的是 **actionCard**（含按鈕），符合官方支援。

---

## 4. 流程

### 乘客下單
1. 乘客填單 → `POST /api/orders/create`
2. 後端寫入 `orders.status='pending'`、`grab_token=xxx`
3. 後端呼叫 `pushOrderActionCard()` 推到釘釘群（包含「🚗 立即搶單」按鈕，按鈕連結 `https://<NEXT_PUBLIC_DRIVER_SITE_URL>/driver/grab/{token}`）
4. 訂單頁 `/order/[orderNumber]` 開始 30 秒輪詢 `/api/orders/[orderNumber]/status`

### 司機從釘釘點擊
1. 點按鈕 → 開啟 H5 `/driver/grab/[token]?staff_id=xxx`（釘釘會自動帶上 userId）
2. 首次訪問 → 顯示 6 欄位註冊表單
3. 已註冊 → 顯示「🚗 確認搶單」按鈕
4. 點擊 → `POST /api/driver/grab/[token]` → 原子搶單（`UPDATE WHERE status='pending'`）
5. 成功 → 顯示乘客聯繫方式

### 乘客端感知
- 訂單頁每 30 秒打 `/api/orders/[orderNumber]/status`
- 一旦 status 變成 `grabbed`，立刻更新頁面上的司機資訊卡

### 後台
- `/admin/orders` — 訂單列表（含搶單司機、搶單時間）
- `/admin/drivers` — 司機列表（含搶單次數、完成率）

> v1 不做後台登入，admin 直接連得到 `/admin/*` 就能看。

---

## 5. 驗證清單

- [ ] `npx tsc --noEmit` 0 錯
- [ ] `curl /admin/orders` 回 200，看到訂單
- [ ] `curl /admin/drivers` 回 200，看到司機
- [ ] `curl /driver/grab/<token>` 回 200（首屏顯示訂單詳情）
- [ ] 填表單 POST → DB drivers 表多一筆
- [ ] 再 POST → DB orders.status='grabbed'
- [ ] 併發 2 個 POST → 只有 1 個成功
- [ ] 釘釘群收到 ActionCard，按按鈕可進入搶單頁

---

## 6. 已知限制（v1 不做）

- 沒有 SMS 驗證（電話未驗證）
- 沒有後台登入
- 沒有車隊、報表、財務
- 沒有司機搶單後的「報價確認」流程（沿用既有 `/driver/orders/[orderNumber]` 流程）
- 沒有 SSE，30 秒輪詢

---

## 7. 後續 TODO

- [ ] driver-app 若也要看 grab 連結，需要把 `NEXT_PUBLIC_DRIVER_SITE_URL` 改成 driver-app 網域並 deploy 一份
- [ ] 訂單完成 / 取消後，下次搶單計數累加（需要 confirm-price / cancel API 一起更新 `drivers.completed_orders` / `cancelled_orders`）
- [ ] 後台登入（admin role gate）
- [ ] 釘釘 callback 接收「卡片點擊事件」（用於統計點擊率，可選）