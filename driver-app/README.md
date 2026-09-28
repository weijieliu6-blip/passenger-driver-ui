# 司機管理後台 (Driver Console)

獨立的司機管理網頁，運行在 **port 3001**，與乘客端 (port 3000) 完全分離。

## 功能

- 司機登入 / 註冊（電郵 / 香港手機 / 內地手機）
- 司機中心（查看進行中訂單）
- 訂單詳情 + 報價（同步給乘客）
- 搶單頁面（從釘釘鏈接進入）
- 個人資料（車牌、車型等）

## 啟動

```bash
cd driver-app
npm install
npm run dev
```

啟動後訪問 `http://localhost:3001`

## 與乘客端的關係

| 端 | Port | 入口 |
|---|------|------|
| 乘客端 | 3000 | `http://localhost:3000` |
| 司機端 | 3001 | `http://localhost:3001` |

兩端共享 Supabase 數據庫，但前端代碼完全分離，修改司機端不會影響乘客端。

## 數據流

```
乘客下單 → Supabase orders 表 → 釘釘推送（含 3001 搶單鏈接）
→ 司機點擊鏈接 → http://localhost:3001/grab/[token]
→ 登入 → 搶單 → 報價 → 寫回 orders 表
→ 乘客端查詢看到已確認價格
```

## 環境變量

複製 `.env.local` 並填入 Supabase 配置（已預填，可直接使用）。
