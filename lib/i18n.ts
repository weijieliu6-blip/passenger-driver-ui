/**
 * 簡單多語言架構
 * - 語言存在 cookie (locale)
 * - client component 用 useT() 拿到翻譯函數
 * - server component 用 getT() 拿到靜態翻譯函數
 *
 * 支援：zh-HK (繁中) / zh-CN (簡中) / en (英文)
 */

export type Locale = 'zh-HK' | 'zh-CN' | 'en'

export const LOCALES: Locale[] = ['zh-HK', 'zh-CN', 'en']
export const DEFAULT_LOCALE: Locale = 'zh-HK'

export const LOCALE_LABEL: Record<Locale, string> = {
  'zh-HK': '繁體中文',
  'zh-CN': '简体中文',
  'en': 'English',
}

export const LOCALE_FLAG: Record<Locale, string> = {
  'zh-HK': '🇭🇰',
  'zh-CN': '🇨🇳',
  'en': '🇬🇧',
}

type Dict = Record<string, string>

/**
 * 繁中（預設）
 */
const zhHK: Dict = {
  // 通用
  'app.title': '中港車預約平台',
  'app.subtitle': '跨境專車 一鍵直達',
  'nav.passenger': '乘客',
  'nav.driver': '司機',
  'nav.admin': '後台',

  // 主頁
  'home.hero.title': '中港跨境專車 一鍵預約',
  'home.hero.subtitle': '香港 ↔ 深圳 / 廣東 7×24 全時段服務',
  'home.book_now': '立即預約',
  'home.track_order': '查看訂單',
  'home.feature.247': '24h 全時段',
  'home.feature.fast': '2hr 平均回覆',
  'home.feature.cheap': '透明收費',
  'home.feature.safe': '平台擔保',

  // 表單
  'form.pickup': '上車地點',
  'form.dropoff': '目的地',
  'form.date': '出發時間',
  'form.passengers': '乘客人數',
  'form.luggage': '行李件數',
  'form.vehicle': '車型',
  'form.vehicle.sedan': '5 座豐田 Camry',
  'form.vehicle.alphard': '7 座埃爾法',
  'form.vehicle.business': '9 座商務車',
  'form.contact': '聯絡電話',
  'form.name': '乘客姓名',
  'form.notes': '備註（選填）',
  'form.submit': '立即預約',
  'form.estimate': '預估車資',

  // 司機招募
  'recruit.title': '加入中港車預約平台',
  'recruit.subtitle': '跨境專車司機招募中 — 接單自由、多勞多得',
  'recruit.name': '姓名 / 暱稱',
  'recruit.phone': '聯絡電話（含區號）',
  'recruit.email': '電郵（選填）',
  'recruit.plate': '車牌號碼',
  'recruit.years': '駕齡（年）',
  'recruit.permit': '已持有跨境運輸證件',
  'recruit.submit': '提交申請',
  'recruit.success': '申請已收到！我們將於 24 小時內聯繫您。',

  // 登入
  'login.title': '登入 / 註冊',
  'login.phone_or_email': '電郵 / 電話',
  'login.password': '密碼',
  'login.submit': '登入',
  'login.register': '註冊',
  'login.switch_mode': '切換登入 / 註冊',
  'login.success': '登入成功！',

  // 後台
  'admin.orders': '訂單列表',
  'admin.drivers': '司機列表',
  'admin.applications': '招募申請',
  'admin.back': '返回前台',

  // 通用操作
  'btn.confirm': '確認',
  'btn.cancel': '取消',
  'btn.save': '儲存',
  'btn.delete': '刪除',
  'btn.back': '返回',
  'btn.next': '下一步',
  'btn.loading': '處理中...',
  'btn.retry': '重試',

  // 狀態
  'status.pending': '待審',
  'status.reviewing': '跟進中',
  'status.approved': '已批准',
  'status.rejected': '已拒絕',

  // 車型
  'car.sedan_5': '5 座豐田 Camry',
  'car.alphard_7': '7 座埃爾法',
  'car.business_9': '9 座商務車',
}

/**
 * 簡中
 */
const zhCN: Dict = {
  'app.title': '中港车预约平台',
  'app.subtitle': '跨境专车 一键直达',
  'nav.passenger': '乘客',
  'nav.driver': '司机',
  'nav.admin': '后台',

  'home.hero.title': '中港跨境专车 一键预约',
  'home.hero.subtitle': '香港 ↔ 深圳 / 广东 7×24 全时段服务',
  'home.book_now': '立即预约',
  'home.track_order': '查看订单',
  'home.feature.247': '24h 全时段',
  'home.feature.fast': '2hr 平均回复',
  'home.feature.cheap': '透明收费',
  'home.feature.safe': '平台担保',

  'form.pickup': '上车地点',
  'form.dropoff': '目的地',
  'form.date': '出发时间',
  'form.passengers': '乘车人数',
  'form.luggage': '行李件数',
  'form.vehicle': '车型',
  'form.vehicle.sedan': '5 座丰田 Camry',
  'form.vehicle.alphard': '7 座埃尔法',
  'form.vehicle.business': '9 座商务车',
  'form.contact': '联系电话',
  'form.name': '乘客姓名',
  'form.notes': '备注（选填）',
  'form.submit': '立即预约',
  'form.estimate': '预估车资',

  'recruit.title': '加入中港车预约平台',
  'recruit.subtitle': '跨境专车司机招募中 — 接单自由、多劳多得',
  'recruit.name': '姓名 / 昵称',
  'recruit.phone': '联系电话（含区号）',
  'recruit.email': '邮箱（选填）',
  'recruit.plate': '车牌号码',
  'recruit.years': '驾龄（年）',
  'recruit.permit': '已持有跨境运输证件',
  'recruit.submit': '提交申请',
  'recruit.success': '申请已收到！我们将于 24 小时内联系您。',

  'login.title': '登录 / 注册',
  'login.phone_or_email': '邮箱 / 电话',
  'login.password': '密码',
  'login.submit': '登录',
  'login.register': '注册',
  'login.switch_mode': '切换登录 / 注册',
  'login.success': '登录成功！',

  'admin.orders': '订单列表',
  'admin.drivers': '司机列表',
  'admin.applications': '招募申请',
  'admin.back': '返回前台',

  'btn.confirm': '确认',
  'btn.cancel': '取消',
  'btn.save': '保存',
  'btn.delete': '删除',
  'btn.back': '返回',
  'btn.next': '下一步',
  'btn.loading': '处理中...',
  'btn.retry': '重试',

  'status.pending': '待审',
  'status.reviewing': '跟进中',
  'status.approved': '已批准',
  'status.rejected': '已拒绝',

  'car.sedan_5': '5 座丰田 Camry',
  'car.alphard_7': '7 座埃尔法',
  'car.business_9': '9 座商务车',
}

