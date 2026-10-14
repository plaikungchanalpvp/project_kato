import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import Chart from 'chart.js/auto'
import { createClient } from '@supabase/supabase-js'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js'

// ================== ตั้งค่า ==================
const YEARS = [2558, 2567]
const CENTER = [18.7883, 98.9853]
const START_ZOOM = 13
const MIN_LOAD_ZOOM = 12
const MAX_FEATURES = 4000

const CATEGORIES = {
    A: { name: 'เกษตรกรรม', color: '#eab308' },
    U: { name: 'ชุมชนและสิ่งปลูกสร้าง', color: '#ef4444' },
    F: { name: 'ป่าไม้', color: '#15803d' },
    W: { name: 'แหล่งน้ำ', color: '#0ea5e9' },
    M: { name: 'เบ็ดเตล็ด', color: '#a855f7' }
}
const OTHER = { name: 'อื่น ๆ', color: '#64748b' }

const getCat = code => (code ? String(code).trim().charAt(0).toUpperCase() : '')
const catInfo = key => CATEGORIES[key] || OTHER
const fmt = n => Number(n || 0).toLocaleString('th-TH', { maximumFractionDigits: 0 })

// ================== Supabase ==================
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    alert('ไม่พบค่า Supabase ในไฟล์ www/.env\nแก้ไฟล์แล้วปิด-เปิด npm run dev ใหม่')
    throw new Error('Missing Supabase env')
}
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

let activeCat = 'ALL'

// ================== สร้างแผนที่ 2 จอ ==================
function createMap(id) {
    const map = L.map(id, { preferCanvas: true }).setView(CENTER, START_ZOOM)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap'
    }).addTo(map)
    return map
}

const state = {}
YEARS.forEach(year => {
    state[year] = {
        map: createMap(`map-${year}`),
        layer: null,
        data: null,
        reqId: 0,
        statusEl: document.getElementById(`status-${year}`)
    }
})

const mapA = state[2558].map
const mapB = state[2567].map

// ซิงค์การเลื่อน/ซูม
let syncing = false
function linkMaps(src, dst) {
    src.on('move', () => {
        if (syncing) return
        syncing = true
        dst.setView(src.getCenter(), src.getZoom(), { animate: false })
        syncing = false
    })
}
linkMaps(mapA, mapB)
linkMaps(mapB, mapA)

// วงกลมบอกตำแหน่งเมาส์บนอีกจอ
function linkCursor(src, dst) {
    const cursor = L.circleMarker(CENTER, {
        radius: 7,
        color: '#111827',
        weight: 2,
        fillOpacity: 0,
        interactive: false
    })
    src.on('mousemove', e => cursor.setLatLng(e.latlng).addTo(dst))
    src.on('mouseout', () => cursor.remove())
}
linkCursor(mapA, mapB)
linkCursor(mapB, mapA)

// ================== วาดแปลงที่ดิน ==================
function setStatus(year, text) {
    state[year].statusEl.textContent = text
}

function featureStyle(feature) {
    return {
        fillColor: catInfo(getCat(feature.properties.lu_code)).color,
        fillOpacity: 0.65,
        color: '#ffffff',
        weight: 0.6
    }
}

function popupHtml(p) {
    const c = catInfo(getCat(p.lu_code))
    return `
    <b>ปี พ.ศ. ${p.year}</b><hr style="margin:4px 0">
    <span class="dot" style="background:${c.color}"></span><b>${c.name}</b><br>
    <b>รหัส:</b> ${p.lu_code ?? '-'}<br>
    <b>ชื่อ:</b> ${p.lu_des_th ?? '-'}<br>
    <b>English:</b> ${p.lu_des_en ?? '-'}<br>
    <b>พื้นที่:</b> ${fmt(p.area_rai)} ไร่
  `
}

function render(year) {
    const s = state[year]
    if (s.layer) {
        s.map.removeLayer(s.layer)
        s.layer = null
    }
    if (!s.data || !s.data.features) return

    s.layer = L.geoJSON(s.data, {
        filter: f => activeCat === 'ALL' || getCat(f.properties.lu_code) === activeCat,
        style: featureStyle,
        onEachFeature: (f, layer) => layer.bindPopup(popupHtml(f.properties))
    }).addTo(s.map)

    const shown = s.layer.getLayers().length
    const total = s.data.features.length
    let msg = `✅ แสดง ${fmt(shown)} แปลง`
    if (total >= MAX_FEATURES) msg += ' (ถึงจำนวนสูงสุด ซูมเข้าเพื่อดูครบ)'
    setStatus(year, msg)
}

