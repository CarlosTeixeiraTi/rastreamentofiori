/* global L */
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

            this._grupoSelecionado = null;

            this.carregarDashboard();

        },

        onQuantidadeObjectListItemPress(oEvent) {

    const grupo =
        oEvent.getSource()
            .getBindingContext("dashboard")
            .getObject()
            .grupo;

    const dados =
        this.getView()
            .getModel("dashboard")
            .getData();

    const bounds = [];

    this._dadosFiltrados.forEach(item => {

    let localizacao =
        item.grupoAtual ||
        "Sem Localização";

    if (localizacao.startsWith("Instalado no ")) {
        localizacao = "Instalados";
    }

    if (localizacao === grupo) {

        const lat = parseFloat(item.latitude);
        const lng = parseFloat(item.longitude);

        if (!isNaN(lat) && !isNaN(lng)) {

            bounds.push([lat, lng]);

        }

    }

});

    if (bounds.length > 0 && this._map) {

        this._map.fitBounds(bounds, {
            padding: [50, 50],
            maxZoom: 18
        });

    }

},


        async carregarDashboard() {
 
            const response = await fetch(
                "/odata/v4/smart-pcm/Rastreio"
            );
            const json = await response.json();

            const responseGateway = await fetch(
                "http://10.44.32.193:4000/Gateway"
            );

            const gateways = await responseGateway.json();

            sap.m.MessageToast.show(
                "Gateways: " + gateways.length
            );


                if (!gateways.length) {

                    sap.m.MessageToast.show(
                        "Nenhum gateway retornado"
                    );

                }
                const dadosFiltrados = (json.value || []).filter(
                    item => item.grupoAtual !== "Tags Digitais Não Habilitadas"
                );
this._dadosFiltrados = dadosFiltrados;
                const gatewaysSet = new Set();
                const gruposMap = {};

                const agora = new Date();

                const limiteOnline = new Date(
                    agora.getTime() - (72 * 60 * 60 * 1000)
                );

                let online = 0;
                let offline = 0;

                dadosFiltrados.forEach(item => {

    let localizacao =
        item.grupoAtual ||
        "Sem Localização";

    if (localizacao.startsWith("Instalado no ")) {
        localizacao = "Instalados";
    }

    gruposMap[localizacao] =
        (gruposMap[localizacao] || 0) + 1;

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
const gruposNormais = [];
const gruposEspeciais = [];

Object.keys(gruposMap).forEach(grupo => {

    const item = {
        grupo,
        quantidade: gruposMap[grupo]
    };

    if (
        grupo === "Fora de zona" ||
        grupo === "Tags Digitais desatualizadas"
    ) {
        gruposEspeciais.push(item);
    } else {
        gruposNormais.push(item);
    }

});

gruposNormais.sort((a, b) =>
    a.grupo.localeCompare(
        b.grupo,
        "pt-BR",
        { sensitivity: "base" }
    )
);

const grupos = [
    ...gruposNormais,
    ...gruposEspeciais
];

                const ultimasLeituras = [...dadosFiltrados]
                    .sort(
                        (a, b) =>
                            this.converterDataBr(b.ultimaPosicao) -
                            this.converterDataBr(a.ultimaPosicao)
                    )
                    .slice(0, 10);

                this.getView()
                    .getModel("dashboard")
                    .setData({

                        totalEquipamentos: dadosFiltrados.length,

                        online,

                        offline,
gateways: gateways.length,

                        grupos,

                        ultimasLeituras

                    });

                this.byId("htmlMapa").setContent(`
    <div
        id="mapaEquipamentos"
        style="height:900px;width:100%;">
    </div>
`);

                sap.ui.getCore().applyChanges();

                setTimeout(() => {
                    let dadosMapa = dadosFiltrados;

if (this._grupoSelecionado) {

    dadosMapa = dadosFiltrados.filter(item => {

let localizacao =
    item.grupoAtual ||
    "Sem Localização";

if (localizacao.startsWith("Instalado no ")) {
    localizacao = "Instalados";
}

return localizacao === this._grupoSelecionado;

    });

}
const equipamentos = dadosMapa.filter(item => {

    if (
    item.grupoAtual === "Tags Digitais Não Habilitadas"
) {
    return false;
}

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
                    
                    setTimeout(() => {
                        this._map.invalidateSize();
                    }, 200);
                    // CONTROLE DE CAMADAS
                    L.control.layers(
                        {
                            "Mapa": osm,
                            "Satélite": satelite
                        },
                        {},
                        {
                            collapsed: false
                        }
                    ).addTo(this._map);
                    setTimeout(() => {

                        const controleLayers =
                            document.querySelector(".leaflet-control-layers");

                        if (controleLayers) {

                            controleLayers.style.fontSize = "18px";

                            const labels =
                                controleLayers.querySelectorAll("label");

                            labels.forEach(label => {
                                label.style.fontSize = "16px";
                                label.style.lineHeight = "24px";
                            });
                        }

                    }, 100);
                    // LEGENDA
                    const legenda = L.control({
                        position: "topright"
                    });

                    legenda.onAdd = function () {

                        const div = L.DomUtil.create("div", "mapLegend");

                        div.style.background = "white";
                        div.style.padding = "6px 8px";
                        div.style.borderRadius = "6px";
                        div.style.boxShadow = "0 1px 6px rgba(0,0,0,.4)";
                        div.style.fontSize = "18px";
                        div.style.lineHeight = "20px";
                        div.style.minWidth = "68px";
                        div.style.color = "#333";
                        div.style.marginTop = "6px";
                        div.style.textAlign = "left";

                        div.innerHTML =

    "<span style='display:inline-block;" +
    "width:8px;" +
    "height:8px;" +
    "background:#2ecc71;" +
    "border:3px solid white;" +
    "border-radius:50%;" +
    "box-shadow:0 0 0 4px rgba(46,204,113,0.25),0 0 10px rgba(46,204,113,0.8);" +
    "vertical-align:middle;" +
    "margin-right:8px;'></span> Online<br>" +

    "<span style='display:inline-block;" +
    "width:8px;" +
    "height:8px;" +
    "background:#f1c40f;" +
    "border:3px solid white;" +
    "border-radius:50%;" +
    "box-shadow:0 0 0 4px rgba(241,196,15,0.25),0 0 10px rgba(241,196,15,0.8);" +
    "vertical-align:middle;" +
    "margin-right:8px;'></span> Offline<br>" +

    "<span style='display:inline-block;" +
    "width:8px;" +
    "height:8px;" +
    "background:#3498db;" +
    "border:3px solid white;" +
    "border-radius:50%;" +
    "box-shadow:0 0 0 4px rgba(52,152,219,0.25),0 0 10px rgba(52,152,219,0.8);" +
    "vertical-align:middle;" +
    "margin-right:8px;'></span> Gateway";

                        return div;
                    };

                    legenda.addTo(this._map);

                    const markers = L.layerGroup();
                    const gatewaysLayer = L.layerGroup();

                    equipamentos.forEach(item => {

                        const lat = parseFloat(item.latitude);
                        const lng = parseFloat(item.longitude);
                       const dataPosicao =
    this.converterDataBr(item.ultimaPosicao);

const online =
    dataPosicao >= limiteOnline;

const ehDesatualizada =
    item.grupoAtual === "Tags Digitais desatualizadas";

const cor =
    ehDesatualizada
        ? "#f1c40f"
        : (online ? "#2ecc71" : "#f1c40f");

const sombra =
    ehDesatualizada
        ? "rgba(241,196,15,0.8)"
        : (
            online
                ? "rgba(46,204,113,0.8)"
                : "rgba(241,196,15,0.8)"
        );

const halo =
    ehDesatualizada
        ? "rgba(241,196,15,0.25)"
        : (
            online
                ? "rgba(46,204,113,0.25)"
                : "rgba(241,196,15,0.25)"
        );
                                const ehInstalado =
                                item.grupoAtual &&
                                item.grupoAtual.startsWith("Instalado no ");
                        const marker = L.marker(
                            [lat, lng],
                            {
                                icon: L.divIcon({
                                    className: "",
                                   html: ehInstalado
    ? `
        <div style="
            width:16px;
            height:16px;
            background:#ff6347;
            border:3px solid white;
            border-radius:50%;
            box-shadow:
                0 0 0 4px rgba(255,99,71,0.25),
                0 0 10px rgba(255,99,71,0.8);
        "></div>
      
      `
    : `
        <div style="
            width:16px;
            height:16px;
            background:${cor};
            border:3px solid white;
            border-radius:50%;
            box-shadow:
                0 0 0 4px ${halo},
                0 0 10px ${sombra};
        "></div>
      `,
                                                iconSize: [22, 22],
                                    iconAnchor: [11, 11]
                                })
                            }
                        ).bindPopup(`
    <b>${item.identificador}</b><br>
    Localização: ${item.grupoAtual}<br>
    Origem: ${item.grupoOriginal}<br>
    Comunicação: ${item.tipoComunicacao}<br>
    Confiança: ${item.confianca}<br>
    Última posição: ${item.ultimaPosicao}<br>
    Status: ${online ? "ONLINE" : "OFFLINE"}
`);

                        markers.addLayer(marker);

                    });

                    this._map.addLayer(markers);
                    this._map.addLayer(gatewaysLayer);
                    sap.m.MessageToast.show(
    "Markers gateway: " +
    gatewaysLayer.getLayers().length
);
                    const bounds = [];

                    equipamentos.forEach(item => {
                        bounds.push([
                            parseFloat(item.latitude),
                            parseFloat(item.longitude)
                        ]);
                    });
                    sap.m.MessageToast.show(
                        "Entrando no loop de gateways: " + gateways.length
                    );
                    gateways.forEach(gw => {

    sap.m.MessageToast.show(
        gw.identificador
    );

                        const lat = parseFloat(gw.latitude);
                        const lng = parseFloat(gw.longitude);

                        if (isNaN(lat) || isNaN(lng)) {
                            return;
                        }

                        const marker = L.marker(
                            [lat, lng],
                            {
                                icon: L.divIcon({
                                    className: "",
                                    html: `
                    <div style="
                        width:20px;
                        height:20px;
                        background:#3498db;
                        border:3px solid white;
                        border-radius:50%;
                        box-shadow:
                            0 0 0 5px rgba(52,152,219,0.25),
                            0 0 12px rgba(52,152,219,0.8);
                    "></div>
                `,
                                    iconSize: [26, 26],
                                    iconAnchor: [13, 13]
                                })
                            }
                        ).bindPopup(`
        <b>${gw.identificador}</b><br>
        Gateway ID: ${gw.gatewayId}<br>
        Localidade: ${gw.localidade}<br>
        Condição: ${gw.condicao}
    `);

                        gatewaysLayer.addLayer(marker);

                    });
                    if (bounds.length > 0) {

                        this._map.fitBounds(bounds, {
                            padding: [30, 30]
                        });

                    }

                }, 1000);


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