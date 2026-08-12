/**
 *@NApiVersion 2.1
 *@NScriptType UserEventScript
 *@NAmdConfig /SuiteScripts/configuration.json
 *@NModuleScope Public
 */
define(
    [
        'N/record', 'N/error', 'N/search', 'L56/utilidades', 'N/runtime', 'N/format', 'N/config', 'N/file', 'N/render', 'N/url', 'N/https', 'N/transaction', 'N/translation'
    ],
    function (record, error, search, utilities, runtime, format, config, file, render, url, https, transaction, translation) {

        /**
         * Function definition to be triggered before record is loaded.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {string} scriptContext.type - Trigger type
         * @param {Form} scriptContext.form - Current form
         */
        function beforeLoad(scriptContext) {
            const process = 'beforeLoad';
            let recId = scriptContext.newRecord.id;
            let recType = scriptContext.newRecord.type;
            let recordTransaction = scriptContext.newRecord;
            let formTransaction = scriptContext.form;
            let currentScript = runtime.getCurrentScript();
            let mensaje = '';
            let codigoEstadoError = currentScript.getParameter('custscript_l56_conx_dirc_fe_cod_est_err'); // Código Estado Log FE - Error (FESTADO-2)
            let codigoEstadoSinError = currentScript.getParameter('custscript_l56_conx_dirc_fe_cod_est_srr'); // Código Estado Log FE - Sin error (FESTADO-1)
            let refTransaccion = recId;
            let refLog = '';
            let infoAuxiliarFolio = '';
            let dirArchPDF;
            let empleadoParaEmail;
            let imprimeProvFE;
            let isOW = runtime.isFeatureInEffect("SUBSIDIARIES");


            try {
                if (scriptContext.type == scriptContext.UserEventType.VIEW && !utilities.isEmpty(recType) && !utilities.isEmpty(recId)) {
                    log.debug(process, 'INICIO - beforeLoad - Creación Botón Generar Folio - unidades disponibles: ' + currentScript.getRemainingUsage() + ' - time: ' + new Date() + ' - recId: ' + recId + ' - recType: ' + recType);

                    let folio = recordTransaction.getValue({ fieldId: 'custbody_zim_fe_cl_folio' });
                    let subsidiary = recordTransaction.getValue({ fieldId: 'subsidiary' });
                    let estadoAprobacion = recordTransaction.getValue({ fieldId: 'approvalstatus' });
                    
                    if ((utilities.isEmpty(estadoAprobacion)) || (!utilities.isEmpty(estadoAprobacion) && (estadoAprobacion != 1 && estadoAprobacion != 3))) {

                        // Busca los datos para pasarle al client
                        let filtros = [];
                        if (isOW === true || isOW == 'T') {
                            let filtro = {};
                            filtro.name = 'custrecord_l56_conf_prov_fe_subsidiaria';
                            filtro.operator = 'ANYOF';
                            filtro.values = subsidiary;
                            filtros.push(filtro);
                        }

                        let objResultSet = utilities.searchSavedPro('customsearch_l56_config_proveedor_fe', filtros);
                        let resultSet = objResultSet.objRsponseFunction.result;
                        let resultSearch = objResultSet.objRsponseFunction.search;

                        if (objResultSet.error) {
                            mensaje = 'Error Consultando searchSavedPro beforeLoad - customsearch_l56_config_proveedor_fe - Detalles del Error: ' + objResultSet.descripcion;
                            log.error(process, 'Error: ' + mensaje);
                            grabarError(codigoEstadoError, mensaje, refLog, refTransaccion, null);

                        } else if ((!utilities.isEmpty(resultSet)) && (resultSet.length > 0)) {
                            dirArchPDF = resultSet[0].getValue({ name: resultSearch.columns[12] }, '');
                            empleadoParaEmail = resultSet[0].getValue({ name: resultSearch.columns[10] }, '');
                            imprimeProvFE = resultSet[0].getValue({ name: resultSearch.columns[11] }, '');
                        }
                        //loguear 2 variab
                        log.debug(process, 'dirArchPDF: ' + dirArchPDF + 'imprimeProvFE: ' + imprimeProvFE);

                        // Validar los formularios, si no tiene folio ya generado
                        if (utilities.isEmpty(folio)) {
                            let docXML = recordTransaction.getValue({ fieldId: 'custbody_l56_cl_doc_electro' });
                            let docType = recordTransaction.getValue({ fieldId: 'custbody_zim_cl_tipo_doc_cod' });

                            if (!utilities.isEmpty(docType)) {
                                if (!utilities.isEmpty(docXML)) {
                                    try {
                                        log.debug(process, "Se genera boton correctamente.");
                                        formTransaction.clientScriptModulePath = './CL - Conexion Directa FE (CL) mejora.js';
                                        let nombreBoton = translation.get({
                                            collection: 'custcollection_l56_fe_translate',
                                            key: 'USEREVENT_B_01'
                                        })();
                                        formTransaction.addButton({
                                            id: 'custpage_l56_boton_generar_folio_conexion_directa',
                                            label: nombreBoton,
                                            functionName: "generarFolio(" + codigoEstadoError + "," + codigoEstadoSinError + "," + imprimeProvFE + "," + dirArchPDF + "," + empleadoParaEmail + ")"
                                        });
                                    } catch (error) {
                                        mensaje = 'Excepción Agregando Botón a transacción - Generar Folio - NetSuite error: ' + error.message;
                                        log.error(process, 'Error: ' + mensaje);
                                        grabarError(codigoEstadoError, mensaje, refLog, refTransaccion, null);
                                    }
                                } else {
                                    mensaje = "La transacción no posee asociado el XML con los datos para generar Folio, proceda a editar la transacción y a guardarla nuevamente para posteriormente generar el folio";
                                    log.error(process, 'Error: ' + mensaje);
                                    grabarError(codigoEstadoError, mensaje, refLog, refTransaccion, null);
                                }
                            } else {
                                mensaje = "La transacción no posee tipo comprobante (tipo comprobante para la facturación electrónica)";
                                log.error(process, 'Error: ' + mensaje);
                                grabarError(codigoEstadoError, mensaje, refLog, refTransaccion, null);
                            }
                        } else {
                            mensaje = 'La transacción ya posee Folio.';
                            log.debug(process, 'Error: ' + mensaje);
                        }
                    } else {
                        mensaje = 'La transacción se enucuentra pendiente de aprobacion o  rechazado.';
                        log.debug(process, 'Error: ' + mensaje);
                    }
                }
            } catch (error) {
                mensaje = 'Excepcion General Agregando Boton - Generar Folio - NetSuite error: ' + error.message;
                log.error(process, 'Error: ' + mensaje);
                grabarError(codigoEstadoError, mensaje, refLog, refTransaccion, null);
            }
            return true;
        }

        /**
         * Function definition to be triggered before record is submit.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {string} scriptContext.type - Trigger type
         * @param {Form} scriptContext.form - Current form
         */
        function beforeSubmit(scriptContext) {
            const process = 'beforeSubmit';
            log.debug(process, "Inicio beforeSubmit");
            var infoTransaction = scriptContext.newRecord;
            var recType = scriptContext.newRecord.type;
            log.debug(process, scriptContext.type);
            if (scriptContext.type == 'create' || scriptContext.type == 'copy' || scriptContext.type == 'edit') {
                log.debug(process, recType);
                if(recType.toLowerCase() == 'itemfulfillment'){
                    var currency = infoTransaction.getValue({
                        fieldId: 'kcurrency'
                    });
                    log.debug(process,"currency:"+currency);
                    var monedaExt = search.create({
                        type: 'customrecord_zim_monedas_exp',
                        filters: [
                            ['custrecord_zim_moneda_ns', 'is', currency]
                        ]
                    });
        
                    var resultMonedaExt = monedaExt.run().getRange(0, 50);
                    log.debug(process, "resultado: "+JSON.stringify(resultMonedaExt));
                    if (resultMonedaExt != null && resultMonedaExt.length != 0) {
                        //var internalID = resultMonedaExt[0].getValue(row[1]);
                        log.debug(process,"InternalId: "+resultMonedaExt[0].id);
                        infoTransaction.setValue({
                            fieldId: 'custbody_zim_moneda_exportacion',
                            value: resultMonedaExt[0].id
                        });
                    }
                    
                }
                

            }
        }
      
        /**
         * Function definition to be triggered before record is submit.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {Record} scriptContext.oldRecord - Old record
         * @param {string} scriptContext.type - Trigger type
         */
        function afterSubmit(scriptContext) {

            let process = 'afterSubmit';
            let currentScript = runtime.getCurrentScript();
            let infoTransaction = scriptContext.newRecord;
            let idTransaccion = infoTransaction.id;
            let recType = infoTransaction.type;
            let mensaje = '';
            let codigoEstadoError = currentScript.getParameter('custscript_l56_conx_dirc_fe_cod_est_err'); // Código Estado Log FE - Error (FESTADO-2)
            let codigoEstadoSinError = currentScript.getParameter('custscript_l56_conx_dirc_fe_cod_est_srr'); // Código Estado Log FE - Sin error (FESTADO-1)
            let refTransaccion = idTransaccion;
            let refLog = '';
            var infoAuxiliarFolio = '';

            try {

                log.debug(process, 'INICIO - afterSubmit - Generación Folio - unidades disponibles: ' + currentScript.getRemainingUsage() + ' - time: ' + new Date() + ' - idTransaccion: ' + idTransaccion + ' - recType: ' + recType);
                if (scriptContext.type == 'edit' || scriptContext.type == 'create') {

                    let recordTransaction = record.load({
                        type: recType,
                        id: idTransaccion,
                        isDynamic: true
                    });

                    let docType = recordTransaction.getValue({ fieldId: 'custbody_zim_cl_tipo_doc_cod' });
                    let subsidiary = recordTransaction.getValue({ fieldId: 'subsidiary' });
                    let isOW = runtime.isFeatureInEffect("SUBSIDIARIES");

                    // Busca la plantilla XML correspondiente
                    let filtros = [];
                    if (isOW === true || isOW == 'T') {
                        let filtro = {};
                        filtro.name = 'custrecord_l56_conf_prov_fe_subsidiaria';
                        filtro.operator = 'ANYOF';
                        filtro.values = subsidiary;
                        filtros.push(filtro);
                    }

                    if (!utilities.isEmpty(docType)) {
                        let filtro = {};
                        filtro.name = 'custrecord_l56_plant_doc_elect_tipo_comp';
                        filtro.join = 'custrecord_l56_plant_doc_elect_conf_prov';
                        filtro.operator = 'ANYOF';
                        filtro.values = docType;
                        filtros.push(filtro);
                    }

                    let objResultSet = utilities.searchSavedPro('customsearch_l56_config_proveedor_fe', filtros);
                    let resultSet = objResultSet.objRsponseFunction.result;
                    let resultSearch = objResultSet.objRsponseFunction.search;

                    if (objResultSet.error) {
                        mensaje = 'Error Consultando searchSavedPro - customsearch_l56_config_proveedor_fe - Detalles del Error: ' + objResultSet.descripcion;
                        log.error(process, 'Error: ' + mensaje);
                        grabarError(codigoEstadoError, mensaje, refLog, refTransaccion, null);

                    } else if ((!utilities.isEmpty(resultSet)) && (resultSet.length > 0)) {
                        let idPlantillaXML = resultSet[0].getValue({ name: resultSearch.columns[9] }, '');
                        let directorioArch = resultSet[0].getValue({ name: resultSearch.columns[4] }, '');
                        let rendererXML = render.create();

                        let fileXML = file.load({
                            id: idPlantillaXML
                        });

                        let templateXML = fileXML.getContents();
                        rendererXML.templateContent = templateXML;

                        rendererXML.addRecord({
                            templateName: 'transaction',
                            record: recordTransaction,
                        });

                        let params = {
                            transactionId: idTransaccion,
                            transactionRecord: recordTransaction
                        };

                        log.debug(process, 'Inicio inject info datasource');
                        let objDateInject = inject(params);
                        if (objDateInject.error) {
                            // ! grabar errror y finalizar.
                            grabarError(codigoEstadoError, objDateInject.mensaje, refLog, refTransaccion, null);
                            return;
                        }
                        rendererXML.addCustomDataSource({
                            format: render.DataSource.OBJECT,
                            alias: "obj_data",
                            data: objDateInject
                        });
                        log.debug(process, 'Fin inject info datasource');

                        let stringXML = rendererXML.renderAsString(); // transform to string

                        // creating the final XML file
                        let fileObj = file.create({
                            name: 'InformacionFE_XML_ID_Transaction_' + idTransaccion + '_' + new Date() + '.xml',
                            fileType: file.Type.XMLDOC,
                            contents: stringXML,
                            folder: directorioArch,
                        });

                        let idFileXML = fileObj.save();

                        if (!utilities.isEmpty(idFileXML)) {
                            recordTransaction.setValue({ fieldId: 'custbody_l56_cl_doc_electro', value: idFileXML });
                            recordTransaction.save({ enableSourcing: false, ignoreMandatoryFields: true, disableTriggers: true });
                        }
                    } else {
                        mensaje = 'No existe configuración para el tipo de transacción de Chile seteada en la transacción.';
                        log.error(process, 'Error: ' + mensaje);
                        grabarError(codigoEstadoSinError, mensaje, refLog, refTransaccion, null);
                    }
                }

            } catch (error) {
                mensaje = 'Excepción al intentar generar XML en afterSubmit - Detalles del error: ' + error.message;
                log.error(process, 'Error: ' + mensaje);
                grabarError(codigoEstadoError, mensaje, refLog, refTransaccion, null);
            }

            log.debug(process, "Remaining Usage = " + currentScript.getRemainingUsage() + ' --- time: ' + new Date());
            log.debug(process, 'FIN - afterSubmit - Generación Folio - unidades disponibles: ' + currentScript.getRemainingUsage() + ' - time: ' + new Date());
            return true;
        }

        /**
          * inject - This function will provide the custom data source during the generation process
          * @param {Object} params
          * @param {String} params.transactionId
          * @param {Object} params.transactionRecord
          * @returns {Object} result
          * @returns {render.DataSource} result.alias
          * @returns {string} result.format
          * @returns {Object | Document | string} result.data
          */
        function inject(params) {

            var obj_injection = {
                error: false,
                mensaje: "",
            };

            var txId = params.transactionId;
            var txObject = params.transactionRecord;

            var isOneWorld = runtime.isFeatureInEffect({
                feature: "SUBSIDIARIES"
            });

            var regionEmi, comunaEmi, provinciaEmi, address1, taxidnum, legalname, custrecord_zim_giro, custrecord_zim_acteco;

            if (isOneWorld) {
                var recSubsi = search.lookupFields({
                    type: search.Type.SUBSIDIARY,
                    id: txObject.getValue('subsidiary'),
                    columns: ['address.custrecord_zim_region', 'address.custrecord_zim_comuna', 'address.custrecord_zim_provincia', 'address.address',
                        "custrecord_l56_num_ide_iva", "legalname", "custrecord_zim_giro", "custrecord_zim_acteco"]
                });

                log.debug('inject', 'recSubsi lookupFields: ' + JSON.stringify(recSubsi));
                regionEmi = recSubsi["address.custrecord_zim_region"];
                comunaEmi = get0Text(recSubsi["address.custrecord_zim_comuna"]);
                provinciaEmi = get0Text(recSubsi["address.custrecord_zim_provincia"]);
                address1 = recSubsi["address.address"];
                taxidnum = recSubsi["custrecord_l56_num_ide_iva"];
                legalname = recSubsi["legalname"];
                custrecord_zim_giro = recSubsi["custrecord_zim_giro"];
                custrecord_zim_acteco = recSubsi["custrecord_zim_acteco"];
            } else {
                var configCompany = config.load({
                    type: config.Type.COMPANY_INFORMATION
                });
                var addressCompany = configCompany.getSubrecord({
                    fieldId: 'mainaddress'
                });
                address1 = addressCompany.getText('addr1');
                regionEmi = addressCompany.getText('custrecord_zim_region');
                comunaEmi = addressCompany.getText('custrecord_zim_comuna');
                provinciaEmi = addressCompany.getText('custrecord_zim_provincia');
                taxidnum = configCompany.getText("custrecord_l56_num_ide_iva");
                legalname = configCompany.getText("legalname");
                custrecord_zim_giro = configCompany.getText("custrecord_zim_giro");
                custrecord_zim_acteco = configCompany.getText("custrecord_zim_acteco");
            }

            // VALIDAR CAMPOS REQUERIDOS
            if (utilities.isEmpty(regionEmi) || utilities.isEmpty(comunaEmi) || utilities.isEmpty(provinciaEmi) || utilities.isEmpty(address1)) {
                obj_injection.mensaje += 'En la direccion la Region, Comuna, Provincia o la misma direccion, estan vacias y son requeridas, revise la configuracion de la empresa o subsidiaria'
                obj_injection.error = true;
            }
            if (utilities.isEmpty(taxidnum)) {
                obj_injection.mensaje += "\nEl Nº DE REGISTRO DE IVA esta vacio y es requerido, revise la configuracion de la empresa o subsidiaria"
                obj_injection.error = true;
            }
            if (utilities.isEmpty(legalname) || utilities.isEmpty(custrecord_zim_giro) || utilities.isEmpty(custrecord_zim_acteco)) {
                obj_injection.mensaje += "\nLos campos Legal Name, Giro y Acteco no pueden estar vacíos y son requeridos, revise la configuracion de la empresa o subsidiaria";
                obj_injection.error = true;
            }
            if (obj_injection.error) return obj_injection;
            // FIN VALIDAR CAMPOS REQUERIDOS


            var obj_supplier = {};
            obj_supplier.region = regionEmi;
            obj_supplier.comuna = comunaEmi;
            obj_supplier.provincia = provinciaEmi;
            obj_supplier.address1 = address1;
            obj_supplier.taxidnum = taxidnum;
            obj_supplier.legalname = legalname;
            obj_supplier.custrecord_zim_giro = custrecord_zim_giro;
            obj_supplier.custrecord_zim_acteco = custrecord_zim_acteco;

            var obj_injection = {};
            obj_injection.supplier = obj_supplier;

            let recType = txObject.getValue('type');
            obj_injection.reference = recType;

            if (recType.toLowerCase() == 'itemship') {

                log.debug('inject', 'Inicio - itemship');
                var orderType = txObject.getValue('ordertype');
                var obj_ref = {};
                if (orderType.toLowerCase() == 'salesord') {
                    var recSO = search.lookupFields({
                        type: 'salesorder',
                        id: txObject.getValue('createdfrom'),
                        columns: ['billingaddress.custrecord_zim_region', 'billingaddress.custrecord_zim_comuna', 'billingaddress.address1']
                    });
                    let billAddressSO = recSO["billingaddress.address1"];
                    let billRegionSO = recSO["billingaddress.custrecord_zim_region"];
                    let billComunaSO = get0Text(recSO["billingaddress.custrecord_zim_comuna"]);
                    obj_ref.address = billAddressSO;
                    obj_ref.region = billRegionSO;
                    obj_ref.comuna = billComunaSO;
                } else if (orderType.toLowerCase() == 'trnfrord') {
                    let shipAddressTO = txObject.getValue('shippingaddress.address1');
                    let shipRegionTO = txObject.getValue('shippingaddress.custrecord_zim_region');
                    let shipComunaTO = txObject.getValue('shippingaddress.custrecord_zim_comuna');
                    obj_ref.address = shipAddressTO;
                    obj_ref.region = shipRegionTO;
                    obj_ref.comuna = shipComunaTO;
                }
                obj_injection.reference = obj_ref;

                log.debug('inject', 'Fin - itemship');
            } else {

                log.debug('inject', 'Inicio - verificacion de descuentos');

                var discountText = txObject.getText("discountrate");
                var discountValue = txObject.getValue("discountrate");
                discountValue = (Math.round(discountValue * 100)) / 100 * -1;
                var discountType = '';
                if (discountText.charAt(discountText.length - 1) === '%') {
                    discountType = '%';
                } else {
                    discountType = '$';
                }

                obj_injection.discountType = discountType;
                obj_injection.discountValue = discountValue;

                log.debug('inject', 'Fin - verificacion de descuentos');
            }

            var transaRelacio = search.create({
                type: 'customrecord_zim_fact_guias',
                columns: ['custrecord_zim_guia_relacionada.trandate', 'custrecord_zim_guia_relacionada.custbody_zim_fe_cl_folio'],
                filters: [
                    ['custrecord_zim_factura_relacion.internalid', 'is', txId], "AND", ['custrecord_zim_factura_relacion.mainline', 'is', true], "AND", ['custrecord_zim_guia_relacionada.mainline', 'is', true]
                ]
            });

            resulttransaRelacio = transaRelacio.run().getRange(0, 50);
            if (resulttransaRelacio != null && resulttransaRelacio.length != 0) {
                var customObjAu = new Array();
                for (var i = 0; i < resulttransaRelacio.length; i++) {
                    row = resulttransaRelacio[i].columns;
                    var fecha = resulttransaRelacio[i].getValue(row[0]);
                    customObjAu[i] = {
                        "fecha": fecha,
                        "folio": resulttransaRelacio[i].getValue(row[1])
                    };
                }
                obj_injection.guias = customObjAu;
            }

            log.debug('inject', 'obj_injection: ' + JSON.stringify(obj_injection));

            return obj_injection;
        }

        /**
         * recibe por parametro lo necesario para rellenat RT traza y detalle traza FE
         *
         * @param {string} codigoEstado
         * @param {string} detalleMensaje
         * @param {string} refLog
         * @param {string} refTransaccion
         * @param {string} infoAuxiliarFolio
         */
        function grabarError(codigoEstado, detalleMensaje, refLog, refTransaccion, idXMLFE) {

            var proceso = 'grabarError';
            log.debug(proceso, 'INICIO PROCESO - grabarError - parámetros - codigoEstado: ' + codigoEstado + ' - detalleMensaje: ' + detalleMensaje + ' - refLog: ' + refLog + ' - refTransaccion: ' + refTransaccion + ' - idXMLFE: ' + idXMLFE);

            try {
                var idRL = refLog;
                var idRDL = null;
                var fechaActual = parseDate();
                //se rellena el RT Traza Audit FE
                if (utilities.isEmpty(idRL)) {

                    var recordLog = record.create({ type: 'customrecord_l56_traza_audit_fe', isDynamic: true });

                    recordLog.setValue({ fieldId: 'custrecord_l56_cl_trz_audit_fe_fecha', value: fechaActual });

                    if (!utilities.isEmpty(codigoEstado)) {
                        recordLog.setValue({ fieldId: 'custrecord_l56_cl_traza_audit_fe_estado', value: codigoEstado });
                    }

                    var subL = 'recmachcustrecord_l56_cl_traza_audit_det_fe_trz';
                    recordLog.selectNewLine({ sublistId: subL });
                    recordLog.setCurrentSublistValue({ sublistId: subL, fieldId: 'custrecord_l56_cl_detall_log_fe_fech_det', value: fechaActual });

                    if (!utilities.isEmpty(detalleMensaje)) {
                        recordLog.setCurrentSublistValue({ sublistId: subL, fieldId: 'custrecord_l56_cl_detall_log_fe_msj_det', value: detalleMensaje });
                    }

                    if (!utilities.isEmpty(refTransaccion)) {
                        recordLog.setCurrentSublistValue({ sublistId: subL, fieldId: 'custrecord_l56_cl_det_log_fe_ref_t_det', value: refTransaccion });
                    }

                    if (!utilities.isEmpty(idXMLFE)) {
                        recordLog.setCurrentSublistValue({ sublistId: subL, fieldId: 'custrecord_l56_cl_trz_de_aud_det_doc_elc', value: idXMLFE });
                    }

                    recordLog.commitLine({ sublistId: subL });
                    recordLog.save();
                }
                log.debug(proceso, 'id log FE: ' + idRL + ' - id detalle log FE: ' + idRDL);

            } catch (error) {
                log.error(proceso, 'Excepción Grabando Log de Proceso de Factura Electrónica - Excepción: ' + error.message);
            }

            log.debug(proceso, 'FIN PROCESO - grabarError.');
        }


        function parseDate(fecha) {

            if (!utilities.isEmpty(fecha)) {
                var fechaFormateada = format.parse({
                    value: fecha,
                    type: format.Type.DATE,
                    timezone: format.Timezone.AMERICA_MONTEVIDEO
                });
            } else {
                var fechaFormateada = new Date();
            }

            return fechaFormateada;
        }
        
        function get0Text(obj) {
            if (obj.length > 0) {
                if (!utilities.isEmpty(obj[0].text)) {
                    return obj[0].text;
                }
            }
            return "";
        }

        return {
            beforeLoad: beforeLoad,
            beforeSubmit: beforeSubmit,
            afterSubmit: afterSubmit
        };
    });