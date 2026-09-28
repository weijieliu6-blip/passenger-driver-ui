# v1 釘釘搶單流程規劃（只規劃、不寫 code）

> 狀態：規劃中
> 範圍：v1 只推「乘客端 + 釘釘搶單（v1 唯一搶單管道）+ 超管後台最小可用」
> 凍結項：司機 app 完整功能、車隊後台、多等級搶單優先級
> 規劃日期：2026-09-27

---

## 1. 流程圖（純文字版）

```
乘客下單（app/page.tsx 表單）
   ↓
POST /api/orders/create
   ├─ 1. 寫入 DB（status=pending、dispatch_deadline_at=now+24h）
   ├─ 2. 呼叫釘釘 webhook → 群裡推播 ActionCard（含「🚗 立即搶單」按鈕）
   └─ 3. 回傳 orderNumber 給前端 → 跳 /order-success?orderNumber=XXX
   ↓
司機在釘釘群看到 ActionCard
   ↓
司機點「🚗 立即搶單」按鈕
   ↓
釘釘 callback → POST /api/dingtalk/grab
（callback URL 由釘釘機器人設定）
   ↓
伺服器驗證：
   ├─ 解析釘釘簽名（簽章驗證）
   ├─ 取得司機 dingtalk_userid
   ├─ 檢查訂單仍 pending（status='pending'）
   └─ UPDATE orders SET status='grabbed', driver_id=..., accepted_at=now()
   ↓
搶單成功：
   ├─ 推播乘客（站內 / SMS / 微信 / 釘釘 — 待 user 決策）
   └─ 回 200 OK 給釘釘（顯示「搶單成功」按鈕回饋）

搶單失敗（已被搶）：
   ├─ 回 409 + 「來晚了，訂單已被搶走」
   └─ 釘釘群按鈕變成「已被搶」灰色狀態
```

---

## 2. 釘釘 ActionCard 卡片模板（給用戶預覽）

```
┌─────────────────────────────────────┐
│ 🚖 新訂單待搶單                      │
│                                     │
│ 路線：汕尾 → 香港                    │
│ 時間：2026-09-27 14:00              │
│ 車型：7 座埃爾法                     │
│ 乘客：尾號 1547 先生                 │
│                                     │
│ [🚗 立即搶單]   [👀 查看詳情]       │
└─────────────────────────────────────┘
```

**ActionCard 欄位設計（JSON）**

```json
{
  "msgtype": "actionCard",
  "actionCard": {
    "title": "🚖 新訂單待搶單",
    "text": "### 🚖 新訂單待搶單\n\n"
           + "**路線**：汕尾 → 香港\n\n"
           + "**時間**：2026-09-27 14:00\n\n"
           + "**車型**：7 座埃爾法\n\n"
           + "**乘客**：尾號 1547 先生\n\n"
           + "**訂單號**：ORD20260927001",
    "btnOrientation": "0",
    "btns": [
      {
        "title": "🚗 立即搶單",
        "actionURL": "https://your-domain.com/dingtalk/grab?orderNumber=ORD20260927001&token=xxx"
      },
      {
        "title": "👀 查看詳情",
        "actionURL": "https://your-domain.com/dingtalk/preview?orderNumber=ORD20260927001"
      }
    ]
  }
}
```

點擊「立即搶單」會走 `actionURL`（網址，不是 callback），這個網址在我們 server 端做：
- 驗證 token
- 確認訂單仍 pending
- 寫入 `accepted_at`、`grabbed_at`、driver_id
- 重導到「搶單成功頁」（給司機看乘客電話 / 上車地點）

> **備註**：釘釘機器人 callback 通常用在「互動式對話」場景；搶單用 URL 是更穩定的做法（避免 callback 失敗）。

---

## 3. 雙搶防呆機制

### 3.1 問題
兩個司機同時點「立即搶單」按鈕 → 必須只有一個成功。

### 3.2 解法
| 機制 | 說明 |
|---|---|
| **DB transaction + `SELECT ... FOR UPDATE`** | 進 transaction 後鎖定該 `orders` row，其他 transaction 阻塞直到 commit |
| **狀態唯一約束檢查** | `WHERE status = 'pending'` 是更新條件的一部分；若已被搶則影響 0 行 |
| **orders 表欄位補齊** | `accepted_by_driver_id`（FK to users）、`accepted_at`（已加）、`dispatch_deadline_at`（已加） |
| **callback 回 409** | 若 `status != 'pending'` 直接回 409 + 「來晚了」訊息 |

### 3.3 流程（搶單 request 進來時）

```sql
BEGIN;
  SELECT * FROM orders WHERE order_number = $1 FOR UPDATE;
  -- 檢查 status
  IF status != 'pending' THEN
    ROLLBACK;
    return 409 '已被搶';
  END IF;
  -- 檢查 dispatch_deadline_at 是否過期
  IF dispatch_deadline_at < now() THEN
    UPDATE orders SET status='expired' WHERE order_number=$1;
    COMMIT;
    return 410 '訂單已逾期';
  END IF;
  -- 更新
  UPDATE orders SET
    status='grabbed',
    driver_id=$2,
    accepted_at=now(),
    grabbed_at=now()
  WHERE order_number=$1;
COMMIT;
return 200;
```

### 3.4 orders 表現有欄位（已加的）
- `dispatch_deadline_at` ✅
- `accepted_at` ✅
- `first_driver_offered_at` ✅

不需要再加欄位。

---

## 4. 實作項目清單（時間預估）

