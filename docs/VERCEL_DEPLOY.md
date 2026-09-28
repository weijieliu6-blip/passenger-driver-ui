# 港中專車 — Vercel 部署指南

> 把你的 Next.js 程式從 localhost 推到正式網域
> 預計時間：30 分鐘（買網域 5 分鐘 + 部署 5 分鐘 + DNS 等待 30 分鐘）

---

## 0. 你需要準備什麼

| 項目 | 費用 | 哪裡辦 |
|---|---|---|
| 網域（一年） | $10-15 USD | Cloudflare Registrar |
| Vercel 帳號 | 免費 | vercel.com |
| GitHub 帳號 | 免費 | github.com |
| 信用卡（買網域用） | — | 你的卡 |

---

## 1. 買網域（5 分鐘）

### 1.1 到 Cloudflare Registrar 註冊

1. 打開瀏覽器，輸入 https://dash.cloudflare.com/sign-up
2. 點 **「Create Account」**（建立帳戶）
3. 填 Email、密碼，點 **「Create Account」**
4. 去你的 Email 收驗證信，點裡面的連結

### 1.2 搜尋網域

1. 登入 Cloudflare 後，左邊選 **「Domain Registration」**（網域註冊）
2. 點 **「Register Domains」**（註冊網域）
3. 搜尋框打你想的名字，例如 `hk-taxi`、`grabcars`、`sz-sw-taxi` 等
4. 選 `.com` 副檔名（CP值最高，便宜又常見）
5. 看看價格（`.com` 約 $10-15/年），確認後點 **「Add to Cart」** → **「Checkout」**
6. 用信用卡或 PayPal 付款

### 1.3 預期結果

- Cloudflare 左邊欄位會顯示你買的網域（例如 `example.com`）
- 狀態一開始可能是「Pending」，等 1-5 分鐘後變成 **「Active」**（綠色鈎）
- 出現 Active 表示網域已啟用，可以開始設定 DNS

---

## 2. 註冊 Vercel + 連接 GitHub（3 分鐘）

### 2.1 Vercel 註冊

1. 打開 https://vercel.com/signup
2. 選 **「Continue with GitHub」**（用 GitHub 登入最方便）
3. 如果跳出 GitHub 授權視窗，點 **「Authorize」**

### 2.2 把程式碼 push 到 GitHub

如果你的程式碼還沒上 GitHub，先做這步。已上過的可跳過。

打開 **PowerShell** 或 **終端機**，進到你的專案資料夾：

```bash
cd C:\Users\weiji\.cursor\project_prd.md
```

#### 確認 Git 狀態

```bash
git status
```

如果顯示 `nothing to commit, working tree clean` 表示都 commit 了。

如果顯示一堆紅字（modified / untracked），要先 commit：

```bash
git add .
git commit -m "chore: 準備部署到 Vercel"
```

#### 看 remote（看你有沒有設 GitHub remote）

```bash
git remote -v
```

**如果顯示空白的話（沒有 origin）**，代表你還沒綁 GitHub repo，繼續做下面 2.2.1。

**如果顯示有 origin**，例如：
```
origin  https://github.com/你的帳號/你的repo.git (fetch)
origin  https://github.com/你的帳號/你的repo.git (push)
```
代表已連上，可跳到 2.3。

---

#### 2.2.1 第一次建 GitHub repo（還沒有才做）

1. 打開 https://github.com/new
2. **Repository name** 填 `hk-mainland-taxi`（或你喜歡的名字）
3. **Description** 填 `港中跨境專車平台`
4. **不要**勾「Add a README file」（你已有）
5. **不要**勾「Add .gitignore」（你已有）
6. **不要**勾「Choose a license」（不用）
7. 點 **「Create repository」**

#### 2.2.2 在本機加 GitHub remote 並 push

回到終端機，執行這三行（一行一行貼）：

```bash
git remote add origin https://github.com/你的帳號/你的repo.git
git branch -M main
git push -u origin main
```

> ⚠️ 把 `你的帳號` 和 `你的repo` 換成你在 GitHub 建的那個。

### 2.3 預期結果

- GitHub 頁面出現你的程式碼（檔案列表）
- 最上面 commit 的訊息顯示在最上面

---

## 3. 在 Vercel 匯入專案（5 分鐘）

### 3.1 建立新專案

1. 開 https://vercel.com/new
2. Vercel 會列出你的 GitHub repos
3. 找到你剛建的 `hk-mainland-taxi`（或你的 repo 名）
4. 點旁邊的 **「Import」**（匯入）

### 3.2 設定 Build 參數（先不要按 Deploy！）

頁面往下滾，會看到幾個設定：

