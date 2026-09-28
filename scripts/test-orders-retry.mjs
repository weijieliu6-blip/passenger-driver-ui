#!/usr/bin/env node
// 重跑 3 張失敗的測試訂單（修正 vehicle_type 到合法 enum）

const orders = [
  {
    direction: 'hk_to_mainland',
    pickupLocation: '中環 IFC 香港站',
    pickupArea: '中環',
    dropoffLocation: '深圳灣口岸',
    dropoffArea: '南山',
    departureTime: '2026-09-29 09:00',
    passengers: 2,
    luggage: 2,
    vehicleType: '7_seat',  // was 5_seat (invalid enum)
    passengerName: '陳先生',
    passengerPhone: '91234567',
    estimatedFare: 800,
    testMode: true,
  },
  {
    direction: 'sz_to_sw',
    pickupLocation: '深圳南山科技園',
    pickupArea: '南山',
    dropoffLocation: '珠海拱北口岸',
    dropoffArea: '拱北',
    departureTime: '2026-09-29 16:30',
    passengers: 2,
    luggage: 1,
    vehicleType: '7_seat',  // was 5_seat (invalid enum)
    passengerName: '王先生',
    passengerPhone: '93456789',
    estimatedFare: 1500,
    testMode: true,
  },
  {
    direction: 'mainland_to_hk',
    pickupLocation: '廣州天河城',
    pickupArea: '天河',
    dropoffLocation: '港島東太古城',
    dropoffArea: '太古城',
    departureTime: '2026-09-30 08:00',
    passengers: 7,
    luggage: 6,
    vehicleType: '8_seat',  // was 9_seat (invalid enum); 7 passengers for 8-seat car
    passengerName: '張總',
    passengerPhone: '94567890',
    estimatedFare: 2500,
    testMode: true,
  },
];

const API = 'https://hk-mainland-taxi.com/api/orders/create';

(async () => {
  const results = [];
  for (let i = 0; i < orders.length; i++) {
    const o = orders[i];
    console.log(`\n========== 測試訂單 #${i + 1}: ${o.passengerName} (${o.direction}) ==========`);
    console.log(`路線: ${o.pickupLocation} → ${o.dropoffLocation}`);
    console.log(`出發: ${o.departureTime} | 乘客: ${o.passengers}人 | 車型: ${o.vehicleType}`);
    try {
      const r = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(o),
      });
      const text = await r.text();
      let body;
      try { body = JSON.parse(text); } catch { body = text; }
      if (r.ok) {
        console.log(`✅ HTTP ${r.status}`);
        console.log(`   訂單編號: ${body.order.orderNumber}`);
        console.log(`   GrabToken: ${body.order.grabToken}`);
        results.push({ i: i + 1, name: o.passengerName, status: 'OK', orderNo: body.order.orderNumber, token: body.order.grabToken });
      } else {
        console.log(`❌ HTTP ${r.status}`);
        console.log(`   訊息: ${JSON.stringify(body, null, 2)}`);
        results.push({ i: i + 1, name: o.passengerName, status: 'FAIL', statusCode: r.status, body });
      }
    } catch (err) {
      console.log(`💥 EXCEPTION: ${err.message}`);
      results.push({ i: i + 1, name: o.passengerName, status: 'ERROR', error: err.message });
    }
    await new Promise(r => setTimeout(r, 1500));
  }

  console.log('\n========================================');
  console.log('測試結果摘要');
  console.log('========================================');
  for (const r of results) {
    if (r.status === 'OK') console.log(`  #${r.i} ${r.name.padEnd(8)} ✅ ${r.orderNo}  token=${r.token?.slice(0, 8)}...`);
    else console.log(`  #${r.i} ${r.name.padEnd(8)} ❌ ${r.status} ${r.error || r.statusCode}`);
  }
  const ok = results.filter(r => r.status === 'OK').length;
  console.log(`\n成功 ${ok}/${results.length}`);
})();
