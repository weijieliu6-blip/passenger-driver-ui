# 🚖 港中專車 / HK ⇄ Mainland Taxi Booking Platform

> 跨境專車預約系統 — Next.js + Supabase + 釘釘搶單
> Cross-border taxi booking — Next.js + Supabase + DingTalk grab

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Next.js](https://img.shields.io/badge/Next.js-16.3-black)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-149eca)](https://react.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-green)](https://supabase.com/)
[![Deploy: Vercel](https://img.shields.io/badge/Deploy-Vercel-black)](https://vercel.com/)
[![Status: MVP](https://img.shields.io/badge/Status-MVP-orange)]()

---

## 📖 專案簡介 / Overview

中文：
香港 ↔ 內地跨境專車預約系統。乘客透過 web 下單，系統自動推播到釘釘司機群，司機透過搶單連結搶單，全程行動裝置友善。

English：
A cross-border (Hong Kong ⇄ Mainland China) taxi booking platform. Passengers place orders via web, the system auto-pushes them to a DingTalk driver group, and drivers claim orders through a one-tap grab link. Fully mobile-friendly.

**核心特點 / Highlights**

- 🚫 **零抽成撮合** — 平台不抽成，乘客線下結算 / Zero commission — passengers pay drivers directly
- 📲 **釘釘搶單流程** — 訂單即時推播、token 防呆 / DingTalk push with token-based dedup
- 🛡️ **雙搶防護** — transactional update，防止並發搶單 / Race-condition safe (atomic updates)
- 🔐 **多端登入** — Supabase Auth + WeChat OAuth + 手機驗證 / Multi-method auth (email / phone / WeChat)

**目標用戶 / Target Users**

- 🧑‍💼 乘客（一般旅客、跨境上班族）/ Passengers (travelers, cross-border commuters)
- 👨‍✈️ 司機（持有跨境牌照的 7 座/8 座師傅）/ Drivers with cross-border permits

[Screenshot: Passenger order page]
[Screenshot: Driver grab page]
[Screenshot: DingTalk push notification]

---

## ✨ 功能 / Features

| 功能 | Feature |
|---|---|
| 乘客下單（雙向 / 多地點 / 多車型） | Passenger booking (HK ⇄ Mainland, multi-region, multi-vehicle) |
| 自動推播到釘釘司機群 | Auto-push to DingTalk driver group |
| 司機搶單（含 token 防呆） | Driver grab with unique token |
| 雙搶防護（transactional update） | Double-grab protection (atomic DB update) |
| 訂單狀態追蹤（pending / grabbed / completed / cancelled） | Order status tracking |
| 司機排班管理 | Driver schedule management |
| 跑馬燈廣告（乘客端首頁） | Passenger marquee announcements |
| 司機後台數據儀表板 | Driver dashboard & reports |
| 微信註冊 / 手機 OTP / Email 登入 | WeChat registration / Phone OTP / Email login |
| 多語系介面（中 / 英） | Multi-language UI (zh / en) |
| 訂單評分與再預約 | Order rating & rebook |

---

## 🚀 快速啟動 / Quick Start

### 前置需求 / Prerequisites

- Node.js 20.x 或更高 / Node.js 20.x or higher
- 一個 Supabase 帳號 / A Supabase account (free tier works)
- 釘釘機器人 webhook（選用 — 不配置也能跑 dev）/ DingTalk bot webhook (optional for dev)

### 5 步啟動 / 5 Steps

```bash
# 1. 複製專案 / Clone
git clone https://github.com/你的帳號/hk-mainland-taxi.git
cd hk-mainland-taxi

# 2. 安裝依賴 / Install
npm install

# 3. 設環境變數 / Set env
cp .env.example .env.local
# 編輯 .env.local 填入你的值（見下方「環境變數」）
# Edit .env.local with your values (see "Environment Variables" below)

# 4. 跑 migration（用 Supabase SQL Editor 或 CLI）
# Apply migrations in supabase/migrations/ to your Supabase project
#   supabase db push                  # (if using Supabase CLI)
#   或在 Supabase Dashboard → SQL Editor 依序執行 sql 檔

# 5. 啟動 dev server / Start dev
npm run dev
# 開 http://localhost:3000
```

完整 Supabase 設定見 / Full Supabase setup: **[docs/SUPABASE_SETUP.md](./docs/SUPABASE_SETUP.md)**
完整釘釘推送設定見 / DingTalk setup: **[docs/DINGTALK_SETUP.md](./docs/DINGTALK_SETUP.md)**

---

## 🔑 環境變數 / Environment Variables

下列變數定義於 `.env.example`，複製為 `.env.local` 後填入。

| 變數 / Var | 必填 / Required | 說明 / Description |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | ✅ | 乘客端網域（用於搶單連結產生）/ Passenger site base URL |
| `NEXT_PUBLIC_DRIVER_SITE_URL` | ✅ | 司機端網域（搶單按鈕指向）/ Driver site base URL |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase 專案 URL / Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase anon key（公開可暴露）/ Supabase anon key (public) |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Supabase service role key（**機密，僅 server 使用**）/ Supabase service role key (**server-only secret**) |
| `DINGTALK_WEBHOOK_URL` | ⬜ 選用 | 釘釘機器人 webhook（含 `access_token`）/ DingTalk bot webhook |
| `DINGTALK_SECRET` | ⬜ 選用 | 釘釘加簽 secret（若機器人開了加簽才需要）/ DingTalk sign secret (only if signing is enabled) |
| `INTERNAL_API_SECRET` | ✅ | 內部 API 呼叫 secret（建議 64 字元隨機）/ Internal API secret (64+ random chars recommended) |
| `WECHAT_WEBHOOK_URL` | ⬜ 選用 | 企業微信 webhook（舊版相容，可留空）/ WeChat Work webhook (legacy, optional) |

> 🔒 **重要 / Important**: `SUPABASE_SERVICE_ROLE_KEY` 與 `INTERNAL_API_SECRET` 絕對不可 commit、不可以 `NEXT_PUBLIC_` 前綴暴露給前端。
> Never commit the service role key; never expose server-only secrets with a `NEXT_PUBLIC_` prefix.

---

## 🚢 部署 / Deployment

完整步驟見 / See full guide: **[docs/VERCEL_DEPLOY.md](./docs/VERCEL_DEPLOY.md)**

簡述 / Summary：

1. 買網域 / Buy domain（建議 Cloudflare Registrar，USD $10–15/年）
2. Push 到 GitHub
3. 在 Vercel 匯入 / Import in Vercel
4. 設環境變數 / Set env vars（在 Vercel Project Settings → Environment Variables）
5. 綁正式網域 / Bind custom domain（Vercel Domains → Cloudflare DNS）

預估時間：30 分鐘（含 DNS 等待）/ ~30 minutes including DNS propagation

---

## 📁 專案結構 / Project Structure

```text
hk-mainland-taxi/
├── app/                          # Next.js 16 App Router
│   ├── api/                      # API routes
│   │   ├── orders/               #   Order creation, grab, status, edit, cancel, rebook, rate
│   │   ├── driver/               #   Driver-side endpoints
│   │   ├── dingtalk/             #   DingTalk webhook & push trigger
│   │   ├── auth/                 #   Auth callbacks (email / WeChat / phone)
│   │   ├── announcements/        #   Passenger marquee
│   │   ├── grab/                 #   Grab token endpoint
│   │   └── admin/                #   Admin endpoints
│   ├── driver/                   # Driver pages (login / dashboard / orders / profile)
│   ├── passenger/                # Passenger pages (login / orders)
│   ├── order/[orderNumber]/edit/ # Edit order
│   ├── order-success/            # Post-booking confirmation
│   ├── confirm/                  # Confirm page before submit
│   ├── grab/                     # Grab link target page
│   ├── layout.tsx
│   ├── page.tsx                  # Passenger order entry (home)
│   └── globals.css
├── driver-app/                   # 獨立司機端 H5 app（可獨立部署）/ Standalone driver H5 app (deployable independently)
│   └── ...                       #   Separate Next.js app under same monorepo
├── components/                   # Shared React components (e.g. order-wait-card)
├── lib/                          # Shared server + client utilities
│   ├── supabase.ts               #   Browser Supabase client
│   ├── auth-server.ts            #   Server-side auth helpers
│   ├── auth-utils.ts             #   Shared auth utilities
│   ├── pricing.ts                #   Pricing logic
│   ├── booking-tips.ts           #   Booking tips / fare rules
│   ├── holidays.ts               #   HK / CN holiday calendar
│   ├── membership.ts             #   Driver membership tier logic
│   ├── wechat-notifier.ts        #   WeChat push helper
│   └── utils.ts                  #   Misc helpers
├── supabase/
│   ├── migrations/               # SQL migrations (apply in order)
│   ├── schema.sql                # Base schema
│   ├── auth.sql                  # Auth triggers / policies
│   └── README.md                 # DB notes
├── docs/                         # Documentation
│   ├── VERCEL_DEPLOY.md          #   Deployment guide
│   ├── SUPABASE_SETUP.md         #   Supabase setup
│   ├── DINGTALK_SETUP.md         #   DingTalk setup
│   ├── GRAB_PAGE_GUIDE.md        #   Grab page guide
│   ├── WECHAT_SETUP_COMPLETE.md  #   WeChat full setup
│   ├── WECHAT_PUSH_GUIDE.md      #   WeChat push guide
│   ├── WECHAT_QUICK_SETUP.md     #   WeChat quick setup
│   ├── CANCEL_FEATURE_COMPLETE.md
│   ├── TEST_FREEZE_NOTES.md
│   └── V1_DINGTALK_GRAB_PLAN.md
├── scripts/                      # One-off utility scripts (HTML admin, db test)
├── public/                       # Static assets
├── .env.local                    # Local env (gitignored)
├── .env.example                  # Env template (committed)
├── next.config.ts
├── package.json
├── tsconfig.json
├── postcss.config.mjs
├── eslint.config.mjs
├── AGENTS.md                     # Agent / dev conventions
└── README.md                     # ← you are here
```

---

## 🛠️ 技術棧 / Tech Stack

| 層 / Layer | 技術 / Tech |
|---|---|
| Frontend | Next.js 16.3 (App Router), React 19, TypeScript, Tailwind CSS 4 |
| Backend | Next.js API Routes (Edge / Node runtime), Supabase |
| Database | PostgreSQL (Supabase), Row-Level Security |
| Auth | Supabase Auth + WeChat OAuth + Phone OTP |
| Realtime | Supabase Realtime (訂單狀態 / order status) |
| Push | 釘釘機器人（DingTalk Bot） / WeChat Work webhook |
| Hosting | Vercel (recommended) |
| Lint / Format | ESLint 9, `eslint-config-next` |

---

## 🧪 常用指令 / Common Scripts

```bash
npm run dev     # Dev server (localhost:3000)
npm run build   # Production build
npm run start   # Run production build
npm run lint    # ESLint
```

---

## 🗺️ 路線圖 / Roadmap

- ✅ 第一階段：乘客下單 + 釘釘搶單 MVP / Phase 1: Passenger order + DingTalk grab MVP
- ✅ 雙搶防護（transactional）/ Double-grab protection
- ✅ 訂單評分、再預約、改單、取消 / Rating, rebook, edit, cancel
- ✅ 司機排班、會員分級 / Driver schedules & membership tiers
- ✅ 乘客跑馬燈廣告 / Passenger marquee
- ⏳ 微信小程序乘客端 / WeChat Mini Program (passenger)
- ⏳ 司機 App 原生化 / Native driver app
- ⏳ 智能派單演算法 / Smart dispatch

---

## 🤝 貢獻 / Contributing

1. Fork 此 repo / Fork this repo
2. 建立分支 `git checkout -b feat/your-feature`
3. 提交變更 / Commit your changes
4. 開 Pull Request 並描述動機與影響 / Open a PR describing motivation & impact

> 請先閱讀 / Please read [AGENTS.md](./AGENTS.md) 了解工作流程與規範。
> Conventional Commits 為佳。/ Conventional Commits preferred.

---

## 📝 License

MIT — 詳見 [LICENSE](./LICENSE)（若 repo 內尚無 `LICENSE` 檔，可省略此連結）。

---

## 🙌 致謝 / Credits

Built with assistance from Cursor IDE + Claude.

---

## 📞 聯絡 / Contact

[Screenshot: 客服 QR Code]

- WhatsApp: ___
- WeChat: ___
- Email: ___

---

<p align="center">🚖🚗 港中專車 — Cross-border rides, simplified.</p>
