/**
 * 地點經緯度坐標數據
 *
 * 用於 Leaflet 地圖顯示上車點 / 目的地位置。
 * 數據來源：OpenStreetMap + 公開地標資訊。
 *
 * 注意：坐標為大致中心點，用於地圖視覺化，不作精準導航。
 */
export interface LocationCoord {
  /** 顯示名稱 */
  name: string
  /** 經度 */
  lng: number
  /** 緯度 */
  lat: number
  /** 所屬區域（用於細分） */
  area?: string
}

/**
 * 香港地點坐標
 */
export const HK_LOCATIONS: LocationCoord[] = [
  // 香港國際機場
  { name: '香港國際機場', lng: 113.9185, lat: 22.3089, area: '離島' },
  // 九龍
  { name: '九龍 - 尖沙咀', lng: 114.1736, lat: 22.2981, area: '九龍' },
  { name: '九龍 - 旺角', lng: 114.1694, lat: 22.3188, area: '九龍' },
  { name: '九龍 - 紅磡', lng: 114.1826, lat: 22.3049, area: '九龍' },
  // 新界
  { name: '新界 - 沙田', lng: 114.1877, lat: 22.3817, area: '新界' },
  { name: '新界 - 元朗', lng: 114.0338, lat: 22.4456, area: '新界' },
  { name: '新界 - 屯門', lng: 113.9782, lat: 22.3944, area: '新界' },
  // 港島
  { name: '港島 - 中環', lng: 114.1589, lat: 22.2819, area: '港島' },
  { name: '港島 - 灣仔', lng: 114.1733, lat: 22.2779, area: '港島' },
  { name: '港島 - 銅鑼灣', lng: 114.1850, lat: 22.2804, area: '港島' },
]

/**
 * 深圳口岸 / 地標坐標
 */
export const SHENZHEN_LOCATIONS: LocationCoord[] = [
  { name: '深圳 - 福田口岸', lng: 114.0613, lat: 22.5196, area: '福田' },
  { name: '深圳 - 羅湖口岸', lng: 114.1166, lat: 22.5447, area: '羅湖' },
  { name: '深圳 - 皇崗口岸', lng: 114.0695, lat: 22.5167, area: '福田' },
  { name: '深圳 - 深圳灣口岸', lng: 113.9448, lat: 22.5025, area: '南山' },
  { name: '深圳 - 福田高鐵站', lng: 114.0549, lat: 22.5396, area: '福田' },
  { name: '深圳 - 深圳寶安機場', lng: 113.8137, lat: 22.6394, area: '寶安' },
]

/**
 * 汕尾地點坐標
 */
export const SHANWEI_LOCATIONS: LocationCoord[] = [
  { name: '汕尾 - 城區', lng: 115.3754, lat: 22.7864, area: '城區' },
  { name: '汕尾 - 陸豐', lng: 115.6444, lat: 22.9183, area: '陸豐' },
  { name: '汕尾 - 海豐', lng: 115.3233, lat: 22.9667, area: '海豐' },
  { name: '汕尾 - 捷勝', lng: 115.4583, lat: 22.7219, area: '城區' },
]

/**
 * 根據地區名稱獲取該地區所有坐標
 */
export function getLocationsByArea(area: string): LocationCoord[] {
  switch (area) {
    case '香港國際機場':
    case '九龍':
    case '新界':
    case '港島':
      return HK_LOCATIONS.filter((l) => {
        if (area === '香港國際機場') return l.name === '香港國際機場'
        return l.area === area
      })
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
  if (locations.length === 0) return [114.17, 22.32] // 默認香港中心
  const avgLng = locations.reduce((sum, l) => sum + l.lng, 0) / locations.length
  const avgLat = locations.reduce((sum, l) => sum + l.lat, 0) / locations.length
  return [avgLng, avgLat]
}
