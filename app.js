import L from "leaflet";

var map = L.map('map').setView([18.7953, 98.9620], 15);

var osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap'
});

var Stadia_AlidadeSatellite = L.tileLayer('https://tiles.stadiamaps.com/tiles/alidade_satellite/{z}/{x}/{y}{r}.{ext}', {
    minZoom: 0,
    maxZoom: 20,
    attribution: '© Stadia Maps, © OpenMapTiles, © OpenStreetMap',
    ext: 'jpg'
});

var marker1 = L.marker([18.790054, 98.981600]).bindPopup("บ้านนายสมชาย");
var marker2 = L.marker([18.788145350013078, 99.01558952416546]).bindPopup("บ้านสมหมาย");

var roadGeom = [
    [18.802648, 98.951397],
    [18.802891, 98.950987],
    [18.803118, 98.950452],
    [18.803264, 98.949716]
];
var line = new L.Polyline(roadGeom, { color: "#853953" });

var angkeawGeom = [
    [18.809407, 98.949242],
    [18.808846, 98.949114],
    [18.807762, 98.949394],
    [18.806591, 98.948749],
    [18.806520, 98.947960],
    [18.805263, 98.949675],
    [18.806354, 98.951283],
    [18.807453, 98.951276],
    [18.809407, 98.949235],
];
var angkeaw = new L.polygon(angkeawGeom, { color: "ORANGE", fillColor: "RED" });

var amphoe = new L.tileLayer.wms("https://engrids.soc.cmu.ac.th/geoserver/cm_dwr/wms?", {
    layers: 'cm_dwr:cm_dwr_amphoe_4326',
    format: 'image/png',
    transparent: true,
});

var village = new L.tileLayer.wms("https://engrids.soc.cmu.ac.th/geoserver/cm_dwr/wms?", {
    layers: 'cm_dwr:cm_dwr_village_4326',
    format: 'image/png',
    transparent: true,
});

var tambon = new L.tileLayer.wms("https://engrids.soc.cmu.ac.th/geoserver/cm_dwr/wms?", {
    layers: 'cm_dwr:cm_tambon_4326',
    format: 'image/png',
    transparent: true,
});

var trans = new L.tileLayer.wms("https://engrids.soc.cmu.ac.th/geoserver/cm_dwr/wms?", {
    layers: 'cm_dwr:cm_dwr_trans_4326',
    format: 'image/png',
    transparent: true,
});

var landuse = new L.tileLayer.wms("https://engrids.soc.cmu.ac.th/geoserver/cm_dwr/wms?", {
    layers: 'cm_dwr:cm_dwr_landuse_4326',
    format: 'image/png',
    transparent: true,
});

var baseMap = {
    "แผนที่ดาวเทียม": Stadia_AlidadeSatellite.addTo(map),
    "osm": osm
};

var overlay = {
    "marker1": marker1.addTo(map),
    "ม๊ากเก้อร์": marker2.addTo(map),
    "ถนน": line.addTo(map),
    "อ้างเเก้ว": angkeaw.addTo(map),
    "ขอบเขตอำเภอ": amphoe.addTo(map),
    "ขอบเขตหมู่บ้าน": village.addTo(map),
    "ขอบเขตตำบล": tambon.addTo(map),
    "ขอบเขตถนน": trans.addTo(map),
    "ขอบเขตการใช้ประโยชน์ที่ดิน": landuse.addTo(map),
};

L.control.layers(baseMap, overlay).addTo(map);

map.on("click", (e) => {
    console.log(e.latlng);
    document.getElementById("lat").innerHTML = e.latlng.lat;
    document.getElementById("lng").innerHTML = e.latlng.lng;
});