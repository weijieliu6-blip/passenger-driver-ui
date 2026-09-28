'use client'

import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useState } from 'react'
import type { LocationCoord } from '@/lib/location-coords'
import { getCenterOfLocations } from '@/lib/location-coords'

// 默認藍色 marker（用 CDN 避免打包問題）
const defaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})

// 選中時的彩色水滴 marker（自定義 SVG）
const selectedIcon = L.divIcon({
  html: `<div style="
    background: linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%);
    width: 32px;
    height: 32px;
    border-radius: 50% 50% 50% 0;
    transform: rotate(-45deg);
    border: 3px solid #fff;
    box-shadow: 0 4px 12px rgba(6, 182, 212, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    animation: bounce 0.4s ease-out;
  ">
    <div style="
      transform: rotate(45deg);
      color: white;
      font-weight: 700;
      font-size: 16px;
      line-height: 1;
    >✓</div>
  </div>
  <style>
    @keyframes bounce {
      0% { transform: rotate(-45deg) scale(0.5); }
      60% { transform: rotate(-45deg) scale(1.15); }
      100% { transform: rotate(-45deg) scale(1); }
    }
  </style>`,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
  className: 'custom-selected-marker',
})

// 修復 Leaflet 默認 icon 路徑問題
L.Marker.prototype.options.icon = defaultIcon

interface PickupMapProps {
  locations: LocationCoord[]
  selectedName?: string | null
  onSelect?: (location: LocationCoord) => void
  height?: string
}

/**
 * 瓦片源列表（按優先級）
 * - 全部已手動驗證 200 OK
 * - 優先用 ArcGIS World Street Map（高清街道圖，無需 key）
 * - 失敗自動切到 OpenStreetMap 兜底
 */
const TILE_LAYERS = [
  {
    name: 'ArcGIS World Street Map',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
    attribution:
      'Tiles &copy; <a href="https://www.esri.com/">Esri</a> — Source: Esri, DeLorme, NAVTEQ, USGS, Intermap, iPC, NRCAN, Esri Japan, METI, Esri China (Hong Kong), Esri (Thailand), MapmyIndia, NGCC, OpenStreetMap contributors, the GIS User Community',
  },
  {
    name: 'OpenStreetMap',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
] as const

/**
 * 帶瓦片降級的 TileLayer
 * 自動切換：主源失敗 → 備用源
 */
function RobustTileLayer({ onAllFailed }: { onAllFailed: () => void }) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const layer = TILE_LAYERS[currentIndex]

  if (!layer) {
    onAllFailed()
    return null
  }

  return (
    <TileLayer
      key={currentIndex}
      attribution={layer.attribution}
      url={layer.url}
      maxZoom={19}
      eventHandlers={{
        tileerror: () => {
          if (currentIndex < TILE_LAYERS.length - 1) {
            console.warn(
              `[PickupMap] 瓦片源 ${layer.name} 載入失敗，切換到下一個`
            )
            setCurrentIndex((i) => i + 1)
          } else {
            console.error('[PickupMap] 所有瓦片源均載入失敗')
            onAllFailed()
          }
        },
      }}
    />
  )
}

/**
 * 當 locations 變化時自動重新計算中心
 */
function MapAutoCenter({ locations }: { locations: LocationCoord[] }) {
  const map = useMap()
  useEffect(() => {
    if (locations.length === 0) return
    const center = getCenterOfLocations(locations)
    map.setView(center, 12, { animate: true })
  }, [locations, map])
  return null
}

/**
 * 當選定位置變化時自動定位
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
      map.setView([target.lat, target.lng], 14, { animate: true })
    }
  }, [selectedName, locations, map])
  return null
}

export default function PickupMap({
  locations,
  selectedName,
  onSelect,
  height = '280px',
}: PickupMapProps) {
  const [allTilesFailed, setAllTilesFailed] = useState(false)

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

  if (allTilesFailed) {
    return (
      <div className="rounded-lg border border-amber-700/50 bg-amber-900/10 p-4">
        <p className="text-amber-300 text-sm font-medium mb-2">
          ⚠️ 地圖瓦片載入失敗
        </p>
        <p className="text-amber-200/70 text-xs leading-relaxed">
          網絡可能限制外部 CDN，請刷新頁面重試。
          <br />
          您仍可從上方下拉框選擇地點。
        </p>
      </div>
    )
  }

  const center = getCenterOfLocations(locations)

  return (
    <div
      className="rounded-lg overflow-hidden border border-slate-700/50 shadow-lg relative"
      style={{ height }}
    >
      <MapContainer
        center={center}
        zoom={12}
        scrollWheelZoom={false}
        style={{ height: '100%', width: '100%' }}
      >
        <RobustTileLayer onAllFailed={() => setAllTilesFailed(true)} />
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
