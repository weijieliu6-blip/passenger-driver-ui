/**
 * 客服 FAQ 知識庫
 * 簡易關鍵字匹配 → 回覆
 * 命中分數高：直接回覆；命中分數低：呼叫 Claude API；無命中：升級人工
 */

export interface FaqEntry {
  keywords: string[]
  category: 'booking' | 'pricing' | 'route' | 'vehicle' | 'payment' | 'safety' | 'general'
  answer: string
}

/**
 * 簡易關鍵字比對：計算命中字數
 */
export function matchFaq(query: string): { entry: FaqEntry; score: number } | null {
  const q = query.toLowerCase()
  let best: { entry: FaqEntry; score: number } | null = null
  for (const entry of FAQ) {
    let score = 0
    for (const kw of entry.keywords) {
      if (q.includes(kw.toLowerCase())) score++
    }
    if (score > 0 && (!best || score > best.score)) {
      best = { entry, score }
    }
  }
  return best
}

export const FAQ: FaqEntry[] = [
  {
    keywords: ['取消', '退款', '不搭了', '不要了'],
    category: 'booking',
    answer:
      '✅ 您可以在訂單詳情頁申請取消訂單。\n\n' +
      '📋 取消政策：\n' +
      '• 用車前 6 小時以上：免費取消\n' +
      '• 用車前 2-6 小時：可能收取手續費（依司機報價）\n' +
      '• 用車前 2 小時內：可能需支付全額\n\n' +
      '⚠️ 平台不參與交易結算，車資由司機與乘客線下協商。如有糾紛請聯繫客服。',
  },
  {
    keywords: ['價錢', '價格', '收費', '多少錢', '車資', '怎麼算'],
    category: 'pricing',
    answer:
      '💰 港粵跨境接送價格依路線、車型、時間而異（單程參考）：\n\n' +
      '🚗 7座商務車（豐田 Alphard）：\n' +
      '• 香港市區 ⇄ 深圳福田/南山/羅湖：HK$ 900-1,000\n' +
      '• 香港市區 ⇄ 深圳機場：HK$ 1,000-1,200\n' +
      '• 香港 ⇄ 廣州天河：HK$ 2,400-2,500\n' +
      '• 香港 ⇄ 珠海拱北：HK$ 1,700-1,800\n' +
      '• 香港 ⇄ 東莞：HK$ 1,400-1,500\n\n' +
      '🚙 4座舒適車：價格約為 7 座的 80%\n\n' +
      '⏰ 夜間加成（22:00-07:00）：+ HK$ 150-300\n' +
      '📍 加停靠點：+ HK$ 100-500\n' +
      '👶 兒童安全座椅：+ HK$ 100\n\n' +
      '最終車資由司機報價為準。',
  },
  {
    keywords: ['幾點', '時間', '加班', '夜間', '凌晨'],
    category: 'route',
    answer:
      '⏰ 服務時間：24 小時全年無休（含夜間）\n\n' +
      '夜間加成時段：22:00 - 07:00（按行程起算）\n' +
      '• 22:00-00:00 / 05:00-07:00：+ HK$ 200\n' +
      '• 00:00-05:00：+ HK$ 300\n\n' +
      '凌晨或深夜建議提前 24 小時預約。',
  },
  {
    keywords: ['行李', '大行李', '幾件', '皮箱'],
    category: 'booking',
    answer:
      '🧳 行李說明：\n\n' +
      '• 7座商務車（載 6 人）：滿載時可放 2-3 件 28 吋行李\n' +
      '• 4-5 位乘客：可放 4-6 件大型行李\n' +
      '• 8座車：可放 3-4 件 28 吋行李\n\n' +
      '📝 建議在下單時填寫行李數量，方便司機評估。\n' +
      '若行李特別多（>6 件），建議升級 8座車或包車。',
  },
  {
    keywords: ['幾人', '人數', '可以坐', '載幾個'],
    category: 'vehicle',
    answer:
      '🚗 車型人數限制：\n\n' +
      '• 4 座車：最多 3 位乘客（不含司機）\n' +
      '• 7 座車：最多 6 位乘客（不含司機；業界標準）\n' +
      '• 8 座車：最多 7 位乘客\n\n' +
      '⚠️ 4座車目前僅適用於深圳⇄汕尾線路。香港跨境需用 7 座或以上。',
  },
  {
    keywords: ['孩童', '兒童', '安全座椅', '嬰兒', '寶寶'],
    category: 'vehicle',
    answer:
      '👶 孩童乘車：\n\n' +
      '• 3 歲以下（不佔座）：免費，但需自備安全座椅\n' +
      '• 3 歲以上（佔座）：計入人數，建議 + HK$ 100 加兒童安全座椅\n' +
      '• 請於下單時勾選「帶孩童」並選擇年齡類型\n\n' +
      '如需司機代為準備兒童安全座椅，請提前告知。',
  },
  {
    keywords: ['皇崗', '深圳灣', '蓮塘', '口岸', '過關', '通關'],
    category: 'route',
    answer:
      '🛂 主要口岸說明：\n\n' +
      '• 皇崗口岸：24 小時通關，車程約 15-20 分鐘\n' +
      '• 深圳灣口岸：6:30-24:00，車程約 20 分鐘（免下車通關）\n' +
      '• 蓮塘口岸：7:00-22:00，車程約 15 分鐘\n\n' +
      '司機會依交通狀況、您的出發點和時間建議最佳口岸。\n' +
      '跨境車輛通常有「免下車過關」便利（車上查驗證件）。',
  },
  {
    keywords: ['安全', '保險', '靠譜', '正規', '執照'],
    category: 'safety',
    answer:
      '🛡️ 安全保障：\n\n' +
      '• 平台所有司機均通過身份證 + 駕照 + 兩地牌驗證\n' +
      '• 跨境車輛須持有粵港 / 港珠澳兩地牌照\n' +
      '• 建議核實司機姓名、車牌、聯繫方式後再上車\n' +
      '• 行程中遇到問題，請及時聯繫客服\n\n' +
      '⚠️ 平台僅提供撮合服務，不承擔行程安全責任。請自行評估並謹慎選擇。',
  },
  {
    keywords: ['付費', '付款', '支付', '現金', '微信', '支付寶', 'payme'],
    category: 'payment',
    answer:
      '💳 付款方式：\n\n' +
      '平台不參與交易結算，車資由您與司機線下協商支付。\n\n' +
      '常見支付方式（依司機接受度）：\n' +
      '• 現金（港幣 / 人民幣）\n' +
      '• 微信支付 / 支付寶\n' +
      '• PayMe / 轉數快 (FPS)\n' +
      '• 八達通 / 信用卡（部分司機支援）\n\n' +
      '建議上車前與司機確認支付偏好。',
  },
  {
    keywords: ['人工', '客服', '轉人工', '真人', '聯繫', '投訴'],
    category: 'general',
    answer:
      '👨‍💼 正在為您轉接人工客服...\n\n' +
      '請稍候，我們的客服人員會盡快回覆（通常 5-15 分鐘）。\n\n' +
      '如緊急事項，請撥打：+852 0000 0000',
  },
  {
    keywords: ['你好', 'hi', 'hello', '嗨', '您好'],
    category: 'general',
    answer:
      '您好！我是中港跨境接送 AI 助理 🚗\n\n' +
      '我可以幫您回答：\n' +
      '• 價格、路線、車型\n' +
      '• 行李、人數、孩童\n' +
      '• 口岸、通關時間\n' +
      '• 取消、修改訂單\n' +
      '• 安全、執照問題\n\n' +
      '請問需要什麼協助？',
  },
]

/**
 * 判斷是否需要轉人工
 * 規則：命中分數 < 2 或含有「人工」「客服」「投訴」等關鍵字
 */
export function shouldEscalate(query: string, faqScore: number): boolean {
  const q = query.toLowerCase()
  if (faqScore < 1) return true
  const escalateKeywords = ['人工', '真人', '投訴', '退款', '報警', '緊急', '投訴', '欺騙', '騙']
  return escalateKeywords.some((k) => q.includes(k))
}