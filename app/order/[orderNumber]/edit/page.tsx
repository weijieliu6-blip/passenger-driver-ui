'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, MapPin, Calendar, Users, Luggage, Car, User, Phone, Baby } from 'lucide-react'

interface Order {
  id: number
  order_number: string
  status: string
  service_type: string
  direction: string
  pickup_location: string
  pickup_area: string | null
  dropoff_location: string
  dropoff_area: string | null
  departure_time: string
  passengers: number
  luggage: number
  vehicle_type: string
  is_charter: boolean
  has_child: boolean
  child_type: string | null
  passenger_name: string
  passenger_phone: string
  passenger_notes: string | null
}

export default function EditOrderPage() {
  const router = useRouter()
  const params = useParams()
  const orderNumber = params.orderNumber as string
  
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // 表單數據
  const [passengers, setPassengers] = useState(1)
  const [luggage, setLuggage] = useState(0)
  const [vehicleType, setVehicleType] = useState('7_seat')
  const [isCharter, setIsCharter] = useState(false)
  const [hasChild, setHasChild] = useState(false)
  const [childType, setChildType] = useState('')
  const [passengerNotes, setPassengerNotes] = useState('')

  // 日期/時間
  const [departureDate, setDepartureDate] = useState('')
  const [departureTime, setDepartureTime] = useState('')

  useEffect(() => {
    fetchOrder()
  }, [orderNumber])

  const fetchOrder = async () => {
    try {
      const res = await fetch(`/api/orders/${orderNumber}`)
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.message || '查詢訂單失敗')
      }

      const o = data.order as Order
      setOrder(o)

      // 只有待接單狀態可修改
      if (o.status !== 'pending') {
        setError('只能修改待接單的訂單')
        return
      }

      // 預填表單
      setPassengers(o.passengers || 1)
      setLuggage(o.luggage || 0)
      setVehicleType(o.vehicle_type || '7_seat')
      setIsCharter(o.is_charter || false)
      setHasChild(o.has_child || false)
      setChildType(o.child_type || '')
      setPassengerNotes(o.passenger_notes || '')

      // 解析出發時間
      try {
        const dt = new Date(o.departure_time)
        if (!isNaN(dt.getTime())) {
          const y = dt.getFullYear()
          const m = String(dt.getMonth() + 1).padStart(2, '0')
          const d = String(dt.getDate()).padStart(2, '0')
          setDepartureDate(`${y}-${m}-${d}`)
          setDepartureTime(`${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`)
        }
      } catch (e) {
        console.error('Parse date error:', e)
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!order) return
    
    // 構造 ISO 時間
    const departure_time = departureDate && departureTime 
      ? `${departureDate}T${departureTime}:00+08:00`
      : order.departure_time
    
    setSaving(true)
    try {
      const res = await fetch(`/api/orders/${orderNumber}/edit`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          departure_time,
          passengers,
          luggage,
          vehicle_type: vehicleType,
          is_charter: isCharter,
          has_child: hasChild,
          child_type: hasChild ? childType : null,
          passenger_notes: passengerNotes
        })
      })
      
      const data = await res.json()
      
      if (data.success) {
        alert('訂單已更新！')
        router.push('/passenger/profile')
      } else {
        alert(data.error || '更新失敗')
      }
    } catch (err) {
      console.error('Save order error:', err)
      alert('更新失敗，請稍後重試')
    } finally {
      setSaving(false)
    }
  }

  // 生成日期選項（今天起的30天）
  const getDateOptions = () => {
    const dates: { value: string, label: string }[] = []
    const today = new Date()
    for (let i = 0; i < 30; i++) {
      const date = new Date(today)
      date.setDate(today.getDate() + i)
      const dateStr = date.toISOString().split('T')[0]
      const displayStr = date.toLocaleDateString('zh-HK', {
        month: '2-digit',
        day: '2-digit',
        weekday: 'short'
      })
      dates.push({ value: dateStr, label: displayStr })
    }
    return dates
  }

  // 生成時間選項
  const getTimeOptions = () => {
    const times: { value: string, label: string }[] = []
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
        times.push({ value: timeStr, label: timeStr })
      }
    }
    return times
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-slate-400">載入中...</div>
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-8 max-w-sm w-full text-center">
          <div className="text-amber-400 text-lg mb-4">{error || '訂單不存在'}</div>
          <Link
            href="/passenger/profile"
            className="inline-block px-6 py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition"
          >
            返回個人中心
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="border-b border-slate-700/50 bg-slate-900/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/passenger/profile" className="flex items-center gap-2 text-cyan-400 hover:text-cyan-300">
            <ArrowLeft className="w-5 h-5" />
            返回
          </Link>
          <h1 className="text-lg font-medium text-slate-50">修改訂單</h1>
          <div className="w-16"></div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        {/* 訂單信息（只讀） */}
        <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-2xl p-6 mb-6">
          <div className="text-sm text-slate-500 mb-3">訂單編號</div>
          <div className="text-lg font-mono text-cyan-400 mb-4">#{order.order_number}</div>
          
          <div className="space-y-2 text-sm text-slate-400">
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 mt-0.5 text-green-400 flex-shrink-0" />
              <div>
                <div>從: {order.pickup_location}{order.pickup_area ? ` ${order.pickup_area}` : ''}</div>
                <div>到: {order.dropoff_location}{order.dropoff_area ? ` ${order.dropoff_area}` : ''}</div>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              ℹ️ 起點和終點無法修改
            </div>
          </div>
        </div>

        {/* 可修改字段 */}
        <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-2xl p-6">
          <h2 className="text-lg font-medium text-slate-50 mb-6">修改信息</h2>

          <div className="space-y-5">
            {/* 出發時間 */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                <Calendar className="inline w-4 h-4 mr-1" />
                出發時間
              </label>
              <div className="grid grid-cols-2 gap-3">
                <select
                  value={departureDate}
                  onChange={(e) => setDepartureDate(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-slate-50 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  suppressHydrationWarning
                >
                  <option value="">選擇日期</option>
                  {getDateOptions().map((date) => (
                    <option key={date.value} value={date.value}>
                      {date.label}
                    </option>
                  ))}
                </select>
                <select
                  value={departureTime}
                  onChange={(e) => setDepartureTime(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-slate-50 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  suppressHydrationWarning
                >
                  <option value="">選擇時間</option>
                  {getTimeOptions().map((time) => (
                    <option key={time.value} value={time.value}>
                      {time.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 車型 */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                <Car className="inline w-4 h-4 mr-1" />
                車型
              </label>
              <div className="grid grid-cols-3 gap-3">
                {['4_seat', '7_seat', '8_seat'].map((type) => {
                  const labels: Record<string, string> = {
                    '4_seat': '4座車',
                    '7_seat': '7座車',
                    '8_seat': '8座車'
                  }
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setVehicleType(type)}
                      className={`px-4 py-3 rounded-lg border transition ${
                        vehicleType === type
                          ? 'border-cyan-500 bg-cyan-500/10 text-cyan-400'
                          : 'border-slate-600 text-slate-400 hover:border-slate-500'
                      }`}
                    >
                      {labels[type]}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* 乘車人數 */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                <Users className="inline w-4 h-4 mr-1" />
                乘車人數
              </label>
              <select
                value={passengers}
                onChange={(e) => setPassengers(Number(e.target.value))}
                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-slate-50 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                {[1, 2, 3, 4, 5, 6].map(n => (
                  <option key={n} value={n}>{n} 人</option>
                ))}
              </select>
            </div>

            {/* 行李數量 */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                <Luggage className="inline w-4 h-4 mr-1" />
                行李數量
              </label>
              <select
                value={luggage}
                onChange={(e) => setLuggage(Number(e.target.value))}
                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-slate-50 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                {[0, 1, 2, 3, 4, 5, 6].map(n => (
                  <option key={n} value={n}>{n} 件</option>
                ))}
              </select>
            </div>

            {/* 包車 */}
            <div className="flex items-center gap-3 p-3 bg-slate-900/30 rounded-lg">
              <input
                type="checkbox"
                id="isCharter"
                checked={isCharter}
                onChange={(e) => setIsCharter(e.target.checked)}
                className="w-4 h-4"
              />
              <label htmlFor="isCharter" className="text-sm text-slate-300 cursor-pointer">
                包車服務
              </label>
            </div>

            {/* 孩童 */}
            <div>
              <div className="flex items-center gap-3 p-3 bg-slate-900/30 rounded-lg mb-3">
                <input
                  type="checkbox"
                  id="hasChild"
                  checked={hasChild}
                  onChange={(e) => {
                    setHasChild(e.target.checked)
                    if (!e.target.checked) setChildType('')
                  }}
                  className="w-4 h-4"
                />
                <label htmlFor="hasChild" className="text-sm text-slate-300 cursor-pointer flex items-center gap-2">
                  <Baby className="w-4 h-4" />
                  帶孩童
                </label>
              </div>
              
              {hasChild && (
                <div className="ml-7 space-y-2">
                  {[
                    { value: 'infant', label: '3歲以下（不佔座）' },
                    { value: 'over_3', label: '3歲以上（佔座）' }
                  ].map((option) => (
                    <label key={option.value} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="childType"
                        value={option.value}
                        checked={childType === option.value}
                        onChange={(e) => setChildType(e.target.value)}
                        className="w-4 h-4"
                      />
                      <span className="text-sm text-slate-300">{option.label}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* 備註 */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                備註
              </label>
              <textarea
                value={passengerNotes}
                onChange={(e) => setPassengerNotes(e.target.value)}
                rows={3}
                placeholder="如有特殊需求請註明..."
                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-slate-50 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none"
              />
            </div>
          </div>
        </div>

        {/* 保存按鈕 */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full mt-6 py-4 bg-gradient-to-r from-cyan-500 to-teal-500 text-slate-900 font-medium rounded-xl hover:from-cyan-400 hover:to-teal-400 transition disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {saving ? (
            <>
              <div className="w-5 h-5 border-2 border-slate-900/30 border-t-slate-900 rounded-full animate-spin" />
              保存中...
            </>
          ) : (
            <>
              <Save className="w-5 h-5" />
              保存修改
            </>
          )}
        </button>

        <p className="mt-4 text-center text-sm text-slate-500">
          ⚠️ 訂單只能修改一次，保存後司機會收到更新通知
        </p>
      </main>
    </div>
  )
}
