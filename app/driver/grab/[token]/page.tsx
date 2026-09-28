'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  MapPin, Calendar, Users, Luggage, Car, Phone, User,
  AlertCircle, CheckCircle, Clock, Baby, ArrowRight, ShieldCheck,
  ClipboardList, RefreshCw
} from 'lucide-react'

/**
 * v1 釘釘搶單頁 — H5
 *
 * 路由：/driver/grab/[token]
 *
 * 流程：
 * 1) 從 query string 讀 staff_id（從釘釘 H5 入口帶過來；測試時可手動輸入）
 * 2) GET /api/driver/grab/[token]?staff_id=xxx
 *    → 若司機已註冊 → 顯示「確認搶單」按鈕
 *    → 若未註冊 → 顯示 6 欄位註冊表單
 * 3) 提交 → POST /api/driver/grab/[token]
 *    → 成功 → 顯示搶單成功頁（司機姓名/電話/車牌 + 乘客聯繫方式）
 *    → 409 已被搶 / 410 過期 → 顯示對應錯誤頁
 */

interface OrderInfo {
  id: number
  orderNumber: string
  status: string
  pickupLocation: string
  dropoffLocation: string
  departureTime: string
  passengers: number
  luggage: number
  vehicleType: string
  hasChild: boolean
  childType?: string | null
  notes?: string | null
  estimatedFare?: number | null
}

interface DriverInfo {
  id: string
  dingtalk_staff_id: string
  name: string
  phone: string
  plate: string
  car_type: string
  driving_years: number
  seats: number
}

interface FetchResult {
  success: boolean
  order?: OrderInfo
  driver?: DriverInfo | null
  needsRegistration?: boolean
  status?: string
  message?: string
}

interface GrabOkResponse {
  success: true
  message: string
  driver: { id: string; name: string; phone: string; plate: string }
  order: { orderNumber: string; passengerName: string | null; passengerPhone: string }
}

interface GrabErrResponse {
  success?: false
  status?: string
  message?: string
  error?: string
}

const VEHICLE_LABEL: Record<string, string> = {
  '4_seat': '4座車', '5_seat': '5座豐田', '7_seat': '7座埃爾法',
  '8_seat': '8座車', '9_seat': '9座商務',
}

