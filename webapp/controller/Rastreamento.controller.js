sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel"
], (Controller, JSONModel) => {
    "use strict";

    return Controller.extend(
        "br.com.smartpcm.rastreamento.zrastreio.controller.Rastreamento",
        {

            onInit() {

                const oDashboardModel = new JSONModel({
                    totalEquipamentos: 0,
                    online: 0,
                    offline: 0,
                    gateways: 0,
                    grupos: [],
                    ultimasLeituras: []
                });

                this.getView().setModel(
                    oDashboardModel,
                    "dashboard"
                );

                this.carregarDashboard();

            },

            async carregarDashboard() {

                const response = await fetch(
                    "/odata/v4/smart-pcm/Rastreio"
                );

                const json = await response.json();

                const dadosFiltrados = (json.value || []).filter(
                    item => item.grupo !== "Tags Digitais Não Habilitadas"
                );

                const gatewaysSet = new Set();
                const gruposMap = {};

                const agora = new Date();

                const limiteOnline = new Date(
                    agora.getTime() - (72 * 60 * 60 * 1000)
                );

                let online = 0;
                let offline = 0;

                dadosFiltrados.forEach(item => {

                    gruposMap[item.grupo] =
                        (gruposMap[item.grupo] || 0) + 1;

                    if (item.ultimaPosicao) {

                        const dataPosicao =
                            this.converterDataBr(item.ultimaPosicao);

                        if (dataPosicao >= limiteOnline) {

                            online++;

                            if (item.gateway) {
                                gatewaysSet.add(item.gateway);
                            }

                        } else {

                            offline++;

                        }

                    } else {

                        offline++;

                    }

                });

                const grupos = Object.keys(gruposMap).map(grupo => ({
                    grupo,
                    quantidade: gruposMap[grupo]
                }));

                const ultimasLeituras = [...dadosFiltrados]
                    .sort(
                        (a, b) =>
                            new Date(b.updatedAt) -
                            new Date(a.updatedAt)
                    )
                    .slice(0, 10);

                this.getView()
                    .getModel("dashboard")
                    .setData({

                        totalEquipamentos: dadosFiltrados.length,

                        online,

                        offline,

                        gateways: gatewaysSet.size,

                        grupos,

                        ultimasLeituras

                    });

                this.byId("htmlMapa").setContent(`
    <div
        id="mapaEquipamentos"
        style="height:500px;width:100%;">
    </div>
`);

                sap.ui.getCore().applyChanges();

                setTimeout(() => {

                    const equipamentos = dadosFiltrados.filter(item => {

                        const lat = parseFloat(item.latitude);
                        const lng = parseFloat(item.longitude);

                        return (
                            !isNaN(lat) &&
                            !isNaN(lng) &&
                            lat >= -21 &&
                            lat <= -18 &&
                            lng >= -45 &&
                            lng <= -42
                        );

                    });

                    if (!equipamentos.length) {
                        return;
                    }

                    if (this._map) {
                        this._map.remove();
                    }

                    const osm = L.tileLayer(
                        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
                        {
                            attribution: "&copy; OpenStreetMap"
                        }
                    );

                    const satelite = L.tileLayer(
                        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
                        {
                            attribution: "Tiles © Esri"
                        }
                    );

                    this._map = L.map("mapaEquipamentos", {
                        layers: [satelite]
                    });


                    L.control.layers(
                        {
                            "Mapa": osm,
                            "Satélite": satelite
                        }
                    ).addTo(this._map);

                    const markers = L.layerGroup();

                    equipamentos.forEach(item => {

                        const lat = parseFloat(item.latitude);
                        const lng = parseFloat(item.longitude);

                        const marker = L.marker(
                            [lat, lng],
                            {
                                icon: L.divIcon({
                                    className: "",
                                    html: `
                <div style="
                    width:16px;
                    height:16px;
                    background:#2ecc71;
                    border:3px solid white;
                    border-radius:50%;
                    box-shadow:
                        0 0 0 4px rgba(46,204,113,0.25),
                        0 0 10px rgba(46,204,113,0.8);
                "></div>
            `,
                                    iconSize: [22, 22],
                                    iconAnchor: [11, 11]
                                })
                            }
                        ).bindPopup(`
    <b>${item.identificador}</b><br>
    Grupo: ${item.grupo}<br>
    Latitude: ${lat}<br>
    Longitude: ${lng}
`);

                        markers.addLayer(marker);

                    });

                    this._map.addLayer(markers);

                    const bounds = [];

                    equipamentos.forEach(item => {
                        bounds.push([
                            parseFloat(item.latitude),
                            parseFloat(item.longitude)
                        ]);
                    });

                    if (bounds.length > 0) {

                        this._map.fitBounds(bounds, {
                            padding: [30, 30]
                        });

                    }

                }, 500);


            },

            converterDataBr(dataStr) {

                try {

                    const partes = dataStr.split(",");

                    const data = partes[0].trim().split("/");
                    const hora = partes[1].trim().split(":");

                    return new Date(
                        parseInt(data[2], 10),
                        parseInt(data[1], 10) - 1,
                        parseInt(data[0], 10),
                        parseInt(hora[0], 10),
                        parseInt(hora[1], 10),
                        parseInt(hora[2], 10)
                    );

                } catch (e) {

                    return new Date(0);

                }

            }

        }
    );
});