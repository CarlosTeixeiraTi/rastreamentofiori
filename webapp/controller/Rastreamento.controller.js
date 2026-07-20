/* global L */
sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/export/Spreadsheet",
    "sap/m/BusyDialog"
], (
    Controller,
    JSONModel,
    Spreadsheet,
    BusyDialog
) => {

    "use strict";

    return Controller.extend(
        "br.com.smartpcm.rastreamento.zrastreio.controller.Rastreamento",
        {
            onInit() {
                // sap.ui.require(["sap/ui/thirdparty/jquery"], function ($) {
                //     $("body").css("zoom", "75%");
                // });
                this._busyDialog = new BusyDialog({
                    title: "Carregando",
                    text: "Reconstruindo mapa..."
                });

                this._busyMapaInicial = new BusyDialog({
                    title: "Carregando",
                    text: "Montando mapa..."
                });

                this._primeiraCargaMapa = true;

                this.resumoTipoStatus = [];

                const oDashboardModel = new JSONModel({
                    totalEquipamentos: 0,
                    online: 0,
                    offline: 0,
                    gateways: 0,
                    grupos: [],
                    ultimasLeituras: [],
                    dashboardVeiculos: [],
                    resumoFrotas: []
                });

                this.getView().setModel(
                    oDashboardModel,
                    "dashboard"
                );

                this._grupoSelecionado = null;

                // this.carregarDashboard();
            },
            onAfterRendering() {

                if (!this._zoomAplicado) {



                }

                if (this._dashboardCarregado) {
                    return;
                }

                this._dashboardCarregado = true;

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
            gerarResumoTipoStatus(dados) {

                const resumo = {};

                dados.forEach(item => {

                    const tipo =
                        item.tipo || "OUTROS";

                    if (!resumo[tipo]) {

                        resumo[tipo] = {

                            tipo,

                            instalado: 0,

                            reformaInterna: 0,

                            reformaExterna: 0,

                            reformado: 0,

                            aReformar: 0

                        };

                    }

                    const status =
                        (item.status || "").toUpperCase();

                    if (status.includes("INSTALADO")) {

                        resumo[tipo].instalado++;

                    } else if (
                        status.includes("REFORMA INTERNA")
                    ) {

                        resumo[tipo].reformaInterna++;

                    } else if (
                        status.includes("REFORMA EXTERNA")
                    ) {

                        resumo[tipo].reformaExterna++;

                    } else if (
                        status.includes("REFORMADO")
                    ) {

                        resumo[tipo].reformado++;

                    } else if (
                        status.includes("A REFORMAR")
                    ) {

                        resumo[tipo].aReformar++;

                    }

                });

                return Object.values(resumo);

            },

            onTabSelecionada(oEvent) {

                const oItem =
                    oEvent.getParameter("item");

                if (
                    oItem &&
                    oItem.getKey() === "geo"
                ) {

                    this._busyDialog.open();

                    setTimeout(() => {

                        if (this._map) {

                            this._map.remove();
                            this._map = null;

                        }

                        this.carregarDashboard();

                    }, 500);

                }

            },



            gerarResumoFrotas(dados) {

                const resumo = {};

                dados.forEach(item => {

                    if (!item.fornecedor || !item.fornecedor.trim()) {
                        return;
                    }

                    const chave =
                        `${item.fornecedor}|${item.frota}`;

                    if (!resumo[chave]) {

                        resumo[chave] = {

                            fornecedor: item.fornecedor,

                            frota: item.frota,

                            imagem: "img/componente_peq.png",

                            comandoFinal: 0,

                            transmissao: 0,

                            conversorTorque: 0,

                            diferencial: 0,

                            motor: 0,

                            total: 0

                        };

                    }

                    resumo[chave].total++;

                    switch (item.tipo) {

                        case "COMANDO FINAL":
                            resumo[chave].comandoFinal++;
                            break;

                        case "TRANSMISSAO":
                            resumo[chave].transmissao++;
                            break;

                        case "CONVERSOR DE TORQUE":
                            resumo[chave].conversorTorque++;
                            break;

                        case "DIFERENCIAL":
                            resumo[chave].diferencial++;
                            break;

                        case "MOTOR":
                            resumo[chave].motor++;
                            break;

                    }

                });
                const resultado = Object.values(resumo)
                    .sort((a, b) =>
                        a.frota.localeCompare(b.frota)
                    );

                resultado.push({

                    imagem: "",

                    fornecedor: "TOTAL",

                    frota: "",

                    comandoFinal: resultado.reduce(
                        (s, x) => s + x.comandoFinal,
                        0
                    ),

                    transmissao: resultado.reduce(
                        (s, x) => s + x.transmissao,
                        0
                    ),

                    conversorTorque: resultado.reduce(
                        (s, x) => s + x.conversorTorque,
                        0
                    ),

                    diferencial: resultado.reduce(
                        (s, x) => s + x.diferencial,
                        0
                    ),

                    motor: resultado.reduce(
                        (s, x) => s + x.motor,
                        0
                    ),

                    total: resultado.reduce(
                        (s, x) => s + x.total,
                        0
                    )

                });

                return resultado;
                return Object.values(resumo)
                    .sort((a, b) =>
                        a.frota.localeCompare(b.frota)
                    );

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
            gerarAnaliseInstaladosDesatualizados(dados) {

                const agora = new Date();

                const limite72h = new Date(
                    agora.getTime() - (72 * 60 * 60 * 1000)
                );

                const resultado = [];

                dados.forEach(item => {

                    if (
                        !item.grupoAtual ||
                        !item.grupoAtual.startsWith("Instalado no ")
                    ) {
                        return;
                    }

                    if (!item.ultimaPosicao) {
                        return;
                    }

                    const dataPosicao =
                        this.converterDataBr(
                            item.ultimaPosicao
                        );


                    if (dataPosicao >= limite72h) {
                        return;
                    }

                    const veiculo =
                        item.grupoAtual.replace(
                            "Instalado no ",
                            ""
                        );

                    const equipamentosMesmoVeiculo =
                        dados.filter(x =>
                            x.grupoAtual ===
                            `Instalado no ${veiculo}`
                        );

                    let dataMaisRecente = null;

                    let equipamentoMaisRecente = "";

                    let gatewayMaisRecente = "";

                    equipamentosMesmoVeiculo.forEach(eq => {

                        if (!eq.ultimaPosicao) {
                            return;
                        }

                        const data =
                            this.converterDataBr(
                                eq.ultimaPosicao
                            );

                        if (
                            !dataMaisRecente ||
                            data > dataMaisRecente
                        ) {

                            dataMaisRecente = data;

                            equipamentoMaisRecente =
                                eq.descEquipamento || "";

                            gatewayMaisRecente =
                                eq.gateway || "";

                        }

                    });

                    const gapDias =
                        dataMaisRecente
                            ? Math.floor(
                                (dataMaisRecente - dataPosicao) /
                                (1000 * 60 * 60 * 24)
                            )
                            : 0;
                    const diasSemAtualizacao =
                        Math.floor(
                            (agora - dataPosicao) /
                            (1000 * 60 * 60 * 24)
                        );
                    if (
                        diasSemAtualizacao <= 3 ||
                        gapDias <= 2
                    ) {
                        return;
                    }
                    const existeAtualizacaoVeiculo =
                        dataMaisRecente !== null;

                    let conclusao = "";

                    if (!existeAtualizacaoVeiculo) {

                        conclusao =
                            "Sem evidência suficiente";

                    } else if (gapDias <= 2) {

                        conclusao =
                            "Baixa criticidade";

                    } else if (gapDias <= 7) {

                        conclusao =
                            "Possível falha individual";

                    } else {

                        conclusao =
                            "Forte evidência de falha individual";

                    }
                    let motivoConclusao = "";

                    if (!existeAtualizacaoVeiculo) {

                        motivoConclusao =
                            "Não foi encontrada atualização de outro rastreador do mesmo veículo que permitisse comparação.";

                    } else {

                        motivoConclusao =
                            `O equipamento analisado apresentou sua última atualização em ${item.ultimaPosicao}. `
                            + `No mesmo veículo (${veiculo}), a atualização mais recente identificada ocorreu em `
                            + `${dataMaisRecente.toLocaleString("pt-BR")} `
                            + `através do equipamento "${equipamentoMaisRecente}". `
                            + `Foi identificado um GAP de ${gapDias} dia(s) entre os registros, `
                            + `diferença utilizada como base para a classificação "${conclusao}".`;

                    }
                    const racional =
                        diasSemAtualizacao > 3
                            ? motivoConclusao
                            : "";
                    resultado.push({

                        veiculo,

                        identificador:
                            item.identificador,

                        equipamento:
                            item.descEquipamento,

                        gateway:
                            item.gateway,

                        ultimaAtualizacao:
                            item.ultimaPosicao,

                        quantidadeEquipamentosVeiculo:
                            equipamentosMesmoVeiculo.length,

                        ultimaAtualizacaoVeiculo:
                            dataMaisRecente
                                ? dataMaisRecente.toLocaleString("pt-BR")
                                : "",

                        equipamentoMaisRecente,

                        gatewayMaisRecente,

                        gapDias:
                            diasSemAtualizacao > 3
                                ? gapDias
                                : "",

                        existeAtualizacaoVeiculo:
                            existeAtualizacaoVeiculo
                                ? "Sim"
                                : "Não",

                        conclusao,

                        motivoConclusao: racional

                    });

                });

                resultado.sort(
                    (a, b) => b.gapDias - a.gapDias
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
            criarMarcadorMina(
                texto,
                lat,
                lng
            ) {

                return L.marker(
                    [lat, lng],
                    {
                        icon: L.divIcon({
                            className: "",
                            html: `
                        <div style="
                            display:flex;
                            align-items:center;
                            white-space:nowrap;
                        ">

                            <div style="
                                width:18px;
                                height:18px;
                                background:#95a5a6;
                                border-radius:50%;
                                border:3px solid white;
                                box-shadow:0 0 6px rgba(0,0,0,.5);
                            ">
                            </div>

                            <span style="
                                margin-left:6px;
                                color:white;
                                font-weight:bold;
                                font-size:14px;
                                text-shadow:
                                    2px 2px 4px black;
                            ">
                                ${texto}
                            </span>

                        </div>
                    `,
                            iconSize: [220, 24],
                            iconAnchor: [9, 9]
                        })
                    }
                );

            },
            criarLabel(
                texto,
                lat,
                lng,
                classe
            ) {

                return L.marker(
                    [lat, lng],
                    {
                        opacity: 0
                    }
                ).bindTooltip(
                    texto,
                    {
                        permanent: true,
                        direction: "center",
                        className: classe
                    }
                );

            },
            atualizarLabels() {

                if (!this._layerLabels) {
                    return;
                }

                this._layerLabels.clearLayers();

                const zoom = this._map.getZoom();

                // Cidade
                // Cidade
                if (zoom <= 14) {

                    this.criarLabel(
                        "ITABIRA",
                        -19.605478,
                        -43.239840,
                        "cityLabel"
                    ).addTo(this._layerLabels);

                }
                if (zoom >= 14) {

                    [
                        ["CENTRO", -19.624, -43.226],
                        ["PARÁ", -19.620, -43.233],
                        ["BELA VISTA", -19.618, -43.212],
                        ["NOVA VISTA", -19.620, -43.202],
                        ["SÃO PEDRO", -19.624, -43.218],
                        ["JUCA ROSA", -19.635, -43.213],
                        ["COLINA DA PRAIA", -19.645, -43.205],
                        ["PEDREIRA", -19.642, -43.245],
                        ["MACHADO", -19.665, -43.240],
                        ["JOÃO XXIII", -19.678, -43.233],
                        ["VILA BETHÂNIA", -19.678, -43.218],
                        ["GABIROBA", -19.683, -43.185],
                        ["FÊNIX", -19.695, -43.242],
                        ["VALE DO SOL", -19.655, -43.165]
                    ]
                        .forEach(item => {

                            this.criarLabel(
                                item[0],
                                item[1],
                                item[2],
                                "bairroLabel"
                            ).addTo(this._layerLabels);

                        });

                }
                if (zoom >= 14) {

                    [

                        ["DIQUE DE IPOEMA", -19.567, -43.305],
                        ["BARRAGEM DO QUINZINHO", -19.565, -43.280],
                        ["PEDREIRA DO INSTITUTO", -19.545, -43.165],

                        ["PDE BORRACHUDO", -19.600, -43.285],

                        ["PEDREIRA DETALHE", -19.620, -43.258],

                        ["DIQUE DE IPOEMA", -19.567, -43.305]



                    ]
                        .forEach(item => {

                            this.criarLabel(
                                item[0],
                                item[1],
                                item[2],
                                "bairroLabel"
                            ).addTo(this._layerLabels);

                        });

                }
                if (zoom >= 14) {

                    [

                        ["MINA CAUÊ", -19.599252, -43.218690],

                        ["MINA CONCEIÇÃO", -19.657580, -43.269398],

                        ["MINA PERIQUITO", -19.632715, -43.254261]

                    ]
                        .forEach(item => {

                            this.criarLabel(
                                item[0],
                                item[1],
                                item[2],
                                "operacaoValeLabel"
                            ).addTo(this._layerLabels);

                        });

                }
                if (zoom >= 14 && zoom < 16) {

                    [

                        ["OFICINA CENTRAL", -19.601106, -43.214199],

                        ["POSTO", -19.632648, -43.242334]
                    ]
                        .forEach(item => {

                            this.criarLabel(
                                item[0],
                                item[1],
                                item[2],
                                "gatewayLabel"
                            ).addTo(this._layerLabels);

                        });

                }
                if (zoom >= 16) {

                    [

                        ["ÁREA 23", -19.604498, -43.211828],

                        ["ÁREA 27", -19.601748, -43.209649],

                        ["OFICINA CENTRAL", -19.601106, -43.214199],

                        ["PORTARIA PRINCIPAL", -19.604328, -43.216655],

                        ["PORTARIA VALER", -19.604723, -43.214709],

                        ["POSTO PERIQUITO", -19.632648, -43.242334]

                    ]
                        .forEach(item => {

                            this.criarLabel(
                                item[0],
                                item[1],
                                item[2],
                                "gatewayLabel"
                            ).addTo(this._layerLabels);

                        });

                }
                if (zoom >= 17) {

                    [


                        ["OFICINA DE LUBRIFICAÇÃO", -19.601286, -43.215671],


                    ]
                        .forEach(item => {

                            this.criarLabel(
                                item[0],
                                item[1],
                                item[2],
                                "gatewayLabel"
                            ).addTo(this._layerLabels);

                        });

                }
            },
            gerarGraficoTipoStatus(dados) {

                const resumo = {};

                dados.forEach(item => {

                    if (!item.tipo || !item.status) {
                        return;
                    }

                    if (item.tipo === "OUTROS") {
                        return;
                    }

                    let status = item.status;

                    if (status.startsWith("Instalado no ")) {
                        status = "Instalado";
                    }

                    const chave =
                        `${item.tipo}|${status}`;

                    resumo[chave] = (resumo[chave] || 0) + 1;

                });

                return Object.keys(resumo).map(chave => {

                    const partes = chave.split("|");

                    return {
                        tipo: partes[0],
                        status: partes[1],
                        quantidade: resumo[chave]
                    };

                });

            },
            async onExportarDetalhamento() {

                const oBusyDialog = new sap.m.BusyDialog({
                    title: "Exportando",
                    text: "Gerando detalhamento..."
                });

                oBusyDialog.open();

                try {

                    const response = await fetch(
                        "http://localhost:4000/ConferenciaComponentesDetalhado/listar"
                    );

                    if (!response.ok) {

                        sap.m.MessageBox.error(
                            `Erro ${response.status}`
                        );

                        return;
                    }

                    const dados = await response.json();

                    const oSpreadsheet = new Spreadsheet({

                        workbook: {

                            columns: [

                                {
                                    label: "Tag Veículo",
                                    property: "tagVeiculo"
                                },

                                {
                                    label: "Tipo",
                                    property: "tipo"
                                },

                                {
                                    label: "Equipamento SAP",
                                    property: "equipamentoSap"
                                },

                                {
                                    label: "Categoria",
                                    property: "categoria"
                                }

                            ]

                        },

                        dataSource: dados,

                        fileName:
                            "Detalhamento_Componentes_Embarcados.xlsx"

                    });

                    await oSpreadsheet.build();

                    oSpreadsheet.destroy();

                } catch (err) {

                    sap.m.MessageBox.error(
                        err.message || "Erro ao gerar relatório"
                    );

                } finally {

                    oBusyDialog.close();

                }

                try {

                    const response = await fetch(
                        "http://localhost:4000/ConferenciaComponentesDetalhado/listar"
                    );

                    if (!response.ok) {

                        sap.m.MessageBox.error(
                            `Erro ${response.status}`
                        );

                        return;
                    }

                    const dados = await response.json();

                    const oSpreadsheet = new Spreadsheet({

                        workbook: {

                            columns: [

                                {
                                    label: "Tag Veículo",
                                    property: "tagVeiculo"
                                },

                                {
                                    label: "Tipo",
                                    property: "tipo"
                                },

                                {
                                    label: "Equipamento SAP",
                                    property: "equipamentoSap"
                                },

                                {
                                    label: "Categoria",
                                    property: "categoria"
                                }

                            ]

                        },

                        dataSource: dados,

                        fileName:
                            "Detalhamento_Componentes_Embarcados.xlsx"

                    });

                    await oSpreadsheet.build();

                    oSpreadsheet.destroy();

                } catch (err) {

                    sap.m.MessageBox.error(
                        err.message || "Erro ao gerar relatório"
                    );

                } finally {

                    sap.ui.core.BusyIndicator.hide();

                }

            },
            onExportarConferenciaExcel() {

                const dados =
                    this.getView()
                        .getModel("dashboard")
                        .getProperty("/dashboardVeiculos");

                const oSpreadsheet = new Spreadsheet({

                    workbook: {

                        columns: [

                            {
                                label: "Veículo",
                                property: "veiculo"
                            },

                            {
                                label: "Status",
                                property: "status"
                            },

                            {
                                label: "Conferência",
                                property: "conferencia"
                            }

                        ]

                    },

                    dataSource: dados,

                    fileName:
                        "Conferencia_Componentes_Embarcados.xlsx"

                });

                oSpreadsheet.build()
                    .finally(() => {
                        oSpreadsheet.destroy();
                    });

            },

            async carregarDashboard() {

                if (this._primeiraCargaMapa) {
                    this._busyMapaInicial.open();
                }

                const response = await fetch(
                    "/odata/v4/smart-pcm/Rastreio"
                );
                const json = await response.json();
                const responseEstrutura =
                    await fetch(
                        "http://localhost:4000/EquipamentosEstrutura"
                    );

                const equipamentosEstrutura =
                    await responseEstrutura.json();
                const resumoTipoStatus =
                    this.gerarResumoTipoStatus(
                        equipamentosEstrutura
                    );
                const resumoFrotas =
                    this.gerarResumoFrotas(
                        equipamentosEstrutura
                    );
                const responseGateway = await fetch(
                    "http://10.44.32.193:4000/Gateway"
                );

                const gateways = await responseGateway.json();

                // sap.m.MessageToast.show(
                //     "Passou aqui 1"
                // );

                const mapaGatewayDescricao = {};

                gateways.forEach(gw => {

                    mapaGatewayDescricao[
                        gw.gatewayId
                    ] = gw.identificador;

                });

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

                } catch (e) {

                    sap.m.MessageBox.error(
                        e.toString()
                    );
                }

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
                const analiseInstaladosDesatualizados =
                    this.gerarAnaliseInstaladosDesatualizados(
                        dadosFiltrados
                    );
                sap.m.MessageToast.show(
                    analiseInstaladosDesatualizados.length + " registros"
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

                            conferencia.push({

                                tipo: grupoEsperado,

                                rastreadoresInstalados: instalado,

                                cadastradosSap: quantidadeEsperada,

                                aderenciaSap:
                                    quantidadeEsperada > 0
                                        ? Math.round(
                                            (instalado / quantidadeEsperada) * 100
                                        )
                                        : 0

                            });

                        }
                    );

                    dashboardVeiculos.push({

                        veiculo: veiculo.Veiculo,

                        imagem: "img/793D.png",

                        conferencia,

                        status: divergente
                            ? "Divergente"
                            : "Conforme",

                        state: divergente
                            ? "Error"
                            : "Success"

                    });


                }
                const graficoTipoStatus =
                    this.gerarGraficoTipoStatus(
                        equipamentosEstrutura
                    );
                // sap.m.MessageBox.information(
                //     JSON.stringify(
                //         resumoFrotas.slice(0, 5),
                //         null,
                //         2
                //     )
                // );   
                const responseReformados =
                    await fetch(
                        "http://localhost:4000/ReformadosDescLocal/listar"
                    );

                const reformadosPorOficina =
                    await responseReformados.json();

                // const reformadosPorLocal =
                //     await responseReformados.json();

                const responseLocalizacao =
                    await fetch(
                        "http://localhost:4000/LocalizacaoAtual"
                    );

                const localizacaoAtual =
                    await responseLocalizacao.json();

                /*
                * AQUI
                */
                const instalados =
                    localizacaoAtual.filter(
                        item => item.nota !== null
                    ).length;

                const totalRastreadores = 50;

                const faltantes =
                    totalRastreadores - instalados;

                const percentualInstalado =
                    (
                        (instalados / totalRastreadores) * 100
                    ).toFixed(1);

                const graficoInstalacao = [
                    {
                        status: "Instalados",
                        quantidade: instalados
                    },
                    {
                        status: "Pendentes",
                        quantidade: faltantes
                    }
                ];

                // sap.m.MessageBox.information(
                //     JSON.stringify(
                //         graficoInstalacao,
                //         null,
                //         2
                //     )
                const totalEquipamentos = dadosFiltrados.length;

                online = totalEquipamentos - offline;

                const percentualOnline =
                    totalEquipamentos > 0
                        ? ((online / totalEquipamentos) * 100).toFixed(1)
                        : "0.0";

                const percentualOffline =
                    totalEquipamentos > 0
                        ? ((offline / totalEquipamentos) * 100).toFixed(1)
                        : "0.0";
                const percentualEquipamentos =
                    ((totalEquipamentos / 50) * 100).toFixed(1);
                const percentualGateway =
                    ((gateways.length / 8) * 100).toFixed(1) + "%";
                this.getView()
                    .getModel("dashboard")
                    .setData({

                        totalEquipamentos,
                        percentualEquipamentos,
                        online,

                        offline,

                        percentualOnline,

                        percentualOffline,

                        gateways: gateways.length,
                        percentualGateway,
                        grupos,

                        ultimasLeituras,

                        resumoEquipamentos,

                        resumoGrupoAtual,

                        detalhesTagsDesatualizadas,

                        analiseInstaladosDesatualizados,

                        dashboardVeiculos,

                        resumoFrotas,

                        resumoTipoStatus,

                        graficoTipoStatus,

                        reformadosPorOficina,

                        graficoInstalacao,

                        instalados,

                        faltantes,

                        percentualInstalado,



                    });
                const oVizFrame =
                    this.byId("idTipoStatusVizFrame");

                if (oVizFrame) {

                    oVizFrame.destroyFeeds();

                    if (oVizFrame.getDataset()) {
                        oVizFrame.destroyDataset();
                    }

                    const oDataset =
                        new sap.viz.ui5.data.FlattenedDataset({

                            dimensions: [

                                {
                                    name: "Tipo",
                                    value: "{dashboard>tipo}"
                                },

                                {
                                    name: "Status",
                                    value: "{dashboard>status}"
                                }

                            ],

                            measures: [

                                {
                                    name: "Quantidade",
                                    value: "{dashboard>quantidade}"
                                }

                            ],

                            data: {
                                path: "dashboard>/graficoTipoStatus"
                            }

                        });

                    oVizFrame.setDataset(oDataset);

                    oVizFrame.setModel(
                        this.getView().getModel("dashboard"),
                        "dashboard"
                    );

                    oVizFrame.addFeed(
                        new sap.viz.ui5.controls.common.feeds.FeedItem({
                            uid: "valueAxis",
                            type: "Measure",
                            values: ["Quantidade"]
                        })
                    );

                    oVizFrame.addFeed(
                        new sap.viz.ui5.controls.common.feeds.FeedItem({
                            uid: "categoryAxis",
                            type: "Dimension",
                            values: ["Tipo"]
                        })
                    );

                    oVizFrame.addFeed(
                        new sap.viz.ui5.controls.common.feeds.FeedItem({
                            uid: "color",
                            type: "Dimension",
                            values: ["Status"]
                        })
                    );
                    oVizFrame.setVizProperties({

                        plotArea: {
                            dataLabel: {
                                visible: true,
                                style: {
                                    fontSize: "16px",
                                    fontWeight: "bold"
                                }
                            }
                        },

                        legend: {
                            title: {
                                visible: false
                            }
                        },

                        title: {
                            visible: false
                        }

                    });

                }
                const oVizFrameReformados =
                    this.byId("idReformadosOficinaVizFrame");

                if (oVizFrameReformados) {

                    oVizFrameReformados.destroyFeeds();

                    if (oVizFrameReformados.getDataset()) {
                        oVizFrameReformados.destroyDataset();
                    }

                    const oDatasetReformados =
                        new sap.viz.ui5.data.FlattenedDataset({

                            dimensions: [

                                {
                                    name: "Descrição do local",
                                    value: "{dashboard>descLocalInstalacao}"
                                },

                                {
                                    name: "Tipo",
                                    value: "{dashboard>tipo}"
                                }

                            ],

                            measures: [

                                {
                                    name: "Quantidade",
                                    value: "{dashboard>quantidade}"
                                }

                            ],

                            data: {
                                path: "dashboard>/reformadosPorOficina"
                            }


                        });

                    oVizFrameReformados.setDataset(
                        oDatasetReformados
                    );

                    oVizFrameReformados.setModel(
                        this.getView().getModel("dashboard"),
                        "dashboard"
                    );

                    oVizFrameReformados.addFeed(
                        new sap.viz.ui5.controls.common.feeds.FeedItem({
                            uid: "valueAxis",
                            type: "Measure",
                            values: ["Quantidade"]
                        })
                    );

                    oVizFrameReformados.addFeed(
                        new sap.viz.ui5.controls.common.feeds.FeedItem({
                            uid: "categoryAxis",
                            type: "Dimension",
                            values: ["Descrição do local"]
                        })
                    );

                    oVizFrameReformados.addFeed(
                        new sap.viz.ui5.controls.common.feeds.FeedItem({
                            uid: "color",
                            type: "Dimension",
                            values: ["Tipo"]
                        })
                    );

                    oVizFrameReformados.setVizProperties({

                        plotArea: {
                            dataLabel: {
                                visible: true,
                                style: {
                                    fontSize: "16px",
                                    fontWeight: "bold"
                                }
                            }
                        },

                        title: {
                            visible: false
                        }

                    });
                }
                const oVizFrameInstalacao =
                    this.byId("idInstalacaoVizFrame");
                if (oVizFrameInstalacao) {

                    oVizFrameInstalacao.destroyFeeds();

                    if (oVizFrameInstalacao.getDataset()) {
                        oVizFrameInstalacao.destroyDataset();
                    }

                    const oDatasetInstalacao =
                        new sap.viz.ui5.data.FlattenedDataset({

                            dimensions: [
                                {
                                    name: "Status",
                                    value: "{dashboard>status}"
                                }
                            ],

                            measures: [
                                {
                                    name: "Quantidade",
                                    value: "{dashboard>quantidade}"
                                }
                            ],

                            data: {
                                path: "dashboard>/graficoInstalacao"
                            }

                        });

                    oVizFrameInstalacao.setDataset(
                        oDatasetInstalacao
                    );

                    oVizFrameInstalacao.setModel(
                        this.getView().getModel("dashboard"),
                        "dashboard"
                    );

                    oVizFrameInstalacao.addFeed(
                        new sap.viz.ui5.controls.common.feeds.FeedItem({
                            uid: "size",
                            type: "Measure",
                            values: ["Quantidade"]
                        })
                    );

                    oVizFrameInstalacao.addFeed(
                        new sap.viz.ui5.controls.common.feeds.FeedItem({
                            uid: "color",
                            type: "Dimension",
                            values: ["Status"]
                        })
                    );

                    oVizFrameInstalacao.setVizProperties({

                        title: {
                            visible: true,
                            text:
                                `Instalados: ${instalados}/50 (${percentualInstalado}%)`
                        },

                        legend: {
                            visible: true
                        },

                        plotArea: {
                            dataLabel: {
                                visible: true
                            }
                        }

                    });
                }

                this.byId("htmlMapa").setContent(`
        <div
            id="mapaEquipamentos"
            style="height:850px;width:100%;">
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

                    this._dadosMapa = dadosMapa;



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

                    const labels = L.tileLayer(
                        "https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
                    );

                    this._map = L.map("mapaEquipamentos", {
                        layers: [satelite]
                    });

                    this._map.setView(
                        [-19.604498, -43.211828],
                        9
                    );

                    this._layerLabels = L.layerGroup().addTo(this._map);

                    this.atualizarLabels();

                    this._map.on("zoomend", () => {

                        this.atualizarLabels();

                        const zoom = this._map.getZoom();

                        if (zoom >= 17) {

                            // this._layerDetalhes.addTo(this._map);

                        } else {

                            // this._map.removeLayer(this._layerDetalhes);

                        }

                    });



                    // this._layerCidades = L.layerGroup();

                    // L.marker([-19.6191, -43.2266], {
                    //     opacity: 0
                    // })
                    //     .bindTooltip("ITABIRA", {
                    //         permanent: true,
                    //         direction: "center",
                    //         className: "cityLabel"
                    //     })
                    //     .addTo(this._layerCidades);

                    // L.marker([-19.8123, -43.1735], {
                    //     opacity: 0
                    // })
                    //     .bindTooltip("JOÃO MONLEVADE", {
                    //         permanent: true,
                    //         direction: "center",
                    //         className: "cityLabel"
                    //     })
                    //     .addTo(this._layerCidades);

                    // const atualizarCamadas = () => {

                    //     const zoom = this._map.getZoom();

                    //     if (zoom >= 13) {

                    //         if (!this._map.hasLayer(this._layerCidades)) {
                    //             this._map.addLayer(this._layerCidades);
                    //         }

                    //     } else {

                    //         if (this._map.hasLayer(this._layerCidades)) {
                    //             this._map.removeLayer(this._layerCidades);
                    //         }

                    //     }
                    // };

                    // atualizarCamadas();

                    // this._map.on("zoomend", atualizarCamadas);

                    // this._layerCidades.addTo(this._map);
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
                                    font-weight:bold;
                                ">
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
                            "background:#9B6DFF;" +
                            "border:3px solid white;" +
                            "border-radius:50%;" +
                            "box-shadow:0 0 0 4px rgba(155,109,255,0.25),0 0 10px rgba(155,109,255,0.8);" +
                            "vertical-align:middle;" +
                            "margin-right:8px;'></span> Instalados";

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
                        const descricaoGateway =
                            mapaGatewayDescricao[item.gateway];
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

                        const descricaoEquipamento =
                            (item.descEquipamento || '').toLowerCase();

                        let imagemEquipamento = "img/793D_default.png";

                        if (descricaoEquipamento.includes("motor")) {
                            imagemEquipamento = "img/MOTOR.png";
                        } else if (descricaoEquipamento.includes("conversor")) {
                            imagemEquipamento = "img/CONVERSOR.png";
                        } else if (descricaoEquipamento.includes("comando")) {
                            imagemEquipamento = "img/COMANDO.png";
                        } else if (descricaoEquipamento.includes("diferencial")) {
                            imagemEquipamento = "img/MOTOR.png";
                        } else if (
                            descricaoEquipamento.includes("transmissao") ||
                            descricaoEquipamento.includes("transmissão")
                        ) {
                            imagemEquipamento = "img/TRANSMISSAO.png";
                        }

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
    background:#9B6DFF;
    border:3px solid white;
    border-radius:50%;
    box-shadow:
        0 0 0 4px rgba(155,109,255,0.25),
        0 0 10px rgba(155,109,255,0.8);
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

<div
    id="imagemVeiculoPopup_${item.identificador}"
        <div style="text-align:center">


    <img
        src= "${imagemEquipamento}"
     
style="max-width:220px;height:auto;"/>
</div>
                 
           <hr>
<div style="
    text-align:left;
    margin-bottom:10px;
">


        <div style="min-width:280px;">
            <b>${item.identificador}</b><br>
            <b>Equipamento:</b> ${item.descEquipamento || ''}<br>
            <b>Local:</b> ${item.localInstalacao || ''}<br>
            <b>Nota:</b> ${item.nota || 'Não informado'}<br>
            📡 Gateway:
    <b>
        ${descricaoGateway || item.gateway || "Não informado"}
    </b>
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

                        marker.on("click", (e) => {

                            if (this._modoMedicao) {

                                this.processarMedicao(
                                    lat,
                                    lng,
                                    item.identificador
                                );

                                e.target.closePopup();
                            }

                        });

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
                            // sap.m.MessageBox.information(

                            //     "Gateway: " +
                            //     item.gateway +

                            //     "\nDescrição: " +
                            //     (gatewayInfo?.identificador || "N/A") +

                            //     "\nDistância estimada: " +
                            //     textoDistancia

                            // );

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

                        // sap.m.MessageToast.show(
                        //     "Passou aqui 2"
                        // );

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

                            const descricaoGateway =
                                mapaGatewayDescricao[item.gateway];

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
                            const gatewayInfo =
                                this._gatewayInfo?.[item.gateway];
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

    <br>

    <span style="
        color:#3498db;
        font-size:12px;
    ">
        📡 Gateway:
        <b>
            ${descricaoGateway || item.gateway || "Não informado"}
        </b>
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
                            .join("\\n");

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
          background:#9B6DFF;
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

<div
    id="imagemVeiculoPopup_${veiculo.Veiculo}"
        <div style="text-align:center">


    <img
        src="img/793D_default.png"
     
        style="max-width:220px;height:auto;"/>
</div>
                 
           <hr>
<div style="
    text-align:left;
    margin-bottom:10px;
">

    <b>Veículo:</b>
    ${veiculo.Veiculo}
    <br>

    <b>Local de Instalação:</b>
    ${veiculo.LOCAL_INSTALACAO || "Não informado"}
    <br>

    <b>Equipamentos Embarcados:</b>
    ${totalEquipamentos}
    <hr>
</div>


        <details
    id="resumo_${veiculo.Veiculo}"
    data-veiculo="${veiculo.Veiculo}">

    <summary style="
        cursor:pointer;
        font-weight:bold;
    ">
        Ver Resumo
    </summary>
<hr>
    <div
        id="conteudoResumo_${veiculo.Veiculo}"
        style="margin-top:10px;">

        ${htmlResumo}

    </div>

</details>

<details
    id="detalhes_${veiculo.Veiculo}"
    data-veiculo="${veiculo.Veiculo}">

    <summary style="
        cursor:pointer;
        font-weight:bold;
    ">
        Ver detalhes
    </summary>

    <div
    id="conteudoDetalhes_${veiculo.Veiculo}"
    style="
        margin-top:10px;
        max-height:350px;
        overflow-y:auto;
    ">

        ${htmlDetalhes}

        <div style="
            text-align:center;
            margin-top:10px;
        ">
            <button
                id="btnExportar_${veiculo.Veiculo}">
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
</div>
            `, {
                            minWidth: 350,
                            maxWidth: 450
                        });
                        marker.on("click", (e) => {

                            if (this._modoMedicao) {

                                this.processarMedicao(
                                    lat,
                                    lng,
                                    veiculo.Veiculo
                                );

                                e.target.closePopup();
                            }

                        });
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
                    // var oVizFrame =
                    //     this.byId("idTipoStatusVizFrame");
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

                        marker.on("click", (e) => {

                            if (this._modoMedicao) {

                                this.processarMedicao(
                                    lat,
                                    lng,
                                    gw.identificador
                                );

                                e.target.closePopup();
                            }

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

                        this._map.once("moveend", () => {





                        });

                    }
                    if (this._primeiraCargaMapa) {

                        this._busyMapaInicial.close();

                        this._primeiraCargaMapa = false;

                    }

                    if (this._busyDialog) {
                        this._busyDialog.close();
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