export default function DriverGrabPage() {
  const params = useParams()
  const token = (params?.token as string) ?? ''

  // 從 query 拿 staff_id（釘釘 H5 入口會帶 ?staff_id=xxx）
  const [staffId, setStaffId] = useState('')
  const [staffIdInput, setStaffIdInput] = useState('') // 測試輸入框

  const [loading, setLoading] = useState(true)
  const [order, setOrder] = useState<OrderInfo | null>(null)
  const [driver, setDriver] = useState<DriverInfo | null>(null)
  const [needsRegistration, setNeedsRegistration] = useState(true)
  const [error, setError] = useState<{ status: string; message: string } | null>(null)

  const [submitting, setSubmitting] = useState(false)
  const [grabOk, setGrabOk] = useState<GrabOkResponse | null>(null)
  const [grabErr, setGrabErr] = useState<{ message: string; status?: string } | null>(null)

  useEffect(() => {
    const url = new URL(window.location.href)
    const sid = url.searchParams.get('staff_id') ?? ''
    setStaffId(sid)
    setStaffIdInput(sid)
  }, [])

  const fetchState = useCallback(async (sid: string) => {
    setLoading(true)
    setError(null)
    try {
      const url = `/api/driver/grab/${encodeURIComponent(token)}${sid ? `?staff_id=${encodeURIComponent(sid)}` : ''}`
      const res = await fetch(url, { cache: 'no-store' })
      const data = (await res.json()) as FetchResult
      if (!res.ok || data.success === false) {
        setError({ status: data.status ?? 'error', message: data.message ?? '訂單不可搶' })
        setOrder(data.order ?? null)
        return
      }
      setOrder(data.order ?? null)
      setDriver(data.driver ?? null)
      setNeedsRegistration(!!data.needsRegistration)
    } catch (e) {
      setError({ status: 'network', message: e instanceof Error ? e.message : '網絡錯誤' })
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    if (token) fetchState(staffId)
  }, [token, staffId, fetchState])

  const handleSetStaffId = () => {
    if (staffIdInput.trim()) setStaffId(staffIdInput.trim())
  }

  const handleRegisterSubmit = async (formData: FormData) => {
    setSubmitting(true)
    setGrabErr(null)
    try {
      const body = {
        staff_id: staffId,
        name: String(formData.get('name') ?? ''),
        phone: String(formData.get('phone') ?? ''),
        plate: String(formData.get('plate') ?? ''),
        car_type: String(formData.get('car_type') ?? ''),
        driving_years: Number(formData.get('driving_years') ?? 0),
        seats: Number(formData.get('seats') ?? 0),
      }
      const res = await fetch(`/api/driver/grab/${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = (await res.json()) as GrabOkResponse | GrabErrResponse
      if (res.ok && 'success' in data && data.success) {
        setGrabOk(data as GrabOkResponse)
        setGrabErr(null)
      } else {
        const err = data as GrabErrResponse
        setGrabErr({ message: err.message ?? err.error ?? '搶單失敗', status: err.status })
      }
    } catch (e) {
      setGrabErr({ message: e instanceof Error ? e.message : '網絡錯誤' })
    } finally {
      setSubmitting(false)
    }
  }

  const handleConfirmGrab = async () => {
    setSubmitting(true)
    setGrabErr(null)
    try {
      const res = await fetch(`/api/driver/grab/${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staff_id: staffId }),
      })
      const data = (await res.json()) as GrabOkResponse | GrabErrResponse
      if (res.ok && 'success' in data && data.success) {
        setGrabOk(data as GrabOkResponse)
      } else {
        const err = data as GrabErrResponse
        setGrabErr({ message: err.message ?? err.error ?? '搶單失敗', status: err.status })
      }
    } catch (e) {
      setGrabErr({ message: e instanceof Error ? e.message : '網絡錯誤' })
    } finally {
      setSubmitting(false)
    }
  }

  // ============== Render ==============

  if (loading) {
    return (
      <CenterShell>
        <div className="text-slate-400">加載訂單中...</div>
      </CenterShell>
    )
  }

  // 已被搶
  if (error?.status === 'grabbed' || error?.status === 'price_confirmed') {
    return (
      <CenterShell>
        <ResultCard
          icon={<AlertCircle className="w-8 h-8 text-orange-400" />}
          iconBg="bg-orange-500/20"
          title="來晚了！"
          subtitle={`訂單 #${order?.orderNumber ?? ''} 已被其他司機搶走`}
          footer="請留意群內新訂單通知"
        />
      </CenterShell>
    )
  }

  // 過期
  if (error?.status === 'expired') {
    return (
      <CenterShell>
        <ResultCard
          icon={<Clock className="w-8 h-8 text-slate-400" />}
          iconBg="bg-slate-700/50"
          title="訂單已過期"
          subtitle="該訂單搶單鏈接已失效"
        />
      </CenterShell>
    )
  }

  // 取消
  if (error?.status === 'cancelled') {
    return (
      <CenterShell>
        <ResultCard
          icon={<AlertCircle className="w-8 h-8 text-red-400" />}
          iconBg="bg-red-500/20"
          title="訂單已取消"
          subtitle="乘客已取消該訂單"
        />
      </CenterShell>
    )
  }

  // 不存在
  if (error && !order) {
    return (
      <CenterShell>
        <ResultCard
          icon={<AlertCircle className="w-8 h-8 text-red-400" />}
          iconBg="bg-red-500/20"
          title="訂單不存在"
          subtitle={error.message}
        />
      </CenterShell>
    )
  }

  // 搶單成功
  if (grabOk) {
    return (
      <CenterShell>
        <div className="max-w-md w-full bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-8 text-center">
          <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-400" />
          </div>
          <h1 className="text-2xl font-bold text-slate-100 mb-2">搶單成功！</h1>
          <p className="text-slate-400 mb-6">訂單 #{grabOk.order.orderNumber}</p>

          <div className="bg-slate-900/50 border border-slate-600 rounded-lg p-6 mb-4 text-left space-y-3">
            <h3 className="text-sm font-medium text-slate-300 mb-2">📞 乘客聯繫方式</h3>
            {grabOk.order.passengerName && (
              <InfoRow icon={<User className="w-5 h-5 text-cyan-400" />} label="姓名">
                {grabOk.order.passengerName}
              </InfoRow>
            )}
            {grabOk.order.passengerPhone && (
              <InfoRow icon={<Phone className="w-5 h-5 text-cyan-400" />} label="電話">
                <a href={`tel:${grabOk.order.passengerPhone}`} className="text-cyan-400 underline">
                  {grabOk.order.passengerPhone}
                </a>
              </InfoRow>
            )}
          </div>

          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 mb-4 text-left">
            <p className="text-sm text-amber-300 font-medium mb-1">您的資料</p>
            <p className="text-xs text-slate-400">
              {grabOk.driver.name} · {grabOk.driver.plate}
            </p>
            <p className="text-xs text-slate-500 mt-2">
              請及時聯繫乘客確認行程細節
            </p>
          </div>

          <Link
            href={`tel:${grabOk.order.passengerPhone}`}
            className="inline-flex items-center justify-center gap-2 w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-slate-900 font-bold rounded-xl"
          >
            <Phone className="w-4 h-4" />
            立即聯繫乘客
          </Link>
        </div>
      </CenterShell>
    )
  }

  if (!order) return null

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 py-6 px-4">
      <div className="max-w-2xl mx-auto">
        {/* 頁面標題 */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-slate-100 mb-1">🚖 釘釘搶單</h1>
          <p className="text-sm text-slate-400">訂單 #{order.orderNumber}</p>
        </div>

        {/* 訂單詳情卡 */}
        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-5 mb-4">
          <h2 className="text-base font-semibold text-slate-100 mb-3 flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-cyan-400" />
            訂單詳情
          </h2>
          <div className="space-y-3">
            <RouteRow
              pickup={order.pickupLocation}
              dropoff={order.dropoffLocation}
            />
            <SimpleRow
              icon={<Calendar className="w-4 h-4 text-cyan-400" />}
              label="出發時間"
              value={formatDateTime(order.departureTime)}
            />
            <div className="grid grid-cols-3 gap-2">
              <SimpleRow
                icon={<Users className="w-4 h-4 text-cyan-400" />}
                label="乘客人數"
                value={`${order.passengers} 人`}
              />
              <SimpleRow
                icon={<Luggage className="w-4 h-4 text-cyan-400" />}
                label="行李"
                value={`${order.luggage} 件`}
              />
              <SimpleRow
                icon={<Car className="w-4 h-4 text-cyan-400" />}
                label="車型"
                value={VEHICLE_LABEL[order.vehicleType] ?? order.vehicleType}
              />
            </div>
            {order.hasChild && (
              <SimpleRow
                icon={<Baby className="w-4 h-4 text-amber-400" />}
                label="孩童"
                value={order.childType === 'infant' ? '嬰兒（0-3歲）' : '3歲以上孩童'}
              />
            )}
            {order.notes && (
              <div className="p-3 bg-slate-900/50 border border-slate-600 rounded-lg text-sm">
                <span className="text-slate-400 text-xs">備註：</span> {order.notes}
              </div>
            )}
            {order.estimatedFare ? (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                <div className="text-xs text-amber-300 mb-1">乘客預估車資</div>
                <div className="text-xl font-bold text-amber-400">HK$ {order.estimatedFare}</div>
              </div>
            ) : null}
          </div>
        </div>

        {/* 釘釘 staff_id 提示 / 測試輸入框 */}
        {!staffId && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 mb-4">
            <p className="text-sm text-amber-300 mb-2">⚠️ 缺少 staff_id（從釘釘 H5 入口會自動帶上）</p>
            <p className="text-xs text-slate-400 mb-3">測試時可手動填入：</p>
            <div className="flex gap-2">
              <input
                value={staffIdInput}
                onChange={(e) => setStaffIdInput(e.target.value)}
                placeholder="例如：staff_xxx 或 dingtalk_user_id"
                className="flex-1 px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-slate-100 text-sm"
              />
              <button
                onClick={handleSetStaffId}
                className="px-4 py-2 bg-amber-500 text-slate-900 font-medium rounded-lg text-sm"
              >
                確認
              </button>
            </div>
          </div>
        )}

        {/* 註冊表單（首次訪問） */}
        {needsRegistration && staffId ? (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleRegisterSubmit(new FormData(e.currentTarget))
            }}
            className="bg-gradient-to-br from-sky-500/10 to-cyan-500/10 border border-sky-500/30 rounded-2xl p-5"
          >
            <h3 className="text-base font-semibold text-slate-100 mb-1">🪪 填寫司機資料</h3>
            <p className="text-xs text-slate-400 mb-4">首次接單，需先註冊；以後搶單就不用再填。</p>

            <div className="space-y-3">
              <Field label="稱呼" name="name" type="text" required placeholder="例如：陳師傅" />
              <Field label="電話" name="phone" type="tel" required placeholder="例如：13800138000" />
              <Field label="車牌號" name="plate" type="text" required placeholder="例如：粵B 12345" />
              <SelectField
                label="車類型"
                name="car_type"
                required
                options={[
                  { value: 'sedan_5', label: '5座豐田' },
                  { value: 'alphard_7', label: '7座埃爾法' },
                  { value: 'business_9', label: '9座商務' },
                ]}
              />
              <Field
                label="駕齡（年）"
                name="driving_years"
                type="number"
                required
                min={0}
                max={50}
                placeholder="0-50"
              />
              <SelectField
                label="座位數"
                name="seats"
                required
                options={[
                  { value: '5', label: '5 座' },
                  { value: '7', label: '7 座' },
                  { value: '9', label: '9 座' },
                ]}
              />
            </div>

            {grabErr && (
              <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-300">
                {grabErr.message}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="mt-5 w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 disabled:from-slate-600 disabled:to-slate-600 text-slate-900 font-bold rounded-xl flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  註冊並搶單中...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  註冊並搶單
                </>
              )}
            </button>
          </form>
        ) : staffId && driver ? (
          /* 已註冊：顯示搶單確認按鈕 */
          <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/30 rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center">
                <User className="w-6 h-6 text-slate-900" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-slate-400">司機</p>
                <p className="text-lg font-semibold text-slate-100">{driver.name}</p>
                <p className="text-xs text-slate-400">
                  {driver.plate} · {VEHICLE_LABEL[driver.car_type] ?? driver.car_type} · {driver.driving_years} 年駕齡
                </p>
              </div>
            </div>

            {grabErr && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-300">
                {grabErr.message}
              </div>
            )}

            <button
              onClick={handleConfirmGrab}
              disabled={submitting}
              className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 disabled:from-slate-600 disabled:to-slate-600 text-slate-900 font-bold text-base rounded-xl flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  搶單中...
                </>
              ) : (
                <>
                  🚗 確認搶單
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 mt-4 text-xs text-slate-400">
              <div className="flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <p>搶單不可撤銷；搶單成功後請及時聯繫乘客確認行程。</p>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

// ============== 子元件 ==============

function CenterShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
      {children}
    </div>
  )
}