| 設定項 | 要填什麼 |
|---|---|
| **Framework Preset** | 自動偵測到 `Next.js`，**不要改** |
| **Root Directory** | `./`（保持預設） |
| **Build Command** | `next build`（保持預設） |
| **Output Directory** | `.next`（保持預設） |
| **Install Command** | `npm install`（保持預設） |
| **Node.js Version** | 點開，選 **20.x** 或更高（預設可能是 18，**改成 20**）|

### 3.3 加入環境變數（這步最重要！）

**往下滾**，找到 **「Environment Variables」**，點 **展開**。

點 **「Add New」**（新增），把下面 7 個**一個一個加進去**：

| Name | Value（從 `.env.local` 複製） |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | `https://你的網域.com` |
| `NEXT_PUBLIC_DRIVER_SITE_URL` | `https://你的網域.com` |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://vuuamydahzhpajjdvokl.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGc...`（從 `.env.local` 複製那一長串） |
| `SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIs...`（從 `.env.local`） |
| `DINGTALK_WEBHOOK_URL` | `https://oapi.dingtalk.com/robot/send?access_token=...`（從 `.env.local`） |
| `DINGTALK_SECRET` | `SECca918ddf91049c4f55a35...`（從 `.env.local`） |
| `INTERNAL_API_SECRET` | `05b7eac4490cc61dbb9b3ac2c940d2b9a5f16e894ba309472903a6cd175d5eb6` |

**如何從 `.env.local` 複製**：
1. 用記事本或 VS Code 打開 `C:\Users\weiji\.cursor\project_prd.md\.env.local`
2. 找到 `KEY=VALUE` 那一行
3. 只複製 `=` 後面的部分（Value）
4. 貼到 Vercel 的 Value 欄位

> ⚠️ `NEXT_PUBLIC_SITE_URL` 和 `NEXT_PUBLIC_DRIVER_SITE_URL` 請改成你買的網域，例如 `https://grabcars.com`，**不要**寫 `localhost` 了。

### 3.4 按 Deploy

確認上面都填好後，點頁面最下面的 **「Deploy」**（綠色大按鈕）。

### 3.5 預期結果

- 畫面跳到 build 頁面，Vercel 開始跑 `npm install` + `next build`
- 終端機視窗會滾動 build log（你不用讀內容）
- ⏱ 等 **1-3 分鐘**
- **成功**：出現 🎉 + 你的暫時網址（格式是 `hk-mainland-taxi.vercel.app`）
- **失敗**：看第七章 Troubleshooting

---

## 4. 綁定正式網域（5 分鐘）

### 4.1 在 Vercel 加入網域

1. 點進你的專案頁面
2. 點 **Settings**（設定）
3. 左邊找到 **Domains**
4. 在輸入框打 `你的網域.com`（例如 `grabcars.com`）
5. 點 **「Add」**

### 4.2 Vercel 給的 DNS 設定

Vercel 會顯示需要加的 DNS 記錄，長這樣：

| Type | Name | Value |
|---|---|---|
| **A** | `@` | `76.76.21.21` |
| **CNAME** | `www` | `cname.vercel-dns.com` |

> 把這張表記下來（或截圖），下一個步驟要用。

### 4.3 到 Cloudflare 加 DNS 記錄

1. 打開 https://dash.cloudflare.com
2. 點你的網域
3. 左邊選 **「DNS」** → **「Records」**
4. 點 **「Add record」**，加第一條：
   - **Type**: 選 `A`
   - **Name**: 填 `@`
   - **IPv4 address**: 填 `76.76.21.21`
5. 再點 **「Add record」**，加第二條：
   - **Type**: 選 `CNAME`
   - **Name**: 填 `www`
   - **Target**: 填 `cname.vercel-dns.com`
6. **重要**：找到那兩條記錄，確認 **雲朵圖示是灰色**（不是橘色）！
   - 灰色 = Proxy 關閉 ✅
   - 橘色 = Proxy 開啟，會干擾 Vercel SSL ❌

### 4.4 等 DNS 生效

- 通常 5-30 分鐘
- 最長 48 小時（很少見）
- 回到 Vercel Domains 頁面，如果看到 **✅ Verified**（綠色），表示成功
- 這時候你打 `https://你的網域.com` 就能開到你的網站了！

---

## 5. 更新釘釘 webhook 接收網域（5 分鐘）

> 只有在你有用「釘釘機器人接收訂單推播」功能才需要做這步

1. 打開釘釘電腦版，進你的群組
2. 右上角點 **「群設定」**
3. 找到 **「智能群助手」**
4. 找到你的機器人（之前加的那個釘釘機器人）
5. 點 **「編輯」**
6. 把「消息接收 URL」改成：
   ```
   https://你的網域.com/api/dingtalk/push
   ```
