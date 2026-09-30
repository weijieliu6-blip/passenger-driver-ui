-- 2026-09-30 — Seed Locations + Pricing Rules
-- 內建熱門地點 POI + 港粵跨境熱門路線行情價
-- 價格依據 2026 年市場行情（參考捷達、KKday、Holimood、永東、HKGCB 等）

-- ============================================================
-- Locations Seed
-- ============================================================
INSERT INTO public.locations (code, name_zh, name_en, region, category, zone_code, address_zh, lat, lng) VALUES
-- 香港機場
('hkg_airport', '香港國際機場', 'Hong Kong International Airport', 'hk', 'airport', 'hk_airport', '赤鱲角翔天路1號', 22.3080, 113.9185),
-- 香港口岸（不常用，主要靠大陸口岸）
-- 香港主要地標
('hk_central', '中環', 'Central', 'hk', 'landmark', 'hk_central', '中環', 22.2819, 114.1585),
('hk_kwun_tong', '觀塘', 'Kwun Tong', 'hk', 'landmark', 'hk_kwun_tong', '觀塘', 22.3133, 114.2258),
('hk_tsim_sha_tsui', '尖沙咀', 'Tsim Sha Tsui', 'hk', 'landmark', 'hk_kowloon', '尖沙咀', 22.2980, 114.1722),
('hk_mong_kok', '旺角', 'Mong Kok', 'hk', 'landmark', 'hk_kowloon', '旺角', 22.3188, 114.1697),
('hk_yau_ma_tei', '油麻地', 'Yau Ma Tei', 'hk', 'landmark', 'hk_kowloon', '油麻地', 22.3070, 114.1700),
('hk_causeway_bay', '銅鑼灣', 'Causeway Bay', 'hk', 'landmark', 'hk_island', '銅鑼灣', 22.2806, 114.1847),
('hk_wan_chai', '灣仔', 'Wan Chai', 'hk', 'landmark', 'hk_island', '灣仔', 22.2773, 114.1727),
('hk_shatin', '沙田', 'Sha Tin', 'hk', 'landmark', 'hk_new_territories', '沙田', 22.3815, 114.1885),
('hk_tsuen_wan', '荃灣', 'Tsuen Wan', 'hk', 'landmark', 'hk_new_territories', '荃灣', 22.3707, 114.1050),
('hk_tuen_mun', '屯門', 'Tuen Mun', 'hk', 'landmark', 'hk_new_territories', '屯門', 22.3908, 113.9785),
('hk_disney', '香港迪士尼樂園', 'Hong Kong Disneyland', 'hk', 'landmark', 'hk_lantau', '大嶼山竹篙灣', 22.3133, 114.0414),
('hk_element', '又一城', 'Festival Walk', 'hk', 'mall', 'hk_kowloon', '九龍達之路80號', 22.3775, 114.1745),
('hk_harbour_city', '海港城', 'Harbour City', 'hk', 'mall', 'hk_kowloon', '尖沙咀廣東道17號', 22.2955, 114.1683),

-- 深圳口岸
('sz_huanggang_port', '皇崗口岸', 'Huanggang Port', 'mainland', 'port', 'sz_futian', '福田區皇崗口岸', 22.5167, 114.0631),
('sz_futian_port', '福田口岸', 'Futian Port', 'mainland', 'port', 'sz_futian', '福田區福田口岸', 22.5185, 114.0578),
('sz_shenzhenwan_port', '深圳灣口岸', 'Shenzhen Bay Port', 'mainland', 'port', 'sz_nanshan', '南山區深圳灣口岸', 22.4925, 113.9494),
('sz_liantang_port', '蓮塘口岸', 'Liantang Port', 'mainland', 'port', 'sz_luohu', '羅湖區蓮塘口岸', 22.5651, 114.1319),
-- 深圳機場
('sz_airport', '深圳寶安國際機場', 'Shenzhen Bao''an International Airport', 'mainland', 'airport', 'sz_airport', '寶安區機場路', 22.6394, 113.8108),
-- 深圳主要區
('sz_futian', '福田區', 'Futian District', 'mainland', 'landmark', 'sz_futian', '福田區', 22.5211, 114.0554),
('sz_nanshan', '南山區', 'Nanshan District', 'mainland', 'landmark', 'sz_nanshan', '南山區', 22.5333, 113.9305),
('sz_luohu', '羅湖區', 'Luohu District', 'mainland', 'landmark', 'sz_luohu', '羅湖區', 22.5489, 114.1311),
('sz_longhua', '龍華區', 'Longhua District', 'mainland', 'landmark', 'sz_longhua', '龍華區', 22.6817, 114.0299),
('sz_longgang', '龍崗區', 'Longgang District', 'mainland', 'landmark', 'sz_longgang', '龍崗區', 22.7207, 114.2467),
('sz_beijing_train', '深圳北站', 'Shenzhen North Station', 'mainland', 'station', 'sz_longhua', '龍華區致遠中路', 22.6095, 114.0293),