async function loadYear(year) {
    const s = state[year]

    if (s.map.getZoom() < MIN_LOAD_ZOOM) {
        s.data = null
        render(year)
        setStatus(year, '🔍 ซูมเข้าอีกนิดเพื่อแสดงแปลงที่ดิน')
        return
    }

    const b = s.map.getBounds()
    const myReq = ++s.reqId
    setStatus(year, '⏳ กำลังโหลด...')

    // เปลี่ยนมาใช้ชื่อฟังก์ชันใหม่ get_landuse_map_v2 ที่ไม่มีปัญหาซ้ำซ้อน
    const { data, error } = await supabase.rpc('get_landuse_map_v2', {
        year_param: year,
        min_lng: b.getWest(),
        min_lat: b.getSouth(),
        max_lng: b.getEast(),
        max_lat: b.getNorth()
    })

    if (myReq !== s.reqId) return // มีคำขอใหม่กว่าแล้ว ทิ้งอันเก่า

    if (error) {
        console.error(`โหลดปี ${year} ไม่สำเร็จ:`, error)
        setStatus(year, '❌ ' + error.message)
        return
    }

    s.data = data
    render(year)
}

let loadTimer = null
function loadAll() {
    clearTimeout(loadTimer)
    loadTimer = setTimeout(() => YEARS.forEach(loadYear), 300)
}
mapA.on('moveend', loadAll)

// ================== ปุ่มกรองประเภท ==================
function renderFilters() {
    const box = document.getElementById('filters')
    const items = [['ALL', { name: 'ทั้งหมด', color: '#334155' }], ...Object.entries(CATEGORIES)]

    box.innerHTML = items
        .map(([key, c]) => `
      <button data-cat="${key}" class="filter-btn ${key === activeCat ? 'active' : ''}" style="--c:${c.color}">
        ${c.name}
      </button>`)
        .join('')

    box.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', () => {
            activeCat = btn.dataset.cat
            renderFilters()
            YEARS.forEach(render)
        })
    })
}

// ================== สรุปสถิติ + กราฟ ==================
async function loadSummary() {
    const tbody = document.getElementById('summary-body')
    const tfoot = document.getElementById('summary-foot')

    const { data, error } = await supabase.rpc('get_landuse_summary')

    if (error) {
        console.error('โหลดสรุปไม่สำเร็จ:', error)
        tbody.innerHTML = `<tr><td colspan="5" class="py-4 text-center text-red-600">โหลดสรุปไม่สำเร็จ: ${error.message}</td></tr>`
        return
    }

    const agg = {}
    data.forEach(r => {
        const key = CATEGORIES[r.lu_group] ? r.lu_group : 'OTHER'
        agg[key] ??= { 2558: 0, 2567: 0 }
        agg[key][r.yr] = (agg[key][r.yr] || 0) + Number(r.total_rai)
    })

    const keys = Object.keys(CATEGORIES)
    if (agg.OTHER) keys.push('OTHER')

    let total58 = 0
    let total67 = 0

    tbody.innerHTML = keys.map(key => {
        const a = agg[key]?.[2558] || 0
        const b = agg[key]?.[2567] || 0
        total58 += a
        total67 += b
        const diff = b - a
        const pct = a ? (diff / a) * 100 : null
        const cls = diff >= 0 ? 'up' : 'down'
        const sign = diff >= 0 ? '+' : ''
        const c = catInfo(key)
        return `
      <tr>
        <td><span class="dot" style="background:${c.color}"></span>${c.name}</td>
        <td class="num">${fmt(a)}</td>
        <td class="num">${fmt(b)}</td>
        <td class="num ${cls}">${sign}${fmt(diff)}</td>
        <td class="num ${cls}">${pct === null ? '-' : sign + pct.toFixed(1) + '%'}</td>
      </tr>`
    }).join('')

    const totalDiff = total67 - total58
    tfoot.innerHTML = `
    <tr>
      <td>รวม</td>
      <td class="num">${fmt(total58)}</td>
      <td class="num">${fmt(total67)}</td>
      <td class="num">${totalDiff >= 0 ? '+' : ''}${fmt(totalDiff)}</td>
      <td class="num">-</td>
    </tr>`

    new Chart(document.getElementById('chart'), {
        type: 'bar',
        data: {
            labels: keys.map(k => catInfo(k).name),
            datasets: [
                { label: 'ปี 2558', data: keys.map(k => agg[k]?.[2558] || 0), backgroundColor: '#94a3b8' },
                { label: 'ปี 2567', data: keys.map(k => agg[k]?.[2567] || 0), backgroundColor: '#2563eb' }
            ]
        },
        options: {
            responsive: true,
            plugins: {
                tooltip: {
                    callbacks: { label: ctx => `${ctx.dataset.label}: ${fmt(ctx.raw)} ไร่` }
                }
            },
            scales: {
                y: { ticks: { callback: v => fmt(v) } }
            }
        }
    })
}

// ================== เริ่มทำงาน ==================
renderFilters()
loadSummary()
loadAll()
setTimeout(() => {
    mapA.invalidateSize()
    mapB.invalidateSize()
}, 300)