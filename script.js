const CONFIG = {
    url: "https://dlkbkvvewelqyrffgstn.supabase.co",
    key: "sb_publishable_RCVofwHTT5M49aQH61blyg_syZqiuYo"
};

const supabaseClient = supabase.createClient(CONFIG.url, CONFIG.key);

const COLORS = {
    "EdificiosSS_AC_info_CHSS_final2": "#2563eb",
    "OSM_building_2026_CHSS_final3": "#10b981",
    "SS_building_OBM_2025_CHSS_final2": "#f59e0b",
    "Techos_AMSS_SS_2023_CHSS_final2": "#ef4444",
    "Uso_suelo_CHSS_final_depurado_wgs84": "#8b5cf6",
    "default": "#94a3b8"
};

const baseMaps = {
    googleSat: L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', { maxZoom: 23, maxNativeZoom: 20 }),
    dark: L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 23, maxNativeZoom: 20 })
};

const map = L.map('map', { zoomControl: false, layers: [baseMaps.googleSat], maxZoom: 23 }).setView([13.6989, -89.1914], 16);
L.control.zoom({ position: 'bottomright' }).addTo(map);

let radarChart = null;
const buildingsLayer = L.geoJSON(null, {
    style: (f) => ({ color: COLORS[f.properties.layer] || COLORS.default, weight: 1.5, fillOpacity: 0.4 }),
    onEachFeature: (f, l) => {
        l.on('click', (e) => {
            L.DomEvent.stopPropagation(e);
            updateDashboard(f.properties, e.latlng);
        });
    }
}).addTo(map);

window.onload = () => {
    initLegend();
    loadSupabaseData();
    document.getElementById('baseMapSelect').addEventListener('change', (e) => {
        Object.values(baseMaps).forEach(l => map.removeLayer(l));
        baseMaps[e.target.value].addTo(map);
    });
};

function initLegend() {
    const container = document.getElementById('legendItems');
    Object.keys(COLORS).forEach(key => {
        if(key === 'default') return;
        container.innerHTML += `<div style="font-size:0.7rem; margin-bottom:4px">
            <span class="legend-dot" style="background:${COLORS[key]}"></span>${key.split('_')[0]}
        </div>`;
    });
}

async function loadSupabaseData() {
    const status = document.getElementById('loadingStatus');
    const prog = document.getElementById('loadProgress');
    let from = 0; let total = 0;

    while (true) {
        status.textContent = `Sincronizando... ${from}`;
        const { data, error, count } = await supabaseClient
            .from('buildings_geojson')
            .select('*', { count: 'exact' })
            .range(from, from + 999);

        if (error || !data.length) break;
        
        if (count) document.getElementById('totalCount').textContent = count;
        total += data.length;
        prog.textContent = total;

        const geojsonFeatures = data.map(d => ({
            type: "Feature",
            geometry: typeof d.geometry === 'string' ? JSON.parse(d.geometry) : d.geometry,
            properties: d
        }));

        buildingsLayer.addData(geojsonFeatures);
        if (data.length < 1000) break;
        from += 1000;
    }
    status.textContent = "✅ Sistema Activo";
}

function updateDashboard(props, latlng) {
    document.getElementById('noSelection').style.display = 'none';
    document.getElementById('selectionContent').style.display = 'block';

    // Texto básico
    document.getElementById('buildingName').textContent = props.nombre_del || `Edificio ID: ${props.gid}`;
    document.getElementById('buildingAddress').textContent = props.par_direcc || "Dirección no disponible";
    document.getElementById('kpiNiveles').textContent = props.niveles || "--";
    document.getElementById('kpiElev').textContent = parseFloat(props.elevmax || 0).toFixed(1) + "m";

    // Tabla de Atributos
    const list = document.getElementById('attributeList');
    list.innerHTML = '';
    ['tipology', 'ocup_dia', 'costo', 'tenencia', 'z_regente'].forEach(key => {
        if(props[key]) {
            list.innerHTML += `<div class="attr-item"><span class="attr-key">${key}</span><span class="attr-val">${props[key]}</span></div>`;
        }
    });

    // Gráfico de Radar
    updateRadar(props);
    map.flyTo(latlng, 21);
}

function updateRadar(p) {
    const ctx = document.getElementById('radarChart').getContext('2d');
    
    // Normalización simple para visualización
    const dataValues = [
        Math.min(parseFloat(p.niveles || 0) * 10, 100),
        Math.min(parseFloat(p.elevmax || 0) * 2, 100),
        Math.min(parseFloat(p.ocup_dia || 0) / 3, 100),
        Math.min(parseFloat(p.shape_area || 0) / 50, 100),
        Math.min(parseFloat(p.costo || 0) / 100000, 100)
    ];

    if (radarChart) radarChart.destroy();
    radarChart = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: ['Niveles', 'Altura', 'Ocupación', 'Superficie', 'Valor'],
            datasets: [{
                label: 'Perfil Técnico',
                data: dataValues,
                fill: true,
                backgroundColor: 'rgba(37, 99, 235, 0.2)',
                borderColor: '#2563eb',
                pointBackgroundColor: '#2563eb'
            }]
        },
        options: {
            scales: { r: { min: 0, max: 100, ticks: { display: false } } },
            plugins: { legend: { display: false } }
        }
    });
}