-- 廣州
('gz_tianhe', '天河區', 'Tianhe District', 'mainland', 'landmark', 'gz_tianhe', '天河區', 23.1246, 113.3613),
('gz_yuexiu', '越秀區', 'Yuexiu District', 'mainland', 'landmark', 'gz_yuexiu', '越秀區', 23.1291, 113.2664),
('gz_baiyun', '白雲區', 'Baiyun District', 'mainland', 'landmark', 'gz_baiyun', '白雲區', 23.1582, 113.2723),
('gz_pazhou', '廣州會展中心（琶洲）', 'Pazhou Convention Center', 'mainland', 'landmark', 'gz_tianhe', '海珠區閱江中路380號', 23.0975, 113.3294),
('gz_airport', '廣州白雲國際機場', 'Guangzhou Baiyun International Airport', 'mainland', 'airport', 'gz_baiyun', '白雲區機場路', 23.3924, 113.2988),

-- 珠海
('zh_gongbei', '拱北口岸', 'Gongbei Port', 'mainland', 'port', 'zh_xiangzhou', '香洲區拱北口岸', 22.2177, 113.5485),
('zh_hengqin', '橫琴新區', 'Hengqin New Area', 'mainland', 'landmark', 'zh_hengqin', '橫琴新區', 22.1093, 113.5461),
('zh_xiangzhou', '香洲區', 'Xiangzhou District', 'mainland', 'landmark', 'zh_xiangzhou', '香洲區', 22.2710, 113.5742),
('zh_chimelong', '珠海長隆海洋王國', 'Chimelong Ocean Kingdom', 'mainland', 'landmark', 'zh_hengqin', '橫琴新區富祥灣', 22.0913, 113.5376),

-- 東莞
('dg_humen', '虎門', 'Humen', 'mainland', 'landmark', 'dg_humen', '虎門鎮', 22.8206, 113.6794),
('dg_city', '東莞城區', 'Dongguan City', 'mainland', 'landmark', 'dg_city', '東莞城區', 23.0207, 113.7518)
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- Pricing Rules Seed
-- 價格行情：2026 年港粵跨境接送行情（7座商務車 / 4座舒適車）
-- 數據來源：捷達、KKday、Holimood、永東、HKGCB 等
-- ============================================================

-- 香港 ⇄ 深圳口岸 / 區
INSERT INTO public.pricing_rules (from_zone, to_zone, vehicle_type, base_price, night_surcharge, estimated_minutes, notes) VALUES
-- 港島 ⇄ 深圳福田/南山/羅湖
('hk_island', 'sz_futian', '7_seat', 1000, 200, 90, '點對點接送'),
('hk_island', 'sz_futian', '4_seat', 800, 150, 90, NULL),
('hk_island', 'sz_nanshan', '7_seat', 1000, 200, 90, NULL),
('hk_island', 'sz_nanshan', '4_seat', 800, 150, 90, NULL),
('hk_island', 'sz_luohu', '7_seat', 1000, 200, 90, NULL),
('hk_island', 'sz_luohu', '4_seat', 800, 150, 90, NULL),
-- 九龍 ⇄ 深圳
('hk_kowloon', 'sz_futian', '7_seat', 900, 200, 75, '九龍/新界出發較便宜'),
('hk_kowloon', 'sz_futian', '4_seat', 700, 150, 75, NULL),
('hk_kowloon', 'sz_nanshan', '7_seat', 900, 200, 75, NULL),
('hk_kowloon', 'sz_nanshan', '4_seat', 700, 150, 75, NULL),
('hk_kowloon', 'sz_luohu', '7_seat', 900, 200, 75, NULL),
('hk_kowloon', 'sz_luohu', '4_seat', 700, 150, 75, NULL),
-- 新界 ⇄ 深圳
('hk_new_territories', 'sz_futian', '7_seat', 850, 200, 60, NULL),
('hk_new_territories', 'sz_futian', '4_seat', 700, 150, 60, NULL),
('hk_new_territories', 'sz_nanshan', '7_seat', 850, 200, 60, NULL),
('hk_new_territories', 'sz_nanshan', '4_seat', 700, 150, 60, NULL),

