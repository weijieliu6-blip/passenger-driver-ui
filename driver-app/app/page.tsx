export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 to-orange-100 px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
        <div className="w-16 h-16 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl mx-auto mb-6 flex items-center justify-center">
          <span className="text-3xl">🚖</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">司機管理後台</h1>
        <p className="text-gray-600 mb-8">中港車預約平台 - 司機專用</p>
        <div className="space-y-3">
          <a
            href="/driver/login"
            className="block w-full bg-gradient-to-r from-amber-500 to-orange-600 text-white py-3 rounded-xl font-semibold hover:from-amber-600 hover:to-orange-700 transition"
          >
            登入 / 註冊
          </a>
          <a
            href="/driver/dashboard"
            className="block w-full bg-gray-100 text-gray-700 py-3 rounded-xl font-medium hover:bg-gray-200 transition"
          >
            進入司機中心
          </a>
        </div>
        <p className="text-xs text-gray-400 mt-6">Port 3001 · Driver Console</p>
      </div>
    </div>
  );
}
