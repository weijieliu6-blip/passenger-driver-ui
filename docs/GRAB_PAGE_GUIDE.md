# 搶單頁面開發指南

## 🎯 功能概述

司機在微信群點擊訂單推送消息中的鏈接，跳轉到搶單頁面，填寫基本信息後一鍵接單。

---

## 📱 頁面路由

```
/grab/[token]
```

**示例 URL**:
```
https://your-domain.com/grab/a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
```

---

## 🎨 頁面設計

### 頁面狀態

```typescript
type PageState = 
  | 'loading'        // 驗證 token 中
  | 'valid'          // token 有效，顯示訂單
  | 'grabbed'        // 訂單已被搶
  | 'expired'        // token 已過期
  | 'cancelled'      // 訂單已取消
  | 'invalid'        // token 無效
  | 'success'        // 搶單成功
```

---

## 🔧 技術實現

### 1. 頁面文件結構

```
app/
└── grab/
    └── [token]/
        ├── page.tsx           # 搶單頁面主體
        └── loading.tsx        # 加載狀態
```

---

### 2. API 路由

#### 2.1 獲取訂單信息
```typescript
// app/api/grab/[token]/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  const supabase = createClient()
  const { token } = params
  
  // 查詢訂單
  const { data: order, error } = await supabase
    .from('orders')
    .select('*')
    .eq('grab_token', token)
    .single()
  
  if (error || !order) {
    return NextResponse.json(
      { error: 'invalid_token', message: '訂單不存在' },
      { status: 404 }
    )
  }
  
  // 檢查訂單狀態
  if (order.status === 'grabbed') {
    return NextResponse.json(
      { error: 'already_grabbed', message: '訂單已被搶' },
      { status: 400 }
    )
  }
  
  if (order.status === 'cancelled') {
    return NextResponse.json(
      { error: 'cancelled', message: '訂單已取消' },
      { status: 400 }
    )
  }
  
  // 檢查 token 是否過期
  const now = new Date()
  const expiresAt = new Date(order.token_expires_at)
  
  if (now > expiresAt) {
    return NextResponse.json(
      { error: 'expired', message: 'Token 已過期' },
      { status: 400 }
    )
  }
  
  // 返回訂單信息（隱藏敏感信息）
  return NextResponse.json({
    id: order.id,
    direction: order.direction,
    pickup_location: order.pickup_location,
    pickup_area: order.pickup_area,
    dropoff_location: order.dropoff_location,
    dropoff_area: order.dropoff_area,
    departure_time: order.departure_time,
    passengers: order.passengers,
    luggage: order.luggage,
    vehicle_type: order.vehicle_type,
    notes: order.notes,
    created_at: order.created_at
    // 不返回乘客電話號碼
  })
}
```

---

#### 2.2 提交搶單
```typescript
// app/api/grab/[token]/submit/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

interface GrabRequest {
  driverName: string
  driverPhone: string
  driverVehicle: string
}

export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  const supabase = createClient()
  const { token } = params
  const body: GrabRequest = await request.json()
  
  // 驗證輸入
  if (!body.driverName || !body.driverPhone || !body.driverVehicle) {
    return NextResponse.json(
      { error: 'missing_fields', message: '請填寫完整信息' },
      { status: 400 }
    )
  }
  
  // 驗證電話號碼格式
  const phoneRegex = /^(\+?86)?1[3-9]\d{9}$|^\+852[0-9]{8}$/
  if (!phoneRegex.test(body.driverPhone)) {
    return NextResponse.json(
      { error: 'invalid_phone', message: '請輸入正確的電話號碼' },
      { status: 400 }
    )
  }
  
  try {
    // 使用事務確保原子性
    const { data: order, error } = await supabase
      .from('orders')
      .update({
        status: 'grabbed',
        driver_name: body.driverName,
        driver_phone: body.driverPhone,
        driver_vehicle: body.driverVehicle,
        grabbed_at: new Date().toISOString()
      })
      .eq('grab_token', token)
      .eq('status', 'pending')  // 只更新待接單狀態
      .select()
      .single()
    
    if (error || !order) {
      // 可能是並發搶單導致
      return NextResponse.json(
        { error: 'grab_failed', message: '搶單失敗，訂單可能已被其他司機接走' },
        { status: 409 }
      )
    }
    
    // 搶單成功，返回乘客聯繫方式
    return NextResponse.json({
      success: true,
      order: {
        id: order.id,
        passenger_name: order.passenger_name,
        passenger_phone: order.passenger_phone,
        pickup_area: order.pickup_area,
        dropoff_area: order.dropoff_area,
        departure_time: order.departure_time,
        passengers: order.passengers,
        luggage: order.luggage,
        vehicle_type: order.vehicle_type,
        notes: order.notes
      }
    })
    
    // TODO: 推送通知給乘客（微信服務號模板消息）
    
  } catch (error) {
    console.error('搶單錯誤:', error)
    return NextResponse.json(
      { error: 'server_error', message: '服務器錯誤，請稍後重試' },
      { status: 500 }
    )
  }
}
```

