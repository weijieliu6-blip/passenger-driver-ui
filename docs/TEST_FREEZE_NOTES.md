# 測試凍結備註 — driver-features

> 建立日期：2026-09-27

## 凍結原因

v1 產品決定**不走司機 app**。司機搶單流程（v1）改走**釘釘群機器人**推播搶單連結，司機端 Web/App 暫不推出。原本針對司機 app 撰寫的 E2E 測試腳本 `test-driver-features.mjs` 因此失去驗證對象，**整份凍結**，不再花時間修到全綠。

參考計畫：`docs/V1_DINGTALK_GRAB_PLAN.md`。

## 已知失敗概況（凍結當下 baseline）

執行 `node test-driver-features.mjs` 結果：

- **Pass：2**（安慰性通過：「cleared existing schedules」、「grab while offline → not 200」）
- **Fail：31**（幾乎全部 401 unauthorized，連鎖自登入失敗；主因是當前 Supabase 專案 `vuuamydahzhpajjdvokl.supabase.co` 在本機 DNS 解析不到，`signInWithPassword` 內部 `fetch failed`，被 route 統一包成 401「電郵或密碼錯誤」丟回客戶端）

完整 baseline 截錄見 `docs/TEST_FREEZE_NOTES.md.baseline.txt`（同 commit 一起產出）。

> 註：即便把 Supabase 連線修好，這份腳本也是過時的——它驗證的是 driver-app 的 REST endpoints，而那些 endpoints 在 v1 都不會被用到。

## 解凍條件（任一觸發即應回來修）

1. **司機 app v2 啟動**：當客單量穩定、公司決定投入司機端原生/Web app v2 開發
2. **v1 釘釘搶單失敗率過高**：需要 driver-app 補上自助後台（例如改單、改價、查看歷史訂單）
3. **司機後台需求浮現**：客服/司機要求查訂單、改 schedule、看營收報表 → 重啟 driver-app 開發
4. **任何「需要 driver API」的功能上線**

## 解凍後要做的事（提醒）

1. 確認 Supabase 專案存活（DNS 解析得到 + service role key 有效）
2. 重跑 `supabase/migrations/*.sql` 並重建測試司機（gold/platinum/normal/none 四個）
3. 把 `test-driver-features.mjs` 開頭的凍結註解移除
4. 跑一次 baseline，預期從 2/33 開始往 25+/33 修
5. 重新評估 endpoint 契約是否還符合 driver-app v2 的設計

## 不要做的事（凍結期間）

- ❌ 不要修 driver-app 的代碼讓測試變綠
- ❌ 不要動測試司機的 SQL（即使看起來「不對」）
- ❌ 不要繞過測試（mock supabase、跳過 login）
- ❌ 不要重構 driver-app 整個 auth 系統
- ❌ 不要刪除/移動這份腳本（保留作為未來 driver app v2 的起點）

## 變更紀錄

- 2026-09-27：凍結。`test-driver-features.mjs` 開頭加凍結註解；baseline 截錄存檔（`docs/TEST_FREEZE_NOTES.md.baseline.txt`）。
