'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  MapPin, Calendar, Users, Luggage, Car, Phone, User,
  AlertCircle, CheckCircle, Clock, Baby, LogIn, ArrowRight, ShieldCheck, Wallet
} from 'lucide-react'

interface OrderData {
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
  childType?: string
  notes?: string
  createdAt: string
  estimatedFare?: number
}

interface GrabResult {
  success: boolean
  message?: string
  status?: string
  order?: {
    orderNumber: string
    passengerName?: string
    passengerPhone?: string
    pickupLocation: string
    dropoffLocation: string
    departureTime: string
    passengers: number
    luggage: number
    vehicleType: string
    notes?: string
    nextStepUrl?: string
  }
  requireLogin?: boolean
  loginUrl?: string
  requireProfileUpdate?: boolean
  profileUrl?: string
}

export default function GrabOrderPage() {
  const params = useParams()
  const router = useRouter()
  const token = params.token as string

  const [orderData, setOrderData] = useState<OrderData | null>(null)
  const [loadingOrder, setLoadingOrder] = useState(true)
  const [loading, setLoading] = useState(false)
  const [driver, setDriver] = useState<any>(null)
  const [grabResult, setGrabResult] = useState<GrabResult | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchOrder()
    checkDriverAuth()
  }, [token])

  const fetchOrder = async () => {
    try {
      const res = await fetch(`/api/grab/${token}`)
      const data = await res.json()

      if (data.success) {
        setOrderData(data.order)
      } else {
        setError(data.message || '訂單不存在')
        if (data.status === 'grabbed' || data.status === 'price_confirmed') {
          setGrabResult({
            success: false,
            status: data.status,
            message: data.message
          })
        }
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoadingOrder(false)
    }
  }

  const checkDriverAuth = async () => {
    try {
      const res = await fetch('/api/auth/me')
      const data = await res.json()
      if (data.authenticated && data.user?.role === 'driver') {
        setDriver(data.user)
      }
    } catch (err) {
      // 忽略錯誤，未登入
    }
  }

  // 處理搶單（使用司機登入資料）
  const handleGrabOrder = async () => {
    if (!driver) {
      router.push(`/driver/login?redirect=${encodeURIComponent(`/grab/${token}`)}`)
      return
    }

    if (!driver.vehicle_plate) {
      alert('請先完善車牌資料')
      router.push('/driver/profile')
      return
    }

    setLoading(true)

    try {
      const res = await fetch(`/api/grab/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })

      const data = await res.json()
      setGrabResult(data)

      if (data.success) {
        // 跳轉到司機訂單詳情頁（報價）
        setTimeout(() => {
          if (data.order?.nextStepUrl) {
            router.push(data.order.nextStepUrl)
          }
        }, 1500)
      }
    } catch (err: any) {
      setGrabResult({
        success: false,
        message: err.message || '搶單失敗'
      })
    } finally {
      setLoading(false)
    }
  }

  // 格式化日期時間
  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleString('zh-HK', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    })
  }

  // 獲取車型名稱
  const getVehicleTypeName = (type: string) => {
    const names: Record<string, string> = {
      '4_seat': '4座車',
      '7_seat': '7座車',
      '8_seat': '8座車'
    }
    return names[type] || type
  }

  if (loadingOrder) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-slate-400">加載訂單中...</div>
      </div>
    )
  }

  // 訂單已被搶
  if (grabResult && (grabResult.status === 'grabbed' || grabResult.status === 'price_confirmed')) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-8 text-center">
          <div className="w-16 h-16 bg-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-orange-400" />
          </div>
          <h1 className="text-2xl font-bold text-slate-100 mb-2">來晚了！</h1>
          <p className="text-slate-400 mb-4">
            訂單 #{orderData?.orderNumber || ''} 已被其他司機搶走
          </p>
          <p className="text-sm text-slate-500">
            請留意群內新訂單通知
          </p>
        </div>
      </div>
    )
  }

  // 訂單已過期
  if (grabResult?.status === 'expired') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-8 text-center">
          <div className="w-16 h-16 bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Clock className="w-8 h-8 text-slate-400" />
          </div>
          <h1 className="text-2xl font-bold text-slate-100 mb-2">訂單已過期</h1>
          <p className="text-slate-400 mb-4">該訂單搶單鏈接已失效</p>
          <Link href="/driver/dashboard" className="inline-block px-6 py-3 bg-amber-500 hover:bg-amber-600 text-slate-900 rounded-xl">
            返回接單大廳
          </Link>
        </div>
      </div>
    )
  }

  // 訂單已取消
  if (grabResult?.status === 'cancelled') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-8 text-center">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-slate-100 mb-2">訂單已取消</h1>
          <p className="text-slate-400 mb-4">乘客已取消該訂單</p>
          <Link href="/driver/dashboard" className="inline-block px-6 py-3 bg-amber-500 hover:bg-amber-600 text-slate-900 rounded-xl">
            返回接單大廳
          </Link>
        </div>
      </div>
    )
  }

  // 搶單失敗
  if (grabResult && !grabResult.success && !grabResult.status) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-8 text-center">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="text-xl font-bold text-slate-100 mb-2">搶單失敗</h1>
          <p className="text-slate-400 mb-6">{grabResult.message}</p>
          <button
            onClick={() => router.push('/driver/dashboard')}
            className="px-6 py-3 bg-amber-500 hover:bg-amber-600 text-slate-900 rounded-xl"
          >
            返回接單大廳
          </button>
        </div>
      </div>
    )
  }

  // 搶單成功
  if (grabResult?.success && grabResult.order) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-8 text-center">
          <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-400" />
          </div>
          <h1 className="text-2xl font-bold text-slate-100 mb-2">搶單成功！</h1>
          <p className="text-slate-400 mb-6">
            訂單 #{grabResult.order.orderNumber}
          </p>

          {/* 乘客聯繫方式 */}
          <div className="bg-slate-900/50 border border-slate-600 rounded-lg p-6 mb-4 text-left">
            <h3 className="text-sm font-medium text-slate-300 mb-4">📞 乘客聯繫方式</h3>
            <div className="space-y-3">
              {grabResult.order.passengerName && (
                <div className="flex items-center gap-3">
                  <User className="w-5 h-5 text-cyan-400" />
                  <div>
                    <div className="text-xs text-slate-400">姓名</div>
                    <div className="text-slate-100">{grabResult.order.passengerName}</div>
                  </div>
                </div>
              )}
              {grabResult.order.passengerPhone && (
                <div className="flex items-center gap-3">
                  <Phone className="w-5 h-5 text-cyan-400" />
                  <div>
                    <div className="text-xs text-slate-400">電話</div>
                    <a
                      href={`tel:${grabResult.order.passengerPhone}`}
                      className="text-cyan-400 hover:text-cyan-300 transition"
                    >
                      {grabResult.order.passengerPhone}
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 提示下一步 */}
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 mb-6 text-left">
            <div className="flex items-start gap-3">
              <Wallet className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-slate-300">
                <p className="font-medium text-amber-300 mb-1">下一步</p>
                <p>請在「我的訂單」中確認最終價格（將同步給乘客）</p>
              </div>
            </div>
          </div>

          <p className="text-xs text-slate-500 mb-3">
            跳轉中...
          </p>
        </div>
      </div>
    )
  }

  // 訂單不存在
  if (error && !orderData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-8 text-center">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-slate-100 mb-2">訂單不存在</h1>
          <p className="text-slate-400 mb-6">{error}</p>
          <Link href="/driver/dashboard" className="inline-block px-6 py-3 bg-amber-500 hover:bg-amber-600 text-slate-900 rounded-xl">
            返回接單大廳
          </Link>
        </div>
      </div>
    )
  }

  if (!orderData) return null

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* 頁面標題 */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-100 mb-2">🚗 搶單頁面</h1>
          <p className="text-slate-400">訂單號：#{orderData.orderNumber}</p>
        </div>

        {/* 訂單詳情卡片 */}
        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-cyan-400" />
            訂單詳情
          </h2>

          <div className="space-y-4">
            {/* 路線信息 */}
            <div className="bg-slate-900/50 border border-slate-600 rounded-lg p-4">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-2 h-2 rounded-full bg-cyan-400 mt-2"></div>
                <div className="flex-1">
                  <div className="text-xs text-slate-400 mb-1">出發地</div>
                  <div className="text-slate-100 font-medium">{orderData.pickupLocation}</div>
                </div>
              </div>
              <div className="border-l-2 border-dashed border-slate-600 ml-1 h-4"></div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-orange-400 mt-2"></div>
                <div className="flex-1">
                  <div className="text-xs text-slate-400 mb-1">目的地</div>
                  <div className="text-slate-100 font-medium">{orderData.dropoffLocation}</div>
                </div>
              </div>
            </div>

            {/* 出發時間 */}
            <div className="flex items-center gap-3 p-4 bg-slate-900/50 border border-slate-600 rounded-lg">
              <Calendar className="w-5 h-5 text-cyan-400" />
              <div className="flex-1">
                <div className="text-xs text-slate-400 mb-1">出發時間</div>
                <div className="text-slate-100 font-medium">{formatDateTime(orderData.departureTime)}</div>
              </div>
            </div>

            {/* 乘車信息 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-3 p-4 bg-slate-900/50 border border-slate-600 rounded-lg">
                <Users className="w-5 h-5 text-cyan-400" />
                <div>
                  <div className="text-xs text-slate-400">乘客人數</div>
                  <div className="text-slate-100 font-medium">{orderData.passengers} 人</div>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 bg-slate-900/50 border border-slate-600 rounded-lg">
                <Luggage className="w-5 h-5 text-cyan-400" />
                <div>
                  <div className="text-xs text-slate-400">行李數量</div>
                  <div className="text-slate-100 font-medium">{orderData.luggage} 件</div>
                </div>
              </div>
            </div>

            {/* 車型 */}
            <div className="flex items-center gap-3 p-4 bg-slate-900/50 border border-slate-600 rounded-lg">
              <Car className="w-5 h-5 text-cyan-400" />
              <div className="flex-1">
                <div className="text-xs text-slate-400 mb-1">車型要求</div>
                <div className="text-slate-100 font-medium">{getVehicleTypeName(orderData.vehicleType)}</div>
              </div>
            </div>

            {/* 孩童信息 */}
            {orderData.hasChild && orderData.childType && (
              <div className="flex items-center gap-3 p-4 bg-slate-900/50 border border-amber-500/30 rounded-lg">
                <Baby className="w-5 h-5 text-amber-400" />
                <div className="flex-1">
                  <div className="text-xs text-slate-400 mb-1">孩童信息</div>
                  <div className="text-slate-100 font-medium">
                    {orderData.childType === 'infant' ? '嬰兒（0-3歲以下）' : '3歲以上孩童'}
                  </div>
                </div>
              </div>
            )}

            {/* 備註 */}
            {orderData.notes && (
              <div className="p-4 bg-slate-900/50 border border-slate-600 rounded-lg">
                <div className="text-xs text-slate-400 mb-2">📝 備註</div>
                <div className="text-slate-100 text-sm">{orderData.notes}</div>
              </div>
            )}

            {/* 乘客預估車資 */}
            {orderData.estimatedFare && (
              <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                <div className="text-xs text-amber-300 mb-1">乘客預估車資（僅供參考）</div>
                <div className="text-2xl font-bold text-amber-400">HK$ {orderData.estimatedFare}</div>
                <div className="text-xs text-slate-400 mt-2">
                  ⚠️ 您可以根據實際情況調整最終價格
                </div>
              </div>
            )}

            {/* 發布時間 */}
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Clock className="w-4 h-4" />
              發布時間：{formatDateTime(orderData.createdAt)}
            </div>
          </div>
        </div>

        {/* 已登入司機：顯示搶單按鈕 */}
        {driver ? (
          <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/30 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center">
                <User className="w-6 h-6 text-slate-900" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-slate-400">已登入司機</p>
                <p className="text-lg font-semibold text-slate-100">{driver.name}</p>
                {driver.vehicle_plate && (
                  <p className="text-xs text-slate-400">車牌：{driver.vehicle_plate}</p>
                )}
              </div>
            </div>

            {!driver.vehicle_plate && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 mb-3 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-amber-300">
                  請先到「個人資料」完善車牌資料
                </p>
              </div>
            )}

            <button
              onClick={handleGrabOrder}
              disabled={loading || !driver.vehicle_plate}
              className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 disabled:from-slate-600 disabled:to-slate-600 text-slate-900 font-bold text-lg rounded-xl transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-slate-900/30 border-t-slate-900 rounded-full animate-spin"></div>
                  搶單中...
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5" />
                  確認搶單
                </>
              )}
            </button>

            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 mt-4">
              <div className="flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-slate-300">
                  <p className="font-medium mb-1">溫馨提示</p>
                  <ul className="text-xs text-slate-400 space-y-1">
                    <li>• 搶單成功後請到「我的訂單」確認最終價格</li>
                    <li>• 平台零抽成，價格由您自行設定</li>
                    <li>• 請及時與乘客溝通確認接送細節</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* 未登入：要求登入 */
          <div className="bg-gradient-to-br from-sky-500/10 to-cyan-500/10 border border-sky-500/30 rounded-2xl p-6">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-sky-500/20 rounded-full mb-4">
                <LogIn className="w-8 h-8 text-sky-400" />
              </div>
              <h3 className="text-xl font-semibold text-slate-100 mb-2">需要先登入司機帳號</h3>
              <p className="text-sm text-slate-400 mb-6">
                為了保障乘客權益和提供更好的服務，請先登入或註冊司機帳號
              </p>
              <Link
                href={`/driver/login?redirect=${encodeURIComponent(`/grab/${token}`)}`}
                className="inline-flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-400 hover:to-cyan-400 text-slate-900 font-bold rounded-xl transition-all"
              >
                前往登入 / 註冊
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
