'use client'

/**
 * AnnouncementMarquee - 乘客端頂部 24h 橫向跑馬燈
 *
 * 內容來源（v2）：
 *   1) /api/announcements API 回傳的 { virtual, holiday, db }
 *      - virtual: 當天 20 條 seeded 模擬熱訊（穩定、跨日切換）
 *      - holiday: 節假日文案（可能為空）
 *      - db: 管理員後台手動公告
 *   2) 額外注入 1-2 條「釘釘搶單」宣傳（固定 info 色）
 *
 * 行為：
 *   - 每 15 秒輪播切換顯示的「當前焦點」虛擬訊息（避免洗版）
 *   - 節假日 / DB / 釘釘宣傳 全時顯示
 *
 * 隱私：只顯示電話末四碼（隨機生成），不顯示姓名。
 *
 * SSR/CSR：
 *   - Server 端無 new Date() 依賴，所有 dynamic 內容只來自 API（client fetch）
 *   - 初次渲染使用 SSR-safe 的固定文案，client mount 後才注入動態內容
 */

import { useEffect, useMemo, useState } from 'react'

interface DbAnnouncement {
  message: string
  kind: string
}

interface ApiResponse {
  success?: boolean
  date?: string
  virtual?: string[]
  holiday?: string[]
  db?: DbAnnouncement[]
  error?: string
}

type SegmentKind = 'holiday' | 'hot' | 'warning' | 'info'

interface Segment {
  text: string
  kind: SegmentKind
}

const KIND_STYLES: Record<SegmentKind, string> = {
  // v2: 公告統一去掉底色，融入跑馬燈深色底；保留 emoji + 字色區分類型
  holiday: 'text-amber-300 border-transparent bg-transparent',
  hot: 'text-emerald-300 border-transparent bg-transparent',
  warning: 'text-orange-300 border-transparent bg-transparent',
  info: 'text-cyan-300 border-transparent bg-transparent',
}

const KIND_PREFIX: Record<SegmentKind, string> = {
  holiday: '🎉',
  hot: '📱',
  warning: '⚠️',
  info: '📲',
}

/** 固定注入的「釘釘搶單」宣傳文案 */
const DINGTALK_PROMOS: string[] = [
  '📲 司機透過釘釘 24h 搶單，平均回覆 2 小時內',
  '📲 釘釘搶單，平均 2 小時內有司機聯繫',
]

/** 將 DB 公告 kind 字串映射成 SegmentKind（DB kind 限定為 enum） */
function mapDbKind(kind: string): SegmentKind {
  if (kind === 'holiday' || kind === 'warning' || kind === 'hot') return kind
  return 'info'
}

export default function AnnouncementMarquee() {
  // mounted: 只在 client 端才注入「現在時間」相關內容，避免 SSR/CSR 不一致
  const [mounted, setMounted] = useState(false)
  // 從 API 拉的資料
  const [virtual, setVirtual] = useState<string[]>([])
  const [holiday, setHoliday] = useState<string[]>([])
  const [db, setDb] = useState<DbAnnouncement[]>([])
  // 每 15 秒輪播的「焦點虛擬訊息」索引
  const [virtualFocusIdx, setVirtualFocusIdx] = useState(0)

  // 初次載入：抓 API
  useEffect(() => {
    setMounted(true)

    let cancelled = false
    fetch('/api/announcements', { cache: 'no-store' })
      .then((r) => r.json() as Promise<ApiResponse>)
      .then((data) => {
        if (cancelled) return
        if (Array.isArray(data?.virtual)) setVirtual(data.virtual)
        if (Array.isArray(data?.holiday)) setHoliday(data.holiday)
        if (Array.isArray(data?.db)) setDb(data.db)
      })
      .catch((err) => {
        console.warn('[AnnouncementMarquee] 抓取公告失敗:', err)
      })

    return () => {
      cancelled = true
    }
  }, [])

  // 每 15 秒輪播虛擬訊息焦點
  useEffect(() => {
    if (!mounted) return
    const id = window.setInterval(() => {
      setVirtualFocusIdx((i) => i + 1)
    }, 15_000)
    return () => window.clearInterval(id)
  }, [mounted])

  // 把 holiday / db / 釘釘宣傳 / virtual 焦點訊息合併成 segments
  const segments: Segment[] = useMemo(() => {
    const out: Segment[] = []

    // 節假日優先（金色字）
    for (const m of holiday) {
      out.push({ text: m, kind: 'holiday' })
    }

    // 釘釘宣傳（固定 info，cyan）
    for (const m of DINGTALK_PROMOS) {
      out.push({ text: m, kind: 'info' })
    }

    // DB 公告（依 kind 著色）
    for (const a of db) {
      out.push({ text: a.message, kind: mapDbKind(a.kind) })
    }

    // 「當前焦點」虛擬訊息（青綠，hot）
    if (virtual.length > 0) {
      const tip = virtual[virtualFocusIdx % virtual.length]
      out.push({ text: tip, kind: 'hot' })
    }

    return out
  }, [virtual, holiday, db, virtualFocusIdx])

  // SSR 階段塞一個固定訊息，避免畫面空白
  const safeSegments: Segment[] =
    segments.length > 0
      ? segments
      : [
          {
            text: '🚗 近期熱門預約溫馨提示：建議您提前 24 小時預約跨境專車，避開節假日高峰',
            kind: 'info',
          },
        ]

  // 重複 2 份以保證無縫循環
  const loopSegments = [...safeSegments, ...safeSegments]

  return (
    <div
      className="w-full bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-slate-700/60 overflow-hidden"
      role="region"
      aria-label="乘客通知跑馬燈"
    >
      <div className="announcement-marquee-track flex whitespace-nowrap py-2 text-sm">
        {loopSegments.map((seg, idx) => (
          <span
            key={`${seg.kind}-${idx}`}
            className={`mx-3 inline-flex items-center gap-1 ${KIND_STYLES[seg.kind]} font-normal`}
          >
            <span aria-hidden="true">{KIND_PREFIX[seg.kind]}</span>
            <span>{seg.text}</span>
            <span aria-hidden="true" className="mx-3 opacity-50">●</span>
          </span>
        ))}
      </div>

      <style jsx>{`
        .announcement-marquee-track {
          display: inline-flex;
          animation: announcement-marquee 60s linear infinite;
          will-change: transform;
        }
        @keyframes announcement-marquee {
          from {
            transform: translateX(0);
          }
          to {
            transform: translateX(-50%);
          }
        }
        /* 滑鼠 hover 時暫停，便於閱讀 */
        .announcement-marquee-track:hover {
          animation-play-state: paused;
        }
        @media (prefers-reduced-motion: reduce) {
          .announcement-marquee-track {
            animation: none;
          }
        }
      `}</style>
    </div>
  )
}