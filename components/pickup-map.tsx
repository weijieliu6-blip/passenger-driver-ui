'use client'

import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect } from 'react'
import type { LocationCoord } from '@/lib/location-coords'
import { getCenterOfLocations } from '@/lib/location-coords'

// Leaflet 默認 marker 圖標問題修復（Next.js 環境下）
const defaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})

const selectedIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [35, 57],
  iconAnchor: [17, 57],
  popupAnchor: [1, -48],
  shadowSize: [57, 57],
})

// 修復 Leaflet 默認 icon 路徑問題
L.Marker.prototype.options.icon = defaultIcon

interface PickupMapProps {
  /** 該地區的所有可選坐標 */
  locations: LocationCoord[]
  /** 已選中的坐標名稱 */
  selectedName?: string | null
  /** 點擊地圖標記時的回調 */
  onSelect?: (location: LocationCoord) => void
  /** 自定義高度 */
  height?: string
}

/**
 * 當 locations 變化時自動重新計算中心
 */
function MapAutoCenter({ locations }: { locations: LocationCoord[] }) {
  const map = useMap()
  useEffect(() => {
    if (locations.length === 0) return
    const center = getCenterOfLocations(locations)
    map.setView(center, 11, { animate: true })
  }, [locations, map])
  return null
}

/**
 * 當選定位置變化時自動定位到該標記
 */
function FlyToSelected({
  locations,
  selectedName,
}: {
  locations: LocationCoord[]
  selectedName?: string | null
}) {
  const map = useMap()
  useEffect(() => {
    if (!selectedName) return
    const target = locations.find((l) => l.name === selectedName)
    if (target) {
      map.setView([target.lat, target.lng], 13, { animate: true })
    }
  }, [selectedName, locations, map])
  return null
}

/**
 * 上車地點選擇地圖組件
 *
 * - 顯示該地區所有可選地點的標記
 * - 點擊標記觸發 onSelect 回調
 * - 已選中的標記會放大高亮
 */
export default function PickupMap({
  locations,
  selectedName,
  onSelect,
  height = '280px',
}: PickupMapProps) {
  if (locations.length === 0) {
    return (
      <div
        className="rounded-lg border border-slate-700/50 bg-slate-900/30 flex items-center justify-center text-slate-500 text-sm"
        style={{ height }}
      >
        請先選擇上車地區，以顯示地圖
      </div>
    )
  }

  const center = getCenterOfLocations(locations)

  return (
    <div
      className="rounded-lg overflow-hidden border border-slate-700/50 shadow-lg"
      style={{ height }}
    >
      <MapContainer
        center={center}
        zoom={11}
        scrollWheelZoom={false}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapAutoCenter locations={locations} />
        <FlyToSelected locations={locations} selectedName={selectedName} />
        {locations.map((loc) => {
          const isSelected = loc.name === selectedName
          return (
            <Marker
              key={loc.name}
              position={[loc.lat, loc.lng]}
              icon={isSelected ? selectedIcon : defaultIcon}
              eventHandlers={{
                click: () => onSelect?.(loc),
              }}
            >
              <Popup>
                <div className="text-sm">
                  <div className="font-semibold text-slate-800">{loc.name}</div>
                  {loc.area && (
                    <div className="text-xs text-slate-600 mt-0.5">
                      區域：{loc.area}
                    </div>
                  )}
                  {isSelected ? (
                    <div className="mt-1 text-xs text-cyan-600 font-medium">
                      ✓ 已選擇
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onSelect?.(loc)}
                      className="mt-1 text-xs text-cyan-700 hover:text-cyan-900 underline"
                    >
                      選擇此地點
                    </button>
                  )}
                </div>
              </Popup>
            </Marker>
          )
        })}
      </MapContainer>
    </div>
  )
}