-- 深圳 ⇄ 香港（反向同價）
('sz_futian', 'hk_kowloon', '7_seat', 900, 200, 75, NULL),
('sz_futian', 'hk_island', '7_seat', 1000, 200, 90, NULL),
('sz_nanshan', 'hk_kowloon', '7_seat', 900, 200, 75, NULL),
('sz_luohu', 'hk_kowloon', '7_seat', 900, 200, 75, NULL),

-- 香港機場 ⇄ 市區
('hk_airport', 'hk_kowloon', '7_seat', 700, 200, 40, '機場接送'),
('hk_airport', 'hk_kowloon', '4_seat', 550, 150, 40, NULL),
('hk_airport', 'hk_island', '7_seat', 800, 200, 45, '需過海隧道'),
('hk_airport', 'hk_island', '4_seat', 650, 150, 45, NULL),
('hk_airport', 'hk_new_territories', '7_seat', 750, 200, 45, NULL),
('hk_airport', 'hk_lantau', '7_seat', 650, 200, 30, '迪士尼/大嶼山'),

-- 深圳機場 ⇄ 香港
('sz_airport', 'hk_kowloon', '7_seat', 1100, 200, 90, '經深圳灣口岸'),
('sz_airport', 'hk_island', '7_seat', 1200, 200, 100, NULL),
('sz_airport', 'hk_kowloon', '4_seat', 900, 150, 90, NULL),
('sz_airport', 'hk_airport', '7_seat', 1100, 200, 90, '機場互轉'),

-- 香港 ⇄ 廣州
('hk_kowloon', 'gz_tianhe', '7_seat', 2400, 300, 180, '跨市長途'),
('hk_kowloon', 'gz_tianhe', '4_seat', 1900, 200, 180, NULL),
('hk_island', 'gz_tianhe', '7_seat', 2500, 300, 195, NULL),
('hk_island', 'gz_tianhe', '4_seat', 2000, 200, 195, NULL),
('hk_kowloon', 'gz_yuexiu', '7_seat', 2400, 300, 180, NULL),
('hk_kowloon', 'gz_baiyun', '7_seat', 2400, 300, 180, NULL),
('hk_kowloon', 'gz_airport', '7_seat', 2000, 300, 150, NULL),
('sz_futian', 'gz_tianhe', '7_seat', 1600, 200, 120, '深圳市內轉廣州'),
('gz_tianhe', 'hk_kowloon', '7_seat', 2400, 300, 180, '反向同價'),

-- 香港 ⇄ 珠海
('hk_kowloon', 'zh_xiangzhou', '7_seat', 1700, 300, 150, '經港珠澳大橋'),
('hk_kowloon', 'zh_xiangzhou', '4_seat', 1400, 200, 150, NULL),
('hk_kowloon', 'zh_hengqin', '7_seat', 1900, 300, 150, NULL),
('hk_kowloon', 'zh_gongbei', '7_seat', 1700, 300, 150, NULL),
('hk_island', 'zh_xiangzhou', '7_seat', 1800, 300, 165, NULL),
('zh_xiangzhou', 'hk_kowloon', '7_seat', 1700, 300, 150, NULL),

-- 香港 ⇄ 東莞
('hk_kowloon', 'dg_city', '7_seat', 1500, 200, 120, NULL),
('hk_kowloon', 'dg_humen', '7_seat', 1400, 200, 100, NULL),
('hk_kowloon', 'dg_city', '4_seat', 1200, 200, 120, NULL),

-- 深圳機場 ⇄ 深圳市區
('sz_airport', 'sz_futian', '7_seat', 800, 100, 60, '深圳市內機場接送'),
('sz_airport', 'sz_nanshan', '7_seat', 800, 100, 50, NULL),
('sz_airport', 'sz_luohu', '7_seat', 900, 100, 70, NULL),

-- 香港市內
('hk_kowloon', 'hk_island', '7_seat', 650, 100, 30, '需過海隧道'),
('hk_kowloon', 'hk_new_territories', '7_seat', 500, 100, 30, NULL)
ON CONFLICT (from_zone, to_zone, vehicle_type) DO UPDATE SET
  base_price = EXCLUDED.base_price,
  night_surcharge = EXCLUDED.night_surcharge,
  estimated_minutes = EXCLUDED.estimated_minutes,
  notes = EXCLUDED.notes,
  updated_at = NOW();