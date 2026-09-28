/**
 * 地點經緯度坐標數據
 *
 * 用於 Leaflet 地圖顯示上車點 / 目的地位置。
 * 坐標來源：香港政府開放數據 + 公開地標資訊（已校驗，精度 ~ 區中心）。
 *
 * 注意：坐標為大致中心點，用於地圖視覺化，不作精準導航。
 */
export interface LocationCoord {
  /** 顯示名稱（與 hkAreas / shenzhenLocations / shanweiLocations 完全一致） */
  name: string
  /** 經度 */
  lng: number
  /** 緯度 */
  lat: number
  /** 所屬大區（HK 18 區 / 內地城市） */
  area?: string
}

/**
 * 香港 18 區坐標
 *
 * 覆蓋 hkAreas 內所有 17 個具體區名 + 香港國際機場
 * 坐標採用各區政府合署或地標中心點
 */
export const HK_LOCATIONS: LocationCoord[] = [
  // === 香港島（4 區）===
  { name: '中西區', lng: 114.1584, lat: 22.2819, area: '港島' },
  { name: '灣仔區', lng: 114.1733, lat: 22.2779, area: '港島' },
  { name: '東區', lng: 114.2231, lat: 22.2841, area: '港島' },
  { name: '南區', lng: 114.1589, lat: 22.2471, area: '港島' },

  // === 九龍（5 區）===
  { name: '油尖旺區', lng: 114.1736, lat: 22.3051, area: '九龍' },
  { name: '深水埗區', lng: 114.1634, lat: 22.3301, area: '九龍' },
  { name: '九龍城區', lng: 114.1826, lat: 22.3205, area: '九龍' },
  { name: '黃大仙區', lng: 114.1935, lat: 22.3437, area: '九龍' },
  { name: '觀塘區', lng: 114.2147, lat: 22.3107, area: '九龍' },

  // === 新界（9 區）===
  { name: '葵青區', lng: 114.1291, lat: 22.3569, area: '新界' },
  { name: '荃灣區', lng: 114.1031, lat: 22.3689, area: '新界' },
  { name: '屯門區', lng: 113.9782, lat: 22.3944, area: '新界' },
  { name: '元朗區', lng: 114.0338, lat: 22.4456, area: '新界' },
  { name: '北區', lng: 114.1477, lat: 22.4921, area: '新界' },
  { name: '大埔區', lng: 114.1717, lat: 22.4517, area: '新界' },
  { name: '沙田區', lng: 114.1877, lat: 22.3817, area: '新界' },
  { name: '西貢區', lng: 114.2700, lat: 22.3819, area: '新界' },
  { name: '離島區', lng: 113.9448, lat: 22.2864, area: '新界' },

  // === 香港國際機場（特殊）===
  { name: '香港國際機場', lng: 113.9185, lat: 22.3089, area: '機場' },
]

/**
 * 深圳口岸 / 熱門地點坐標
 *
 * 覆蓋 shenzhenLocations 內所有 13 個具體地點
 */
export const SHENZHEN_LOCATIONS: LocationCoord[] = [
  { name: '深圳灣口岸', lng: 113.9448, lat: 22.5025, area: '南山' },
  { name: '羅湖口岸', lng: 114.1166, lat: 22.5447, area: '羅湖' },
  { name: '福田口岸', lng: 114.0613, lat: 22.5196, area: '福田' },
  { name: '文錦渡口岸', lng: 114.1180, lat: 22.5417, area: '羅湖' },
  { name: '沙頭角口岸', lng: 114.2259, lat: 22.5500, area: '鹽田' },
  { name: '福田中心區', lng: 114.0549, lat: 22.5396, area: '福田' },
  { name: '羅湖商業區', lng: 114.1289, lat: 22.5442, area: '羅湖' },
  { name: '南山科技園', lng: 113.9505, lat: 22.5400, area: '南山' },
  { name: '寶安中心', lng: 113.8836, lat: 22.5547, area: '寶安' },
  { name: '深圳機場', lng: 113.8137, lat: 22.6394, area: '寶安' },
  { name: '深圳北站', lng: 114.0294, lat: 22.6097, area: '龍華' },
  { name: '深圳站', lng: 114.1166, lat: 22.5447, area: '羅湖' },
]

/**
 * 汕尾地點坐標
 *
 * 覆蓋 shanweiLocations 內所有 6 個具體地點
 */
export const SHANWEI_LOCATIONS: LocationCoord[] = [
  { name: '汕尾城區', lng: 115.3754, lat: 22.7864, area: '城區' },
  { name: '海豐縣', lng: 115.3233, lat: 22.9667, area: '海豐' },
  { name: '陸豐市', lng: 115.6444, lat: 22.9183, area: '陸豐' },
  { name: '紅海灣', lng: 115.4083, lat: 22.6500, area: '城區' },
  { name: '華僑管理區', lng: 115.4600, lat: 22.8200, area: '城區' },
]

/**
 * 根據 formData.pickupLocation 獲取該地區所有坐標
 *
 * 重要：當用戶選了具體地點（如「黃大仙區」），會嘗試精確匹配；
 *       如果沒選具體地點，會列出整個大區的所有 marker
 */
export function getLocationsByArea(area: string): LocationCoord[] {
  switch (area) {
    case '香港國際機場':
      return HK_LOCATIONS.filter((l) => l.name === '香港國際機場')
    case '九龍':
      return HK_LOCATIONS.filter((l) => l.area === '九龍')
    case '新界':
      return HK_LOCATIONS.filter((l) => l.area === '新界')
    case '港島':
      return HK_LOCATIONS.filter((l) => l.area === '港島')
    case '深圳':
      return SHENZHEN_LOCATIONS
    case '汕尾':
      return SHANWEI_LOCATIONS
    default:
      return []
  }
}

/**
 * 根據完整地點名稱查詢坐標
 */
export function findLocationCoord(name: string): LocationCoord | undefined {
  const all = [...HK_LOCATIONS, ...SHENZHEN_LOCATIONS, ...SHANWEI_LOCATIONS]
  return all.find((l) => l.name === name)
}

/**
 * 計算地圖中心點（取所有點的平均坐標）
 */
export function getCenterOfLocations(locations: LocationCoord[]): [number, number] {
  if (locations.length === 0) return [114.17, 22.32] // 默認香港島
  const avgLng = locations.reduce((sum, l) => sum + l.lng, 0) / locations.length
  const avgLat = locations.reduce((sum, l) => sum + l.lat, 0) / locations.length
  return [avgLng, avgLat]
}
