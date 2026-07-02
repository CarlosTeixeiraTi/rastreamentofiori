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
                    <div style="
                        height:500px;
                        overflow:auto;
                        padding:10px;
                        border:1px solid #ccc;
                        background:#fafafa">

                        ${dadosFiltrados
                        .filter(item =>
                            !isNaN(parseFloat(item.latitude)) &&
                            !isNaN(parseFloat(item.longitude))
                        )
                        .map(item => `
                                <div style="
                                    margin-bottom:8px;
                                    padding:8px;
                                    background:white;
                                    border-radius:4px;
                                    border:1px solid #ddd">

                                    📍 <strong>${item.identificador}</strong><br>
                                    Grupo: ${item.grupo}<br>
                                    Latitude: ${item.latitude}<br>
                                    Longitude: ${item.longitude}

                                </div>
                            `)
                        .join("")}

                    </div>
                `);

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