7. 儲存

---

## 6. 上線驗證清單

做完上面 1-5 步驟後，依序檢查：

### 6.1 首頁能開
- 打開 `https://你的網域.com`
- ✅ 應該看到你的乘客下單頁（深色背景那個）

### 6.2 API 有回應
在 PowerShell 跑：
```bash
curl -I https://你的網域.com/api/orders/create
```
- ✅ 預期：`HTTP/2 405`（表示 server 有運作，只是 GET 方法不支援這個 API）

### 6.3 整個下單流程（選做）

1. 在 `https://你的網域.com` 填一筆測試訂單
2. 去釘釘群看有沒有收到推播（應有搶單連結）
3. 點連結，開 `https://你的網域.com/driver/grab/xxx`
4. 嘗試搶單，看有沒有成功

### 6.4 後台能進（選做）
- 開 `https://你的網域.com/admin/orders`
- ✅ 應能看到訂單列表

---

## 7. Troubleshooting

### Build 失敗：TypeScript 錯誤

**錯誤長這樣**：
```
app/page.tsx(789,81): error TS2339: Property 'disabled' does not exist on type ...
driver-app/app/api/driver/available-orders/route.ts(4,34): error TS2307: Cannot find module '@/lib/schedule-utils'
```

**原因**：程式碼還有 TypeScript 類型問題，需要先修。

**修法**：
1. 在 VS Code 開啟專案
2. 找到出錯的檔案，按提示修
3. 修完後 commit + push：
   ```bash
   git add .
   git commit -m "fix: 修 TS 類型錯誤"
   git push
   ```
4. Vercel 會自動偵測 push，自動重新 build

### Build 失敗：模組找不到（例如 `@/lib/schedule-utils`）

**原因**：driver-app 是獨立的子專案，它的 `@/` alias 指向錯誤的根目錄。

**修法**：
1. 把 `driver-app/` 資料夾從 `tsconfig.json` 的 `include` 移除
2. 或在 driver-app 裡設定 `.vercelignore` 排除

### 網域一直未生效

1. 打開 https://dnschecker.org
2. 輸入你的網域
3. 確認有出現 `76.76.21.21` 和 `cname.vercel-dns.com`
4. 確認 Cloudflare 那兩條記錄的雲朵是 **灰色**
5. 等滿 30 分鐘再說

### 環境變數改完沒生效

Vercel 的環境變數改完**不會自動觸發重新 build**。

**修法**：
1. 進 Vercel → 你的專案 → **Deployments**
2. 找到最新一筆部署
3. 右上角點 **「⋯」**（三個點）
4. 點 **「Redeploy」**

### 釘釘 webhook 沒收到推播

1. 進 Vercel → 專案 → **Logs**（日誌）
2. 找 `/api/dingtalk/push` 的請求，看有沒有錯誤
3. 確認釘釘機器人的「消息接收 URL」已改成新網域
4. 確認釘釘群還在（群被刪了就失效）

---

## 8. 之後怎麼更新程式

每當你改完程式碼並 commit：

```bash
git add .
git commit -m "feat: 你的改動描述"
git push
```

Vercel 會**自動**偵測 GitHub 有新 push，自動跑 `npm install` + `next build` + 部署。

你只需要：
- 看 Vercel dashboard 有沒有變綠色 ✅
- 打你的網址確認有更新

---

## 9. 費用總結

| 項目 | 費用 |
|---|---|
| 網域（一年，`.com`） | $10-15 USD |
| Vercel Hobby 方案 | 免費 |
| SSL 憑證 | 免費（Vercel 自動幫你搞定） |
| Cloudflare DNS | 免費 |
| **第一年總計** | **$10-15 USD** |
| 之後每年 | $10-15 USD（網域續費） |

---

## 附錄：本機 Build 驗證指令

如果你想先在本機確認 production build 沒問題，可以跑：

```bash
cd C:\Users\weiji\.cursor\project_prd.md
npm run build
```

成功徵兆：
- 出現 `✓ Compiled successfully`
- `✓ Collecting page data`（多個 route）
- `✓ Generating static pages`（數字 > 0）

失敗徵兆：
- `Failed to type check`：代表有 TypeScript 錯誤，需先修（見第 7 章）
- `Error: Cannot find module`：代表缺某個檔案

---

> 📌 **提示**：這個部署只包含主網站（`app/`）。如果你也想部署司機端 App（`driver-app/`），需要另外建立一個 Vercel 專案，設定 root directory 為 `driver-app`，並且要另外修好 `@/lib/schedule-utils` 等路徑問題。
