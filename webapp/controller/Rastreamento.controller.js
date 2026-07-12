/* global L */
sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/export/Spreadsheet"
], (
    Controller,
    JSONModel,
    Spreadsheet
) => {
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
                    ultimasLeituras: [],
                    dashboardVeiculos: []
                });

                this.getView().setModel(
                    oDashboardModel,
                    "dashboard"
                );

                this._grupoSelecionado = null;

                this.carregarDashboard();

            },
            determinarGrupo(item) {

                let grupo =
                    item.grupoAtual ||
                    "Sem Localização";

                const descLocal =
                    (item.descLocalInstalacao || "")
                        .toUpperCase();

                if (descLocal.includes(" A REF")) {

                    grupo = "A reformar";

                } else if (descLocal.includes("REFORMADO")) {

                    grupo = "Reformado";

                } else if (descLocal.includes("EXT")) {

                    grupo = "Reforma externa";

                } else if (
                    (
                        descLocal.includes("EMREF") ||
                        descLocal.includes("REFORMA")
                    ) &&
                    !descLocal.includes("EXT")
                ) {

                    grupo = "Reforma interna";

                }

                return grupo;

            },

            onPesquisarRastreador(oEvent) {

                const identificador =
                    oEvent.getParameter("query")
                        .trim();

                if (!identificador) {
                    return;
                }

                const marker =
                    this._equipamentoMarkers?.[
                    identificador
                    ];

                if (!marker) {

                    sap.m.MessageToast.show(
                        "Rastreador não encontrado."
                    );

                    return;

                }

                this._map.setView(
                    marker.getLatLng(),
                    18
                );

                marker.openPopup();

                this.piscarEquipamento(marker);

            },
            piscarEquipamento(marker) {

                const elemento = marker.getElement();

                if (!elemento) {
                    return;
                }

                let contador = 0;

                const intervalo = setInterval(() => {

                    elemento.style.opacity =
                        elemento.style.opacity === "0.1"
                            ? "1"
                            : "0.1";

                    contador++;

                    if (contador >= 12) {

                        clearInterval(intervalo);

                        elemento.style.opacity = "1";

                    }

                }, 250);

            },
            normalizarGrupo(texto) {

                texto = (texto || "").toUpperCase();

                if (texto.startsWith("CONVERSOR")) {
                    return "CONVERSOR DE TORQUE";
                }

                if (texto.startsWith("MOTOR")) {
                    return "MOTOR";
                }

                if (texto.startsWith("COMANDO FINAL")) {
                    return "COMANDO FINAL";
                }

                if (texto.startsWith("TRANSMISSAO")) {
                    return "TRANSMISSAO";
                }

                if (texto.startsWith("DIFERENCIAL")) {
                    return "DIFERENCIAL";
                }

                return texto;
            },
            onExportarExcel() {

                const dados = (this._dadosFiltrados || []).map(item => ({

                    identificador:
                        item.identificador || "",

                    descEquipamento:
                        item.descEquipamento || "",

                    grupoAtual:
                        item.grupoAtual || "",

                    localInstalacao:
                        item.localInstalacao || "",

                    descLocalInstalacao:
                        item.descLocalInstalacao || "",

                    gateway:
                        item.gateway || "",

                    ultimaPosicao:
                        item.ultimaPosicao || "",

                    latitude:
                        item.latitude || "",

                    longitude:
                        item.longitude || ""

                }));

                const oSpreadsheet = new Spreadsheet({

                    workbook: {

                        columns: [

                            {
                                label: "Identificador",
                                property: "identificador"
                            },

                            {
                                label: "Descrição Equipamento",
                                property: "descEquipamento"
                            },

                            {
                                label: "Grupo Atual",
                                property: "grupoAtual"
                            },

                            {
                                label: "Local Instalação",
                                property: "localInstalacao"
                            },

                            {
                                label: "Descrição Local",
                                property: "descLocalInstalacao"
                            },

                            {
                                label: "Gateway",
                                property: "gateway"
                            },

                            {
                                label: "Última Atualização",
                                property: "ultimaPosicao"
                            },

                            {
                                label: "Latitude",
                                property: "latitude"
                            },

                            {
                                label: "Longitude",
                                property: "longitude"
                            }

                        ]

                    },

                    dataSource: dados,

                    fileName: "Rastreamento_RFID.xlsx"

                });

                oSpreadsheet.build()
                    .then(() => {
                        oSpreadsheet.destroy();
                    });

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
                        this.determinarGrupo(item);
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
            gerarResumoEquipamentos(dados) {

                const resumo = {};

                dados.forEach(item => {

                    const desc =
                        (item.descEquipamento || "")
                            .toUpperCase();

                    let familia = "OUTROS";

                    if (desc.startsWith("COMANDO FINAL")) {
                        familia = "COMANDO FINAL";
                    } else if (desc.startsWith("TRANSMISSAO")) {
                        familia = "TRANSMISSAO";
                    } else if (desc.startsWith("CONVERSOR TORQUE")) {
                        familia = "CONVERSOR TORQUE";
                    } else if (desc.startsWith("DIFERENCIAL")) {
                        familia = "DIFERENCIAL";
                    } else if (desc.startsWith("MOTOR COMBUSTAO")) {
                        familia = "MOTOR COMBUSTAO";
                    }

                    if (!resumo[familia]) {

                        resumo[familia] = {
                            familia,
                            total: 0,
                            instalados: 0,
                            reformaInterna: 0,
                            reformaExterna: 0,
                            reformados: 0,
                            aReformar: 0
                        };

                    }

                    resumo[familia].total++;

                    const grupo =
                        this.determinarGrupo(item);

                    if (
                        item.grupoAtual &&
                        item.grupoAtual.startsWith("Instalado no ")
                    ) {

                        resumo[familia].instalados++;

                    } else if (grupo === "Reforma interna") {

                        resumo[familia].reformaInterna++;

                    } else if (grupo === "Reforma externa") {

                        resumo[familia].reformaExterna++;

                    } else if (grupo === "Reformado") {

                        resumo[familia].reformados++;

                    } else if (grupo === "A reformar") {

                        resumo[familia].aReformar++;

                    }

                });

                const resultado = Object.values(resumo)
                    .sort((a, b) =>
                        a.familia.localeCompare(
                            b.familia,
                            "pt-BR"
                        )
                    );

                resultado.push({

                    familia: "TOTAL",

                    total: resultado.reduce(
                        (s, x) => s + x.total, 0
                    ),

                    instalados: resultado.reduce(
                        (s, x) => s + x.instalados, 0
                    ),

                    reformaInterna: resultado.reduce(
                        (s, x) => s + x.reformaInterna, 0
                    ),

                    reformaExterna: resultado.reduce(
                        (s, x) => s + x.reformaExterna, 0
                    ),

                    reformados: resultado.reduce(
                        (s, x) => s + x.reformados, 0
                    ),

                    aReformar: resultado.reduce(
                        (s, x) => s + x.aReformar, 0
                    )

                });
                const totalGeral = resultado.reduce(
                    (s, x) => s + x.total,
                    0
                );

                resultado.forEach(item => {

                    item.percentual =
                        totalGeral > 0
                            ? (
                                (item.total / totalGeral) * 100
                            ).toFixed(1) + "%"
                            : "0%";

                });
                return resultado;

            },

            gerarResumoGrupoAtual(dados) {

                const grupos = {};

                dados.forEach(item => {

                    let grupo =
                        this.determinarGrupo(item);

                    if (
                        grupo ===
                        "Tags Digitais desatualizadas"
                    ) {
                        grupo = "Fora de zona";
                    }

                    grupos[grupo] =
                        (grupos[grupo] || 0) + 1;

                });

                const resultado = [];

                Object.keys(grupos).forEach(grupo => {

                    resultado.push({

                        grupo,

                        quantidade: grupos[grupo]

                    });

                });
                resultado.sort((a, b) =>
                    (a.grupo || "").localeCompare(
                        b.grupo || "",
                        "pt-BR",
                        { sensitivity: "base" }
                    )
                );

                return resultado;

            },
            gerarDetalhesTagsDesatualizadas(dados) {

                const agora = new Date();

                const limiteOnline = new Date(
                    agora.getTime() - (72 * 60 * 60 * 1000)
                );

                const resultado = [];

                dados.forEach(item => {

                    if (!item.ultimaPosicao) {
                        return;
                    }

                    const dataPosicao =
                        this.converterDataBr(
                            item.ultimaPosicao
                        );

                    if (dataPosicao < limiteOnline) {

                        const dias =
                            Math.floor(
                                (agora - dataPosicao) /
                                (1000 * 60 * 60 * 24)
                            );

                        const grupoAtual =
                            this.determinarGrupo(item);

                        let deducao = "";

                        if (
                            grupoAtual.startsWith("Instalado no ")
                        ) {

                            deducao =
                                "Equipamento em operação. Avaliar necessidade de gateway na área.";

                        } else if (
                            grupoAtual === "Reforma externa"
                        ) {

                            deducao =
                                "Equipamento enviado para reforma externa. Ausência de leituras é esperada.";

                        } else if (
                            grupoAtual === "Reformado"
                        ) {

                            deducao =
                                "Equipamento reformado sem leituras recentes. Avaliar necessidade de gateway na área.";

                        } else {

                            deducao =
                                "Verificar condição operacional e conectividade do equipamento.";

                        }

                        resultado.push({

                            identificador:
                                item.identificador,

                            equipamento:
                                item.descEquipamento,

                            localInstalacao:
                                item.localInstalacao,

                            grupoAtual:
                                grupoAtual,


                            ultimaPosicao:
                                item.ultimaPosicao,

                            diasSemAtualizacao:
                                dias,

                            deducao:
                                deducao

                        });

                    }

                });

                resultado.sort((a, b) =>
                    a.grupoAtual.localeCompare(
                        b.grupoAtual,
                        "pt-BR",
                        { sensitivity: "base" }
                    )
                );

                return resultado;

            },


            gerarResumoVeiculo(veiculoId, dados) {

                const resumo = {};

                dados.forEach(item => {

                    if (
                        item.grupoAtual !==
                        `Instalado no ${veiculoId}`
                    ) {
                        return;
                    }

                    const desc =
                        (item.descEquipamento || "")
                            .toUpperCase();

                    let familia = "OUTROS";

                    if (desc.startsWith("COMANDO FINAL")) {
                        familia = "COMANDO FINAL";
                    } else if (desc.startsWith("TRANSMISSAO")) {
                        familia = "TRANSMISSAO";
                    } else if (desc.startsWith("CONVERSOR TORQUE")) {
                        familia = "CONVERSOR TORQUE";
                    } else if (desc.startsWith("DIFERENCIAL")) {
                        familia = "DIFERENCIAL";
                    } else if (desc.startsWith("MOTOR COMBUSTAO")) {
                        familia = "MOTOR COMBUSTAO";
                    }

                    resumo[familia] =
                        (resumo[familia] || 0) + 1;

                });

                return resumo;

            },
            centralizarPopup(marker) {

                const posicao = marker.getLatLng();

                const pontoTela =
                    this._map.latLngToContainerPoint(
                        posicao
                    );

                const novoPontoTela = L.point(
                    pontoTela.x,
                    pontoTela.y - 180
                );

                const novoCentro =
                    this._map.containerPointToLatLng(
                        novoPontoTela
                    );

                this._map.panTo(
                    novoCentro,
                    {
                        animate: true
                    }
                );

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
                let veiculos = [];

                try {

                    const responseVeiculos = await fetch(
                        "http://localhost:4000/Veiculo"
                    );

                    veiculos = await responseVeiculos.json();

                    sap.m.MessageToast.show(
                        "Veículos: " + veiculos.length
                    );

                } catch (e) {

                    sap.m.MessageBox.error(
                        e.toString()
                    );

                }
                sap.m.MessageToast.show("veiculos: " + veiculos.length);
                const dadosFiltrados = (json.value || []).filter(
                    item =>
                        item.grupoAtual !== "Tags Digitais Não Habilitadas" &&
                        item.identificador !== "11039948"
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
                        this.determinarGrupo(item);

                    if (localizacao.startsWith("Instalado no ")) {
                        localizacao = "Instalados";
                    }

                    gruposMap[localizacao] =
                        (gruposMap[localizacao] || 0) + 1;

                    const instalado =
                        item.grupoAtual &&
                        item.grupoAtual.startsWith("Instalado no ");

                    // Equipamentos instalados não entram no cálculo
                    if (instalado) {
                        return;
                    }

                    if (!item.ultimaPosicao) {

                        offline++;
                        return;

                    }

                    const dataPosicao =
                        this.converterDataBr(
                            item.ultimaPosicao
                        );

                    if (dataPosicao >= limiteOnline) {

                        online++;

                        if (item.gateway) {
                            gatewaysSet.add(item.gateway);
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
                        grupo === "Fora de zona"
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
                const resumoEquipamentos =
                    this.gerarResumoEquipamentos(
                        dadosFiltrados
                    );

                const resumoGrupoAtual =
                    this.gerarResumoGrupoAtual(
                        dadosFiltrados
                    );
                const detalhesTagsDesatualizadas =
                    this.gerarDetalhesTagsDesatualizadas(
                        dadosFiltrados
                    );
                const mapaVeiculosDashboard = {};

                veiculos.forEach(v => {

                    const existente =
                        mapaVeiculosDashboard[v.Veiculo];

                    if (
                        !existente ||
                        new Date(v.DataAtualizacao) >
                        new Date(existente.DataAtualizacao)
                    ) {

                        mapaVeiculosDashboard[v.Veiculo] = v;

                    }

                });

                const veiculosUnicosDashboard =
                    Object.values(
                        mapaVeiculosDashboard
                    );

                const dashboardVeiculos = [];


                for (const veiculo of veiculosUnicosDashboard) {

                    const equipamentosVeiculo = dadosFiltrados.filter(
                        item =>
                            item.grupoAtual ===
                            `Instalado no ${veiculo.Veiculo}`
                    );
                    const responseEsperados = await fetch(
                        `http://localhost:4000/equipamentos/local/${encodeURIComponent(
                            veiculo.Veiculo
                        )}`
                    );

                    const gruposEsperados = await responseEsperados.json();

                    const conferencia = [];

                    let divergente = false;
                    Object.entries(gruposEsperados).forEach(
                        ([grupoEsperado, quantidadeEsperada]) => {

                            const instalado = equipamentosVeiculo.filter(
                                item =>
                                    this.normalizarGrupo(
                                        item.descEquipamento
                                    ) === grupoEsperado
                            ).length;


                            if (instalado !== quantidadeEsperada) {
                                divergente = true;
                            }

                            conferencia.push(
                                `${instalado === quantidadeEsperada ? "✅" : "❌"} ${grupoEsperado}: ${instalado}/${quantidadeEsperada}`
                            );

                        }
                    );


                    dashboardVeiculos.push({

                        veiculo: veiculo.Veiculo,

                        imagem: "img/793D.png",

                        conferencia: conferencia.join("\n"),

                        status: divergente
                            ? "Divergente"
                            : "Conforme",

                        state: divergente
                            ? "Error"
                            : "Success"

                    });

                }

                sap.m.MessageBox.information(
                    JSON.stringify(
                        dashboardVeiculos.slice(0, 5),
                        null,
                        2
                    )
                );
                this.getView()
                    .getModel("dashboard")
                    .setData({

                        totalEquipamentos: dadosFiltrados.length,

                        online,

                        offline,

                        gateways: gateways.length,

                        grupos,

                        ultimasLeituras,

                        resumoEquipamentos,

                        resumoGrupoAtual,

                        detalhesTagsDesatualizadas,

                        dashboardVeiculos
                    });

                this.byId("htmlMapa").setContent(`
        <div
            id="mapaEquipamentos"
            style="height:650px;width:100%;">
        </div>
    `);

                sap.ui.getCore().applyChanges();

                setTimeout(async () => {
                    let dadosMapa = dadosFiltrados;

                    if (this._grupoSelecionado) {

                        dadosMapa = dadosFiltrados.filter(item => {

                            let localizacao =
                                this.determinarGrupo(item);

                            if (
                                localizacao ===
                                "Tags Digitais desatualizadas"
                            ) {
                                localizacao = "Fora de zona";
                            }

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

                        if (
                            item.grupoAtual &&
                            item.grupoAtual.startsWith("Instalado no ")
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
                    const botaoMedir = L.control({
                        position: "topleft"
                    });

                    botaoMedir.onAdd = () => {

                        const div =
                            L.DomUtil.create("div");

                        div.innerHTML = `
                        <button
                            style="
                                background:white;
                                border:1px solid #ccc;
                                padding:8px;
                                cursor:pointer;
                                font-size:16px;
                                font-weight:bold;">
                            📏 Medir
                        </button>
                    `;

                        div.onclick = () => {

                            this._modoMedicao =
                                !this._modoMedicao;

                            this._pontosMedicao = [];

                            if (this._linhaMedicao) {

                                this._map.removeLayer(
                                    this._linhaMedicao
                                );

                                this._linhaMedicao = null;

                            }

                            sap.m.MessageToast.show(

                                this._modoMedicao
                                    ? "Modo medição ativado"
                                    : "Modo medição desativado"

                            );

                        };

                        return div;

                    };

                    botaoMedir.addTo(this._map);
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
                    setTimeout((a) => {

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
                            "margin-right:8px;'></span> Gateway<br>" +


                            "<span style='display:inline-block;" +
                            "width:8px;" +
                            "height:8px;" +
                            "background:#ff6347;" +
                            "border:3px solid white;" +
                            "border-radius:50%;" +
                            "box-shadow:0 0 0 4px rgba(255,99,71,0.25),0 0 10px rgba(255,99,71,0.8);" +
                            "vertical-align:middle;" +
                            "margin-right:8px;'></span> Instalado";

                        return div;
                    };

                    legenda.addTo(this._map);
                    const markers = L.layerGroup();
                    const gatewaysLayer = L.layerGroup();
                    const bounds = [];
                    this._gatewayMarkers = {};
                    this._gatewayInfo = {};
                    this._equipamentoMarkers = {};
                    this._modoMedicao = false;
                    this._pontosMedicao = [];
                    this._linhaMedicao = null;


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
        <div style="min-width:280px;">
            <b>${item.identificador}</b><br>
            <b>Equipamento:</b> ${item.descEquipamento || ''}<br>
            <b>Local:</b> ${item.localInstalacao || ''}<br>
            <b>Nota:</b> ${item.nota || 'Não informado'}<br>
            <b>Gateway:</b> ${item.gateway || ''}<br>
            <b>Última Atualização:</b> ${item.ultimaPosicao || ''}<br><br>

            <details>
                <summary><b>Ver detalhes</b></summary>
                <br>
                <b>Grupo:</b> ${item.grupoAtual || ''}<br>
                <b>Descrição do Local:</b> ${item.descLocalInstalacao || ''}<br>
                <b>Centro de Trabalho:</b> ${item.centro_trab_resp || 'Não informado'}<br>
                <b>Centro de Localização:</b> ${item.centro_localizacao || 'Não informado'}<br>
                <b>Oficina:</b> ${item.oficina || 'Não informado'}
            </details>
        </div>
    `);

                        marker.on("dblclick", () => {

                            const gatewayMarker =
                                this._gatewayMarkers[item.gateway];

                            if (!gatewayMarker) {

                                sap.m.MessageToast.show(
                                    "Gateway não encontrado."
                                );

                                return;

                            }

                            this.piscarGateway(gatewayMarker);

                            const posGateway =
                                gatewayMarker.getLatLng();

                            const distancia =
                                this.calcularDistanciaMetros(
                                    lat,
                                    lng,
                                    posGateway.lat,
                                    posGateway.lng
                                );
                            const textoDistancia =
                                distancia >= 1000
                                    ? (distancia / 1000)
                                        .toFixed(2)
                                        .replace(".", ",") + " km"
                                    : distancia.toFixed(0) + " m";
                            const gatewayInfo =
                                this._gatewayInfo[item.gateway];
                            sap.m.MessageBox.information(

                                "Gateway: " +
                                item.gateway +

                                "\nDescrição: " +
                                (gatewayInfo?.identificador || "N/A") +

                                "\nDistância estimada: " +
                                textoDistancia

                            );

                        });

                        this._equipamentoMarkers[
                            item.identificador
                        ] = marker;

                        markers.addLayer(marker);

                    });
                    const veiculosUnicos = [];

                    const mapaVeiculos = {};

                    veiculos.forEach(v => {

                        const existente = mapaVeiculos[v.Veiculo];

                        if (
                            !existente ||
                            new Date(v.DataAtualizacao) >
                            new Date(existente.DataAtualizacao)
                        ) {
                            mapaVeiculos[v.Veiculo] = v;
                        }

                    });

                    Object.values(mapaVeiculos)
                        .forEach(v => veiculosUnicos.push(v));



                    veiculosUnicos.forEach(veiculo => {
                        const resumo =
                            this.gerarResumoVeiculo(
                                veiculo.Veiculo,
                                dadosFiltrados
                            );
                        const equipamentosVeiculo =
                            dadosFiltrados.filter(item =>
                                item.grupoAtual ===
                                `Instalado no ${veiculo.Veiculo}`
                            );

                        let htmlDetalhes = "";

                        equipamentosVeiculo.forEach(item => {

                            const dataPosicao =
                                this.converterDataBr(
                                    item.ultimaPosicao
                                );

                            const online =
                                dataPosicao >= limiteOnline;

                            const indicador =
                                online
                                    ? "🟢"
                                    : "🟡";

                            htmlDetalhes += `
        <div style="
    margin:6px 0;
    padding:4px 0;
    border-bottom:1px solid #eee;
    font-size:12px;
">
    ${indicador}
    <b>${item.identificador}</b>
    -
    <span style="
        display:inline-block;
        max-width:380px;
        white-space:nowrap;     
        overflow:hidden;
        text-overflow:ellipsis;
        vertical-align:bottom;
    ">
        ${item.descEquipamento || ""}
    </span>

    <br>

    <span style="
        color:#666;
        font-size:12px;
    ">
        Última atualização:
        ${item.ultimaPosicao || "Não informada"}
    </span>
</div>
    `;

                        });

                        const totalEquipamentos =
                            Object.values(resumo)
                                .reduce(
                                    (a, b) => a + b,
                                    0
                                );

                        let htmlResumo = "";

                        Object.keys(resumo)
                            .sort()
                            .forEach(tipo => {

                                htmlResumo += `
            <b>${tipo}:</b>
            ${resumo[tipo]}<br>
        `;

                            });
                        const lat = parseFloat(veiculo.Latitude);
                        const lng = parseFloat(veiculo.Longitude);

                        if (isNaN(lat) || isNaN(lng)) {
                            return;
                        }


                        const textoResumo = Object.keys(resumo)
                            .sort()
                            .map(tipo =>
                                `${tipo}: ${resumo[tipo]}`
                            )
                            .join('\\n');

                        const textoResumoHtml =
                            textoResumo.replace(/'/g, "\\'");


                        const marker = L.marker(
                            [lat, lng],
                            {
                                icon: L.divIcon({
                                    className: "",
                                    html: `
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
                `,
                                    iconSize: [22, 22],
                                    iconAnchor: [11, 11]
                                })
                            }
                        ).bindPopup(`
        <div style="min-width:320px;">

        <div style="
            text-align:right;
            margin-bottom:10px;
        ">
<button
    title="Copiar local de instalação"
    onclick="
        navigator.clipboard.writeText('${veiculo.LOCAL_INSTALACAO}');
        sap.m.MessageToast.show('✅ Local copiado');
    "
    style="
        cursor:pointer;
        padding:6px 10px;
    ">
    📋 Copiar Local
</button>
        </div>

        <b>Veículo:</b>
        ${veiculo.Veiculo}<br>

        <b>Local:</b>
        ${veiculo.LOCAL_INSTALACAO}<br>

        <b>Equipamentos embarcados:</b>
        ${totalEquipamentos}<br>

            


    <hr>



<details
    id="resumo_${veiculo.Veiculo}"
    data-veiculo="${veiculo.Veiculo}"
    ontoggle="
        const detalhes =
            document.getElementById(
                'conteudoDetalhes_${veiculo.Veiculo}'
            );

        if (detalhes) {
            detalhes.style.display =
                this.open ? 'none' : 'block';
        }
    ">

    <summary style="
        cursor:pointer;
        font-weight:bold;
    ">
        Ver Resumo
    </summary>

    <div
        id="conteudoResumo_${veiculo.Veiculo}"
        style="margin-top:10px;">

        ${htmlResumo}

        <div style="
            text-align:right;
            margin-top:10px;
        ">
            <button
                title="Copiar resumo dos equipamentos embarcados"
                onclick="
                    navigator.clipboard.writeText('${textoResumo}');
                    sap.m.MessageToast.show('✅ Resumo copiado');
                "
                style="
                    cursor:pointer;
                    padding:6px 10px;
                ">
                📋 Copiar Resumo
            </button>
        </div>

    </div>

</details>

<details
    id="detalhes_${veiculo.Veiculo}"
    data-veiculo="${veiculo.Veiculo}"
    ontoggle="
        const resumo =
            document.getElementById(
                'conteudoResumo_${veiculo.Veiculo}'
            );

        if (resumo) {
            resumo.style.display =
                this.open ? 'none' : 'block';
        }
    ">

    <summary style="
        cursor:pointer;
        font-weight:bold;
    ">
        Detalhes
    </summary>

    <div
        id="conteudoDetalhes_${veiculo.Veiculo}"
        style="margin-top:10px;">


        ${htmlDetalhes}

        <div style="
            text-align:center;
            margin-top:10px;
        ">
            <button
                id="btnExportar_${veiculo.Veiculo}"
                style="
                    cursor:pointer;
                    padding:6px 10px;
                    width:95%;
                    box-sizing:border-box;
                ">
                📊 Exportar Excel
            </button>
        </div>

    </div>

</details>

<hr>

<b>Atualização:</b>
${new Date(veiculo.DataAtualizacao)
                                .toLocaleString("pt-BR", {
                                    day: "2-digit",
                                    month: "2-digit",
                                    year: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                    second: "2-digit"
                                })
                                .replace(",", "")}

</div>
    `);
                        markers.addLayer(marker);
                        marker.on("popupopen", () => {

                            const resumo = document.getElementById(
                                `resumo_${veiculo.Veiculo}`
                            );

                            const detalhes = document.getElementById(
                                `detalhes_${veiculo.Veiculo}`
                            );

                            if (resumo) {

                                resumo.addEventListener("toggle", () => {

                                    if (resumo.open) {

                                        this.centralizarPopup(marker);

                                    }

                                });

                            }

                            if (detalhes) {

                                detalhes.addEventListener("toggle", () => {

                                    if (detalhes.open) {

                                        this.centralizarPopup(marker);

                                    }

                                });

                            }

                            setTimeout(() => {

                                const btn = document.getElementById(
                                    `btnExportar_${veiculo.Veiculo}`
                                );

                                if (!btn) {
                                    return;
                                }

                                btn.onclick = async () => {

                                    const response = await fetch(
                                        `http://localhost:4000/StatusComponentes/veiculo?local=${encodeURIComponent(
                                            veiculo.LOCAL_INSTALACAO
                                        )}`
                                    );

                                    const dadosExcel = await response.json();

                                    const oSpreadsheet = new Spreadsheet({

                                        workbook: {
                                            columns: [
                                                {
                                                    label: "Status",
                                                    property: "status"
                                                },
                                                {
                                                    label: "Equipamento",
                                                    property: "equipamento"
                                                },
                                                {
                                                    label: "Descrição",
                                                    property: "descricao"
                                                },
                                                {
                                                    label: "Local Instalação",
                                                    property: "localInstalacao"
                                                }
                                            ]
                                        },

                                        dataSource: dadosExcel,

                                        fileName:
                                            `Veiculo_${veiculo.Veiculo}.xlsx`

                                    });

                                    oSpreadsheet.build()
                                        .finally(() =>
                                            oSpreadsheet.destroy()
                                        );

                                };

                            }, 100);

                        });
                        bounds.push([lat, lng]);

                    });


                    sap.m.MessageToast.show(
                        "Markers gateway: " +
                        gatewaysLayer.getLayers().length
                    );
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
                            width:16px;
                            height:16px;
                            background:#3498db;
                            border:3px solid white;
                            border-radius:50%;
                            box-shadow:
                                0 0 0 5px rgba(52,152,219,0.25),
                                0 0 12px rgba(52,152,219,0.8);
                        "></div>
                    `,
                                    iconSize: [22, 22],
                                    iconAnchor: [11, 11]
                                })
                            }
                        )

                            .bindTooltip(gw.identificador)
                            .bindPopup(`
            <b>${gw.identificador}</b><br>
            Gateway ID: ${gw.gatewayId}<br>
            Localidade: ${gw.localidade}<br>
            Condição: ${gw.condicao}
        `);

                        marker.on("click", () => {

                            this.processarMedicao(
                                lat,
                                lng,
                                gw.identificador
                            );

                        });

                        this._gatewayMarkers[gw.gatewayId] = marker;

                        this._gatewayInfo[gw.gatewayId] = {
                            identificador: gw.identificador,
                            localidade: gw.localidade,
                            condicao: gw.condicao
                        };

                        gatewaysLayer.addLayer(marker);

                    });
                    this._map.addLayer(markers);
                    this._map.addLayer(gatewaysLayer);
                    if (bounds.length > 0) {

                        this._map.fitBounds(bounds, {
                            padding: [30, 30]
                        });

                    }

                }, 1000);


            },
            processarMedicao(
                lat,
                lng,
                descricao
            ) {

                if (!this._modoMedicao) {
                    return;
                }

                this._pontosMedicao.push({
                    lat,
                    lng,
                    descricao
                });

                if (
                    this._pontosMedicao.length < 2
                ) {
                    return;
                }

                const p1 =
                    this._pontosMedicao[0];

                const p2 =
                    this._pontosMedicao[1];

                const distancia =
                    this._map.distance(
                        [p1.lat, p1.lng],
                        [p2.lat, p2.lng]
                    );

                if (this._linhaMedicao) {

                    this._map.removeLayer(
                        this._linhaMedicao
                    );

                }

                this._linhaMedicao = L.polyline(
                    [
                        [p1.lat, p1.lng],
                        [p2.lat, p2.lng]
                    ],
                    {
                        color: "red",
                        weight: 4
                    }
                ).addTo(this._map);

                const meioLat =
                    (p1.lat + p2.lat) / 2;

                const meioLng =
                    (p1.lng + p2.lng) / 2;

                L.popup()
                    .setLatLng([
                        meioLat,
                        meioLng
                    ])
                    .setContent(`
                                            <b>
                                                ${(distancia / 1000)
                            .toFixed(2)} km
                                            </b>
                                            `)
                    .openOn(this._map);

                this._pontosMedicao = [];

            },
            calcularDistanciaMetros(
                lat1,
                lon1,
                lat2,
                lon2
            ) {

                return this._map.distance(
                    [lat1, lon1],
                    [lat2, lon2]
                );

            },

            piscarGateway(marker) {

                const elemento = marker.getElement();

                if (!elemento) {
                    return;
                }

                let contador = 0;

                const intervalo = setInterval(() => {

                    elemento.style.opacity =
                        elemento.style.opacity === "0.2"
                            ? "1"
                            : "0.2";

                    contador++;

                    if (contador >= 8) {

                        clearInterval(intervalo);

                        elemento.style.opacity = "1";

                    }

                }, 250);

            },
            formatarStatusGrupo(grupoAtual) {


                if (
                    grupoAtual &&
                    grupoAtual.toUpperCase().includes("REFORMADO")
                ) {
                    return "Warning";
                }

                return "None";

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