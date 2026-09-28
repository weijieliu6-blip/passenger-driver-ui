'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { MapPin, Calendar, Users, Luggage, Car, CheckCircle, Clock, AlertCircle, Baby, User, Phone, ClipboardList } from 'lucide-react'
import { LocaleSwitcher } from '@/components/locale-switcher'
import { useT } from '@/components/i18n-provider'
import { getLocationsByArea } from '@/lib/location-coords'

// Leaflet 必須動態加載（瀏覽器 API only, 不能 SSR）
const PickupMap = dynamic(() => import('@/components/pickup-map'), {
  ssr: false,
  loading: () => (
    <div className="rounded-lg border border-slate-700/50 bg-slate-900/30 flex items-center justify-center text-slate-500 text-sm" style={{ height: '280px' }}>
      載入地圖中...
    </div>
  ),
})

export default function HomePage() {
  const router = useRouter()
  const t = useT()
  const [authState, setAuthState] = useState<'loading' | 'guest' | 'passenger'>('loading')
  
  // 檢查登入狀態
  useEffect(() => {
    checkAuth()
  }, [])
  
  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth/me')
      const data = await response.json()
      if (data.authenticated) {
        setAuthState('passenger')
        // 自動填充已登入用戶的姓名和電話
        if (data.user) {
          setFormData(prev => ({
            ...prev,
            passengerName: data.user.name || '',
            passengerPhone: data.user.phone || ''
          }))
        }
      } else {
        setAuthState('guest')
      }
    } catch {
      setAuthState('guest')
    }
  }
  
  const handleUserButtonClick = () => {
    if (authState === 'passenger') {
      router.push('/passenger/profile')
    } else {
      router.push('/passenger/login?redirect=/passenger/profile')
    }
  }
  const [formData, setFormData] = useState({
    serviceType: 'cross_border', // 'cross_border' | 'mainland_local' (跨境專車 | 內地專車)
    direction: 'hk_to_mainland', // 跨境: 'hk_to_mainland' | 'mainland_to_hk' / 內地: 'sz_to_sw' | 'sw_to_sz'
    pickupLocation: '',
    pickupArea: '', // 香港區域或內地具體地點
    dropoffLocation: '',
    dropoffArea: '', // 香港區域或內地具體地點
    departureDate: '', // 出發日期
    departureTime: '', // 出發時間
    passengers: 1,
    luggage: 0,
    vehicleType: '7_seat', // '7_seat', '8_seat', '4_seat'
    isCharter: false, // 是否包車
    hasChild: false, // 是否有孩童
    childType: '', // 'infant' 或 'over_3'
    passengerName: '', // 乘客姓名
    passengerPhone: '', // 乘客電話
    passengerNotes: '', // 備註
  })

  // 香港區域選項
  type AreaOption = { value: string; label: string; disabled?: boolean }
  const hkAreas: Record<string, AreaOption[]> = {
    '九龍': [
      { value: '', label: '請選擇區域', disabled: true },
      { value: '黃大仙區', label: '黃大仙區' },
      { value: '九龍城區', label: '九龍城區' },
      { value: '觀塘區', label: '觀塘區' },
      { value: '深水埗區', label: '深水埗區' },
      { value: '油尖旺區', label: '油尖旺區' },
      { value: '離島區', label: '離島區' },
    ],
    '新界': [
      { value: '', label: '請選擇區域' },
      { value: '葵青區', label: '葵青區' },
      { value: '荃灣區', label: '荃灣區' },
      { value: '屯門區', label: '屯門區' },
      { value: '元朗區', label: '元朗區' },
      { value: '北區', label: '北區' },
      { value: '大埔區', label: '大埔區' },
      { value: '沙田區', label: '沙田區' },
      { value: '西貢區', label: '西貢區' },
    ],
    '港島': [
      { value: '', label: '請選擇區域' },
      { value: '中西區', label: '中西區' },
      { value: '灣仔區', label: '灣仔區' },
      { value: '東區', label: '東區' },
      { value: '南區', label: '南區' },
    ],
  }

  // 汕尾地點選項
  const shanweiLocations = [
    { value: '', label: '請選擇汕尾地點', disabled: true },
    { value: '汕尾城區', label: '汕尾城區' },
    { value: '海豐縣', label: '海豐縣' },
    { value: '陸豐市', label: '陸豐市' },
    { value: '紅海灣', label: '紅海灣' },
    { value: '華僑管理區', label: '華僑管理區' },
  ]

  // 深圳地點選項（口岸和熱門地點）
  const shenzhenLocations = [
    { value: '', label: '請選擇深圳地點', disabled: true },
    { value: '深圳灣口岸', label: '深圳灣口岸' },
    { value: '羅湖口岸', label: '羅湖口岸' },
    { value: '福田口岸', label: '福田口岸' },
    { value: '文錦渡口岸', label: '文錦渡口岸' },
    { value: '沙頭角口岸', label: '沙頭角口岸' },
    { value: '福田中心區', label: '福田中心區' },
    { value: '羅湖商業區', label: '羅湖商業區' },
    { value: '南山科技園', label: '南山科技園' },
    { value: '寶安中心', label: '寶安中心' },
    { value: '深圳機場', label: '深圳機場' },
    { value: '深圳北站', label: '深圳北站' },
    { value: '深圳站', label: '深圳站' },
  ]

  // 判斷地點是否為香港（需要顯示區域選擇）
  const isHkLocation = (location: string) => {
    return ['九龍', '新界', '港島'].includes(location)
  }

  // 判斷地點是否為汕尾
  const isShanweiLocation = (location: string) => {
    return location === '汕尾'
  }

  // 判斷地點是否為深圳
  const isShenzhenLocation = (location: string) => {
    return location === '深圳'
  }

  // 獲取對應的區域選項
  const getAreaOptions = (location: string) => {
    if (isHkLocation(location)) {
      return hkAreas[location as keyof typeof hkAreas] || []
    } else if (isShanweiLocation(location)) {
      return shanweiLocations
    } else if (isShenzhenLocation(location)) {
      return shenzhenLocations
    }
    return []
  }

  // 根據方向獲取出發地和目的地選項
  const getLocationOptions = () => {
    // 跨境專車
    if (formData.serviceType === 'cross_border') {
      if (formData.direction === 'hk_to_mainland') {
        // 香港 → 內地
        return {
          pickup: [
            { value: '', label: '請選擇出發地 (香港)', disabled: true },
            { value: '香港國際機場', label: '香港國際機場' },
            { value: '九龍', label: '九龍' },
            { value: '新界', label: '新界' },
            { value: '港島', label: '港島' },
          ],
          dropoff: [
            { value: '', label: '請選擇目的地 (內地)', disabled: true },
            { value: '深圳', label: '深圳' },
            { value: '汕尾', label: '汕尾' },
          ]
        }
      } else {
        // 內地 → 香港
        return {
          pickup: [
            { value: '', label: '請選擇出發地 (內地)', disabled: true },
            { value: '深圳', label: '深圳' },
            { value: '汕尾', label: '汕尾' },
          ],
          dropoff: [
            { value: '', label: '請選擇目的地 (香港)', disabled: true },
            { value: '香港國際機場', label: '香港國際機場' },
            { value: '九龍', label: '九龍' },
            { value: '新界', label: '新界' },
            { value: '港島', label: '港島' },
          ]
        }
      }
    } else {
      // 內地專車
      if (formData.direction === 'sz_to_sw') {
        // 深圳 → 汕尾
        return {
          pickup: [
            { value: '', label: '請選擇出發地 (深圳)', disabled: true },
            { value: '深圳', label: '深圳' },
          ],
          dropoff: [
            { value: '', label: '請選擇目的地 (汕尾)', disabled: true },
            { value: '汕尾', label: '汕尾' },
          ]
        }
      } else {
        // 汕尾 → 深圳
        return {
          pickup: [
            { value: '', label: '請選擇出發地 (汕尾)', disabled: true },
            { value: '汕尾', label: '汕尾' },
          ],
          dropoff: [
            { value: '', label: '請選擇目的地 (深圳)', disabled: true },
            { value: '深圳', label: '深圳' },
          ]
        }
      }
    }
  }

  // 判斷是否為香港線路（跨境專車）
  const isHongKongRoute = () => {
    return formData.serviceType === 'cross_border'
  }

  // 獲取車輛選項
  const getVehicleOptions = () => {
    const isHkRoute = isHongKongRoute()
    return [
      { 
        value: '4_seat', 
        label: '4座車', 
        desc: '僅適用於深圳⇄汕尾線路', 
        maxPassengers: 3,
        disabled: isHkRoute,
        disabledReason: '4座車不適用於香港線路（因跨境車輛需要特殊牌照）'
      },
      { value: '7_seat', label: '7座車', desc: '適合小家庭', maxPassengers: 6, disabled: false },
      { value: '8_seat', label: '8座車', desc: '適合大團體', maxPassengers: 7, disabled: false },
    ]
  }

  // 獲取當前車輛的最大乘客數
  const getMaxPassengers = () => {
    const vehicle = getVehicleOptions().find(v => v.value === formData.vehicleType)
    return vehicle ? vehicle.maxPassengers : 6
  }

  // 獲取可選人數選項
  const getPassengerOptions = () => {
    if (formData.isCharter) {
      // 包車模式：只能選擇最大人數
      const maxPassengers = getMaxPassengers()
      return [{ value: maxPassengers, label: `包車 ${maxPassengers} 人` }]
    } else {
      // 拼車模式：從1到最大人數
      const maxPassengers = getMaxPassengers()
      return Array.from({ length: maxPassengers }, (_, i) => ({
        value: i + 1,
        label: `${i + 1} 人`
      }))
    }
  }

  // 生成日期選項（今天起的30天）
  const getDateOptions = () => {
    const dates = []
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

  // 生成時間選項（每30分鐘一個選項）
  const getTimeOptions = () => {
    const times = []
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
        times.push({ value: timeStr, label: timeStr })
      }
    }
    return times
  }

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

  // 處理服務類型切換（跨境專車 / 內地專車）
  const handleServiceTypeChange = (serviceType: 'cross_border' | 'mainland_local') => {
    setFormData({
      ...formData,
      serviceType,
      direction: serviceType === 'cross_border' ? 'hk_to_mainland' : 'sz_to_sw',
      pickupLocation: '',
      pickupArea: '',
      dropoffLocation: '',
      dropoffArea: '',
      vehicleType: '7_seat',
      isCharter: false,
    })
  }

  // 當方向改變時，重置地點、區域和包車狀態
  const handleDirectionChange = (direction: string) => {
    setFormData({
      ...formData,
      direction,
      pickupLocation: '',
      pickupArea: '',
      dropoffLocation: '',
      dropoffArea: '',
      isCharter: false,
    })
  }

  // 當出發地改變時，清除區域選擇，並檢查車輛類型是否適用
  const handlePickupChange = (location: string) => {
    const newFormData = {
      ...formData,
      pickupLocation: location,
      pickupArea: '',
    }
    
    // 檢查當前車輛是否適用
    setFormData(newFormData)
    
    // 如果選擇了4座車且路線包含香港，需要重置並提示
    if (formData.vehicleType === '4_seat') {
      const hkLocations = ['九龍', '新界', '港島']
      if (hkLocations.includes(location) || hkLocations.includes(formData.dropoffLocation)) {
        setTimeout(() => {
          alert('4座車不適用於香港線路（因跨境車輛需要特殊牌照），請重新選擇車輛類型')
          setFormData({
            ...newFormData,
            vehicleType: '7_seat'
          })
        }, 100)
      }
    }
  }

  // 當目的地改變時，清除區域選擇，並檢查車輛類型是否適用
  const handleDropoffChange = (location: string) => {
    const newFormData = {
      ...formData,
      dropoffLocation: location,
      dropoffArea: '',
    }
    
    setFormData(newFormData)
    
    // 如果選擇了4座車且路線包含香港，需要重置並提示
    if (formData.vehicleType === '4_seat') {
      const hkLocations = ['九龍', '新界', '港島']
      if (hkLocations.includes(location) || hkLocations.includes(formData.pickupLocation)) {
        setTimeout(() => {
          alert('4座車不適用於香港線路（因跨境車輛需要特殊牌照），請重新選擇車輛類型')
          setFormData({
            ...newFormData,
            vehicleType: '7_seat'
          })
        }, 100)
      }
    }
  }

  // 當車輛類型改變時，重置人數
  const handleVehicleTypeChange = (type: string) => {
    setFormData({
      ...formData,
      vehicleType: type,
      passengers: 1,
      isCharter: false,
    })
  }

  // 當包車選項改變時，自動設置人數為最大值
  const handleCharterChange = (isCharter: boolean) => {
    setFormData({
      ...formData,
      isCharter,
      passengers: isCharter ? getMaxPassengers() : 1,
    })
  }

  // 處理孩童選項變更
  const handleChildChange = (checked: boolean) => {
    setFormData({ 
      ...formData, 
      hasChild: checked,
      childType: '' // 清空孩童類型
    })
  }

  // 處理孩童類型變更
  const handleChildTypeChange = (type: string) => {
    setFormData({ 
      ...formData, 
      childType: type
    })
    
    // 如果選擇3歲以上，彈出提示
    if (type === 'over_3') {
      setTimeout(() => {
        alert('3歲以上孩童將會計算一個座位')
      }, 100)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    console.log('=== 表单提交 ===', formData)

    // 驗證姓名和電話
    if (!formData.passengerName || !formData.passengerPhone) {
      alert('❌ 請填寫乘客姓名和電話')
      return
    }

    // 验证出发地
    if (!formData.pickupLocation) {
      alert('❌ 請選擇出發地')
      return
    }

    // 验证出发地区域（如果需要）
    if (isHkLocation(formData.pickupLocation) || isShanweiLocation(formData.pickupLocation) || isShenzhenLocation(formData.pickupLocation)) {
      if (!formData.pickupArea) {
        alert('❌ 請選擇出發地的具體區域/地點')
        return
      }
    }

    // 验证目的地
    if (!formData.dropoffLocation) {
      alert('❌ 請選擇目的地')
      return
    }

    // 验证目的地区域（如果需要）
    if (isHkLocation(formData.dropoffLocation) || isShanweiLocation(formData.dropoffLocation) || isShenzhenLocation(formData.dropoffLocation)) {
      if (!formData.dropoffArea) {
        alert('❌ 請選擇目的地的具體區域/地點')
        return
      }
    }

    // 驗證日期和時間
    if (!formData.departureDate || !formData.departureTime) {
      alert('❌ 請選擇出發日期和時間')
      return
    }

    // 验证孩童类型（如果勾选了孩童）
    if (formData.hasChild && !formData.childType) {
      alert('❌ 請選擇孩童年齡類型')
      return
    }

    // ✅ 訪客模式：彈出註冊提示（推薦註冊，可選擇跳過繼續訪客預約）
    if (authState === 'guest') {
      const choice = window.confirm(
        '👋 建議先註冊帳號！\n\n' +
        '✅ 註冊好處：\n' +
        '  • 即時查看訂單狀態、司機報價\n' +
        '  • 訂單歷史 / 電子收據\n' +
        '  • 一鍵聯繫客服\n' +
        '  • 收藏常用路線\n\n' +
        '📝 點「確定」前往註冊/登入\n' +
        '📝 點「取消」以訪客身份繼續預約'
      )
      if (choice) {
        // 把 formData 存到 sessionStorage，登入後可恢復
        sessionStorage.setItem('pendingBooking', JSON.stringify(formData))
        router.push('/passenger/login?redirect=/')
        return
      }
      // 用戶選擇「以訪客身份繼續」→ 繼續
    }

    console.log('✅ 驗證通過，跳轉到確認頁面')

    // 將表單數據存儲到 localStorage 以便在確認頁面使用
    localStorage.setItem('bookingData', JSON.stringify(formData))

    // 跳轉到確認頁面
    router.push('/confirm')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="border-b border-slate-700/50 bg-slate-900/50 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-50">{t('home.page_title')}</h1>
            <p className="text-sm text-slate-400 mt-1">{t('home.page_subtitle')}</p>
          </div>

          {/* 右上角用户入口 — 圖標式 */}
          <div className="flex items-center gap-2">
            {/* 語言切換（圖標） */}
            <LocaleSwitcher iconOnly />

            {/* 我的訂單（僅登入後顯示） */}
            {authState === 'passenger' && (
              <button
                onClick={() => router.push('/passenger/orders')}
                aria-label={t('nav.my_orders')}
                title={t('nav.my_orders')}
                className="w-9 h-9 flex items-center justify-center rounded-full bg-slate-800/80 backdrop-blur-sm border border-slate-700 hover:border-cyan-500/50 text-slate-300 hover:text-cyan-400 transition-all"
              >
                <ClipboardList className="w-4 h-4" />
              </button>
            )}

            {/* 個人中心 / 登入 — 圓形頭像按鈕 */}
            <button
              onClick={handleUserButtonClick}
              aria-label={authState === 'passenger' ? t('nav.profile') : t('nav.login')}
              title={authState === 'passenger' ? t('nav.profile') : t('nav.login')}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 transition-all hover:scale-105 shadow-md shadow-cyan-500/20"
            >
              <User className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 服務狀態卡片 */}
        <div className="mb-6 bg-gradient-to-r from-cyan-500/10 to-teal-500/10 border border-cyan-500/30 rounded-xl p-4 backdrop-blur">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 bg-gradient-to-br from-cyan-500 to-teal-500 rounded-lg flex items-center justify-center">
              <Car className="w-6 h-6 text-slate-900" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-slate-50">{t('home.page_subtitle')}</h3>
              <p className="text-xs text-cyan-300">{t('home.tagline')}</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-2 bg-slate-900/30 rounded-lg">
              <div className="flex items-center justify-center gap-1 mb-0.5">
                <CheckCircle className="w-3 h-3 text-green-400" />
                <span className="text-xs font-medium text-slate-300">{t('home.online_drivers')}</span>
              </div>
              <div className="text-xl font-bold text-cyan-400">127</div>
            </div>
            <div className="text-center p-2 bg-slate-900/30 rounded-lg">
              <div className="flex items-center justify-center gap-1 mb-0.5">
                <Clock className="w-3 h-3 text-yellow-400" />
                <span className="text-xs font-medium text-slate-300">{t('home.avg_response')}</span>
              </div>
              <div className="text-xl font-bold text-cyan-400">{t('home.avg_response_val')}</div>
            </div>
            <div className="text-center p-2 bg-slate-900/30 rounded-lg">
              <div className="flex items-center justify-center gap-1 mb-0.5">
                <CheckCircle className="w-3 h-3 text-cyan-400" />
                <span className="text-xs font-medium text-slate-300">{t('home.service_status')}</span>
              </div>
              <div className="text-base font-bold text-green-400">{t('home.service_normal')}</div>
            </div>
          </div>
        </div>

        {/* 已登入用戶提示 */}
        {authState === 'passenger' && (
          <div className="mb-4 p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-teal-500 rounded-full flex items-center justify-center">
                <User className="w-4 h-4 text-white" />
              </div>
              <div>
                <div className="text-sm font-medium text-cyan-400">{t('home.logged_in.title')}</div>
                <div className="text-xs text-slate-400">{t('home.logged_in.desc')}</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => router.push('/passenger/profile/edit')}
              className="text-xs text-cyan-400 hover:text-cyan-300"
            >
              {t('home.logged_in.edit')}
            </button>
          </div>
        )}

        {/* 預約表單卡片 */}
        <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-2xl p-6 shadow-xl">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-slate-50 mb-1">{t('home.book_section.title')}</h2>
            <p className="text-sm text-slate-400">{t('home.book_section.subtitle')}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* 乘客信息 */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="passengerName" className="block text-sm font-medium text-slate-300 mb-2">
                  <User className="inline w-4 h-4 mr-1" />
                  {t('form.name')}
                </label>
                <input
                  type="text"
                  id="passengerName"
                  required
                  value={formData.passengerName}
                  onChange={(e) => setFormData({ ...formData, passengerName: e.target.value })}
                  placeholder={t('home.book_section.name_ph')}
                  className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-slate-50 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition"
                />
              </div>

              <div>
                <label htmlFor="passengerPhone" className="block text-sm font-medium text-slate-300 mb-2">
                  <Phone className="inline w-4 h-4 mr-1" />
                  {t('form.contact')}
                </label>
                <input
                  type="tel"
                  id="passengerPhone"
                  required
                  value={formData.passengerPhone}
                  onChange={(e) => setFormData({ ...formData, passengerPhone: e.target.value })}
                  placeholder={t('home.book_section.phone_ph')}
                  className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-slate-50 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition"
                />
              </div>
            </div>

            {/* 服務類型選擇 */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                <Car className="inline w-4 h-4 mr-1" />
                {t('form.service_type')}
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleServiceTypeChange('cross_border')}
                  className={`px-4 py-3 rounded-lg border transition-all text-sm ${
                    formData.serviceType === 'cross_border'
                      ? 'border-cyan-500 bg-cyan-500/10 text-cyan-400'
                      : 'border-slate-600 bg-slate-900/30 text-slate-400 hover:border-slate-500'
                  }`}
                >
                  <div className="font-medium">🌏 {t('form.service.cross_border')}</div>
                </button>
                <button
                  type="button"
                  onClick={() => handleServiceTypeChange('mainland_local')}
                  className={`px-4 py-3 rounded-lg border transition-all text-sm ${
                    formData.serviceType === 'mainland_local'
                      ? 'border-cyan-500 bg-cyan-500/10 text-cyan-400'
                      : 'border-slate-600 bg-slate-900/30 text-slate-400 hover:border-slate-500'
                  }`}
                >
                  <div className="font-medium">🚗 {t('form.service.mainland_local')}</div>
                </button>
              </div>
            </div>

            {/* 行程方向選擇 */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                <MapPin className="inline w-4 h-4 mr-1" />
                {t('form.direction')}
              </label>
              {formData.serviceType === 'cross_border' ? (
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => handleDirectionChange('hk_to_mainland')}
                    className={`px-4 py-2.5 rounded-lg border transition-all text-sm ${
                      formData.direction === 'hk_to_mainland'
                        ? 'border-cyan-500 bg-cyan-500/10 text-cyan-400'
                        : 'border-slate-600 bg-slate-900/30 text-slate-400 hover:border-slate-500'
                    }`}
                  >
                    {t('form.dir.hk_to_mainland')}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDirectionChange('mainland_to_hk')}
                    className={`px-4 py-2.5 rounded-lg border transition-all text-sm ${
                      formData.direction === 'mainland_to_hk'
                        ? 'border-cyan-500 bg-cyan-500/10 text-cyan-400'
                        : 'border-slate-600 bg-slate-900/30 text-slate-400 hover:border-slate-500'
                    }`}
                  >
                    {t('form.dir.mainland_to_hk')}
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => handleDirectionChange('sz_to_sw')}
                    className={`px-4 py-2.5 rounded-lg border transition-all text-sm ${
                      formData.direction === 'sz_to_sw'
                        ? 'border-cyan-500 bg-cyan-500/10 text-cyan-400'
                        : 'border-slate-600 bg-slate-900/30 text-slate-400 hover:border-slate-500'
                    }`}
                  >
                    {t('form.dir.sz_to_sw')}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDirectionChange('sw_to_sz')}
                    className={`px-4 py-2.5 rounded-lg border transition-all text-sm ${
                      formData.direction === 'sw_to_sz'
                        ? 'border-cyan-500 bg-cyan-500/10 text-cyan-400'
                        : 'border-slate-600 bg-slate-900/30 text-slate-400 hover:border-slate-500'
                    }`}
                  >
                    {t('form.dir.sw_to_sz')}
                  </button>
                </div>
              )}
            </div>

            {/* 出發地 */}
            <div>
              <label htmlFor="pickupLocation" className="block text-sm font-medium text-slate-300 mb-2">
                <MapPin className="inline w-4 h-4 mr-1" />
                {t('form.pickup')}
              </label>
              <select
                id="pickupLocation"
                required
                value={formData.pickupLocation}
                onChange={(e) => handlePickupChange(e.target.value)}
                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-slate-50 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition"
              >
                {getLocationOptions().pickup.map((option, index) => (
                  <option key={index} value={option.value} disabled={option.disabled}>
                    {option.label}
                  </option>
                ))}
              </select>
              
              {/* 香港區域選擇 - 出發地 */}
              {formData.serviceType === 'cross_border' && formData.direction === 'hk_to_mainland' && isHkLocation(formData.pickupLocation) && (
                <div className="mt-3 animate-fadeIn">
                  <label htmlFor="pickupArea" className="block text-sm font-medium text-slate-400 mb-2">
                    選擇區域
                  </label>
                  <select
                    id="pickupArea"
                    required
                    value={formData.pickupArea}
                    onChange={(e) => setFormData({ ...formData, pickupArea: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-800/50 border border-slate-500 rounded-lg text-slate-50 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition"
                  >
                    {getAreaOptions(formData.pickupLocation).map((option, index) => (
                      <option key={index} value={option.value} disabled={option.disabled}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* 內地地點選擇 - 出發地 (內地→香港 或 內地專車) */}
              {((formData.serviceType === 'cross_border' && formData.direction === 'mainland_to_hk') || formData.serviceType === 'mainland_local') && (isShanweiLocation(formData.pickupLocation) || isShenzhenLocation(formData.pickupLocation)) && (
                <div className="mt-3 animate-fadeIn">
                  <label htmlFor="pickupArea" className="block text-sm font-medium text-slate-400 mb-2">
                    選擇具體地點
                  </label>
                  <select
                    id="pickupArea"
                    required
                    value={formData.pickupArea}
                    onChange={(e) => setFormData({ ...formData, pickupArea: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-800/50 border border-slate-500 rounded-lg text-slate-50 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition"
                  >
                    {getAreaOptions(formData.pickupLocation).map((option, index) => (
                      <option key={index} value={option.value} disabled={option.disabled}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* 🗺️ Uber 風格地圖：同時顯示起點（綠）+ 終點（紅）+ 連線 */}
              {(formData.pickupLocation || formData.dropoffLocation) && (() => {
                const pickupMapLocations = formData.pickupLocation
                  ? getLocationsByArea(formData.pickupLocation)
                  : []
                const dropoffMapLocations = formData.dropoffLocation
                  ? getLocationsByArea(formData.dropoffLocation)
                  : []
                if (pickupMapLocations.length === 0 && dropoffMapLocations.length === 0) {
                  return null
                }
                return (
                  <div className="mt-3 animate-fadeIn">
                    <label className="block text-xs font-medium text-slate-400 mb-2 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-cyan-400" />
                      行程路線預覽
                      <span className="ml-1 text-slate-500 text-[10px]">· 點擊 marker 可切換</span>
                    </label>
                    <PickupMap
                      height="320px"
                      pickupLocations={pickupMapLocations}
                      pickupName={formData.pickupArea || null}
                      onPickupSelect={(loc) => setFormData({ ...formData, pickupArea: loc.name })}
                      dropoffLocations={dropoffMapLocations}
                      dropoffName={formData.dropoffArea || null}
                      onDropoffSelect={(loc) => setFormData({ ...formData, dropoffArea: loc.name })}
                    />
                  </div>
                )
              })()}
            </div>

            {/* 目的地 */}
            <div>
              <label htmlFor="dropoffLocation" className="block text-sm font-medium text-slate-300 mb-2">
                <MapPin className="inline w-4 h-4 mr-1" />
                {t('form.dropoff')}
              </label>
              <select
                id="dropoffLocation"
                required
                value={formData.dropoffLocation}
                onChange={(e) => handleDropoffChange(e.target.value)}
                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-slate-50 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition"
              >
                {getLocationOptions().dropoff.map((option, index) => (
                  <option key={index} value={option.value} disabled={option.disabled}>
                    {option.label}
                  </option>
                ))}
              </select>
              
              {/* 香港區域選擇 - 目的地 */}
              {formData.serviceType === 'cross_border' && formData.direction === 'mainland_to_hk' && isHkLocation(formData.dropoffLocation) && (
                <div className="mt-3 animate-fadeIn">
                  <label htmlFor="dropoffArea" className="block text-sm font-medium text-slate-400 mb-2">
                    選擇區域
                  </label>
                  <select
                    id="dropoffArea"
                    required
                    value={formData.dropoffArea}
                    onChange={(e) => setFormData({ ...formData, dropoffArea: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-800/50 border border-slate-500 rounded-lg text-slate-50 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition"
                  >
                    {getAreaOptions(formData.dropoffLocation).map((option, index) => (
                      <option key={index} value={option.value} disabled={option.disabled}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* 內地地點選擇 - 目的地 (香港→內地 或 內地專車) */}
              {((formData.serviceType === 'cross_border' && formData.direction === 'hk_to_mainland') || formData.serviceType === 'mainland_local') && (isShanweiLocation(formData.dropoffLocation) || isShenzhenLocation(formData.dropoffLocation)) && (
                <div className="mt-3 animate-fadeIn">
                  <label htmlFor="dropoffArea" className="block text-sm font-medium text-slate-400 mb-2">
                    選擇具體地點
                  </label>
                  <select
                    id="dropoffArea"
                    required
                    value={formData.dropoffArea}
                    onChange={(e) => setFormData({ ...formData, dropoffArea: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-800/50 border border-slate-500 rounded-lg text-slate-50 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition"
                  >
                    {getAreaOptions(formData.dropoffLocation).map((option, index) => (
                      <option key={index} value={option.value} disabled={option.disabled}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* 車輛類型 */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                <Car className="inline w-4 h-4 mr-1" />
                {t('form.vehicle')}
              </label>
              <div className="grid grid-cols-3 gap-3">
                {getVehicleOptions().map((vehicle) => (
                  <button
                    key={vehicle.value}
                    type="button"
                    onClick={() => !vehicle.disabled && handleVehicleTypeChange(vehicle.value)}
                    disabled={vehicle.disabled}
                    title={vehicle.disabled ? vehicle.disabledReason : vehicle.desc}
                    className={`px-3 py-2.5 rounded-lg border transition-all text-sm ${
                      vehicle.disabled
                        ? 'border-slate-700 bg-slate-900/20 text-slate-600 cursor-not-allowed opacity-50'
                        : formData.vehicleType === vehicle.value
                        ? 'border-cyan-500 bg-cyan-500/10 text-cyan-400 font-medium'
                        : 'border-slate-600 bg-slate-900/30 text-slate-400 hover:border-slate-500'
                    }`}
                  >
                    {vehicle.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 出發日期與時間 */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-3">
                <Calendar className="inline w-4 h-4 mr-1" />
                {t('form.date')}
              </label>

              <div className="grid grid-cols-2 gap-4">
                {/* 日期選擇 */}
                <div>
                  <label htmlFor="departureDate" className="block text-xs font-medium text-slate-400 mb-2">
                    {t('form.date_pick')}
                  </label>
                  <select
                    id="departureDate"
                    required
                    value={formData.departureDate}
                    onChange={(e) => setFormData({ ...formData, departureDate: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-slate-50 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition"
                    suppressHydrationWarning
                  >
                    <option value="">{t('form.date_placeholder')}</option>
                    {getDateOptions().map((date) => (
                      <option key={date.value} value={date.value}>
                        {date.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 時間選擇 */}
                <div>
                  <label htmlFor="departureTime" className="block text-xs font-medium text-slate-400 mb-2">
                    {t('form.time_pick')}
                  </label>
                  <select
                    id="departureTime"
                    required
                    value={formData.departureTime}
                    onChange={(e) => setFormData({ ...formData, departureTime: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-slate-50 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition"
                    suppressHydrationWarning
                  >
                    <option value="">{t('form.time_placeholder')}</option>
                    {getTimeOptions().map((time) => (
                      <option key={time.value} value={time.value}>
                        {time.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* 乘車人數和行李數量 */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="passengers" className="block text-sm font-medium text-slate-300 mb-2">
                  <Users className="inline w-4 h-4 mr-1" />
                  {t('form.passengers')}
                </label>

                {/* 包車和孩童選項 */}
                <div className="mb-3 space-y-2">
                  <label className="flex items-center gap-2 p-2 bg-slate-900/50 border border-slate-600 rounded-lg cursor-pointer hover:border-cyan-500 transition text-sm">
                    <input
                      type="checkbox"
                      checked={formData.isCharter}
                      onChange={(e) => handleCharterChange(e.target.checked)}
                      className="w-4 h-4 text-cyan-500 bg-slate-800 border-slate-500 rounded focus:ring-cyan-500 focus:ring-2"
                    />
                    <span className="text-slate-300">{t('form.charter')}</span>
                  </label>

                  <label className="flex items-center gap-2 p-2 bg-slate-900/50 border border-slate-600 rounded-lg cursor-pointer hover:border-cyan-500 transition text-sm">
                    <input
                      type="checkbox"
                      checked={formData.hasChild}
                      onChange={(e) => handleChildChange(e.target.checked)}
                      className="w-4 h-4 text-cyan-500 bg-slate-800 border-slate-500 rounded focus:ring-cyan-500 focus:ring-2"
                    />
                    <Baby className="inline w-4 h-4 text-slate-400" />
                    <span className="text-slate-300">{t('form.child')}</span>
                  </label>
                </div>

                {/* 孩童類型選擇（勾選孩童後顯示） */}
                {formData.hasChild && (
                  <div className="mb-3 animate-fadeIn">
                    <select
                      id="childType"
                      required={formData.hasChild}
                      value={formData.childType}
                      onChange={(e) => handleChildTypeChange(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-slate-800/50 border border-slate-500 rounded-lg text-slate-50 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition"
                    >
                      <option value="">{t('form.child_age_ph')}</option>
                      <option value="infant">{t('form.child_infant')}</option>
                      <option value="over_3">{t('form.child_over_3')}</option>
                    </select>

                    {formData.childType === 'over_3' && (
                      <div className="mt-2 text-xs text-orange-400 bg-orange-500/10 px-2 py-1.5 rounded border border-orange-500/30 flex items-start gap-1">
                        <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                        <span>{t('form.child_seat_note')}</span>
                      </div>
                    )}
                  </div>
                )}

                <select
                  id="passengers"
                  value={formData.passengers}
                  onChange={(e) => setFormData({ ...formData, passengers: Number(e.target.value) })}
                  disabled={formData.isCharter}
                  className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-slate-50 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {getPassengerOptions().map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="luggage" className="block text-sm font-medium text-slate-300 mb-2">
                  <Luggage className="inline w-4 h-4 mr-1" />
                  {t('form.luggage')}
                </label>
                <select
                  id="luggage"
                  value={formData.luggage}
                  onChange={(e) => setFormData({ ...formData, luggage: Number(e.target.value) })}
                  className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-slate-50 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition"
                >
                  {[0, 1, 2, 3, 4, 5, 6].map((num) => (
                    <option key={num} value={num}>{num} 件</option>
                  ))}
                </select>
              </div>
            </div>

            {/* 醒目的預約按鈕 */}
            <button
              type="submit"
              className="w-full bg-gradient-to-r from-cyan-500 to-teal-500 text-slate-900 font-bold text-lg py-4 px-6 rounded-xl hover:from-cyan-400 hover:to-teal-400 focus:outline-none focus:ring-4 focus:ring-cyan-500/50 transition-all shadow-lg shadow-cyan-500/20 transform hover:scale-[1.01] active:scale-[0.99]"
            >
              {t('form.submit')}
            </button>

            {/* 預估車資顯示 */}
            {formData.pickupLocation && formData.dropoffLocation && (() => {
              const fare = calculateEstimatedFare()
              return fare ? (
                <div className="bg-gradient-to-r from-orange-500/10 to-amber-500/10 border border-orange-500/30 rounded-lg p-4 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-slate-400">💰 {t('form.estimate')}</div>
                    <div className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-400">
                      HK$ {fare.minFare} - {fare.maxFare}
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-slate-500">
                    * {t('form.fare_note')}
                  </div>
                </div>
              ) : null
            })()}
          </form>

          {/* 提示信息 */}
          <div className="mt-4 p-3 bg-slate-900/50 border border-slate-700/50 rounded-lg">
            <p className="text-xs text-slate-400 leading-relaxed">
              💡 <span className="font-medium text-slate-300">{t('form.tip.label')}</span>
              {t('form.tip.body')}
            </p>
          </div>
        </div>

        {/* Features Section - 始終三列並排（手機也並排，更緊湊） */}
        <div className="mt-8 grid grid-cols-3 gap-3 md:gap-4">
          <div className="text-center p-3 md:p-4 bg-slate-800/30 border border-slate-700/30 rounded-lg">
            <div className="w-10 h-10 bg-cyan-500/10 rounded-lg flex items-center justify-center mx-auto mb-2">
              <MapPin className="w-5 h-5 text-cyan-400" />
            </div>
            <h3 className="font-semibold text-slate-200 mb-1 text-xs md:text-sm">{t('home.feature.door2door')}</h3>
            <p className="text-[10px] md:text-xs text-slate-400 leading-relaxed">{t('home.feature.door2door.desc')}</p>
          </div>

          <div className="text-center p-3 md:p-4 bg-slate-800/30 border border-slate-700/30 rounded-lg">
            <div className="w-10 h-10 bg-cyan-500/10 rounded-lg flex items-center justify-center mx-auto mb-2">
              <Users className="w-5 h-5 text-cyan-400" />
            </div>
            <h3 className="font-semibold text-slate-200 mb-1 text-xs md:text-sm">{t('home.feature.no_commission')}</h3>
            <p className="text-[10px] md:text-xs text-slate-400 leading-relaxed">{t('home.feature.no_commission.desc')}</p>
          </div>

          <div className="text-center p-3 md:p-4 bg-slate-800/30 border border-slate-700/30 rounded-lg">
            <div className="w-10 h-10 bg-cyan-500/10 rounded-lg flex items-center justify-center mx-auto mb-2">
              <Calendar className="w-5 h-5 text-cyan-400" />
            </div>
            <h3 className="font-semibold text-slate-200 mb-1 text-xs md:text-sm">{t('home.feature.fast_reply')}</h3>
            <p className="text-[10px] md:text-xs text-slate-400 leading-relaxed">{t('home.feature.fast_reply.desc')}</p>
          </div>
        </div>
      </main>

      {/* Footer - 免責聲明 */}
      <footer className="mt-12 mb-6 px-4 max-w-2xl mx-auto">
        <div className="border-t border-slate-700/50 pt-6">
          <h4 className="text-xs font-semibold text-slate-300 mb-3 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
            免責聲明
          </h4>
          <div className="text-[11px] text-slate-500 leading-relaxed space-y-2">
            <p>
              • 本平台僅提供司機與乘客的<strong className="text-slate-400">信息撮合服務</strong>，不參與任何行程的實際運營，亦不收取任何費用。
            </p>
            <p>
              • 車資、路線及行程細節由司機與乘客<strong className="text-slate-400">自行協商並線下結算</strong>，平台不對交易內容承擔責任。
            </p>
            <p>
              • 用戶應自行核實司機身份、車輛狀況及相關證件，<strong className="text-slate-400">謹慎選擇</strong>並對自身安全負責。
            </p>
            <p>
              • 因行程中發生的任何<strong className="text-slate-400">人身、財產、交通糾紛</strong>，均由當事雙方依法律途徑解決，平台不承擔連帶責任。
            </p>
            <p className="pt-2 text-slate-600">
              使用本平台即視為同意以上條款。如有疑問，請聯繫客服。
            </p>
          </div>
          <p className="mt-4 text-[10px] text-slate-600 text-center">
            © {new Date().getFullYear()} 中港車預約平台 · Cross-Border Taxi Booking
          </p>
        </div>
      </footer>
    </div>
  )
}
