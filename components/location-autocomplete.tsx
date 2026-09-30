'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Search, MapPin, Loader2, ChevronDown } from 'lucide-react'

export interface Location {
  id: number
  code: string
  name_zh: string
  name_en?: string
  region: 'hk' | 'mainland'
  category: string
  zone_code: string
  address_zh?: string
  lat?: number
  lng?: number
}

interface Props {
  /** 限制 region（'hk' | 'mainland'） */
  region?: 'hk' | 'mainland'
  /** category 過濾 */
  category?: string
  /** 顯示標籤 */
  label?: string
  /** 當前值（用於初始化/外部控制） */
  value?: Location | null
  /** 選中時 callback */
  onSelect: (loc: Location | null, customAddress: string | null) => void
  /** placeholder */
  placeholder?: string
  /** 是否禁用 */
  disabled?: boolean
  /** 額外的 class */
  className?: string
}

export default function LocationAutocomplete({
  region,
  category,
  label,
  value,
  onSelect,
  placeholder = '搜尋地點或手動輸入地址',
  disabled,
  className,
}: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Location[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showManualInput, setShowManualInput] = useState(false)
  const [manualAddress, setManualAddress] = useState('')
  const wrapperRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 點外面關閉
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  // 從 value 同步
  useEffect(() => {
    if (value) {
      setQuery(value.name_zh)
      setShowManualInput(false)
      setManualAddress('')
    }
  }, [value])

  const fetchResults = useCallback(
    async (q: string) => {
      setLoading(true)
      try {
        const params = new URLSearchParams()
        if (q) params.set('q', q)
        if (region) params.set('region', region)
        if (category) params.set('category', category)
        params.set('limit', '10')
        const res = await fetch(`/api/locations/search?${params}`)
        const data = await res.json()
        setResults(data.locations || [])
        setShowManualInput(!!data.showManualInput)
      } catch (e) {
        console.error('[LocationAutocomplete] search error:', e)
        setResults([])
        setShowManualInput(true)
      } finally {
        setLoading(false)
      }
    },
    [region, category]
  )

  const handleInputChange = (v: string) => {
    setQuery(v)
    setShowDropdown(true)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchResults(v), 250)
  }

  const handleSelect = (loc: Location) => {
    setQuery(loc.name_zh)
    setShowDropdown(false)
    setShowManualInput(false)
    setManualAddress('')
    onSelect(loc, null)
  }

  const handleManualConfirm = () => {
    if (!manualAddress.trim()) return
    setShowDropdown(false)
    onSelect(null, manualAddress.trim())
    setQuery(manualAddress.trim())
  }

  return (
    <div ref={wrapperRef} className={`relative ${className || ''}`}>
      {label && (
        <label className="block text-sm font-medium text-slate-400 mb-2">{label}</label>
      )}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input
          type="text"
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => setShowDropdown(true)}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full pl-10 pr-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-slate-50 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-400 animate-spin" />
        )}
        {!loading && query && (
          <button
            type="button"
            onClick={() => {
              setQuery('')
              setResults([])
              onSelect(null, null)
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
          >
            ✕
          </button>
        )}
      </div>

      {showDropdown && (
        <div className="absolute z-50 mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg shadow-xl max-h-72 overflow-y-auto">
          {results.length === 0 && !loading && !showManualInput && (
            <div className="px-4 py-3 text-sm text-slate-500">無匹配地點，請手動輸入</div>
          )}

          {results.map((loc) => (
            <button
              key={loc.id}
              type="button"
              onClick={() => handleSelect(loc)}
              className="w-full px-4 py-3 flex items-start gap-3 hover:bg-slate-700/50 transition text-left"
            >
              <MapPin className="w-4 h-4 text-cyan-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-slate-50 font-medium">{loc.name_zh}</div>
                {loc.name_en && (
                  <div className="text-xs text-slate-500">{loc.name_en}</div>
                )}
                {loc.address_zh && (
                  <div className="text-xs text-slate-400 mt-0.5">{loc.address_zh}</div>
                )}
                <div className="text-xs text-slate-500 mt-1">
                  <span className="inline-block px-1.5 py-0.5 bg-slate-700/50 rounded text-[10px]">
                    {loc.region === 'hk' ? '香港' : '內地'}
                  </span>
                  <span className="ml-1 inline-block px-1.5 py-0.5 bg-slate-700/50 rounded text-[10px]">
                    {loc.category}
                  </span>
                </div>
              </div>
            </button>
          ))}

          {showManualInput && (
            <div className="border-t border-slate-700 p-3">
              <div className="text-xs text-slate-400 mb-2">沒找到？手動輸入詳細地址：</div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={manualAddress}
                  onChange={(e) => setManualAddress(e.target.value)}
                  placeholder="例：皇后大道中 1 號、福田保稅區 F 棟"
                  className="flex-1 px-3 py-2 bg-slate-900/50 border border-slate-600 rounded text-sm text-slate-50 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
                <button
                  type="button"
                  onClick={handleManualConfirm}
                  disabled={!manualAddress.trim()}
                  className="px-3 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm rounded transition"
                >
                  確認
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}