/**
 * 英文
 */
const en: Dict = {
  'app.title': 'HK-Mainland Taxi Platform',
  'app.subtitle': 'Cross-border Private Car Booking',
  'nav.passenger': 'Passenger',
  'nav.driver': 'Driver',
  'nav.admin': 'Admin',

  'home.hero.title': 'Cross-Border Car Booking in One Click',
  'home.hero.subtitle': 'Hong Kong ↔ Shenzhen / Guangdong · 24/7 Service',
  'home.book_now': 'Book Now',
  'home.track_order': 'My Orders',
  'home.feature.247': '24/7 Available',
  'home.feature.fast': '2hr Avg Reply',
  'home.feature.cheap': 'Transparent Pricing',
  'home.feature.safe': 'Platform Guarantee',

  'form.pickup': 'Pickup Location',
  'form.dropoff': 'Dropoff Location',
  'form.date': 'Departure Time',
  'form.passengers': 'Passengers',
  'form.luggage': 'Luggage',
  'form.vehicle': 'Vehicle Type',
  'form.vehicle.sedan': '5-seat Toyota Camry',
  'form.vehicle.alphard': '7-seat Alphard',
  'form.vehicle.business': '9-seat Business Van',
  'form.contact': 'Contact Phone',
  'form.name': 'Passenger Name',
  'form.notes': 'Notes (optional)',
  'form.submit': 'Book Now',
  'form.estimate': 'Estimated Fare',

  'recruit.title': 'Join HK-Mainland Taxi Platform',
  'recruit.subtitle': 'We are hiring cross-border drivers — Flexible hours, earn more',
  'recruit.name': 'Name / Nickname',
  'recruit.phone': 'Contact Phone (with country code)',
  'recruit.email': 'Email (optional)',
  'recruit.plate': 'License Plate',
  'recruit.years': 'Driving Years',
  'recruit.permit': 'I hold a cross-border transport permit',
  'recruit.submit': 'Submit Application',
  'recruit.success': 'Application received! We will contact you within 24 hours.',

  'login.title': 'Login / Register',
  'login.phone_or_email': 'Email / Phone',
  'login.password': 'Password',
  'login.submit': 'Login',
  'login.register': 'Register',
  'login.switch_mode': 'Toggle Login / Register',
  'login.success': 'Logged in successfully!',

  'admin.orders': 'Orders',
  'admin.drivers': 'Drivers',
  'admin.applications': 'Applications',
  'admin.back': 'Back to Home',

  'btn.confirm': 'Confirm',
  'btn.cancel': 'Cancel',
  'btn.save': 'Save',
  'btn.delete': 'Delete',
  'btn.back': 'Back',
  'btn.next': 'Next',
  'btn.loading': 'Loading...',
  'btn.retry': 'Retry',

  'status.pending': 'Pending',
  'status.reviewing': 'Reviewing',
  'status.approved': 'Approved',
  'status.rejected': 'Rejected',

  'car.sedan_5': '5-seat Toyota Camry',
  'car.alphard_7': '7-seat Alphard',
  'car.business_9': '9-seat Business Van',
}

const DICT: Record<Locale, Dict> = { 'zh-HK': zhHK, 'zh-CN': zhCN, en }

/**
 * Server-side: 根據 cookie 或預設取得 locale
 */
export function getLocaleFromCookies(cookieHeader: string | null | undefined): Locale {
  if (!cookieHeader) return DEFAULT_LOCALE
  const match = cookieHeader.match(/locale=([^;]+)/)
  if (!match) return DEFAULT_LOCALE
  const value = decodeURIComponent(match[1]) as Locale
  return LOCALES.includes(value) ? value : DEFAULT_LOCALE
}

/**
 * 純函數翻譯（SSR / server action 用）
 */
export function translate(locale: Locale, key: string, fallback?: string): string {
  return DICT[locale]?.[key] ?? DICT[DEFAULT_LOCALE][key] ?? fallback ?? key
}

/**
 * 簡寫別名
 */
export const t = translate

/**
 * 從 dict 物件深拷貝，避免被改
 */
export function getDictionary(locale: Locale): Dict {
  return { ...DICT[locale] }
}
