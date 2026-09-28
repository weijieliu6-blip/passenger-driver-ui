'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { CheckCircle, Home, MessageCircle, Search } from 'lucide-react'

export default function OrderSuccessPage() {
  return (
    <Suspense fallback={null}>
      <OrderSuccessContent />
    </Suspense>
  )
}

function OrderSuccessContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [orderNumber, setOrderNumber] = useState('')

  useEffect(() => {
    // 从 URL 参数获取订单号
    const orderNum = searchParams.get('orderNumber')
    if (orderNum) {
      setOrderNumber(orderNum)
    }
  }, [searchParams])

  useEffect(() => {
    // 5秒后自动返回首页
    const timer = setTimeout(() => {
      router.push('/')
    }, 5000)

    return () => clearTimeout(timer)
  }, [router])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* 成功图标 */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-green-500/20 rounded-full mb-6 animate-bounce">
            <CheckCircle className="w-12 h-12 text-green-400" />
          </div>
          <h1 className="text-3xl font-bold text-slate-100 mb-3">提交成功！</h1>
          <p className="text-slate-400">您的訂單已成功提交</p>
        </div>

        {/* 信息卡片 */}
        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-6 mb-6">
          <div className="space-y-4">
            {/* 订单号 */}
            {orderNumber && (
              <div className="p-4 bg-slate-900/50 border border-slate-600 rounded-lg">
                <p className="text-xs text-slate-400 mb-1">订单号</p>
                <p className="text-lg font-mono font-semibold text-slate-100">{orderNumber}</p>
              </div>
            )}

            <div className="flex items-start gap-3 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
              <MessageCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-slate-300 mb-2">
                  📲 司機將透過「釘釘」搶單並聯繫您，請保持電話暢通
                </p>
                <p className="text-xs text-slate-400">
                  訂單已推送至釘釘司機群，預計 2-24 小時內會有司機接單
                </p>
              </div>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between p-3 bg-slate-900/50 border border-slate-600 rounded-lg">
                <span className="text-slate-400">訂單狀態</span>
                <span className="text-cyan-400 font-medium">待接單（釘釘推送中）</span>
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-900/50 border border-slate-600 rounded-lg">
                <span className="text-slate-400">預計接單時間</span>
                <span className="text-slate-100 font-medium">2-24 小時</span>
              </div>
            </div>
          </div>
        </div>

        {/* 提示信息 */}
        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-6 mb-6">
          <h3 className="text-sm font-medium text-slate-300 mb-3">📌 下一步</h3>
          <ul className="space-y-2 text-sm text-slate-400">
            <li className="flex items-start gap-2">
              <span className="text-cyan-400 font-bold mt-0.5">1.</span>
              <span>司機在釘釘群看到訂單並搶單</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-cyan-400 font-bold mt-0.5">2.</span>
              <span>司機透過電話與您確認接送地點和時間</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-cyan-400 font-bold mt-0.5">3.</span>
              <span>乘車完成後與司機線下結算費用</span>
            </li>
          </ul>
        </div>

        {/* 操作按钮 */}
        <div className="space-y-3">
          {orderNumber && (
            <button
              onClick={() => router.push(`/order/${orderNumber}`)}
              className="w-full py-4 bg-slate-700/50 hover:bg-slate-700 border border-slate-600 hover:border-slate-500 text-slate-100 font-semibold rounded-lg transition-all duration-200 flex items-center justify-center gap-2"
            >
              <Search className="w-5 h-5" />
              查看订单详情
            </button>
          )}

          <button
            onClick={() => router.push('/')}
            className="w-full py-4 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-semibold rounded-lg transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <Home className="w-5 h-5" />
            返回首頁
          </button>

          <p className="text-center text-xs text-slate-500">
            頁面將在 5 秒後自動跳轉...
          </p>
        </div>

        {/* 客服信息 */}
        <div className="mt-6 text-center">
          <p className="text-xs text-slate-500 mb-2">如有問題，請聯繫客服</p>
          <a 
            href="tel:4001234567" 
            className="text-sm text-cyan-400 hover:text-cyan-300 transition"
          >
            400-123-4567
          </a>
        </div>
      </div>
    </div>
  )
}
