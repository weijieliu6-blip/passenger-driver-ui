# 🔍 正式上線後監控清單

> 從 deploy 完成那天起，該看什麼、什麼時候看、出了事怎麼辦
> 適用：Vercel + Supabase + 釘釘搶單架構

---

## 🚨 L1 — 必看（5 分鐘內處理）

### 每小時檢查（第一週每天，之後每 4 小時）

#### [ ] 1.1 Vercel Function 是否正常回應
**工具**：https://vercel.com/dashboard
**看什麼**：
- Functions tab → Error rate
- 若 > 1% error rate → 🚨

**怎麼做**：
1. 點進最新失敗的 function
2. 看 Logs tab
3. 找錯誤訊息

#### [ ] 1.2 Supabase 連線是否正常
**工具**：Supabase Dashboard → Logs
**看什麼**：
- API logs → 4xx/5xx 數量
- Database logs → connection errors
- Auth logs → login failures

#### [ ] 1.3 釘釘推播是否送達
**工具**：你的釘釘群
**看什麼**：
- 過去 1 小時有沒有新訂單推播
- 若完全沒收到 → 推播 API 可能壞了

---

## 📊 L2 — 重要（24 小時內處理）

### 每天早上檢查（9:00 AM）

#### [ ] 2.1 訂單成功率
**工具**：Supabase SQL Editor
**SQL**：
```sql
SELECT
  DATE_TRUNC('day', created_at) AS day,
  COUNT(*) FILTER (WHERE status = 'pending') AS pending,
  COUNT(*) FILTER (WHERE status = 'grabbed') AS grabbed,
  COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled,
  COUNT(*) FILTER (WHERE status = 'completed') AS completed,
  ROUND(100.0 * COUNT(*) FILTER (WHERE status IN ('grabbed','completed')) / NULLIF(COUNT(*), 0), 1) AS grab_rate_pct
FROM orders
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY day
ORDER BY day DESC;
```
**判斷**：
- grab_rate > 30% ✅ 正常
- grab_rate 10-30% ⚠️ 觀察
- grab_rate < 10% 🚨 推播或搶單有問題

#### [ ] 2.2 司機活躍數
**SQL**：
```sql
SELECT COUNT(DISTINCT driver_id) AS active_drivers_today
FROM orders
WHERE grabbed_at > NOW() - INTERVAL '24 hours';
```
**判斷**：
- > 3 位 ✅
- 1-3 位 ⚠️ 司機太少，可能要招募
- 0 位 🚨 沒人搶單

#### [ ] 2.3 推播成功率
**工具**：Vercel Function Logs → `/api/dingtalk/push`
**看什麼**：
- 過去 24 小時的 response code 分布
- 200 比例應該 > 95%
- 失敗原因：webhook URL 過期 / secret 錯 / 釘釘伺服器掛了

#### [ ] 2.4 訂單數趨勢
**SQL**：
```sql
SELECT DATE_TRUNC('day', created_at) AS day, COUNT(*) AS orders
FROM orders
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY day
ORDER BY day DESC;
```
**判斷**：
- 跟昨日比、跟上週同日比
- 跌幅 > 50% 🚨 客戶流失或下單流程壞了

---

### 每週一早上檢查（9:00 AM）

#### [ ] 2.5 推播到搶單平均時間
**SQL**：
```sql
SELECT
  AVG(EXTRACT(EPOCH FROM (grabbed_at - created_at))) AS avg_grab_seconds,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (grabbed_at - created_at))) AS median_grab_seconds,
  PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (grabbed_at - created_at))) AS p90_grab_seconds
FROM orders
WHERE created_at > NOW() - INTERVAL '7 days'
  AND grabbed_at IS NOT NULL;
```
**判斷**：
- p90 < 60 秒 ✅ 司機反應快
- p90 > 300 秒 ⚠️ 推播延遲或司機不夠

#### [ ] 2.6 取消率
**SQL**：
```sql
SELECT
  COUNT(*) FILTER (WHERE cancelled_at IS NOT NULL) AS cancelled,
  COUNT(*) AS total,
  ROUND(100.0 * COUNT(*) FILTER (WHERE cancelled_at IS NOT NULL) / NULLIF(COUNT(*), 0), 1) AS cancel_rate_pct
FROM orders
WHERE created_at > NOW() - INTERVAL '7 days';
```
**判斷**：
- cancel_rate < 10% ✅
- cancel_rate 10-20% ⚠️
- cancel_rate > 20% 🚨（可能是乘客找不到車，或系統問題）

