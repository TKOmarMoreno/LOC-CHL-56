/**
 *@NApiVersion 2.1
 *@NScriptType Suitelet
 *@NAmdConfig /SuiteScripts/configuration.json
 *@NModuleScope Public
 */
define(
    [
        "N/search", "N/record", "N/format", "N/xml", "N/file", "N/https", "N/runtime", "N/encode", "N/http", "N/config", "N/email", "L56/utilidades"
    ],
    /* global define log */
    function (search, record, format, xml, file, https, runtime, encode, http, config, email, utilities) {
        var URL = "";
        var USER = "";
        var PASSWORD = "";
        var ACTECO = "";
        var CEDIBLE = "";
        var CARPETA_DOC = "";
        var CARPETA_XML = "";
        var giroEmisor = "";
        var nameTypeDoc = "";

        var estadoOperacionId = "";
        var descripcionOperacionId = "";
        var estadoOperacionId_ = "";
        var descripcionOperacionId_ = "";
        var codDoc = "";
        var TransaccionId = "";
        var rutEmisor = "";
        var folioID = "";
        var PDFBase64 = "";
        var PDF = "";
        var PDFFile = "";
        var internalId = "";
        var exitoGenerate = false;
        var exitoObtiene = false;
        var tranID = "";
        var subsidiary = "";
        var textoLibres = "";
        var typeRecord = "";

        /**
         * Definition of the Suitelet script trigger point.
         *
         * @param {Object} context
         * @param {ServerRequest} context.request - Encapsulation of the incoming request
         * @param {ServerResponse} context.response - Encapsulation of the Suitelet response
         */
        function onRequest(context) {
            const process = "onRequest";
            const script = runtime.getCurrentScript();
            try {

                if (context.request.method == "POST") {
                    log.debug(process, "Remaining Usage = " + script.getRemainingUsage() + " --- time: " + new Date());
                    const resultados = send(context);
                    context.response.writeLine(JSON.stringify(resultados));
                }
            }
            catch (error) {
                const message = "Ha ocurrido una excepción en el Suitelet de Generación de Folio, Detalles: " + error.message;
                log.error(process, message);
            }
        }

        function send(context) {
            const { request } = context;
            const { parameters } = request;

            const result = {
                success: true,
                message: "Success!",
                folio: "",
                pdf: ""
            };
            let xmlEnvio = "";
            internalId = parameters.idTransaccion;
            const impresionProveedor = JSON.parse(parameters.imprimeProvFE);
            const dirArchPDF = parameters.dirArchPDF;
            const empleadoParaEmail = parameters.empleadoParaEmail;
            const idAccount = runtime.accountId;
            const isOW = runtime.isFeatureInEffect("SUBSIDIARIES");
            let IdAccountProv;
            try {
                // Captura datos de la empresa
                var configRecObj = config.load({
                    type: config.Type.COMPANY_INFORMATION
                });

                getEnableFeatures();
                // rutEmisor = configRecObj.getValue('employerid');


                const obj_type = search.lookupFields({
                    type: "transaction",
                    id: internalId,
                    columns: ["type"]
                });
                const rec_type = obj_type.type[0].value;

                if (rec_type == "CustInvc") {
                    typeRecord = record.Type.INVOICE;
                } else if (rec_type == "ItemShip") {
                    typeRecord = record.Type.ITEM_FULFILLMENT;
                } else if (rec_type == "CustCred") {
                    typeRecord = record.Type.CREDIT_MEMO;
                }

                const rec = record.load({
                    type: typeRecord,
                    id: internalId
                });
                subsidiary = rec.getValue({ fieldId: "subsidiary" });
                tranID = rec.getValue("tranid");
                log.debug("send()", "Que tiene el internalId " + internalId + "Que tiene el impresionProveedor " + impresionProveedor + "Que tiene el dirArchPDF " + dirArchPDF + " - tranID: " + tranID + " - empleadoParaEmail: " + empleadoParaEmail);

                const filtros = [];
                if (isOW === true || isOW == "T") {
                    const filtro = {};
                    filtro.name = "custrecord_l56_conf_prov_fe_subsidiaria";
                    filtro.operator = "ANYOF";
                    filtro.values = subsidiary;
                    filtros.push(filtro);
                }

                const objResultSet = utilities.searchSavedPro("customsearch_l56_config_proveedor_fe", filtros);
                const resultSet = objResultSet.objRsponseFunction.result;
                const resultSearch = objResultSet.objRsponseFunction.search;

                if (objResultSet.error) {
                    const mensaje = "Error Consultando searchSavedPro beforeLoad - customsearch_l56_config_proveedor_fe - Detalles del Error: " + objResultSet.descripcion;
                    log.error("send()", "Error: " + mensaje);
                    //grabarError(codigoEstadoError, mensaje, refLog, refTransaccion, null);

                } else if ((!utilities.isEmpty(resultSet)) && (resultSet.length > 0)) {
                    IdAccountProv = resultSet[0].getValue({ name: resultSearch.columns[13] }, "");
                }
                //loguear 2 variab
                log.debug("send()", "IdAccountProv: " + IdAccountProv + "idAccount: " + idAccount);
                /*
                if (rec_type == 'CustInvc') {
                    var cliente = search.lookupFields({
                        type: search.Type.CUSTOMER,
                        id: rec.getValue("entity"),
                        columns: ['custentity_zim_acuerdo_firmado']
                    });
                    if (rec.getValue("terms") != "") {
                        var termRec = record.load({
                            "type": record.Type.TERM,
                            "id": rec.getValue("terms")
                        });
                        var cuotasTerm = termRec.getValue("daysuntilnetdue");
                    
                        if (cuotasTerm >= 30 && cliente.custentity_zim_acuerdo_firmado == false) {
                            result.success = false;
                            result.message = "No tiene contrato de pago oportuno";
                            return result;
                        }
                    }
                }
                */
                if (IdAccountProv == idAccount) {
                    const idXmlEnvio = rec.getValue({ fieldId: "custbody_l56_cl_doc_electro" }); //TODO invocaría el plugin eInvoiceContent.
                    xmlEnvio = file.load({
                        id: idXmlEnvio,
                    });
                    xmlEnvio = xmlEnvio.getContents();
                    xmlEnvio = xmlEnvio.replace(/<br\s*[\/]?>/gi, " ");
                    log.debug("send()", "xmlEnvio" + xmlEnvio);


                    /* Obtiene Tipo de Documento codDoc */
                    const existeCodDoc = xmlEnvio.search("TipoDTE>");
                    if (existeCodDoc != -1) {
                        codDoc = xmlEnvio.split("TipoDTE>")[1];
                        if (codDoc != null && codDoc != "") {
                            codDoc = codDoc.substring(0, codDoc.length - 2);
                        }
                    }
                    log.debug("xmlEnvio", "Post a TipoDTE");

                    const existeRutEmisor = xmlEnvio.search("RUTEmisor>");

                    if (existeRutEmisor != -1) {
                        rutEmisor = xmlEnvio.split("RUTEmisor>")[1];
                        log.debug("xmlContent", "xmlEnvio rutEmisor dentro del if: " + rutEmisor);
                        if (rutEmisor != null && rutEmisor != "") {
                            rutEmisor = rutEmisor.substring(0, rutEmisor.length - 2);
                            log.debug("xmlContent", "xmlEnvio rutEmisor dentro del otro if: " + rutEmisor);
                        }
                    }

                    nameTypeDoc = rec.getText("custbody_zim_cl_tipo_doc_cod");
                    //Si folio esta lleno enviar 0
                    //var pdfAntiguo = rec.getValue('custbody_zim_fe_cl_pdf'); //TODO deberíamos quitar este campo ya que no se utilizaría más.
                    const folioAntiguo = rec.getValue("custbody_zim_fe_cl_folio");

                    if (folioAntiguo != null && folioAntiguo != "") {
                        xmlEnvio = xmlEnvio.replace(/-FOLIO-/g, folioAntiguo);
                        // if (pdfAntiguo != null && pdfAntiguo != '') {

                        // } else {
                        //     folioID = folioAntiguo;
                        //     let returnObtieneDTE = WSObtieneDTE();
                        //     //rec.setValue('custbody_zim_fe_cl_pdf', PDFFile);
                        //     rec.save();
                        //     result.message = 'PDF GENERADO';
                        //     return result;
                        // }
                    } else {
                        xmlEnvio = xmlEnvio.replace(/-FOLIO-/g, "0");
                    }

                    log.debug("xmlEnvio", "Previo a FECHAEMISION");
                    const existeFechaEmision = xmlEnvio.search("-FECHAEMISION-");
                    if (existeFechaEmision != -1) {
                        let fechaEmision = xmlEnvio.split("-FECHAEMISION-")[1];
                        const fechaEmisionLast = "-FECHAEMISION-" + fechaEmision + "-FECHAEMISION-";
                        if (fechaEmision != null && fechaEmision != "") {
                            fechaEmision = FormatoDDMMYYY(fechaEmision);
                        }
                        xmlEnvio = xmlEnvio.replace(fechaEmisionLast, fechaEmision);
                    }
                    log.debug("xmlEnvio", "Post a FECHAEMISION");

                    // Corregir Fecha Vencimiento
                    log.debug("xmlEnvio", "Previo a FECHAVENCE");
                    const existeFechaVencimiento = xmlEnvio.search("-FECHAVENCE-");
                    log.debug("send()", "existeFechaVencimiento" + existeFechaVencimiento);
                    if (existeFechaVencimiento != -1) {
                        let fechaVence = xmlEnvio.split("-FECHAVENCE-")[1];
                        const fechaVenceLast = "-FECHAVENCE-" + fechaVence + "-FECHAVENCE-";
                        if (fechaVence != null && fechaVence != "") {
                            fechaVence = FormatoDDMMYYY(fechaVence);
                        }
                        xmlEnvio = xmlEnvio.replace(fechaVenceLast, fechaVence);
                    }
                    log.debug("xmlEnvio", "Post a FECHAVENCE");

                    log.debug("xmlEnvio", "Previo a TXTLIB");
                    //TextosLibres
                    const existeTextoLib = xmlEnvio.search("-TXTLIB-");
                    log.debug("send()", "existeFechaVencimiento" + existeFechaVencimiento);
                    if (existeTextoLib != -1) {
                        textoLibres = xmlEnvio.split("-TXTLIB-")[1];
                        const textoLibresLast = "-TXTLIB-" + textoLibres + "-TXTLIB-";
                        xmlEnvio = xmlEnvio.replace(textoLibresLast, "");
                    }
                    log.debug("xmlEnvio", "Post a TXTLIB");

                    log.debug("xmlEnvio", "previo a FECHAREF");
                    //Corregir Fecha Referencia
                    const existeFechaRef = xmlEnvio.search("-FECHAREF-");
                    log.debug("send()", "existeFechaRef" + existeFechaRef);
                    if (existeFechaRef != -1) {
                        let fechaRef = xmlEnvio.split("-FECHAREF-")[1];
                        const fechaRefLast = "-FECHAREF-" + fechaRef + "-FECHAREF-";
                        if (fechaRef != null && fechaRef != "") {
                            fechaRef = FormatoDDMMYYY(fechaRef);
                        }
                        xmlEnvio = xmlEnvio.replace(fechaRefLast, fechaRef);
                    }
                    log.debug("xmlEnvio", "Post a FECHAREF");

                    //TipoDocRef
                    log.debug("xmlEnvio", "previo a IDREF");
                    const existeIdRef = xmlEnvio.search("-IDREF-");
                    log.debug("send()", "existeIdRef" + existeIdRef);
                    if (existeIdRef != -1) {
                        let tipoDocFin;
                        const tipoDocRef = xmlEnvio.split("-IDREF-")[1];
                        const tipoDocRefLast = "-IDREF-" + tipoDocRef + "-IDREF-";
                        if (tipoDocRef != null && tipoDocRef != "") {
                            const recTipoDoc = search.create({
                                type: "customrecord_zim_cl_tipo_documento",
                                columns: ["custrecord_zim_cl_tipo_doc_cod"],
                                filters: ["name", "is", tipoDocRef]
                            });
                            const resultrecTipoDoc = recTipoDoc.run().getRange(0, 5);
                            if (resultrecTipoDoc != null && resultrecTipoDoc.length != 0) {
                                const row = resultrecTipoDoc[0].columns;
                                tipoDocFin = resultrecTipoDoc[0].getValue(row[0]);
                            }
                        }
                        xmlEnvio = xmlEnvio.replace(tipoDocRefLast, tipoDocFin);
                    }
                    log.debug("xmlEnvio", "post a IDREF");

                    //Reemplazar los datos de Emisor
                    const existeActeco = xmlEnvio.search("<Acteco>");
                    const actecoo = ACTECO.split(",");
                    let acteco_ = "";
                    for (let ac = 0; ac < actecoo.length; ac++) {
                        acteco_ += "<Acteco>" + actecoo[ac] + "</Acteco>";
                    }

                    xmlEnvio = xmlEnvio.replace("-ACTECO-", acteco_);
                    xmlEnvio = replaceXML(xmlEnvio);

                    sleep(5000);

                    const returnGeneraDTE = WSGeneraDTE(xmlEnvio, impresionProveedor);
                    log.debug("send()", "Que tiene returnGeneraDTE " + returnGeneraDTE);

                    /**
                     * En el caso de que la transacción ya tenga un número de folio asignado por FACELE y se retorne un mensaje de error,
                     * se obtiene el número de folio desde el mensaje y se asigna al campo correspondiente.
                     */
                    if (returnGeneraDTE.indexOf("Folio:") !== -1 && !exitoGenerate) {
                        log.debug("xmlContent", "Inicio lectura de folio desde reintento");
                        const mensajeDividido = returnGeneraDTE.split(" ");
                        const posicionNumeroFolio = mensajeDividido.indexOf("Folio:") + 1;
                        const numeroFolio = mensajeDividido[posicionNumeroFolio];
                        const numeroFolioFormateado = format.parse({
                            value: numeroFolio,
                            type: format.Type.INTEGER
                        });

                        log.debug("xmlContent", "numeroFolio: " + numeroFolio + " - numeroFolioFormateado: " + numeroFolioFormateado);

                        if (!isEmpty(numeroFolioFormateado) && !isNaN(numeroFolioFormateado)) {
                            exitoGenerate = true;
                            folioID = numeroFolioFormateado;
                            log.debug("xmlContent", "folioID: " + folioID);
                        }

                        log.debug("xmlContent", "Fin lectura de folio desde reintento");
                    }

                    sleep(5000);

                    if (exitoGenerate) {
                        const returnObtieneDTE = WSObtieneDTE(impresionProveedor, dirArchPDF, "F");
                        result.folio = folioID;
                        log.debug("generacionFechaFolioDTE", "returnObtieneDTE: " + returnObtieneDTE);

                        // Crear el campo 'impresionFacele', devolverlo en la savesearch y pasarlo aca para validar
                        if (impresionProveedor == true || impresionProveedor == "T") {
                            result.pdf = PDFFile;
                        } else {
                            rec.setValue("custbody_3k_timbre_electronico", returnObtieneDTE);
                            rec.save();
                        }

                        var xmlAprobado = WSObtieneDTE(null, null, "T");
                        log.debug("send - xmlAprobado: ", xmlAprobado);

                        sendMailYGuardarXMLAprobado(xmlEnvio, returnGeneraDTE, xmlAprobado, PDF, empleadoParaEmail, true, null);
                    } else {
                        result.success = false;
                        result.message = descripcionOperacionId;
                    }
                    log.debug("send()", "Estado: " + result.success + "Message: " + result.message);
                } else {
                    result.success = false;
                    result.message = "Ocurrió un error al enviar la transacción hacia FACELE, detalles: \t El Id de la cuenta actual y el que se tiene configurado en el record \"CL - Configuración Proveedor FE\" son diferentes. \t El ID de la cuenta es: " + idAccount + "\t El ID ingresado en el Proveedor es: " + IdAccountProv + "\t Adicionalmente, por favor, verifique si la cuenta es un ambiente de sandbox y posee las credenciales de FE de producción configuradas.";
                    log.error("send()", "Estado: " + result.success + " - Error: " + result.message);
                }
            } catch (e) {
                result.success = false;
                result.message = "Ocurrió un error inesperado al enviar la transacción hacia FACELE, detalles: " + e.message;
                log.error("send()", "Estado: " + result.success + " - Error: " + result.message);
            }

            if (!result.success) {
                sendMailYGuardarXMLAprobado(null, null, null, null, empleadoParaEmail, result.success, result.message);
            }

            log.debug("send()", "result: " + result);
            log.debug("send()", "result string: " + JSON.stringify(result));

            return result;
        }

        function WSGeneraDTE(xml, impresionProveedor) {

            log.debug("WSGeneraDTE", "Inicio de función WSGeneraDTE / imprimeProveedor: " + impresionProveedor);
            const formatoDoc = (impresionProveedor == "T" || impresionProveedor == true) ? "PDF" : "XML";

            var StringXML =
                "<soapenv:Envelope xmlns:soapenv=\"http://schemas.xmlsoap.org/soap/envelope/\" xmlns:doc=\"http://www.facele.cl/DoceleOL/\">" +
                "<soapenv:Header/>" +
                "<soapenv:Body>" +
                "<doc:generaDTE>" +
                "<rutEmisor>" + rutEmisor + "</rutEmisor>" + textoLibres +
                "<tipoDTE>" + codDoc + "</tipoDTE>" +
                "<formato>XML</formato>" +
                "<xml><![CDATA[" + xml + "]]></xml>" +
                "<!--Optional:-->" +
                "<uuid>" + internalId + "</uuid>" +
                "</doc:generaDTE>" +
                "</soapenv:Body>" +
                "</soapenv:Envelope>";

            var soapHeaders = new Array();
            soapHeaders["facele.user"] = USER;
            soapHeaders["facele.pass"] = PASSWORD;
            var objGeneraDTE = "";
            if (URL.indexOf("https") != -1) {
                require(["N/https"], function (https) {
                    objGeneraDTE =
                        https.post({
                            url: URL,
                            body: StringXML,
                            headers: soapHeaders
                        });
                });
            } else {
                require(["N/http"], function (http) {
                    objGeneraDTE =
                        http.post({
                            url: URL,
                            body: StringXML,
                            headers: soapHeaders
                        });
                });
            }

            // log.debug('generaDTE', 'datos genera DTE / StringXML: ' + JSON.stringify(StringXML));
            log.debug("generaDTE", "datos genera DTE / StringXML sin parsear: " + StringXML);
            log.debug("generaDTE", "datos genera DTE / soapHeaders USER: " + USER + " / soapHeaders PASSWORD: " + PASSWORD + " / URL: " + URL);

            var returnGeneraDTE = objGeneraDTE.body;
            returnGeneraDTE = replaceXML(returnGeneraDTE);

            var estadoOperacion = returnGeneraDTE.split("estadoOperacion>");
            estadoOperacion = !isEmpty(estadoOperacion) && estadoOperacion.length > 0 ? estadoOperacion[1] : null;

            if (!isEmpty(estadoOperacion)) {
                estadoOperacionId = estadoOperacion.substring(0, estadoOperacion.length - 2);
                log.debug("WSGeneraDTE", "estadoOperacionId: " + estadoOperacionId);// 0
                descripcionOperacionId = returnGeneraDTE.split("descripcionOperacion>");
                log.debug("WSGeneraDTE", "descripcionOperacionId split: " + descripcionOperacionId);
                log.debug("WSGeneraDTE", "descripcionOperacionId split 0: " + descripcionOperacionId[0]);
                log.debug("WSGeneraDTE", "descripcionOperacionId split 1: " + descripcionOperacionId[1]);
                descripcionOperacionId = !isEmpty(descripcionOperacionId) && descripcionOperacionId.length > 0 ? descripcionOperacionId[1] : null;
                log.debug("WSGeneraDTE", "descripcionOperacionId: " + descripcionOperacionId);

                if (!isEmpty(descripcionOperacionId)) {
                    descripcionOperacionId = descripcionOperacionId.substring(0, descripcionOperacionId.length - 2);
                    log.debug("WSGeneraDTE", "line 412 - descripcionOperacionId: " + descripcionOperacionId);

                    if (estadoOperacionId == "1") {
                        exitoGenerate = true;
                        folioID = returnGeneraDTE.split("folioDTE>");
                        folioID = !isEmpty(folioID) && folioID.length > 0 ? folioID[1] : null;
                        log.debug("WSGeneraDTE", "line 322 - folioID: " + JSON.stringify(folioID));

                        if (!isEmpty(folioID)) {
                            folioID = folioID.substring(0, folioID.length - 2);
                        } else {
                            exitoGenerate = false;
                        }
                    } else {
                        exitoGenerate = false;
                    }
                } else {
                    if (estadoOperacionId == "1") {
                        exitoGenerate = false;
                        descripcionOperacionId = "El estado de la operación es 0 en la respuesta del XML de FACELE, para que se genere correctamente el DTE debe ser 1, revise el XML recibido en los logs del script CL - Conexion Directa FE (SL).";
                    } else {
                        exitoGenerate = false;
                        descripcionOperacionId = "No existe información de descripción de operación en la respuesta del XML de FACELE, revise el XML recibido en los logs del script CL - Conexion Directa FE (SL).";
                    }
                }
            } else {
                exitoGenerate = false;
                descripcionOperacionId = "No existe información de estado de operación, revise el XML recibido en los logs del script CL - Conexion Directa FE (SL).";
            }

            return returnGeneraDTE;
        }

        function isEmpty(value) {

            if (value === "") {
                return true;
            }

            if (value === null || value === "null") {
                return true;
            }

            if (value === undefined || value === "undefined") {
                return true;
            }

            return false;
        }

        /**
         * se debe formatear para que se pueda usar la vista previa de netsuite
         */
        function formatearParaPrevisualizacion(xmlPrev) {
            xmlPrev = xmlPrev.replace(/&quot;/g, "'");

            // remover primer <?xml
            let startIndex = xmlPrev.indexOf("<?xml");
            if (startIndex == -1) {
                return xmlPrev;
            }
            const endIndex = xmlPrev.indexOf("<XML>", startIndex);
            if (endIndex == -1) {
                return xmlPrev;
            }
            xmlPrev = xmlPrev.slice(0, startIndex) + xmlPrev.slice(endIndex + "<XML>".length);
            // remover parte final
            
            startIndex = xmlPrev.indexOf("</XML>");
            if (startIndex == -1) {
                return xmlPrev;
            }
            xmlPrev = xmlPrev.slice(0,startIndex);

            return xmlPrev;
        }

        // pASAR AL CLIENTE
        function sendMailYGuardarXMLAprobado(content, WSGenerarDTE, xmlAprobado, PDF, empleadoParaEmail, result, message) {

            log.debug("sendMail", "Inicio sendmail");

            try {

                if (result == true) {
                    let body = "";
                    body += "<p>Estimado(a) :</p>";
                    body += "<p>Se ha generado el número de folio: " + folioID + " para la transacción de " + nameTypeDoc + " " + tranID + " con Internal ID " + internalId + ".</p>";
                    body += "<p>Atentamente,</p>";
                    body += "<br>";
                    body += "<p><strong>***NO RESPONDA A ESTE MENSAJE***</strong></p>";
                    var fileXML = new Array();


                    var i = 0;
                    var FileName = "Archivo Facturacion Electronica CL.ftl";

                    if (content != null && content != "") {
                        fileXML[0] = file.create({
                            name: FileName,
                            fileType: file.Type.XMLDOC,
                            contents: content
                        });

                        i++;
                    }
                    if (WSGenerarDTE != null && WSGenerarDTE != "") {
                        fileXML[i] = file.create({
                            name: "Response WSGenerarDTE.xml",
                            fileType: file.Type.XMLDOC,
                            contents: WSGenerarDTE
                        });

                        i++;
                    }

                    if (xmlAprobado != null && xmlAprobado != "") {
                        xmlAprobado = formatearParaPrevisualizacion(xmlAprobado);
                        fileXML[i] = file.create({
                            name: "XML_Aprobado_" + internalId + "_" + folioID + "_" + new Date() + ".xml",
                            fileType: file.Type.XMLDOC,
                            contents: xmlAprobado,
                            folder: CARPETA_XML
                        });

                        //graba archivo en la carpeta
                        var idXMLFile = fileXML[i].save();

                        //graba campo en la transaction
                        setXMLFile(idXMLFile);

                        i++;
                    }
                    // if (PDF != null && PDF != '') {
                    //     fileXML[i] = file.create({
                    //         name: "Response PDF.pdf",
                    //         fileType: file.Type.PDF,
                    //         contents: PDF
                    //     });
                    //     i++;
                    // }
                    if (isEmpty(empleadoParaEmail)) {
                        log.audit("no hay empleado seleccionado no se envia el email");
                        return;
                    }
                    const subject = "Resultados Generación FOLIO - Tekiio - " + nameTypeDoc + " " + tranID;
                    email.send({
                        author: empleadoParaEmail,
                        recipients: empleadoParaEmail,
                        subject: subject,
                        body: body,
                        attachments: fileXML
                    });
                } else {
                    if (isEmpty(empleadoParaEmail)) {
                        log.audit("no hay empleado seleccionado no se envia el email");
                        return;
                    }
                    let body = "";
                    body += "<p>Estimado(a) :</p>";
                    body += "<p>Se ha generado un error al intentar generar el folio para la transacción de " + nameTypeDoc + " " + tranID + " con Internal ID " + internalId + ".</p>";
                    body += "<p>Detalles del error ocurrido: " + message + ".</p>";
                    body += "<p>Atentamente,</p>";
                    body += "<br>";
                    body += "<p><strong>***NO RESPONDA A ESTE MENSAJE***</strong></p>";

                    const subject = "Resultados Generación FOLIO - Tekiio - " + nameTypeDoc + " " + tranID;

                    email.send({
                        author: empleadoParaEmail,
                        recipients: empleadoParaEmail,
                        subject: subject,
                        body: body
                    });
                }

            } catch (e) {
                log.error("sendMail", "Excepcion inesperada, detalles: " + e.message);
            }

        }

        function WSObtieneDTE(impresionProveedor, dirArchPDF, obtieneXMLAprobado) {

            log.debug("wsObtieneDTE", "impresionProveedor: ${impresionProveedor} / diArchPDF: ${dirArchPDF} / rutEmisor: ${rutEmisor} / codDoc: ${codDoc} / folioID: ${folioID} / CEDIBLE: ${CEDIBLE}");
            const formatoDoc = (impresionProveedor == "T" || impresionProveedor == true) ? "PDF" : "XML";
            log.debug("wsObtieneDTE", "formatoDoc: " + formatoDoc + " obtieneXMLAprobado: " + obtieneXMLAprobado);

            var StringXML =
                "<soapenv:Envelope xmlns:soapenv=\"http://schemas.xmlsoap.org/soap/envelope/\" xmlns:doc=\"http://www.facele.cl/DoceleOL/\">" +
                "<soapenv:Header/>" +
                "<soapenv:Body>" +
                "<doc:obtieneDTE>" +
                "<rutEmisor>" + rutEmisor + "</rutEmisor>" +
                "<tipoDTE>" + codDoc + "</tipoDTE>" +
                "<folioDTE>" + folioID + "</folioDTE>" +
                "<formato>" + formatoDoc + "</formato>" +
                "<!--Optional:-->";
            if (CEDIBLE) {
                StringXML += "<cedible>true</cedible>" +
                    "<!--Optional:-->" +
                    "<cantidad>2</cantidad>";
            } else {
                StringXML += "<cedible>?</cedible>" +
                    "<!--Optional:-->" +
                    "<cantidad>?</cantidad>";
            }
            StringXML += "</doc:obtieneDTE>" +
                "</soapenv:Body>" +
                "</soapenv:Envelope>";
            var soapHeaders = new Array();
            soapHeaders["facele.user"] = USER;
            soapHeaders["facele.pass"] = PASSWORD;
            //soapHeaders['facele.user'] = 'd5885a2db';
            //soapHeaders['facele.pass'] = 'JcbZmmyZW6AAJsL3CdhD/w==';
            var objObtieneDTE = "";
            if (URL.indexOf("https") != -1) {
                require(["N/https"], function (https) {
                    objObtieneDTE =
                        https.post({
                            url: URL,
                            body: StringXML,
                            headers: soapHeaders
                        });
                });
            } else {
                require(["N/http"], function (http) {
                    objObtieneDTE =
                        http.post({
                            url: URL,
                            body: StringXML,
                            headers: soapHeaders
                        });
                });
            }

            var returnObtieneDTE = objObtieneDTE.body;

            returnObtieneDTE = replaceXML(returnObtieneDTE);
            log.debug("xmlContent", "line 393 - returnObtieneDTE replace XML: " + JSON.stringify(returnObtieneDTE));

            var xmlAprobadoAUX = returnObtieneDTE;
            log.debug("xmlContent - xmlAprobadoAUX", xmlAprobadoAUX);

            if (obtieneXMLAprobado == "T") {

                return xmlAprobadoAUX;
            }

            //var respuestaWS = 'respuesta WS-> objObtieneDTE: ' + objObtieneDTE;

            if (impresionProveedor == true || impresionProveedor == "T") {
                log.debug("xmlContent", "Inicio obtencion del PDF de FACELE");

                var estadoOperacion = returnObtieneDTE.split("estadoOperacion>")[1];
                log.debug("xmlContent", "estadoOperacion: " + estadoOperacion);

                if (estadoOperacion != null && estadoOperacion != "") {
                    estadoOperacionId_ = estadoOperacion.substring(0, estadoOperacion.length - 2);
                    descripcionOperacionId_ = returnObtieneDTE.split("descripcionOperacion>")[1];
                    log.debug("xmlContent", "descripcionOperacionId_: " + descripcionOperacionId_);
                    if (descripcionOperacionId_ != null && descripcionOperacionId_ != "") {
                        descripcionOperacionId_ = descripcionOperacionId_.substring(0, descripcionOperacionId_.length - 2);
                        if (estadoOperacionId_ == "1") {
                            PDFBase64 = returnObtieneDTE.split("PDF>")[1];
                            if (PDFBase64 != null && PDFBase64 != "") {
                                PDFBase64 = PDFBase64.substring(0, PDFBase64.length - 2);
                                var namePDF = "DTE-" + codDoc + "-" + folioID + "-" + rutEmisor + ".pdf";
                                PDF = encode.convert({
                                    string: PDFBase64,
                                    inputEncoding: encode.Encoding.BASE_64,
                                    outputEncoding: encode.Encoding.UTF_8
                                });

                                var PDFFiles = file.create({
                                    name: namePDF,
                                    fileType: file.Type.PDF,
                                    contents: PDF,
                                    folder: dirArchPDF
                                });

                                PDFFile = PDFFiles.save();
                            }

                            log.debug("xmlContent", "Fin obtencion del PDF de FACELE - PDFFile: " + PDFFile);

                        }

                    }
                }

            } else {

                var estadoOperacion = returnObtieneDTE.split("estadoOperacion>");
                estadoOperacion = (!isEmpty(estadoOperacion) && estadoOperacion.length > 0) ? estadoOperacion[1] : null;
                log.debug("xmlContent", "line 397 - estadoOperacion: " + JSON.stringify(estadoOperacion));

                if (!isEmpty(estadoOperacion)) {

                    estadoOperacionId_ = estadoOperacion.substring(0, estadoOperacion.length - 2);
                    descripcionOperacionId_ = returnObtieneDTE.split("descripcionOperacion>");
                    descripcionOperacionId_ = (!isEmpty(descripcionOperacionId_) && descripcionOperacionId_.length > 0) ? descripcionOperacionId_[1] : null;
                    log.debug("xmlContent", "line 402 - descripcionOperacionId_: " + JSON.stringify(descripcionOperacionId_));

                    if (!isEmpty(descripcionOperacionId_)) {
                        descripcionOperacionId_ = descripcionOperacionId_.substring(0, descripcionOperacionId_.length - 2);
                        log.debug("xmlContent", "line 606 - descripcion: que trae estadoOperacionId_ " + JSON.stringify(estadoOperacionId_));
                        if (estadoOperacionId_ == "1") {
                            log.debug("xmlContent", "line 608 - descripcion: entro al if estadoOperacionId_ " + JSON.stringify(estadoOperacionId_));
                            log.debug("xmlContent", "line 608 - descripcion: que trae impresionProveedor " + JSON.stringify(impresionProveedor));

                            //log.error('xmlContent', 'LINE 446 - No existe informacion del estado de la operacion');
                            //Devuelvo únicamente lo que se encuentra entre tags <TED> que corresponde a la firma electrónica de SII.
                            var xmlSplit1 = returnObtieneDTE.split("<TED");
                            xmlSplit1 = "<TED" + xmlSplit1[1];
                            // log.debug('xmlContent', 'line 410 - xmlSplit1: ' + JSON.stringify(xmlSplit1));
                            log.debug("xmlContent", "line 411 - xmlSplit1: " + xmlSplit1);

                            var firmaElectronicaCortadaDelXML = xmlSplit1.split("</TED>");
                            firmaElectronicaCortadaDelXML = firmaElectronicaCortadaDelXML[0] + "</TED>";
                            // log.debug('xmlContent', 'line 415 - firmaElectronicaCortadaDelXML: ' + JSON.stringify(firmaElectronicaCortadaDelXML));
                            log.debug("xmlContent", "line 416 - firmaElectronicaCortadaDelXML: " + firmaElectronicaCortadaDelXML);

                            var xmlConTagsRemplazados = prepararFirma(firmaElectronicaCortadaDelXML);

                            return xmlConTagsRemplazados;
                        }
                    } else {
                        log.error("generacionDTE", "LINE 443 - No existe informacion de descripcion de operacion");
                    }
                } else {
                    log.error("generacionDTE", "LINE 446 - No existe informacion del estado de la operacion");
                }
            }

            return "";

        }

        /**
        * Graba custbody_l56_cl_doc_xml
        * con idXMLFile
        */
        function setXMLFile(idXMLFile) {

            log.debug("setXMLFile()", "InternalId Transaccion " + internalId + " Graba custbody_l56_cl_doc_xml " + idXMLFile);

            var recTran = record.load({
                type: typeRecord,
                id: internalId
            });

            recTran.setValue("custbody_l56_cl_doc_xml", idXMLFile);
            recTran.save();

            log.debug("setXMLFile()", "Concluido");

        }

        /**
        * La firma no puede tener tags xml.
        * Por ejemplo: remplaza < > por &lt; y &gt;
        */
        function prepararFirma(xml) {

            var parsedxml = xml.replace(/&/g, "&amp;");
            parsedxml = parsedxml.replace(/</g, "&lt;");
            parsedxml = parsedxml.replace(/>/g, "&gt;");
            parsedxml = parsedxml.replace(/"/g, "&quot;");
            parsedxml = parsedxml.replace(/'/g, "&apos;");
            parsedxml = parsedxml.replace(/\s/g, "");

            return parsedxml;
        }

        function replaceXML(xml) {
            xml = xml.replace(/&lt;/g, "<");
            xml = xml.replace(/&gt;/g, ">");
            xml = xml.replace(/&amp;lt;/g, "<");
            xml = xml.replace(/&amp;gt;/g, ">");
            return xml;
        }

        function FormatoDDMMYYY(fecha) {
            //var f = nlapiStringToDate(fecha);
            try {
                var f = format.parse({
                    value: fecha,
                    type: format.Type.DATE
                });
                var d = f.getDate();
                var m = f.getMonth() + 1;
                var y = f.getFullYear();
                m = m + "";
                if (m.length == 1) {
                    m = "0" + m;
                }
                d = d + "";
                if (d.length == 1) {
                    d = "0" + d;
                }

                var fechaOrden = y + "-" + m + "-" + d;
                //fechaOrden = retornaValorFecha(fechaOrden);
                return fechaOrden;
            }
            catch (error) {
                log.error("FormatoDDMMYYY()", "Error: " + error.message);
            }
        }

        function getEnableFeatures() {

            // Registro Personalizado Para FE 

            const busqEnabFet = search.create({
                type: "customrecord_zim_fe_configuracion",
                columns: ["custrecord_zim_user", "custrecord_zim_password",
                    "custrecord_zim_conexion", "custrecord_zim_actividad_economica",
                    "custrecord_zim_cedible", "custrecord_zim_carpetas_documentos",
                    "custrecord_zim_carpeta_xml"
                ]
            });
            const resultEnabFet = busqEnabFet.run().getRange(0, 10);

            if (resultEnabFet != null && resultEnabFet.length != 0) {
                const row = resultEnabFet[0].columns;
                USER = resultEnabFet[0].getValue(row[0]);
                PASSWORD = resultEnabFet[0].getValue(row[1]);
                URL = "" + resultEnabFet[0].getValue(row[2]);
                ACTECO = resultEnabFet[0].getValue(row[3]);
                CEDIBLE = resultEnabFet[0].getValue(row[4]);
                CARPETA_DOC = resultEnabFet[0].getValue(row[5]);
                CARPETA_XML = resultEnabFet[0].getValue(row[6]);
            }
        }

        function sleep(milliseconds) {
            var start = new Date().getTime();
            for (var i = 0; i < 1e7; i++) {
                if ((new Date().getTime() - start) > milliseconds) {
                    break;
                }
            }
        }

        return {
            onRequest: onRequest
        };
    });