| 項目 | 時間 | 備註 |
|---|---|---|
| 釘釘群 webhook 接收 + ActionCard 推播 | 0.5 天 | `lib/dingtalk.ts` 已存在，需擴充 ActionCard 支援 + 「🚗 立即搶單」按鈕 URL 組裝 |
| 搶單 callback API + 雙搶防呆 | 0.5 天 | 新增 `POST /api/dingtalk/grab`，FOR UPDATE 鎖 row |
| 乘客端訂單狀態輪詢 / SSE | 1 天 | 30 秒輪詢 `/api/orders/[orderNumber]`；或用 SSE（Server-Sent Events）即時推送 |
| 釘釘群 ↔ supabase user 綁定 | 1 天 | 司機進群後 @機器人「註冊 +852-9123-4567」→ 比對 supabase `users.phone` → 寫入 `driver_dingtalk_id` |
| 乘客端「釘釘搶單即將開始」提示 | 0.5 天 | 在訂單成功頁 + OrderWaitCard 顯示「司機透過釘釘搶單」 |
| mock 環境（讓用戶先看效果） | 0.5 天 | 假釘釘推播畫面（截圖 / HTML 預覽），不需真實 webhook |
| **合計** | **~4 天** | 含 mock |

---

## 5. 待用戶決策的關鍵問題（6 題）

> **請逐題回答**，每題有 A/B/C 可選或填寫備註

### Q1：釘釘群 webhook 設置方式
- [ ] **A**：用戶自己去釘釘群加「自訂機器人」，把 webhook URL 給我們
- [ ] **B**：先用 mock 環境測試，webhook 之後再接
- [ ] **C**：用既有 `DINGTALK_WEBHOOK_URL`（已在 `.env.local`）直接推播

### Q2：司機進群方式
- [ ] **A**：管理員手動一個個邀請進群（簡單，但慢）
- [ ] **B**：司機掃 QR Code 進群（推薦，UX 好）
- [ ] **C**：後台匯入電話 → 系統批量發邀請（複雜，自動化）

### Q3：搶單後聯繫乘客方式
- [ ] **A**：司機自己撥電話（簡單，v1 推薦）
- [ ] **B**：平台代撥（隱私好但需要客服）
- [ ] **C**：SMS 推 6 碼驗證碼給乘客，再由司機撥打驗證

### Q4：搶單順序
- [ ] **A**：先搶先得（最簡單，v1 推薦）
- [ ] **B**：依司機等級（金牌 > 銀牌 > 鑽石）— v2 再做
- [ ] **C**：依距離 / 歷史完成率 — v3 再做

### Q5：多個釘釘群
- [ ] **A**：只一個總群（v1 推薦）
- [ ] **B**：依地區分群（汕尾群 / 深圳群）
- [ ] **C**：依車型分群（埃爾法群 / 商務群）

### Q6：要不要做 mock 預覽
- [ ] **A**：先做一個「假釘釘推播畫面」（HTML 截圖）讓用戶看卡片長相（+0.5 天）
- [ ] **B**：不用 mock，直接接真 webhook 測試

---

## 6. 不會做（v1 凍結）

- ❌ 司機 app 完整功能（搶單 UI / 訂單管理 / 排班）
- ❌ 車隊後台（多司機管理）
- ❌ 多等級搶單優先級（先搶先得就好）
- ❌ 自動派單 AI
- ❌ 乘客端 SSE 即時推播（v1 用 30s 輪詢就夠）

---

## 7. 風險

1. **釘釘 webhook 簽名驗證**：若 webhook URL 洩漏會被任意推播，需要做 HMAC 簽章驗證
2. **搶單 race condition**：必須用 `SELECT FOR UPDATE`，純 `WHERE status='pending'` 不夠安全
3. **Supabase 連線限制**：每分鐘 60 次寫入上限 → 搶單 callback 需在 transaction 內，避免 lock 過久
4. **釘釘按鈕 URL 過期**：token 是訂單的 grab_token，需要 24h 過期機制（已有）
5. **司機搶錯單**：UI 沒搶單確認頁，司機點下去就搶了；建議加「確認搶單」中間頁

---

## 8. 交付建議

v1 建議這樣排：
- **第 1 天**：Q1/Q3/Q4/Q6 確認後，先做「mock 預覽」給用戶看卡片樣式
- **第 2 天**：搶單 callback API + 雙搶防呆
- **第 3 天**：訂單狀態輪詢 + 「釘釘搶單」提示
- **第 4 天**：整合測試（mock webhook → 模擬兩個司機搶單 → 驗證 409）

---

## 9. 附：現有資源盤點

| 已存在 | 用途 |
|---|---|
| `lib/dingtalk.ts` | 釘釘 webhook 推播（文字訊息） |
| `.env.local` 的 `DINGTALK_WEBHOOK_URL` | 釘釘機器人 URL |
| `app/api/orders/create/route.ts` | 訂單建立（已呼叫 `sendDingTalkNotification`） |
| `app/api/orders/[orderNumber]/route.ts` | 訂單查詢（乘客輪詢用） |
| `app/api/grab/[token]/route.ts` | 司機 grab token 搶單（既有；可保留作為備援） |
| `orders` 表 | 已加 `dispatch_deadline_at` / `accepted_at` / `first_driver_offered_at` |
| `announcements` 表 | 跑馬燈公告（含 kind enum） |

需要新加：
- `app/api/dingtalk/grab/route.ts`（搶單 callback）
- `app/dingtalk/grab/page.tsx`（搶單中間確認頁）
- `app/admin/page.tsx`（超管後台最小可用：訂單列表）
- `app/admin/api/orders/route.ts`（超管訂單列表 API）

---

## 10. 等 user 回覆

請用戶回覆 Q1-Q6 即可開始實作；或先回 Q1/Q3/Q4（最關鍵）也行。
