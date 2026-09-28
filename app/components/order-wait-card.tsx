'use client'

/**
 * OrderWaitCard - 訂單畫面等待時間提示卡
 *
 * 狀態：
 *   - pending + 尚未接單 → 顯示等待卡 + 進度條 + 顏色分級
 *   - 已被接單（grabbed / price_confirmed / completed / ...）→ 隱藏本卡
 *
 * 顏色分級（基於「距離 dispatch_deadline_at 的剩餘時間」反推等待時長）：
 *   0 - 2 小時   → 綠色（準時區間）
 *   2 - 6 小時   → 黃色（略慢）
 *   6 - 24 小時  → 橙色（建議耐心等待）
 *   > 24 小時    → 紅色 + 客服建議
 *
 * SSR/CSR：
 *   - Server 端傳 serverNowMs，避免 SSR/CSR 時間漂移
 *   - mount 後每分鐘更新一次
 */

import { useEffect, useState } from 'react'

export interface OrderWaitCardOrder {
  status: string
  /** 司機接單 deadline（ISO string） */
  dispatch_deadline_at?: string | null
  /** 司機接單時間（ISO string） */
  accepted_at?: string | null
  /** 出發時間（ISO string） */
  departure_time?: string | null
  /** 訂單建立時間（ISO string） */
  created_at?: string | null
}

interface Props {
  order: OrderWaitCardOrder
  /** Server 端的「現在」時間戳 (ms)，避免 SSR/CSR 漂移 */
  serverNowMs: number
}

type Tone = 'green' | 'yellow' | 'orange' | 'red'

const TONE_BG: Record<Tone, string> = {
  green: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200',
  yellow: 'bg-amber-500/15 border-amber-500/40 text-amber-200',
  orange: 'bg-orange-500/15 border-orange-500/40 text-orange-200',
  red: 'bg-red-500/20 border-red-500/50 text-red-100',
}
const TONE_BAR: Record<Tone, string> = {
  green: 'bg-emerald-400',
  yellow: 'bg-amber-400',
  orange: 'bg-orange-400',
  red: 'bg-red-400',
}

function classifyWait(elapsedHours: number): Tone {
  if (elapsedHours < 2) return 'green'
  if (elapsedHours < 6) return 'yellow'
  if (elapsedHours < 24) return 'orange'
  return 'red'
}

function formatHHMM(iso: string | null | undefined): string {
  if (!iso) return '-'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '-'
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

export default function OrderWaitCard({ order, serverNowMs }: Props) {
  // mount 後才更新（避免 SSR/CSR 時間不一致）
  const [mounted, setMounted] = useState(false)
  const [nowMs, setNowMs] = useState<number>(serverNowMs)

  useEffect(() => {
    setMounted(true)
    const id = window.setInterval(() => setNowMs(Date.now()), 60_000)
    return () => window.clearInterval(id)
  }, [])

  const isPending = order.status === 'pending'
  // 一旦被接單 → 隱藏本卡（由父層自由決定要不要顯示「已接單 / 出發時間」橫幅）
  const isAssigned =
    order.status === 'grabbed' ||
    order.status === 'price_confirmed' ||
    order.status === 'arrived' ||
    order.status === 'completed'

  if (isAssigned) {
    // 已接單：顯示一行簡潔的「司機已接單，預計於 HH:MM 出發」
    const departureLabel = formatHHMM(order.departure_time)
    return (
      <div className="bg-sky-500/10 border border-sky-500/40 rounded-2xl p-4 mb-4 flex items-center gap-3">
        <div className="w-10 h-10 bg-sky-500/20 rounded-full flex items-center justify-center flex-shrink-0">
          <span className="text-xl" aria-hidden>✅</span>
        </div>
        <div>
          <p className="font-medium text-sky-200">司機已接單</p>
          <p className="text-xs text-slate-400 mt-0.5">
            預計於 {departureLabel} 出發，請保持電話暢通
          </p>
        </div>
      </div>
    )
  }

  if (!isPending) {
    // 其他狀態（cancelled / expired）→ 不顯示等待卡
    return null
  }

  // 計算「已等待時間」= now - createdAt
  const createdMs = order.created_at ? new Date(order.created_at).getTime() : serverNowMs
  const elapsedMs = Math.max(0, nowMs - createdMs)
  const elapsedHours = elapsedMs / (1000 * 60 * 60)
  const tone = classifyWait(elapsedHours)

  // 進度條 = elapsed / 24h，clamp [0, 1]
  const ratio = Math.min(1, Math.max(0, elapsedHours / 24))
  const percent = Math.round(ratio * 100)

  // 倒數剩餘時間（基於 dispatch_deadline_at）
  const deadlineMs = order.dispatch_deadline_at
    ? new Date(order.dispatch_deadline_at).getTime()
    : createdMs + 24 * 60 * 60 * 1000
  const remainingMs = deadlineMs - nowMs
  const remainingHours = remainingMs / (1000 * 60 * 60)

  // 文案
  let mainText = '⏳ 等待司機接單'
  let subText = '司機將透過「釘釘」搶單並聯繫您，預計 2-24 小時內會有司機接單'
  let extraText: string | null = null
  if (elapsedHours >= 24) {
    mainText = '⏰ 目前尚無司機接單'
    subText = '已超過 24 小時，建議您撥打客服熱線或重新調整時間'
    extraText = '☎️ 客服熱線將於訂單詳情下方顯示'
  } else if (elapsedHours >= 6) {
    subText = '當前等候略長，建議您耐心等待；司機透過釘釘搶單並聯繫您'
  } else if (elapsedHours >= 2) {
    subText = '司機將透過「釘釘」搶單並聯繫您，請保持電話暢通'
  } else {
    subText = '司機將透過「釘釘」搶單並聯繫您，預計 2-24 小時內會有司機接單'
  }

  // 倒數顯示（mount 之前用 serverNowMs 的穩定計算）
  const remainingLabel = mounted
    ? remainingHours > 0
      ? `剩餘約 ${remainingHours.toFixed(1)} 小時`
      : remainingHours > -24
      ? '已超過建議接單時間'
      : '已逾期'
    : null

  return (
    <div className={`rounded-2xl border p-5 mb-4 ${TONE_BG[tone]}`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="text-lg font-bold">{mainText}</p>
          <p className="text-xs opacity-90 mt-1">{subText}</p>
        </div>
        {remainingLabel && (
          <div className="text-right flex-shrink-0">
            <p className="text-xs opacity-75">{remainingLabel}</p>
            <p className="text-xs opacity-60 mt-1">
              已等待 {elapsedHours.toFixed(1)} 小時
            </p>
          </div>
        )}
      </div>

      {/* 進度條 */}
      <div className="w-full h-2 rounded-full bg-black/30 overflow-hidden">
        <div
          className={`h-full ${TONE_BAR[tone]} transition-all duration-500`}
          style={{ width: `${percent}%` }}
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          role="progressbar"
          aria-label="已等待時間比例（24 小時上限）"
        />
      </div>

      <div className="flex items-center justify-between mt-2 text-[11px] opacity-70">
        <span>0 小時</span>
        <span>2 小時</span>
        <span>6 小時</span>
        <span>24 小時</span>
      </div>

      {extraText && (
        <p className="mt-3 text-xs opacity-90">{extraText}</p>
      )}
    </div>
  )
}