#### [ ] 2.7 Vercel 用量
**工具**：https://vercel.com/dashboard → Usage
**看什麼**：
- Bandwidth（頻寬）
- Function invocations（API 呼叫次數）
- Edge requests
**判斷**：
- Hobby 額度：100 GB 頻寬 / 月
- 若用 80%（80 GB）⚠️ 考慮升級 Pro 或加 Cloudflare CDN

#### [ ] 2.8 Supabase 用量
**工具**：Supabase Dashboard → Settings → Usage
**看什麼**：
- Database size
- Storage
- Bandwidth
- Monthly active users
**判斷**：
- Free 額度：500 MB DB / 1 GB storage / 2 GB 頻寬
- 若快用完 ⚠️ 升級 Pro 或清理舊資料

---

## 💡 L3 — Nice-to-have（每月/有空再看）

### 每月 1 號檢查

#### [ ] 3.1 清理測試訂單
**SQL**：
```sql
-- 先看有多少測試訂單
SELECT COUNT(*) FROM orders WHERE phone LIKE '+8520000%' OR phone LIKE 'test%';

-- 若確認都是測試，刪除（謹慎）
DELETE FROM orders WHERE phone LIKE '+8520000%' AND created_at < NOW() - INTERVAL '30 days';
```
**判斷**：超過 30 天的測試資料可清

#### [ ] 3.2 檢查資料庫索引
**SQL**：
```sql
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan ASC;
```
**看什麼**：長期沒被用到的 index（idx_scan = 0）可考慮刪除以省空間

#### [ ] 3.3 更新依賴
```bash
npm outdated
npm update --save
npm audit
```
**判斷**：有 critical security update 要立刻更新

#### [ ] 3.4 備份驗證
**Supabase**：Dashboard → Database → Backups
- Free 方案只有 7 天 backup
- 若資料重要，升級 Pro 或自己寫 cron 匯出

#### [ ] 3.5 域名續費日提醒
**看什麼**：網域到期日（建議設行事曆提醒 30 天前）

---

## 🚨 緊急處理 SOP

### 情境 1：網站完全打不開
1. 開 https://你的網域.com 看錯誤訊息
2. 開 Vercel Dashboard 看 Deployments 狀態
3. 若最新 deploy 失敗 → Revert to previous deployment
4. 若 DNS 問題 → 查 https://dnschecker.org

### 情境 2：可以下單但司機收不到推播
1. 開 Vercel Logs → `/api/dingtalk/push`
2. 看 webhook response code
3. 若 400 → 檢查 token / secret
4. 若 403 → 釘釘 IP 白名單問題
5. 備用方案：手動通知司機（電話/WhatsApp 群）

### 情境 3：搶單 API 回 500
1. Vercel Logs → `/api/orders/[orderNumber]/grab`
2. 看錯誤堆疊
3. 常見：Supabase RLS 政策 / transaction 死鎖 / token 過期
4. 緊急：暫時把 API 改 force-dynamic 並重 deploy

### 情境 4：Supabase 連不上
1. Supabase Status: https://status.supabase.com
2. 若是他們掛了，等他們修
3. 若是你的 quota 用完，升級或清理

### 情境 5：司機投訴搶不到單（雙搶問題）
1. 查 `orders` 表 `grab_token` 是否唯一
2. 查 transactions 是否有 race condition
3. 緊急：暫停推播，手動指派

---

## 📊 監控儀表板建議

把以下 4 個加到書籤：
1. **Vercel Dashboard**：https://vercel.com/dashboard
2. **Supabase Dashboard**：https://supabase.com/dashboard
3. **Supabase SQL Editor**：常用查詢存這
4. **DNS Checker**：https://dnschecker.org

可考慮接免費監控：
- **UptimeRobot**（網站掛了通知你）
- **Sentry**（前端錯誤追蹤）
- **LogRocket**（使用者行為錄影）

---

## 📝 更新紀錄

- 2026-09-28：初版（deploy 前）
