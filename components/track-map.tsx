'use client'

import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect } from 'react'

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

const pickupIcon = L.divIcon({
  className: 'track-pickup',
  html: `<div style="width:32px;height:32px;background:linear-gradient(135deg,#10b981 0%,#059669 100%);border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid #fff;box-shadow:0 4px 12px rgba(16,185,129,0.55);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:13px;">起</div>`,
  iconSize: [32, 40],
  iconAnchor: [16, 40],
})

const dropoffIcon = L.divIcon({
  className: 'track-dropoff',
  html: `<div style="width:32px;height:32px;background:linear-gradient(135deg,#ef4444 0%,#dc2626 100%);border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid #fff;box-shadow:0 4px 12px rgba(239,68,68,0.55);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:13px;">終</div>`,
  iconSize: [32, 40],
  iconAnchor: [16, 40],
})

const driverIcon = L.divIcon({
  className: 'track-driver',
  html: `<div style="width:36px;height:36px;background:linear-gradient(135deg,#06b6d4 0%,#0891b2 100%);border:3px solid #fff;border-radius:50%;box-shadow:0 4px 12px rgba(6,182,212,0.6),0 0 0 6px rgba(6,182,212,0.18);display:flex;align-items:center;justify-content:center;color:#fff;font-size:18px;">🚗</div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
})

interface Props {
  pickup: { name: string; lng: number; lat: number } | null
  dropoff: { name: string; lng: number; lat: number } | null
  driverLocation: { lat: number; lng: number; heading?: number | null; speed?: number | null; updatedAt: string } | null
  center: [number, number]
}

function FitBounds({
  pickup,
  dropoff,
  driverLocation,
}: Pick<Props, 'pickup' | 'dropoff' | 'driverLocation'>) {
  const map = useMap()
  useEffect(() => {
    const pts: Array<[number, number]> = []
    if (pickup) pts.push([pickup.lat, pickup.lng])
    if (dropoff) pts.push([dropoff.lat, dropoff.lng])
    if (driverLocation) pts.push([driverLocation.lat, driverLocation.lng])
    if (pts.length === 0) return
    if (pts.length === 1) {
      map.setView(pts[0], 14, { animate: true })
      return
    }
    const bounds = L.latLngBounds(pts)
    map.fitBounds(bounds, { padding: [60, 60], maxZoom: 14, animate: true })
  }, [pickup, dropoff, driverLocation, map])
  return null
}

export default function TrackMap({ pickup, dropoff, driverLocation, center }: Props) {
  return (
    <MapContainer
      center={center}
      zoom={12}
      scrollWheelZoom
      style={{ height: '100%', width: '100%' }}
    >
      <TileLayer
        attribution='Tiles &copy; Esri'
        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}"
        maxZoom={19}
      />
      <FitBounds pickup={pickup} dropoff={dropoff} driverLocation={driverLocation} />

      {pickup && (
        <Marker position={[pickup.lat, pickup.lng]} icon={pickupIcon}>
          <Popup>
            <div className="text-sm">
              <div className="font-semibold text-emerald-700">起點</div>
              <div>{pickup.name}</div>
            </div>
          </Popup>
        </Marker>
      )}
      {dropoff && (
        <Marker position={[dropoff.lat, dropoff.lng]} icon={dropoffIcon}>
          <Popup>
            <div className="text-sm">
              <div className="font-semibold text-red-700">目的地</div>
              <div>{dropoff.name}</div>
            </div>
          </Popup>
        </Marker>
      )}
      {driverLocation && (
        <Marker
          position={[driverLocation.lat, driverLocation.lng]}
          icon={driverIcon}
          zIndexOffset={1500}
        >
          <Popup>
            <div className="text-sm">
              <div className="font-semibold text-cyan-700">司機位置</div>
              <div className="font-mono text-xs">
                {driverLocation.lat.toFixed(5)}, {driverLocation.lng.toFixed(5)}
              </div>
              {driverLocation.speed != null && (
                <div className="text-xs text-slate-500">
                  速度 {(driverLocation.speed * 3.6).toFixed(0)} km/h
                </div>
              )}
              <div className="text-[10px] text-slate-400">
                更新：{new Date(driverLocation.updatedAt).toLocaleTimeString('zh-HK', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
              </div>
            </div>
          </Popup>
        </Marker>
      )}

      {pickup && dropoff && (
        <Polyline
          positions={[
            [pickup.lat, pickup.lng],
            [dropoff.lat, dropoff.lng],
          ]}
          pathOptions={{
            color: '#06b6d4',
            weight: 4,
            opacity: 0.65,
            dashArray: '8 8',
            lineCap: 'round',
            lineJoin: 'round',
          }}
        />
      )}
    </MapContainer>
  )
}