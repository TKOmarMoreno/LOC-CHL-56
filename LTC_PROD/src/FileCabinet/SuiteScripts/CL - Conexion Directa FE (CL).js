/**
 * @NApiVersion 2.0
 * @NModuleScope Public
 *@NAmdConfig /SuiteScripts/configuration.json
 */
define(
    [
        'N/currentRecord', 'N/format', 'L56/utilidades', 'N/runtime', 'N/https', 'N/url', 'N/log', 'N/record', 'N/search', 'N/error', 'N/ui/dialog', 'N/translation'
    ],
    function (currentRecord, format, utilities, runtime, https, url, log, record, search, error, dialog, translation) {

        function generarFolioPro(codigoEstadoError, codigoEstadoSinError, imprimeProvFE, dirArchPDF, empleadoParaEmail) {

            var process = 'generarFolio';
            var currentScript = runtime.getCurrentScript();
            log.debug(process, "INICIO - Generar Folio (CL) - unidades disponibles: " + currentScript.getRemainingUsage() + ' --- time: ' + new Date());
            var currentContext = currentRecord.get();
            var recId = currentContext.id;
            var recType = currentContext.type;
            var refTransaccion = recId;
            var refLog = '';
            var infoAuxiliarFolio = '';
            var recordTransaction = record.load({
                type: recType,
                id: recId,
                isDynamic: true
            });
            var docXML = recordTransaction.getValue({ fieldId: 'custbody_l56_cl_doc_electro' });
            var idXMLFE = docXML;
            var folio = recordTransaction.getValue({ fieldId: 'custbody_zim_fe_cl_folio' });
            var mensaje = '';
            var codigoEstadoError = codigoEstadoError;
            var codigoEstadoSinError = codigoEstadoSinError;
            var dirArchPDF = dirArchPDF;
            var imprimeProvFE = imprimeProvFE;
            log.debug(process, 'Que tiene imprimeProvFE ' + imprimeProvFE + 'Que tiene dirArchPDF ' + dirArchPDF)

            try {
                if (!utilities.isEmpty(docXML)) {
                    if (utilities.isEmpty(folio)) {
                        // Se conecta al suitelet
                        var new_url = url.resolveScript({
                            scriptId: 'customscript_l56_conexion_directa_fe_st',
                            deploymentId: 'customdeploy_l56_conexion_directa_fe_st',
                        });

                        var idTransaccion = recId;

                        // poner las variables
                        var postData = {
                            idTransaccion: recId,
                            typeTransaccion: recType,
                            dirArchPDF: dirArchPDF,
                            imprimeProvFE: imprimeProvFE,
                            empleadoParaEmail: empleadoParaEmail
                        };

                        var response = https.post({
                            url: new_url,
                            body: postData
                        });
                        log.debug(process, 'Response: ' + JSON.stringify(response));

                        if (utilities.isEmpty(response)) {
                            //mensaje = "Error obteniendo información de Suitelet generador de Folio - Respuesta OBJECT: nula/vacía";
                            mensaje = translation.get({
                                collection: 'custcollection_l56_fe_translate',
                                key: 'CLIENT_E_01'
                            })();
                            log.error(process, mensaje);
                            grabarError(codigoEstadoError, mensaje, refLog, refTransaccion, null);
                            alert_msg(mensaje);
                            return false;
                        }

                        if (!utilities.isEmpty(response)) {
                            log.debug(process, 'Response Suitelet body: ' + JSON.stringify(response.body));
                            var informacionRespuestaAux = JSON.parse(response.body);

                            log.debug(process, 'Response informacionRespuestaAux: ' + JSON.stringify(informacionRespuestaAux));

                            if (utilities.isEmpty(informacionRespuestaAux)) {
                                //mensaje = "Error obteniendo información de Suitelet generador de Folio - Respuesta body: nula/vacía";
                                mensaje = translation.get({
                                    collection: 'custcollection_l56_fe_translate',
                                    key: 'CLIENT_E_02'
                                })();
                                log.error(process, mensaje);
                                grabarError(codigoEstadoError, mensaje, refLog, refTransaccion, null);
                                alert_msg(mensaje);
                                return false;
                            } else if (!informacionRespuestaAux.success) {
                                //mensaje = 'Error en el proceso de generación de Folio - Detalles: ' + informacionRespuestaAux.message;
                                var mensajeLetras = translation.get({
                                    collection: 'custcollection_l56_fe_translate',
                                    key: 'CLIENT_E_03'
                                })();
                                mensaje = mensajeLetras + informacionRespuestaAux.message;
                                log.error(process, mensaje);
                                grabarError(codigoEstadoError, mensaje, refLog, refTransaccion, null);
                                alert_msg(mensaje);
                                return false;
                            }

                            if (informacionRespuestaAux.success) {
                                var informacionFolio = informacionRespuestaAux.folio;
                                log.debug(process, 'informacionFolio: ' + informacionFolio);

                                if (!utilities.isEmpty(informacionFolio) && informacionFolio > 0) {
                                    var FOLIOGENERADO = true;
                                    log.debug(process, "Remaining Usage = " + currentScript.getRemainingUsage() + ' --- time: ' + new Date());
                                    
                                    var tipoComprobanteElectronico = recordTransaction.getValue({ fieldId: 'custbody_zim_cl_tipo_doc_cod' });
                                    var codigoComprobanteElectronico = '';
                                    if(!utilities.isEmpty(tipoComprobanteElectronico)){
                                        var obj_type = search.lookupFields({
                                            type: 'customrecord_zim_cl_tipo_documento',
                                            id: tipoComprobanteElectronico,
                                            columns: ['custrecord_zim_cl_tipo_doc_cod']
                                        });
                                        log.debug(process, "Tipo Doc = " + JSON.stringify(obj_type));
                                    
                                        codigoComprobanteElectronico = obj_type.custrecord_zim_cl_tipo_doc_cod;
                                    }

                                    var tranID = recordTransaction.getValue({ fieldId: 'tranid' });
                                    
                                    grabarDatosFolio(informacionRespuestaAux, codigoEstadoSinError, codigoEstadoError, FOLIOGENERADO, recType, recId, mensaje, refLog, refTransaccion, idXMLFE,codigoComprobanteElectronico,tranID)
                                }
                            }
                        }
                    } else {
                        //mensaje = "La transacción ya posee Folio.";
                        mensaje = translation.get({
                            collection: 'custcollection_l56_fe_translate',
                            key: 'CLIENT_E_04'
                        })();
                        alert_msg(mensaje);
                        log.error(process, mensaje);
                        grabarError(codigoEstadoError, mensaje, refLog, refTransaccion, null);
                    }
                } else {
                    //mensaje = "La transacción no posee asociado el XML con los datos para generar el folio, proceda a editar la transacción y a guardarla nuevamente para posteriormente generar el Folio";
                    mensaje = translation.get({
                        collection: 'custcollection_l56_fe_translate',
                        key: 'CLIENT_E_05'
                    })();
                    alert_msg(mensaje);
                    log.error(process, mensaje);
                    grabarError(codigoEstadoError, mensaje, refLog, refTransaccion, null);
                }
            } catch (error) {
                //mensaje = 'Excepción inesperada en la función generarFolio - Detalles: ' + error;
                var mensajepart1 = translation.get({
                    collection: 'custcollection_l56_fe_translate',
                    key: 'CLIENT_E_06'
                })();
                mensaje = mensajepart1 + error;
                log.error(process, mensaje);
                grabarError(codigoEstadoError, mensaje, refLog, refTransaccion, null);
                alert_msg(mensaje);
            }
            log.debug(process, "FIN - Generar Folio (CL) - unidades disponibles: " + currentScript.getRemainingUsage() + ' --- time: ' + new Date());
        }

        function generarFolio(codigoEstadoError, codigoEstadoSinError, imprimeProvFE, dirArchPDF, empleadoParaEmail) {
            // dialog.confirm({
            //     title: "Confirmación",
            //     message: "La obtención del Folio es un proceso externo, el cual puede demorar unos segundos. Se le notificará cuando finalice, ¿Desea continuar?"
            // })
            //     .then(function (res) {
            //         if (res === true) {
            //             generarFolioPro(codigoEstadoError, codigoEstadoSinError, imprimeProvFE, dirArchPDF, empleadoParaEmail);
            //         }
            //     });
            var titulo = translation.get({
                collection: 'custcollection_l56_fe_translate',
                key: "CLIENT_T_01"
                })();
            var mensaje = translation.get({
                collection: 'custcollection_l56_fe_translate',
                key: "CLIENT_C_01"
                })();
            if(confirm(mensaje)){
                generarFolioPro(codigoEstadoError, codigoEstadoSinError, imprimeProvFE, dirArchPDF, empleadoParaEmail);
            }
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
                var idRegistroFinal = '';
                //se rellena el RT Traza Audit FE
                if (utilities.isEmpty(idRL)) {

                    var recordLog = record.create({ type: 'customrecord_l56_traza_audit_fe', isDynamic: true });

                    recordLog.setValue({ fieldId: 'custrecord_l56_cl_trz_audit_fe_fecha', value: fechaActual });

                    if (!utilities.isEmpty(codigoEstado)) {
                        recordLog.setValue({ fieldId: 'custrecord_l56_cl_traza_audit_fe_estado', value: codigoEstado });
                    }

                    var subL = 'recmachcustrecord_l56_cl_traza_audit_det_fe_trz';
                    recordLog.selectNewLine({ sublistId: subL })
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
                    idRegistroFinal = recordLog.save();
                }
                log.debug(proceso, 'id log FE: ' + idRegistroFinal);

            } catch (error) {
                log.error(proceso, 'Excepción Grabando Log de Proceso de Factura Electrónica - Excepción: ' + error);
            }

            log.debug(proceso, 'FIN PROCESO - grabarError.');
        }

        /**
         * Graba los datos de la transacción con CAE
         * @param {Object} informacionRespuestaAux - Información de Folio
         * @param {int} codigoEstadoSinError
         * @param {int} codigoEstadoError
         * @param {Boolean} FOLIOGENERADO 
         * @param {string} recType - Tipo de transacción
         * @param {int} recId - ID Transacción
         */
        function grabarDatosFolio(informacionRespuestaAux, codigoEstadoSinError, codigoEstadoError, FOLIOGENERADO, recType, recId, mensaje, refLog, refTransaccion, idXMLFE,codigoComprobanteElectronico,tranIDOriginal) {

            var proceso = 'grabarDatosFolio';
            log.debug(proceso, 'INICIO - grabarDatosFolio');
            var mensajeFinal = '';

            if (FOLIOGENERADO == true && !utilities.isEmpty(informacionRespuestaAux.folio) && informacionRespuestaAux.folio != "0" && informacionRespuestaAux.folio != 0) {

                log.debug(proceso, 'Generación de Folio OK - informacionRespuestaAux: ' + JSON.stringify(informacionRespuestaAux));
                //mensajeFinal = 'Se ha generado correctamente el folio para la transacción. Número de folio: ' + informacionRespuestaAux.folio + '. Recargue la página y visualice el detalle en la subficha CHL-Facturación Electrónica.';
                var mensajepart1 = translation.get({
                    collection: 'custcollection_l56_fe_translate',
                    key: "CLIENT_C_02"
                    })();
                var mensajepart2 = translation.get({
                    collection: 'custcollection_l56_fe_translate',
                    key: "CLIENT_C_03"
                    })();
                mensajeFinal = mensajepart1 + informacionRespuestaAux.folio + mensajepart2;
                grabarError(codigoEstadoSinError, mensajeFinal, refLog, refTransaccion, idXMLFE);

                log.debug(proceso, 'INICIO - actualizar el Record Transaccion');
                // INICIO CALCULAR TRANID
                var tranID = tranIDOriginal;

                //alert('TranID Original : ' + tranIDOriginal + ' - Codigo : ' + codigoComprobanteElectronico);

                if(!utilities.isEmpty(codigoComprobanteElectronico)){
                    //alert('Codigo Electornico NO Vacio');
                    switch (codigoComprobanteElectronico) {
                        case '33':
                            tranID = 'FV-' + informacionRespuestaAux.folio;
                            break;
                        case '56':
                            tranID = 'ND-' + informacionRespuestaAux.folio;
                            break;
                        case '61':
                            tranID = 'NC-' + informacionRespuestaAux.folio;
                            break;
                        case '39':
                            tranID = 'BL-' + informacionRespuestaAux.folio;
                            break;
                        case '41':
                            tranID = 'BLE-' + informacionRespuestaAux.folio;
                            break;
                        case '110':
                            tranID = 'FVE-' + informacionRespuestaAux.folio;
                            break;
                        case '111':
                            tranID = 'NDE-' + informacionRespuestaAux.folio;
                            break;
                        case '112':
                            tranID = 'NCE-' + informacionRespuestaAux.folio;
                            break;
                    }
                }
                //alert('TranID : ' + tranID);
                // FIN CALCULAR TRANID
                // Grabo el Record Trnasaccion
                var idTransaccionFinal = record.submitFields({
                    type: recType,
                    id: recId,
                    values: {
                        custbody_zim_fe_cl_folio: informacionRespuestaAux.folio,
                        custbody_zim_fe_cl_pdf: informacionRespuestaAux.pdf,
                        tranid : tranID
                    },
                    options: {
                        enablesourcing: false,
                        ignoreMandatoryFields: true
                    }

                });

                log.debug(proceso, 'FIN - actualizar el Record Transaccion - idTransaccionFinal: ' + idTransaccionFinal);
            } else {
                log.debug(proceso, 'Generación de Folio NULL.');
                mensajeFinal = mensaje;
                grabarError(codigoEstadoError, mensajeFinal, refLog, refTransaccion, null);
            }

            alert_msg(mensajeFinal);
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

        function alert_msg(bodyMessage) {
            // dialog.alert({
            //     title: "Mensaje",
            //     message: bodyMessage
            // }).then(function (result) {
            //     log.debug('alert_msg', "Success with value " + result);
            // }).catch(function (reason) {
            //     log.error('alert_msg', "Failure: " + reason);
            // });
            alert(bodyMessage);
        }

        return {
            generarFolio: generarFolio,
        };
    });
