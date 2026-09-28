'use client'

import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useMemo } from 'react'
import type { LocationCoord } from '@/lib/location-coords'
import { getCenterOfLocations } from '@/lib/location-coords'

// 預設藍色 marker（從 CDN 取，避免打包問題）
const baseIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})

L.Marker.prototype.options.icon = baseIcon

// 起點：水滴型（綠色），Uber 風格
const pickupIcon = L.divIcon({
  className: 'uber-pickup-marker',
  html: `<div style="position:relative;width:32px;height:40px;display:flex;align-items:center;justify-content:center;">
    <div style="
      position:absolute;
      top:0;left:0;width:32px;height:32px;
      background:linear-gradient(135deg,#10b981 0%,#059669 100%);
      border-radius:50% 50% 50% 0;
      transform:rotate(-45deg);
      border:3px solid #fff;
      box-shadow:0 4px 12px rgba(16,185,129,0.55),0 0 0 1px rgba(0,0,0,0.08);
      display:flex;align-items:center;justify-content:center;
    ">
      <div style="transform:rotate(45deg);color:#fff;font-weight:800;font-size:14px;line-height:1;">起</div>
    </div>
  </div>`,
  iconSize: [32, 40],
  iconAnchor: [16, 40],
  popupAnchor: [0, -36],
})

// 終點：水滴型（紅色），Uber 風格
const dropoffIcon = L.divIcon({
  className: 'uber-dropoff-marker',
  html: `<div style="position:relative;width:32px;height:40px;display:flex;align-items:center;justify-content:center;">
    <div style="
      position:absolute;
      top:0;left:0;width:32px;height:32px;
      background:linear-gradient(135deg,#ef4444 0%,#dc2626 100%);
      border-radius:50% 50% 50% 0;
      transform:rotate(-45deg);
      border:3px solid #fff;
      box-shadow:0 4px 12px rgba(239,68,68,0.55),0 0 0 1px rgba(0,0,0,0.08);
      display:flex;align-items:center;justify-content:center;
    ">
      <div style="transform:rotate(45deg);color:#fff;font-weight:800;font-size:14px;line-height:1;">終</div>
    </div>
  </div>`,
  iconSize: [32, 40],
  iconAnchor: [16, 40],
  popupAnchor: [0, -36],
})