function ResultCard({
  icon,
  iconBg,
  title,
  subtitle,
  footer,
}: {
  icon: React.ReactNode
  iconBg: string
  title: string
  subtitle: string
  footer?: string
}) {
  return (
    <div className="max-w-md w-full bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-8 text-center">
      <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${iconBg}`}>
        {icon}
      </div>
      <h1 className="text-xl font-bold text-slate-100 mb-2">{title}</h1>
      <p className="text-slate-400">{subtitle}</p>
      {footer && <p className="text-xs text-slate-500 mt-3">{footer}</p>}
    </div>
  )
}

function RouteRow({ pickup, dropoff }: { pickup: string; dropoff: string }) {
  return (
    <div className="bg-slate-900/50 border border-slate-600 rounded-lg p-3">
      <div className="flex items-start gap-2 mb-2">
        <div className="w-2 h-2 rounded-full bg-cyan-400 mt-2"></div>
        <div className="flex-1">
          <div className="text-xs text-slate-400 mb-0.5">出發地</div>
          <div className="text-slate-100 text-sm font-medium">{pickup}</div>
        </div>
      </div>
      <div className="border-l-2 border-dashed border-slate-600 ml-1 h-3"></div>
      <div className="flex items-start gap-2">
        <div className="w-2 h-2 rounded-full bg-orange-400 mt-2"></div>
        <div className="flex-1">
          <div className="text-xs text-slate-400 mb-0.5">目的地</div>
          <div className="text-slate-100 text-sm font-medium">{dropoff}</div>
        </div>
      </div>
    </div>
  )
}

function SimpleRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="flex items-center gap-3 p-3 bg-slate-900/50 border border-slate-600 rounded-lg">
      {icon}
      <div className="flex-1 min-w-0">
        <div className="text-xs text-slate-400">{label}</div>
        <div className="text-slate-100 text-sm font-medium truncate">{value}</div>
      </div>
    </div>
  )
}

function InfoRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      {icon}
      <div>
        <div className="text-xs text-slate-400">{label}</div>
        <div className="text-slate-100">{children}</div>
      </div>
    </div>
  )
}

function Field({
  label,
  name,
  type,
  required,
  placeholder,
  min,
  max,
}: {
  label: string
  name: string
  type: string
  required?: boolean
  placeholder?: string
  min?: number
  max?: number
}) {
  return (
    <label className="block">
      <span className="text-xs text-slate-400 mb-1 block">
        {label} {required && <span className="text-red-400">*</span>}
      </span>
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        min={min}
        max={max}
        className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-cyan-500"
      />
    </label>
  )
}

function SelectField({
  label,
  name,
  required,
  options,
}: {
  label: string
  name: string
  required?: boolean
  options: { value: string; label: string }[]
}) {
  return (
    <label className="block">
      <span className="text-xs text-slate-400 mb-1 block">
        {label} {required && <span className="text-red-400">*</span>}
      </span>
      <select
        name={name}
        required={required}
        defaultValue=""
        className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-cyan-500"
      >
        <option value="" disabled>
          請選擇
        </option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function formatDateTime(s: string) {
  try {
    const d = new Date(s)
    if (isNaN(d.getTime())) return s
    return d.toLocaleString('zh-HK', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
  } catch {
    return s
  }
}