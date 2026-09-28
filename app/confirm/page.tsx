'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MapPin, Calendar, Users, Luggage, Car, Phone, User, ArrowLeft, CheckCircle, AlertCircle, Baby } from 'lucide-react'

export default function ConfirmPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState<any>(null)

  useEffect(() => {
    // 从 localStorage 获取订单数据
    const savedData = localStorage.getItem('bookingData')
    if (!savedData) {
      // 如果没有数据，返回首页
      router.push('/')
      return
    }
    
    try {
      const data = JSON.parse(savedData)
      setFormData(data)
    } catch (error) {
      console.error('解析订单数据失败:', error)
      router.push('/')
    }
  }, [router])

  // 計算預估車資
  const calculateEstimatedFare = () => {
    if (!formData.pickupLocation || !formData.dropoffLocation) {
      return null
    }

    // 基礎價格表（港幣）
    const baseFares: Record<string, number> = {
      // 香港 ⇄ 汕尾
      '九龍-汕尾': 600,
      '新界-汕尾': 650,
      '港島-汕尾': 700,
      '汕尾-九龍': 600,
      '汕尾-新界': 650,
      '汕尾-港島': 700,
      
      // 香港 ⇄ 深圳
      '九龍-深圳': 300,
      '新界-深圳': 350,
      '港島-深圳': 400,
      '深圳-九龍': 300,
      '深圳-新界': 350,
      '深圳-港島': 400,
      
      // 深圳 ⇄ 汕尾
      '深圳-汕尾': 400,
      '汕尾-深圳': 400,
    }

    const routeKey = `${formData.pickupLocation}-${formData.dropoffLocation}`
    let baseFare = baseFares[routeKey] || 500

    // 車型係數
    const vehicleMultiplier: Record<string, number> = {
      '4_seat': 1.0,
      '7_seat': 1.2,
      '8_seat': 1.4,
    }
    
    baseFare *= vehicleMultiplier[formData.vehicleType] || 1.2

    // 包車增加30%
    if (formData.isCharter) {
      baseFare *= 1.3
    }

    // 計算最終價格範圍（上下浮動10%）
    const minFare = Math.round(baseFare * 0.9)
    const maxFare = Math.round(baseFare * 1.1)

    return { minFare, maxFare }
  }

  // 格式化日期时间
  const formatDateTime = (dateStr: string | undefined, timeStr: string | undefined) => {
    if (!dateStr || !timeStr) return ''
    
    // 解析日期
    const date = new Date(`${dateStr}T${timeStr}:00`)
    const year = date.getFullYear()
    const month = date.getMonth() + 1
    const day = date.getDate()
    const weekdays = ['週日', '週一', '週二', '週三', '週四', '週五', '週六']
    const weekday = weekdays[date.getDay()]
    
    // 解析時間
    const [hour, minute] = timeStr.split(':').map(Number)
    const hourStr = hour.toString().padStart(2, '0')
    const minuteStr = minute.toString().padStart(2, '0')
    const period = hour >= 5 && hour < 12 ? '早上' : hour >= 12 && hour < 18 ? '下午' : '晚上'
    
    return {
      date: `${year}年${month}月${day}日 (${weekday})`,
      time: `${period} ${hourStr}:${minuteStr}`
    }
  }

  // 获取车型名称
  const getVehicleTypeName = (type: string) => {
    const names: Record<string, string> = {
      '4_seat': '4座車',
      '7_seat': '7座車',
      '8_seat': '8座車'
    }
    return names[type] || type
  }

  // 获取方向名称
  const getDirectionName = (serviceType: string, direction: string) => {
    if (serviceType === 'cross_border') {
      if (direction === 'hk_to_mainland') return '跨境專車：香港 → 內地'
      if (direction === 'mainland_to_hk') return '跨境專車：內地 → 香港'
    } else if (serviceType === 'mainland_local') {
      if (direction === 'sz_to_sw') return '內地專車：深圳 → 汕尾'
      if (direction === 'sw_to_sz') return '內地專車：汕尾 → 深圳'
    }
    return direction
  }

  // 提交订单
  const handleSubmit = async () => {
    if (!formData) return
    
    setLoading(true)
    
    try {
      // 添加预估车资到数据中
      const estimatedFare = calculateEstimatedFare()
      
      // 将日期和时间合并为完整的 ISO 时间戳
      const departureDateTime = `${formData.departureDate}T${formData.departureTime}:00+08:00`
      
      const response = await fetch('/api/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          departureTime: departureDateTime,
          estimatedFare: estimatedFare ? Math.round((estimatedFare.minFare + estimatedFare.maxFare) / 2) : null
        })
      })
      
      const result = await response.json()
      
      if (!response.ok || !result.success) {
        throw new Error(result.message || '提交订单失败')
      }
      
      // 清除 localStorage
      localStorage.removeItem('bookingData')
      
      // 跳转到成功页面，传递订单号
      const orderNumber = result.order?.orderNumber || result.order?.order_number
      if (orderNumber) {
        router.push(`/order-success?orderNumber=${orderNumber}`)
      } else {
        router.push('/order-success')
      }
      
    } catch (error) {
      console.error('提交订单失败:', error)
      alert('提交訂單失敗，請重試')
    } finally {
      setLoading(false)
    }
  }

  // 返回修改
  const handleBack = () => {
    router.back()
  }

  if (!formData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-slate-400">加載中...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* 页面标题 */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-100 mb-2">📋 確認訂單</h1>
          <p className="text-slate-400">請仔細核對以下信息</p>
        </div>

        {/* 订单信息卡片 */}
        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-cyan-400" />
            行程信息
          </h2>

          <div className="space-y-4">
            {/* 方向 */}
            <div className="flex items-center justify-between p-4 bg-slate-900/50 border border-slate-600 rounded-lg">
              <span className="text-slate-400">行程方向</span>
              <span className="text-slate-100 font-medium">{getDirectionName(formData.serviceType, formData.direction)}</span>
            </div>

            {/* 路线 */}
            <div className="bg-slate-900/50 border border-slate-600 rounded-lg p-4">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-2 h-2 rounded-full bg-cyan-400 mt-2"></div>
                <div className="flex-1">
                  <div className="text-xs text-slate-400 mb-1">出發地</div>
                  <div className="text-slate-100 font-medium">{formData.pickupLocation}</div>
                  {formData.pickupArea && (
                    <div className="text-sm text-slate-400 mt-1">{formData.pickupArea}</div>
                  )}
                </div>
              </div>
              <div className="border-l-2 border-dashed border-slate-600 ml-1 h-4"></div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-orange-400 mt-2"></div>
                <div className="flex-1">
                  <div className="text-xs text-slate-400 mb-1">目的地</div>
                  <div className="text-slate-100 font-medium">{formData.dropoffLocation}</div>
                  {formData.dropoffArea && (
                    <div className="text-sm text-slate-400 mt-1">{formData.dropoffArea}</div>
                  )}
                </div>
              </div>
            </div>

            {/* 出发时间 */}
            <div className="flex items-center gap-3 p-4 bg-slate-900/50 border border-slate-600 rounded-lg">
              <Calendar className="w-5 h-5 text-cyan-400" />
              <div className="flex-1">
                <div className="text-xs text-slate-400 mb-1">出發時間</div>
                {(() => {
                  const dt = formatDateTime(formData.departureDate, formData.departureTime)
                  return typeof dt === 'object' ? (
                    <div>
                      <div className="text-slate-100 font-medium">{dt.date}</div>
                      <div className="text-cyan-400 font-medium mt-0.5">{dt.time}</div>
                    </div>
                  ) : (
                    <div className="text-slate-100 font-medium">{dt}</div>
                  )
                })()}
              </div>
            </div>

            {/* 乘车信息 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-3 p-4 bg-slate-900/50 border border-slate-600 rounded-lg">
                <Users className="w-5 h-5 text-cyan-400" />
                <div>
                  <div className="text-xs text-slate-400">乘車人數</div>
                  <div className="text-slate-100 font-medium">
                    {formData.passengers} 人
                    {formData.isCharter && (
                      <span className="ml-2 text-xs bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded">包車</span>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-3 p-4 bg-slate-900/50 border border-slate-600 rounded-lg">
                <Luggage className="w-5 h-5 text-cyan-400" />
                <div>
                  <div className="text-xs text-slate-400">行李數量</div>
                  <div className="text-slate-100 font-medium">{formData.luggage} 件</div>
                </div>
              </div>
            </div>

            {/* 车型 */}
            <div className="flex items-center gap-3 p-4 bg-slate-900/50 border border-slate-600 rounded-lg">
              <Car className="w-5 h-5 text-cyan-400" />
              <div className="flex-1">
                <div className="text-xs text-slate-400 mb-1">車型要求</div>
                <div className="text-slate-100 font-medium">{getVehicleTypeName(formData.vehicleType)}</div>
              </div>
            </div>

            {/* 孩童信息 */}
            {formData.hasChild && formData.childType && (
              <div className="flex items-center gap-3 p-4 bg-slate-900/50 border border-amber-500/30 rounded-lg">
                <Baby className="w-5 h-5 text-amber-400" />
                <div className="flex-1">
                  <div className="text-xs text-slate-400 mb-1">孩童信息</div>
                  <div className="text-slate-100 font-medium">
                    {formData.childType === 'infant' ? '嬰兒（0-3歲以下）' : '3歲以上孩童'}
                  </div>
                  {formData.childType === 'over_3' && (
                    <div className="text-xs text-amber-400 mt-1">將計算一個座位</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 联系信息卡片 */}
        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
            <Phone className="w-5 h-5 text-cyan-400" />
            聯繫信息
          </h2>

          <div className="space-y-3">
            {formData.passengerName && (
              <div className="flex items-center justify-between p-4 bg-slate-900/50 border border-slate-600 rounded-lg">
                <span className="text-slate-400">姓名</span>
                <span className="text-slate-100 font-medium">{formData.passengerName}</span>
              </div>
            )}
            
            {formData.passengerPhone && (
              <div className="flex items-center justify-between p-4 bg-slate-900/50 border border-slate-600 rounded-lg">
                <span className="text-slate-400">聯繫電話</span>
                <span className="text-slate-100 font-medium">{formData.passengerPhone}</span>
              </div>
            )}

            {formData.passengerNotes && (
              <div className="p-4 bg-slate-900/50 border border-slate-600 rounded-lg">
                <div className="text-xs text-slate-400 mb-2">備註</div>
                <div className="text-slate-100 text-sm">{formData.passengerNotes}</div>
              </div>
            )}
          </div>
        </div>

        {/* 預估車資卡片 */}
        {(() => {
          const fare = calculateEstimatedFare()
          return fare ? (
            <div className="bg-gradient-to-r from-orange-500/10 to-amber-500/10 border border-orange-500/30 rounded-2xl p-6 mb-6">
              <h2 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
                💰 預估車資
              </h2>
              <div className="text-center mb-4">
                <div className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-400 mb-2">
                  HK$ {fare.minFare} - {fare.maxFare}
                </div>
                <div className="text-sm text-slate-400">價格範圍僅供參考</div>
              </div>
              <div className="grid grid-cols-2 gap-3 p-4 bg-slate-900/30 rounded-lg">
                <div className="text-center">
                  <div className="text-xs text-slate-400 mb-1">車型</div>
                  <div className="text-slate-200 font-medium">
                    {formData.vehicleType === '4_seat' ? '4座車' : formData.vehicleType === '7_seat' ? '7座車' : '8座車'}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-slate-400 mb-1">模式</div>
                  <div className="text-slate-200 font-medium">{formData.isCharter ? '包車' : '拼車'}</div>
                </div>
              </div>
              <div className="mt-4 p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg text-xs text-slate-400 text-center">
                ⚠️ 實際價格由司機報價決定，平台不參與定價
              </div>
            </div>
          ) : null
        })()}

        {/* 提示信息 */}
        <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-slate-300">
              <p className="font-medium mb-2">溫馨提示</p>
              <ul className="text-xs text-slate-400 space-y-1">
                <li>• 提交後訂單將推送至釘釘司機群，由司機搶單</li>
                <li>• 司機接單後會主動聯繫您確認行程細節</li>
                <li>• 📲 預計 2-24 小時內會有司機接單，請保持電話暢通</li>
                <li>• 平台零抽成，費用與司機線下結算</li>
                <li>• 如需取消或修改訂單，請及時聯繫司機</li>
              </ul>
            </div>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex gap-4">
          <button
            type="button"
            onClick={handleBack}
            disabled={loading}
            className="flex-1 py-4 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 text-slate-100 font-semibold rounded-lg transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-5 h-5" />
            返回修改
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 py-4 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 disabled:from-slate-600 disabled:to-slate-600 text-white font-semibold rounded-lg transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                提交中...
              </>
            ) : (
              <>
                <CheckCircle className="w-5 h-5" />
                確認提交
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