// 中間候選 marker：藍色（用戶可以點切換）
const optionIcon = L.divIcon({
  className: 'uber-option-marker',
  html: `<div style="width:14px;height:14px;background:#06b6d4;border:2.5px solid #fff;border-radius:50%;box-shadow:0 2px 6px rgba(6,182,212,0.5);"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
})

/**
 * 瓦片源（多源降級）
 * - 全部已手動驗證 200 OK
 */
const TILE_LAYERS = [
  {
    name: 'ArcGIS World Street Map',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
    attribution:
      'Tiles &copy; <a href="https://www.esri.com/">Esri</a>',
  },
  {
    name: 'OpenStreetMap',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap',
  },
] as const

function RobustTileLayer() {
  // 用單一 TileLayer 多 URL 備援（react-leaflet 不直接支援多層 fallback，
  // 所以這裡只用主源 + 屬性，源本身已驗證 200 OK + 全球 CDN）
  const layer = TILE_LAYERS[0]
  return (
    <TileLayer
      attribution={layer.attribution}
      url={layer.url}
      maxZoom={19}
    />
  )
}

interface PickupMapProps {
  /** 起點候選地點 */
  pickupLocations: LocationCoord[]
  /** 起點當前選定 */
  pickupName?: string | null
  onPickupSelect?: (loc: LocationCoord) => void

  /** 終點候選地點 */
  dropoffLocations: LocationCoord[]
  /** 終點當前選定 */
  dropoffName?: string | null
  onDropoffSelect?: (loc: LocationCoord) => void

  /** 地圖高度 */
  height?: string
}

/**
 * 自動 fit bounds：根據起點 + 終點 + 所有候選點動態調整
 */
function MapAutoBounds({
  pickupCoord,
  dropoffCoord,
  extraPoints,
}: {
  pickupCoord?: LocationCoord
  dropoffCoord?: LocationCoord
  extraPoints: LocationCoord[]
}) {
  const map = useMap()
  useEffect(() => {
    // 全部候選點
    const allPts: [number, number][] = []

    if (pickupCoord) allPts.push([pickupCoord.lat, pickupCoord.lng])
    if (dropoffCoord) allPts.push([dropoffCoord.lat, dropoffCoord.lng])
    extraPoints.forEach((p) => allPts.push([p.lat, p.lng]))

    if (allPts.length === 0) return

    if (allPts.length === 1) {
      map.setView(allPts[0], 13, { animate: true })
      return
    }

    // 多點 → fit bounds
    const bounds = L.latLngBounds(allPts)
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 13, animate: true })
  }, [pickupCoord, dropoffCoord, extraPoints, map])
  return null
}

/**
 * 計算兩點距離（km），用 Haversine 公式
 */
function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const lat1 = (a.lat * Math.PI) / 180
  const lat2 = (b.lat * Math.PI) / 180
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export default function PickupMap({
  pickupLocations,
  pickupName,
  onPickupSelect,
  dropoffLocations,
  dropoffName,
  onDropoffSelect,
  height = '320px',
}: PickupMapProps) {
  // 找到選定點的完整座標
  const pickupCoord = useMemo(
    () => pickupLocations.find((l) => l.name === pickupName),
    [pickupLocations, pickupName]
  )
  const dropoffCoord = useMemo(
    () => dropoffLocations.find((l) => l.name === dropoffName),
    [dropoffLocations, dropoffName]
  )

  // 過濾掉已選定的候選 marker，避免重疊
  const pickupOthers = pickupLocations.filter((l) => l.name !== pickupName)
  const dropoffOthers = dropoffLocations.filter((l) => l.name !== dropoffName)

  // 路線
  const routeLine: [number, number][] = useMemo(() => {
    if (!pickupCoord || !dropoffCoord) return []
    return [
      [pickupCoord.lat, pickupCoord.lng],
      [dropoffCoord.lat, dropoffCoord.lng],
    ]
  }, [pickupCoord, dropoffCoord])

  // 距離
  const distanceKm = useMemo(() => {
    if (!pickupCoord || !dropoffCoord) return null
    return haversineKm(pickupCoord, dropoffCoord)
  }, [pickupCoord, dropoffCoord])

  // 全部「候選」marker
  const extraPoints: LocationCoord[] = useMemo(
    () => [...pickupOthers, ...dropoffOthers],
    [pickupOthers, dropoffOthers]
  )

  // 沒有任何地點時
  if (pickupLocations.length === 0 && dropoffLocations.length === 0) {
    return (
      <div
        className="rounded-lg border border-slate-700/50 bg-slate-900/30 flex items-center justify-center text-slate-500 text-sm"
        style={{ height }}
      >
        請先選擇上車/目的地，以顯示地圖
      </div>
    )
  }

  // 默認中心
  const allShown = [...pickupLocations, ...dropoffLocations]
  const center: [number, number] = allShown.length > 0
    ? getCenterOfLocations(allShown)
    : [114.17, 22.32]

  return (
    <div className="space-y-2">
      <div
        className="rounded-xl overflow-hidden border border-slate-700/50 shadow-2xl relative"
        style={{ height }}
      >
        <MapContainer
          center={center}
          zoom={11}
          scrollWheelZoom={true}
          zoomControl={true}
          style={{ height: '100%', width: '100%' }}
        >
          <RobustTileLayer />
          <MapAutoBounds
            pickupCoord={pickupCoord}
            dropoffCoord={dropoffCoord}
            extraPoints={extraPoints}
          />

          {/* 起點選定 marker（綠色水滴） */}
          {pickupCoord && (
            <Marker
              position={[pickupCoord.lat, pickupCoord.lng]}
              icon={pickupIcon}
              zIndexOffset={1000}
              eventHandlers={{
                click: () => onPickupSelect?.(pickupCoord),
              }}
            >
              <Popup>
                <div className="text-sm">
                  <div className="font-semibold text-emerald-700">起點</div>
                  <div className="font-medium text-slate-800">{pickupCoord.name}</div>
                </div>
              </Popup>
            </Marker>
          )}

          {/* 終點選定 marker（紅色水滴） */}
          {dropoffCoord && (
            <Marker
              position={[dropoffCoord.lat, dropoffCoord.lng]}
              icon={dropoffIcon}
              zIndexOffset={1000}
              eventHandlers={{
                click: () => onDropoffSelect?.(dropoffCoord),
              }}
            >
              <Popup>
                <div className="text-sm">
                  <div className="font-semibold text-red-700">終點</div>
                  <div className="font-medium text-slate-800">{dropoffCoord.name}</div>
                </div>
              </Popup>
            </Marker>
          )}

          {/* 起點候選 */}
          {pickupOthers.map((loc) => (
            <Marker
              key={`p-${loc.name}`}
              position={[loc.lat, loc.lng]}
              icon={optionIcon}
              eventHandlers={{
                click: () => onPickupSelect?.(loc),
              }}
            >
              <Popup>
                <div className="text-sm">
                  <div className="text-emerald-700 text-xs font-semibold">設為起點</div>
                  <div className="font-medium text-slate-800">{loc.name}</div>
                </div>
              </Popup>
            </Marker>
          ))}

          {/* 終點候選 */}
          {dropoffOthers.map((loc) => (
            <Marker
              key={`d-${loc.name}`}
              position={[loc.lat, loc.lng]}
              icon={optionIcon}
              eventHandlers={{
                click: () => onDropoffSelect?.(loc),
              }}
            >
              <Popup>
                <div className="text-sm">
                  <div className="text-red-700 text-xs font-semibold">設為終點</div>
                  <div className="font-medium text-slate-800">{loc.name}</div>
                </div>
              </Popup>
            </Marker>
          ))}

          {/* 連線（虛線） */}
          {routeLine.length === 2 && (
            <Polyline
              positions={routeLine}
              pathOptions={{
                color: '#06b6d4',
                weight: 4,
                opacity: 0.9,
                dashArray: '10 8',
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
          )}
        </MapContainer>

        {/* 右上角浮層：距離估算 */}
        {distanceKm !== null && (
          <div className="absolute top-3 right-3 z-[400] bg-slate-900/85 backdrop-blur border border-slate-700/70 text-slate-100 text-xs px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1.5">
            <span className="text-cyan-400">●</span>
            距離 <span className="font-semibold text-cyan-300">{distanceKm.toFixed(1)} km</span>
          </div>
        )}
      </div>

      {/* 底部圖例 */}
      <div className="flex items-center gap-4 text-xs text-slate-400 px-1">
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 border border-white shadow"></span>
          起點
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-full bg-gradient-to-br from-red-500 to-red-700 border border-white shadow"></span>
          終點
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-cyan-500 border-2 border-white shadow"></span>
          候選地點
        </div>
        {routeLine.length === 2 && (
          <div className="ml-auto text-cyan-400">
            點擊地圖 marker 可切換起/終點
          </div>
        )}
      </div>
    </div>
  )
}