---

### 3. 前端頁面實現

```typescript
// app/grab/[token]/page.tsx

'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { MapPin, Calendar, Users, Luggage, Car, Phone, User, FileText } from 'lucide-react'

interface OrderInfo {
  id: string
  direction: string
  pickup_location: string
  pickup_area: string
  dropoff_location: string
  dropoff_area: string
  departure_time: string
  passengers: number
  luggage: number
  vehicle_type: string
  notes?: string
}

interface GrabbedOrder extends OrderInfo {
  passenger_name: string
  passenger_phone: string
}

type PageState = 'loading' | 'valid' | 'grabbed' | 'expired' | 'cancelled' | 'invalid' | 'success'

export default function GrabOrderPage() {
  const params = useParams()
  const router = useRouter()
  const token = params.token as string
  
  const [state, setState] = useState<PageState>('loading')
  const [order, setOrder] = useState<OrderInfo | null>(null)
  const [grabbedOrder, setGrabbedOrder] = useState<GrabbedOrder | null>(null)
  const [error, setError] = useState<string>('')
  
  // 司機信息表單
  const [driverName, setDriverName] = useState('')
  const [driverPhone, setDriverPhone] = useState('')
  const [driverVehicle, setDriverVehicle] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // 加載訂單信息
  useEffect(() => {
    fetchOrderInfo()
  }, [token])
  
  async function fetchOrderInfo() {
    try {
      const response = await fetch(`/api/grab/${token}`)
      const data = await response.json()
      
      if (!response.ok) {
        // 處理不同的錯誤狀態
        if (data.error === 'already_grabbed') {
          setState('grabbed')
        } else if (data.error === 'expired') {
          setState('expired')
        } else if (data.error === 'cancelled') {
          setState('cancelled')
        } else {
          setState('invalid')
        }
        setError(data.message)
        return
      }
      
      setOrder(data)
      setState('valid')
    } catch (err) {
      setState('invalid')
      setError('加載訂單失敗，請稍後重試')
    }
  }
  
  // 提交搶單
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    
    if (!driverName || !driverPhone || !driverVehicle) {
      alert('請填寫完整信息')
      return
    }
    
    setIsSubmitting(true)
    
    try {
      const response = await fetch(`/api/grab/${token}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driverName,
          driverPhone,
          driverVehicle
        })
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        if (data.error === 'grab_failed') {
          // 訂單已被搶
          setState('grabbed')
          setError(data.message)
        } else {
          alert(data.message)
        }
        return
      }
      
      // 搶單成功
      setGrabbedOrder(data.order)
      setState('success')
      
    } catch (err) {
      alert('搶單失敗，請稍後重試')
    } finally {
      setIsSubmitting(false)
    }
  }
  
  // 渲染不同狀態
  if (state === 'loading') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400 mx-auto"></div>
          <p className="text-slate-400 mt-4">加載中...</p>
        </div>
      </div>
    )
  }
  
  if (state === 'grabbed') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="bg-slate-900 rounded-2xl p-8 max-w-md w-full text-center border border-slate-800">
          <div className="text-6xl mb-4">😔</div>
          <h1 className="text-2xl font-bold text-slate-200 mb-2">來晚了</h1>
          <p className="text-slate-400">這個訂單已經被其他司機接走了</p>
          <p className="text-slate-500 text-sm mt-4">請留意群裡的新訂單通知</p>
        </div>
      </div>
    )
  }
  
  if (state === 'expired') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="bg-slate-900 rounded-2xl p-8 max-w-md w-full text-center border border-slate-800">
          <div className="text-6xl mb-4">⏰</div>
          <h1 className="text-2xl font-bold text-slate-200 mb-2">鏈接已過期</h1>
          <p className="text-slate-400">搶單鏈接有效期為 24 小時</p>
        </div>
      </div>
    )
  }
  
  if (state === 'cancelled') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="bg-slate-900 rounded-2xl p-8 max-w-md w-full text-center border border-slate-800">
          <div className="text-6xl mb-4">❌</div>
          <h1 className="text-2xl font-bold text-slate-200 mb-2">訂單已取消</h1>
          <p className="text-slate-400">乘客已取消此訂單</p>
        </div>
      </div>
    )
  }
  
  if (state === 'invalid') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="bg-slate-900 rounded-2xl p-8 max-w-md w-full text-center border border-slate-800">
          <div className="text-6xl mb-4">🚫</div>
          <h1 className="text-2xl font-bold text-slate-200 mb-2">無效鏈接</h1>
          <p className="text-slate-400">{error || '訂單不存在或鏈接無效'}</p>
        </div>
      </div>
    )
  }
  
  if (state === 'success' && grabbedOrder) {
    return (
      <div className="min-h-screen bg-slate-950 p-4 pb-24">
        <div className="max-w-2xl mx-auto pt-8">
          {/* 成功標題 */}
          <div className="text-center mb-8">
            <div className="text-6xl mb-4">🎉</div>
            <h1 className="text-3xl font-bold text-cyan-400 mb-2">搶單成功！</h1>
            <p className="text-slate-400">請及時聯繫乘客確認行程</p>
          </div>
          
          {/* 乘客聯繫方式 - 突出顯示 */}
          <div className="bg-gradient-to-br from-cyan-500/20 to-teal-500/20 rounded-2xl p-6 mb-6 border border-cyan-500/30">
            <h2 className="text-lg font-semibold text-cyan-300 mb-4 flex items-center gap-2">
              <Phone className="w-5 h-5" />
              乘客聯繫方式
            </h2>
            <div className="bg-slate-900/50 rounded-xl p-4">
              <p className="text-slate-300 mb-2">
                <span className="text-slate-500">姓名：</span>
                {grabbedOrder.passenger_name}
              </p>
              <div className="flex items-center justify-between">
                <p className="text-2xl font-mono font-bold text-cyan-400">
                  {grabbedOrder.passenger_phone}
                </p>
                <a 
                  href={`tel:${grabbedOrder.passenger_phone}`}
                  className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 px-4 py-2 rounded-lg font-medium transition"
                >
                  撥打電話
                </a>
              </div>
            </div>
          </div>
          
          {/* 訂單詳情 */}
          <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800">
            <h2 className="text-lg font-semibold text-slate-200 mb-4">訂單詳情</h2>
            
            {/* 路線 */}
            <div className="mb-4 pb-4 border-b border-slate-800">
              <div className="flex items-start gap-3 mb-2">
                <MapPin className="w-5 h-5 text-cyan-400 mt-1" />
                <div>
                  <p className="text-slate-400 text-sm">出發地</p>
                  <p className="text-slate-200">{grabbedOrder.pickup_area}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-orange-400 mt-1" />
                <div>
                  <p className="text-slate-400 text-sm">目的地</p>
                  <p className="text-slate-200">{grabbedOrder.dropoff_area}</p>
                </div>
              </div>
            </div>
            
            {/* 時間和人數 */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-slate-500" />
                <div>
                  <p className="text-slate-400 text-sm">出發時間</p>
                  <p className="text-slate-200">
                    {new Date(grabbedOrder.departure_time).toLocaleString('zh-HK', {
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-slate-500" />
                <div>
                  <p className="text-slate-400 text-sm">乘車人數</p>
                  <p className="text-slate-200">{grabbedOrder.passengers} 人</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <Luggage className="w-5 h-5 text-slate-500" />
                <div>
                  <p className="text-slate-400 text-sm">行李數量</p>
                  <p className="text-slate-200">{grabbedOrder.luggage} 件</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <Car className="w-5 h-5 text-slate-500" />
                <div>
                  <p className="text-slate-400 text-sm">車型</p>
                  <p className="text-slate-200">
                    {grabbedOrder.vehicle_type === '4_seat' && '4座車'}
                    {grabbedOrder.vehicle_type === '7_seat' && '7座車'}
                    {grabbedOrder.vehicle_type === '8_seat' && '8座車'}
                  </p>
                </div>
              </div>
            </div>
            
            {/* 備註 */}
            {grabbedOrder.notes && (
              <div className="bg-slate-800/50 rounded-lg p-4">
                <p className="text-slate-400 text-sm mb-1 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  乘客備註
                </p>
                <p className="text-slate-200">{grabbedOrder.notes}</p>
              </div>
            )}
          </div>
          
          {/* 溫馨提示 */}
          <div className="mt-6 bg-slate-900/50 rounded-xl p-4 border border-slate-800">
            <p className="text-slate-400 text-sm">
              🔔 <span className="font-medium text-slate-300">溫馨提示</span>
            </p>
            <ul className="text-slate-500 text-sm mt-2 space-y-1 ml-6 list-disc">
              <li>請及時聯繫乘客確認行程細節</li>
              <li>準時到達接送地點</li>
              <li>提供優質服務，累積好評</li>
            </ul>
          </div>
        </div>
      </div>
    )
  }
  
  // 搶單表單頁面
  if (state === 'valid' && order) {
    return (
      <div className="min-h-screen bg-slate-950 p-4 pb-24">
        <div className="max-w-2xl mx-auto pt-8">
          {/* 標題 */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-cyan-400 mb-2">搶單確認</h1>
            <p className="text-slate-400">填寫信息後即可接單</p>
          </div>
          
          {/* 訂單信息 */}
          <div className="bg-slate-900 rounded-2xl p-6 mb-6 border border-slate-800">
            <h2 className="text-lg font-semibold text-slate-200 mb-4">訂單信息</h2>
            
            {/* 路線 */}
            <div className="mb-4 pb-4 border-b border-slate-800">
              <div className="flex items-start gap-3 mb-2">
                <MapPin className="w-5 h-5 text-cyan-400 mt-1" />
                <div>
                  <p className="text-slate-400 text-sm">出發地</p>
                  <p className="text-slate-200">{order.pickup_area}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-orange-400 mt-1" />
                <div>
                  <p className="text-slate-400 text-sm">目的地</p>
                  <p className="text-slate-200">{order.dropoff_area}</p>
                </div>
              </div>
            </div>
            
            {/* 詳細信息網格 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-slate-500" />
                <div>
                  <p className="text-slate-400 text-sm">出發時間</p>
                  <p className="text-slate-200">
                    {new Date(order.departure_time).toLocaleString('zh-HK', {
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-slate-500" />
                <div>
                  <p className="text-slate-400 text-sm">乘車人數</p>
                  <p className="text-slate-200">{order.passengers} 人</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <Luggage className="w-5 h-5 text-slate-500" />
                <div>
                  <p className="text-slate-400 text-sm">行李數量</p>
                  <p className="text-slate-200">{order.luggage} 件</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <Car className="w-5 h-5 text-slate-500" />
                <div>
                  <p className="text-slate-400 text-sm">車型要求</p>
                  <p className="text-slate-200">
                    {order.vehicle_type === '4_seat' && '4座車'}
                    {order.vehicle_type === '7_seat' && '7座車'}
                    {order.vehicle_type === '8_seat' && '8座車'}
                  </p>
                </div>
              </div>
            </div>
            
            {/* 備註 */}
            {order.notes && (
              <div className="mt-4 bg-slate-800/50 rounded-lg p-4">
                <p className="text-slate-400 text-sm mb-1 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  乘客備註
                </p>
                <p className="text-slate-200">{order.notes}</p>
              </div>
            )}
          </div>
          
          {/* 司機信息表單 */}
          <form onSubmit={handleSubmit} className="bg-slate-900 rounded-2xl p-6 border border-slate-800">
            <h2 className="text-lg font-semibold text-slate-200 mb-4">司機信息</h2>
            
            <div className="space-y-4">
              {/* 姓名 */}
              <div>
                <label className="block text-slate-400 text-sm mb-2 flex items-center gap-2">
                  <User className="w-4 h-4" />
                  姓名
                </label>
                <input
                  type="text"
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                  placeholder="請輸入您的姓名"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition"
                  required
                />
              </div>
              
              {/* 電話 */}
              <div>
                <label className="block text-slate-400 text-sm mb-2 flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  電話號碼
                </label>
                <input
                  type="tel"
                  value={driverPhone}
                  onChange={(e) => setDriverPhone(e.target.value)}
                  placeholder="請輸入手機號碼"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition"
                  required
                />
                <p className="text-slate-500 text-xs mt-1">
                  用於乘客聯繫您，例如：13800138000 或 +85291234567
                </p>
              </div>
              
              {/* 車牌號 */}
              <div>
                <label className="block text-slate-400 text-sm mb-2 flex items-center gap-2">
                  <Car className="w-4 h-4" />
                  車牌號碼
                </label>
                <input
                  type="text"
                  value={driverVehicle}
                  onChange={(e) => setDriverVehicle(e.target.value.toUpperCase())}
                  placeholder="例如：粵B12345"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition font-mono"
                  required
                />
              </div>
            </div>
            
            {/* 提交按鈕 */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-6 bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 disabled:from-slate-700 disabled:to-slate-700 text-slate-950 disabled:text-slate-500 font-bold py-4 rounded-xl transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] disabled:transform-none"
            >
              {isSubmitting ? '提交中...' : '確認接單'}
            </button>
          </form>
          
          {/* 提示 */}
          <div className="mt-4 text-center">
            <p className="text-slate-500 text-sm">
              ⚠️ 接單後將顯示乘客聯繫方式，請及時聯繫確認
            </p>
          </div>
        </div>
      </div>
    )
  }
  
  return null
}
```

---

## 🧪 測試清單

### 功能測試
- [ ] Token 驗證（有效/無效/過期）
- [ ] 訂單信息正確顯示
- [ ] 表單驗證（姓名/電話/車牌）
- [ ] 搶單成功流程
- [ ] 併發搶單處理（兩人同時點擊）
- [ ] 已搶訂單再次訪問
- [ ] 取消訂單後訪問

### 用戶體驗測試
- [ ] 移動端響應式佈局
- [ ] 加載狀態顯示
- [ ] 錯誤提示清晰
- [ ] 成功頁面信息完整
- [ ] 一鍵撥打功能（移動端）

### 安全測試
- [ ] Token 無法猜測
- [ ] 併發控制有效
- [ ] 敏感信息不洩露（搶單前）
- [ ] SQL 注入防護
- [ ] XSS 防護

---

## 🚀 部署注意事項

1. **環境變數配置**
   ```env
   NEXT_PUBLIC_APP_URL=https://your-domain.com
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   ```

2. **HTTPS 必需**
   - 微信群中的鏈接必須使用 HTTPS
   - 可使用 Vercel / Netlify 免費 SSL

3. **域名備案**（如果在國內）
   - 國內服務器需要域名備案
   - 或使用香港/海外服務器

---

**搶單頁面開發完成後，整個微信群派單系統就上線了！** 🎉
