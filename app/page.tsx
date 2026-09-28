'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MapPin, Calendar, Users, Luggage, Car, CheckCircle, Clock } from 'lucide-react'

export default function HomePage() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    pickupLocation: '',
    dropoffLocation: '',
    departureTime: '',
    passengers: 1,
    luggage: 0,
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    // 將表單數據存儲到 localStorage 以便在確認頁面使用
    localStorage.setItem('bookingData', JSON.stringify(formData))
    
    // 跳轉到確認頁面
    router.push('/confirm')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="border-b border-slate-700/50 bg-slate-900/50 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <h1 className="text-2xl font-bold text-slate-50">中港車預約平台</h1>
          <p className="text-sm text-slate-400 mt-1">香港 ⇄ 汕尾 跨境包車服務</p>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 服務狀態卡片 */}
        <div className="mb-8 bg-gradient-to-r from-cyan-500/10 to-teal-500/10 border border-cyan-500/30 rounded-2xl p-6 backdrop-blur">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 bg-gradient-to-br from-cyan-500 to-teal-500 rounded-xl flex items-center justify-center">
              <Car className="w-8 h-8 text-slate-900" />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-slate-50 mb-1">平台服務狀態</h3>
              <p className="text-sm text-cyan-300">實時匹配，快速響應</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-3 bg-slate-900/30 rounded-lg">
              <div className="flex items-center justify-center gap-1 mb-1">
                <CheckCircle className="w-4 h-4 text-green-400" />
                <span className="text-sm font-medium text-slate-300">在線司機</span>
              </div>
              <div className="text-2xl font-bold text-cyan-400">127</div>
            </div>
            <div className="text-center p-3 bg-slate-900/30 rounded-lg">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Clock className="w-4 h-4 text-yellow-400" />
                <span className="text-sm font-medium text-slate-300">平均響應</span>
              </div>
              <div className="text-2xl font-bold text-cyan-400">3分鐘</div>
            </div>
            <div className="text-center p-3 bg-slate-900/30 rounded-lg">
              <div className="flex items-center justify-center gap-1 mb-1">
                <CheckCircle className="w-4 h-4 text-cyan-400" />
                <span className="text-sm font-medium text-slate-300">服務狀態</span>
              </div>
              <div className="text-lg font-bold text-green-400">正常</div>
            </div>
          </div>
        </div>

        {/* 預約表單卡片 */}
        {/* 預約表單卡片 */}
        <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-2xl p-8 shadow-xl">
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-slate-50 mb-2">預約您的行程</h2>
            <p className="text-slate-400">填寫以下信息，我們將為您匹配合適的司機</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 出發地 */}
            <div>
              <label htmlFor="pickupLocation" className="block text-sm font-medium text-slate-300 mb-2">
                <MapPin className="inline w-4 h-4 mr-1" />
                出發地
              </label>
              <input
                type="text"
                id="pickupLocation"
                required
                value={formData.pickupLocation}
                onChange={(e) => setFormData({ ...formData, pickupLocation: e.target.value })}
                placeholder="香港"
                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-slate-50 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition"
              />
            </div>

            {/* 目的地 */}
            <div>
              <label htmlFor="dropoffLocation" className="block text-sm font-medium text-slate-300 mb-2">
                <MapPin className="inline w-4 h-4 mr-1" />
                目的地
              </label>
              <input
                type="text"
                id="dropoffLocation"
                required
                value={formData.dropoffLocation}
                onChange={(e) => setFormData({ ...formData, dropoffLocation: e.target.value })}
                placeholder="汕尾"
                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-slate-50 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition"
              />
            </div>

            {/* 出發日期與時間 */}
            <div>
              <label htmlFor="departureTime" className="block text-sm font-medium text-slate-300 mb-2">
                <Calendar className="inline w-4 h-4 mr-1" />
                出發日期與時間
              </label>
              <input
                type="datetime-local"
                id="departureTime"
                required
                value={formData.departureTime}
                onChange={(e) => setFormData({ ...formData, departureTime: e.target.value })}
                min={new Date().toISOString().slice(0, 16)}
                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-slate-50 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition"
              />
            </div>

            {/* 乘車人數和行李數量 */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="passengers" className="block text-sm font-medium text-slate-300 mb-2">
                  <Users className="inline w-4 h-4 mr-1" />
                  乘車人數
                </label>
                <select
                  id="passengers"
                  value={formData.passengers}
                  onChange={(e) => setFormData({ ...formData, passengers: Number(e.target.value) })}
                  className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-slate-50 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition"
                >
                  {[1, 2, 3, 4, 5, 6, 7].map((num) => (
                    <option key={num} value={num}>{num} 人</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="luggage" className="block text-sm font-medium text-slate-300 mb-2">
                  <Luggage className="inline w-4 h-4 mr-1" />
                  行李數量
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

            {/* 醒目的預估車資按鈕 */}
            <button
              type="submit"
              className="w-full bg-gradient-to-r from-cyan-500 to-teal-500 text-slate-900 font-bold text-lg py-5 px-6 rounded-xl hover:from-cyan-400 hover:to-teal-400 focus:outline-none focus:ring-4 focus:ring-cyan-500/50 transition-all shadow-2xl shadow-cyan-500/30 transform hover:scale-[1.02] active:scale-[0.98]"
            >
              預估車資並預約
            </button>
          </form>

          {/* 提示信息 */}
          <div className="mt-6 p-4 bg-slate-900/50 border border-slate-700/50 rounded-lg">
            <p className="text-sm text-slate-400 leading-relaxed">
              💡 <span className="font-medium text-slate-300">溫馨提示：</span>
              提交訂單後，平台將為您匹配合適的司機。費用請直接與司機線下結算，平台不抽成。
            </p>
          </div>
        </div>

        {/* Features Section */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center p-6 bg-slate-800/30 border border-slate-700/30 rounded-xl">
            <div className="w-12 h-12 bg-cyan-500/10 rounded-lg flex items-center justify-center mx-auto mb-3">
              <MapPin className="w-6 h-6 text-cyan-400" />
            </div>
            <h3 className="font-semibold text-slate-200 mb-1">點對點接送</h3>
            <p className="text-sm text-slate-400">香港到汕尾門對門服務</p>
          </div>

          <div className="text-center p-6 bg-slate-800/30 border border-slate-700/30 rounded-xl">
            <div className="w-12 h-12 bg-cyan-500/10 rounded-lg flex items-center justify-center mx-auto mb-3">
              <Users className="w-6 h-6 text-cyan-400" />
            </div>
            <h3 className="font-semibold text-slate-200 mb-1">零抽成撮合</h3>
            <p className="text-sm text-slate-400">平台不抽成，價格更優惠</p>
          </div>

          <div className="text-center p-6 bg-slate-800/30 border border-slate-700/30 rounded-xl">
            <div className="w-12 h-12 bg-cyan-500/10 rounded-lg flex items-center justify-center mx-auto mb-3">
              <Calendar className="w-6 h-6 text-cyan-400" />
            </div>
            <h3 className="font-semibold text-slate-200 mb-1">快速響應</h3>
            <p className="text-sm text-slate-400">實時派單，快速匹配司機</p>
          </div>
        </div>
      </main>
    </div>
  )
}
