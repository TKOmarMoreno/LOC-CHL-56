/**
 *@NApiVersion 2.1
 *@NScriptType MapReduceScript
 *@NAmdConfig /SuiteScripts/configuration.json
 */
define(['N/record', 'N/runtime', 'N/search', 'N/format', 'N/url', 'N/https', 'N/error', 'L56/utilidades', 'N/email', 'N/log'],
    function (record, runtime, search, format, url, https, error, utilities, email, log) {

        const proceso = "Generación de Folio Automatico (MR)";
        const URLSuitelet = 'customscript_l56_conexion_directa_fe_st';
        const ImplSuitelet = 'customdeploy_l56_conexion_directa_fe_st';

        /**
         * Marks the beginning of the Map/Reduce process and generates input data.
         *
         * @typedef {Object} ObjectRef
         * @property {number} id - Internal ID of the record instance
         * @property {string} type - Record type id
         *
         * @return {Array|Object|Search|RecordRef} inputSummary
         * @since 2015.1
         */
        function getInputData() {
            var currScript = runtime.getCurrentScript();

            var respuesta = new Object();
            respuesta.error = false;
            respuesta.mensaje = '';
            respuesta.informacionTransacciones = new Array();

            try {

                /***************************** OBTENER PARAMETROS DE EJECUCION - INICIO ********************************/

                var parametrosEjecucion = obtenerParametros(currScript);

                log.audit(proceso, 'Parametros de Ejecución : ' + JSON.stringify(parametrosEjecucion));

                /***************************** OBTENER PARAMETROS DE EJECUCION - FIN ********************************/

                if (!utilities.isEmpty(parametrosEjecucion) && !utilities.isEmpty(parametrosEjecucion.ssTransaccionesPendCAE)) {

                    /***************************** OBTENER TRANSACCIONES - INICIO ********************************/

                    var objInformacionTransacciones = obtenerTransacciones(currScript, parametrosEjecucion);

                    log.audit(proceso, 'Respuesta Obtener Transacciones : ' + JSON.stringify(objInformacionTransacciones));

                    /***************************** OBTENER TRANSACCIONES - FIN ********************************/

                    if (!utilities.isEmpty(objInformacionTransacciones) && objInformacionTransacciones.error == false
                        && !utilities.isEmpty(objInformacionTransacciones.informacionTransacciones) && objInformacionTransacciones.informacionTransacciones.length > 0) {
                        respuesta.informacionTransacciones = objInformacionTransacciones.informacionTransacciones;
                    }
                    else {

                        if (utilities.isEmpty(objInformacionTransacciones)) {
                            respuesta.error = true;
                            respuesta.mensaje = 'No se recibio objeto con respuesta de la consulta de Transacciones a procesar';
                        }
                        else {
                            if (objInformacionTransacciones.error == true) {
                                respuesta.error = true;
                                respuesta.mensaje = 'Error al obtener las Transacciones a Procesar - Error : ' + objInformacionTransacciones.mensaje;
                            }
                            else {
                                if (utilities.isEmpty(objInformacionTransacciones.informacionTransacciones)) {
                                    respuesta.error = true;
                                    respuesta.mensaje = 'No se recibio objeto con la informacion de Transacciones a procesar';
                                }
                                else {
                                    respuesta.error = false;
                                    respuesta.mensaje = 'No se recibieron Transacciones a procesar';
                                }
                            }
                        }
                    }
                }
                else {
                    respuesta.error = true;
                    if (utilities.isEmpty(parametrosEjecucion)) {
                        respuesta.mensaje = 'No se recibio objeto con la informacion de los Parametros de Ejecucion';
                    }
                    else {
                        respuesta.mensaje = 'No se recibio la siguiente informacion requerida para realizar la generacion de CAE : ';
                        if (utilities.isEmpty(parametrosEjecucion.ssTransaccionesPendCAE)) {
                            respuesta.mensaje += ' / Busqueda Guardada con Transacciones Autorizadas';
                        }
                    }
                }

            } catch (excepcion) {
                log.error(proceso, 'INPUT DATA - Excepcion Generando CAE - Excepcion : ' + excepcion.message.toString());
                log.audit(proceso, 'INPUT DATA - Fin Proceso');

                return null;
            }
            if (respuesta.error == false) {
                log.audit(proceso, 'INPUT DATA - Fin Proceso - Fecha : ' + new Date() + ' - Unidades Disponibles : ' + currScript.getRemainingUsage());
                if (respuesta.informacionTransacciones.length > 0) {
                    return respuesta.informacionTransacciones;
                }
                else {
                    return null;
                }
            }
            else {
                log.error(proceso, 'INPUT DATA - Error Generando CAE - Error : ' + respuesta.mensaje);
                return null;
            }
        }

        /**
         * Executes when the map entry point is triggered and applies to each key/value pair.
         *
         * @param {MapSummary} context - Data collection containing the key/value pairs to process through the map stage
         * @since 2015.1
         */
        function map(context) {
            var currScript = runtime.getCurrentScript();
            try {
                log.audit(proceso, 'MAP - Incio Proceso - Fecha : ' + new Date() + ' - Unidades Disponibles : ' + currScript.getRemainingUsage());
                var resultado = context.value;
                if (!utilities.isEmpty(resultado)) {
                    var informacion = JSON.parse(resultado);
                    log.debug('map', 'Que tiene informacion : ' + JSON.stringify(informacion));
                    if (!utilities.isEmpty(informacion.id) && !utilities.isEmpty(informacion.tipo)) {

                        var obj = new Object();
                        obj = informacion;

                        var clave = obj.tipo + '-' + obj.id;

                        context.write(clave, JSON.stringify(obj));

                    } else {
                        log.error(proceso, 'MAP - Error Obteniendo Resultados de ID de Registro a Procesar');
                    }

                } else {
                    log.error(proceso, 'MAP - Error Parseando Resultados de registro a Procesar');
                }

            } catch (excepcion) {
                log.error(proceso, 'MAP - Excepcion Procesando Registros - Excepcion : ' + excepcion.message.toString());
            }
            log.audit(proceso, 'MAP - Fin Proceso - Fecha : ' + new Date() + ' - Unidades Disponibles : ' + currScript.getRemainingUsage());
        }

        /**
         * Executes when the reduce entry point is triggered and applies to each group.
         *
         * @param {ReduceSummary} context - Data collection containing the groups to process through the reduce stage
         * @since 2015.1
         */
        function reduce(context) {
            var currScript = runtime.getCurrentScript();
            log.audit(proceso, 'REDUCE - Incio Proceso - ID Transaccion : ' + context.key + ' - Fecha : ' + new Date() + ' - Unidades Disponibles : ' + currScript.getRemainingUsage());

            var respuesta = new Object();
            respuesta.error = false;
            respuesta.mensaje = '';
            respuesta.tipo = '';
            respuesta.id = '';
            respuesta.cae = '';

            try {

                if (!utilities.isEmpty(context.key) && !utilities.isEmpty(context.values) && context.values.length > 0) {
                    //var i = 0; !utilities.isEmpty(context.values) && context.values.length > 0 && i < context.values.length; i++) {
                    for (var i = 0; !utilities.isEmpty(context.values) && context.values.length > 0 && i < context.values.length; i++) {
                        var registro = JSON.parse(context.values[i]);

                        log.debug('proceso', 'que tiene registro: ' + JSON.stringify(registro));
                        if (!utilities.isEmpty(registro.id) && !utilities.isEmpty(registro.tipo) && !utilities.isEmpty(registro.tranName)) {
                            log.audit(proceso, 'Transacciones A Ejecutar : ' + JSON.stringify(context));

                            respuesta.id = registro.id;
                            respuesta.tipo = registro.tipo;
                            /***************************** OBTENER PARAMETROS DE EJECUCION - FIN ********************************/
                            var parametrosEjecucion = obtenerParametros(currScript);

                            log.audit(proceso, 'Parametros de Ejecución : ' + JSON.stringify(parametrosEjecucion));

                            /***************************** OBTENER PARAMETROS DE EJECUCION - FIN ********************************/

                            if (!utilities.isEmpty(parametrosEjecucion)) {
                                // INICIO - Generar CAE   //currentScript, parametros, paramRecType, paramRecId, context) {
                                objRespuestaCAE = generarCAE(currScript, parametrosEjecucion, registro.tipo, registro.id, registro.tranName, context);
                                // FIN - Generar CAE
                              
                            }
                            else {
                                respuesta.error = true;
                                if (utilities.isEmpty(parametrosEjecucion)) {
                                    respuesta.mensaje = 'No se recibio objeto con la informacion de los Parametros de Ejecucion';
                                }
                                /*   else {
                                      if (utilities.isEmpty(parametrosEjecucion.codigoEstadoError)) {
                                          respuesta.mensaje += ' / Codigo de Estado de Error';
                                      }
                                      if (utilities.isEmpty(parametrosEjecucion.codigoEstadoSinError)) {
                                          respuesta.mensaje += ' / Codigo Estado Sin Error';
                                      }
                                      if (utilities.isEmpty(parametrosEjecucion.tipoMensajeErrorConfiguracionFE)) {
                                          respuesta.mensaje += ' / Tipo de Mensaje de Error de Configuracion FE';
                                      }
                                      if (utilities.isEmpty(parametrosEjecucion.tipoMensajeErrorCAE)) {
                                          respuesta.mensaje += ' / Tipo de Mensaje de Error de CAE';
                                      }
                                      if (utilities.isEmpty(parametrosEjecucion.tipoMensajeErrorInesperadoXML)) {
                                          respuesta.mensaje += ' / Tipo de Mensaje de Error Inesperado XML';
                                      }
                                      if (utilities.isEmpty(parametrosEjecucion.tipoMensajeSinError)) {
                                          respuesta.mensaje += ' / Tipo de Mensaje Sin Error';
                                      }
                                      if (utilities.isEmpty(parametrosEjecucion.tipoMensajeErrorBoton)) {
                                          respuesta.mensaje += ' / Tipo de Mensaje de Error de Boton';
                                      }
                                  } */
                            }
                        }
                        else {
                            respuesta.error = true;
                            respuesta.mensaje = 'No se recibio la siguiente informacion de la transaccion requerida para relizar la generacion de CAE : ';
                            if (utilities.isEmpty(registro.id)) {
                                respuesta.mensaje += ' / ID Interno de Transaccion';
                            }
                            if (utilities.isEmpty(registro.tipo)) {
                                respuesta.mensaje += ' / Tipo de Transaccion';
                            }
                        }
                    }
                } else {
                    respuesta.error = true;
                    respuesta.mensaje = 'Error al Generar CAE de la Transaccion con ID Interno : ' + context.key + ' - No se recibio informacion de registros';
                    log.error(proceso, respuesta.mensaje);
                }
            }
            catch (ex) {
                respuesta.error = true;
                respuesta.mensaje = 'Excepcion General Generando CAE de la Transaccion con ID Interno   : ' + context.key + ' - Descripcion : ' + ex.message;
                log.error(proceso, respuesta.mensaje);
                context.write(context.key, respuesta);
            }
            if (respuesta.error == false) {
                respuesta.mensaje = 'Se ha generado correctamente el CAE para la Transaccion Tipo : ' + respuesta.tipo + ' - ID Interno : ' + respuesta.id + ' - CAE Generado : ' + respuesta.cae + ' - Fecha : ' + new Date() + ' - Unidades Disponibles : ' + currScript.getRemainingUsage() + ' - Respuesta : ' + JSON.stringify(respuesta);
                log.audit(proceso, 'REDUCE - Fin Proceso - KEY : ' + context.key + ' - Fecha : ' + new Date() + ' - Unidades Disponibles : ' + currScript.getRemainingUsage() + ' - Respuesta : ' + JSON.stringify(respuesta));
            }
            else {
                respuesta.error = true;
                respuesta.mensaje = 'Error Generando CAE para la Transaccion Tipo : ' + respuesta.tipo + ' - ID Interno : ' + respuesta.id + ' - Fecha : ' + new Date() + ' - Unidades Disponibles : ' + currScript.getRemainingUsage() + ' - Respuesta : ' + JSON.stringify(respuesta);
                log.error(proceso, 'REDUCE - ' + respuesta.mensaje);

            }

            context.write(context.key, respuesta);
        }

        /**
         * Executes when the summarize entry point is triggered and applies to the result set.
         *
         * @param {Summary} summary - Holds statistics regarding the execution of a map/reduce script
         * @since 2015.1
         */
        function summarize(summary) {
            //handleErrorIfAny(summary);
            var currScript = runtime.getCurrentScript();
            var respuesta = new Object();
            respuesta.error = false;
            respuesta.mensaje = 'Detalle de Ejecucion : ';

            log.audit(proceso, 'SUMMARIZE - Incio Proceso - Fecha : ' + new Date() + ' - Unidades Disponibles : ' + currScript.getRemainingUsage());

            try {
                var totalReduceRecords = 0;
                var totalReduceErrors = 0;

                summary.output.iterator().each(function (key, value) {

                    totalReduceRecords++;
                    var objResp = JSON.parse(value);

                    if (objResp.error == true) {
                        totalReduceErrors++;
                    }
                    respuesta.mensaje += ' / ' + totalReduceRecords + ': ' + ' - Tipo Registro : ' + objResp.tipo + ' - ID : ' + objResp.id + ' - CAE : ' + objResp.cae + ' - Mensaje : ' + objResp.mensaje;

                    return true;
                });

                log.audit(proceso, 'SUMMARIZE - Fin Proceso - Fecha : ' + new Date() + ' - Unidades Disponibles : ' + currScript.getRemainingUsage() + ' - Total Registros : ' + totalReduceRecords + ' - Total Registros Procesados Correctamente : ' + (totalReduceRecords - totalReduceErrors) + ' - Total Registros con Error : ' + totalReduceErrors);
                log.audit(proceso, 'SUMMARIZE - Detalle Procesamiento : ' + respuesta.mensaje);

            } catch (e) {
                log.error(proceso, 'Excepcion General Summarize - Descripcion : ' + JSON.stringify(e.message));
            }
        }

        /***************************** FUNCIONES AUXILIARES - INICIO ********************************/

        function obtenerParametros(currScript) {
            var respuesta = new Object();
            respuesta.error = false;
            respuesta.mensaje = '';

            try {
                respuesta.ssTransaccionesPendCAE = currScript.getParameter('custscript_l56_bus_trans_pend_folio');
                //respuesta.subsidiaria = currScript.getParameter('custscript_l598_gen_cae_a_sub');
                respuesta.codigoEstadoError = currScript.getParameter('custscript_l56_gen_folio_masiv_cod_err');
                respuesta.codigoEstadoSinError = currScript.getParameter('custscript_l56_gen_folio_masiv_sin_err');
                respuesta.tipoMensajeErrorConfiguracionFE = currScript.getParameter('custscript_l56_msj_err_cnfg_fe');
                //respuesta.tipoMensajeErrorCAE = currScript.getParameter('custscript_l598_gen_cae_a_men_error_cae');
                //respuesta.tipoMensajeErrorInesperadoXML = currScript.getParameter('custscript_l598_gen_cae_a_men_error_xml');
                respuesta.tipoMensajeSinError = currScript.getParameter('custscript_l56_mnsj_log_fe_sin_err_mr');
                //respuesta.tipoMensajeErrorBoton = currScript.getParameter('custscript_l598_gen_cae_a_men_error_bot');

                return respuesta;
            } catch (exception) {
                respuesta.error = true;
                respuesta.mensaje = 'Excepcion al Obtener Parametros de Ejecucion - Error : ' + exception.message;
                return respuesta;
            }
            return respuesta;
        }

        function obtenerTransacciones(currScript, parametrosEjecucion) {
            log.debug(proceso, 'OBTENER TRANSACCIONES - Incio Proceso - INFORMACION RECIBIDA - Parametros de Ejecucion : '
                + JSON.stringify(parametrosEjecucion));

            var respuesta = new Object();
            respuesta.error = false;
            respuesta.mensaje = '';
            respuesta.informacionTransacciones = new Array();

            try {
                if (!utilities.isEmpty(parametrosEjecucion) && !utilities.isEmpty(parametrosEjecucion.ssTransaccionesPendCAE)) {

                    /****************************** CONSULTAR TRANSACCIONES - INICIO **********************************/

                    var respuestaTransacciones = buscarTransacciones(currScript, parametrosEjecucion);

                    log.debug(proceso, 'Obtener Transacciones - Informacion Transacciones : ' + JSON.stringify(respuestaTransacciones));

                    /****************************** CONSULTAR TRANSACCIONES - FIN **********************************/

                    if (!utilities.isEmpty(respuestaTransacciones) && respuestaTransacciones.error == false
                        && !utilities.isEmpty(respuestaTransacciones.informacion) && respuestaTransacciones.informacion.length > 0) {

                        respuesta.informacionTransacciones = respuestaTransacciones.informacion;

                    }
                    else {
                        // No se encoentraron Transacciones
                        if (utilities.isEmpty(respuestaTransacciones)) {
                            respuesta.error = true;
                            respuesta.mensaje = 'No se recibio la información del objeto con la información de las Transacciones a Procesar';
                        }
                        else {
                            if (respuestaTransacciones.error == true) {
                                respuesta.error = true;
                                if (!utilities.isEmpty(respuestaTransacciones.mensaje)) {
                                    respuesta.mensaje = 'Error obteniendo Informacion de Transacciones A Procesar - Error : ' + respuestaTransacciones.mensaje;
                                }
                                else {
                                    respuesta.mensaje = 'No se recibio la información de las Transacciones A Procesar';
                                }
                            }
                        }
                    }
                }
                else {
                    // Error Recibiendo Parametros
                    respuesta.error = true;
                    if (utilities.isEmpty(parametrosEjecucion)) {
                        respuesta.mensaje = 'No se recibio objeto con la informacion de los Parametros de Ejecucion';
                    }
                    else {
                        respuesta.mensaje = 'No se recibio la siguiente informacion requerida para realizar la Busqueda de Transacciones : ';
                        if (utilities.isEmpty(parametrosEjecucion.ssTransaccionesPendCAE)) {
                            respuesta.mensaje += ' / Busqueda Guardada para la Consulta de Transacciones a Generar CAE';
                        }
                    }
                }
            } catch (exception) {
                respuesta.error = true;
                respuesta.mensaje = 'Excepcion al Obtener Transacciones A Generar CAE - Error : ' + exception.message;
                return respuesta;
            }
            return respuesta;
        }

        function buscarTransacciones(currScript, parametros) {
            log.debug(proceso, 'BUSCAR TRANSACCIONES - Incio Proceso - INFORMACION RECIBIDA - Parametros de Ejecucion : '
                + JSON.stringify(parametros));

            var respuesta = new Object();
            respuesta.error = false;
            respuesta.mensaje = '';
            respuesta.informacion = new Array();
            try {

                if (!utilities.isEmpty(parametros) && !utilities.isEmpty(parametros.ssTransaccionesPendCAE)) {
                    var objResultSet = '';


                    objResultSet = utilities.searchSavedPro(parametros.ssTransaccionesPendCAE, null);

                    if (objResultSet.error) {
                        respuesta.error = true;
                        respuesta.mensaje = 'Error Consultando Transacciones A Procesar - Error : ' + objResultSet.descripcion;
                        log.error(proceso, respuesta.mensaje);
                    } else {
                        var resultSet = objResultSet.objRsponseFunction.result;
                        var resultSearch = objResultSet.objRsponseFunction.search;

                        if (!utilities.isEmpty(resultSet) && resultSet.length > 0) {
                            for (var i = 0; !utilities.isEmpty(resultSet) && i < resultSet.length; i++) {
                                infoTransaccion = new Object();
                                infoTransaccion.id = resultSet[i].getValue({ name: resultSearch.columns[0] });
                                infoTransaccion.tipo = resultSet[i].getValue({ name: resultSearch.columns[1] });
                                infoTransaccion.tranName = resultSet[i].getValue({ name: resultSearch.columns[2] });

                                if (!utilities.isEmpty(infoTransaccion.id) && !utilities.isEmpty(infoTransaccion.tipo) && !utilities.isEmpty(infoTransaccion.tranName)) {
                                    respuesta.informacion.push(infoTransaccion);
                                }
                            }
                        }
                    }
                }
                else {
                    // Error no se recibieron parametros de consulta de Transacciones A Procesar
                    respuesta.error = true;
                    respuesta.mensaje = 'Error Consultando Transacciones A Procesar - No se recibio la siguiente informacion requerida : ';
                    if (utilities.isEmpty(parametros)) {
                        respuesta.mensaje += ' / Objeto con Informacion de Parametros de Ejecucion';
                    }
                    else {
                        if (utilities.isEmpty(parametros.ssTransaccionesPendCAE)) {
                            respuesta.mensaje += ' / Busqueda Guardada a utilizar para la consulta de Transacciones';
                        }
                    }
                }
            }
            catch (e) {
                respuesta.error = true;
                respuesta.mensaje = 'Excepcion Consultando Transacciones A Procesar - Descripcion : ' + JSON.stringify(e.message);
                return respuesta;
            }
            log.debug(proceso, 'BUSCAR TRANSACCIONES - Fin Proceso - INFORMACION RESPUESTA :  ' + JSON.stringify(respuesta));
            return respuesta;
        }

        function generarCAE(currScript, parametrosEjecucion, paramRecType, paramRecId, paramRecTranName, context) {

            let process = 'Generar Folio'
            let codigoEstadoError = parametrosEjecucion.codigoEstadoError;
            let codigoEstadoSinError = parametrosEjecucion.codigoEstadoSinError;
            let recType = paramRecType
            let recId = paramRecId;
            let currentScript = currScript
            log.debug(process, 'GENERAR CAE - Incio Proceso - INFORMACION RECIBIDA - Tipo de Transaccion : '
                + paramRecType + ' - ID de Transaccion : ' + paramRecId + ' - Name Transaction: ' + paramRecTranName);
            let recordTransaction = '';

            recordTransaction = record.load({
                type: paramRecTranName,
                id: recId,
                isDynamic: true
            });

            log.debug(process, 'INICIO -  Generar Folio - unidades disponibles: ' + currentScript.getRemainingUsage() + ' - time: ' + new Date() + ' - recId: ' + paramRecId + ' - recType: ' + paramRecType);
            log.audit(process, 'que tiene recordTransaction: ' + JSON.stringify(recordTransaction));
            
            //let folio = recordTransaction.getValue({ fieldId: 'custbody_zim_fe_cl_folio' });
            let subsidiary = recordTransaction.getValue({ fieldId: 'subsidiary' });
            let isOW = runtime.isFeatureInEffect("SUBSIDIARIES");
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
                mensaje = 'Error Consultando searchSavedPro Generar Folio - customsearch_l56_config_proveedor_fe - Detalles del Error: ' + objResultSet.descripcion;
                log.error(process, 'Error: ' + mensaje);
                grabarError(codigoEstadoError, mensaje, refLog, refTransaccion, null);

            } else if ((!utilities.isEmpty(resultSet)) && (resultSet.length > 0)) {
                dirArchPDF = resultSet[0].getValue({ name: resultSearch.columns[12] }, '');
                empleadoParaEmail = resultSet[0].getValue({ name: resultSearch.columns[10] }, '');
                imprimeProvFE = resultSet[0].getValue({ name: resultSearch.columns[11] }, '');

                try {
                    //loguear 2 variab
                    log.debug(process, 'dirArchPDF: ' + dirArchPDF + 'imprimeProvFE: ' + imprimeProvFE);

                    // comienza generacion de folio...

                    log.debug(process, "INICIO - Generar Folio - unidades disponibles: " + currentScript.getRemainingUsage() + ' --- time: ' + new Date());
                    //var currentContext = currentRecord.get();


                    var refTransaccion = recId;
                    var refLog = '';
                    var infoAuxiliarFolio = '';


                    var docXML = recordTransaction.getValue({ fieldId: 'custbody_l56_cl_doc_electro' });
                    var idXMLFE = docXML;
                    var folio = recordTransaction.getValue({ fieldId: 'custbody_zim_fe_cl_folio' });
                    var mensaje = '';

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
                                    returnExternalUrl: true

                                });

                                var idTransaccion = recId;
                                if (recType == 'CUSTINVC') {
                                    recType = 'transaction'
                                }
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
                                    mensaje = "Error obteniendo información de Suitelet generador de Folio - Respuesta OBJECT: nula/vacía";
                                    log.error(process, mensaje);
                                    grabarError(codigoEstadoError, mensaje, refLog, refTransaccion, null);

                                    return false;
                                }

                                if (!utilities.isEmpty(response)) {
                                    log.debug(process, 'Response Suitelet body: ' + JSON.stringify(response.body));
                                    var informacionRespuestaAux = JSON.parse(response.body);

                                    log.debug(process, 'Response informacionRespuestaAux: ' + JSON.stringify(informacionRespuestaAux));

                                    if (utilities.isEmpty(informacionRespuestaAux)) {
                                        mensaje = "Error obteniendo información de Suitelet generador de Folio - Respuesta body: nula/vacía";
                                        log.error(process, mensaje);
                                        grabarError(codigoEstadoError, mensaje, refLog, refTransaccion, null);

                                        return false;
                                    } else if (!informacionRespuestaAux.success) {
                                        mensaje = 'Error en el proceso de generación de Folio - Detalles: ' + informacionRespuestaAux.message;
                                        log.error(process, mensaje);
                                        grabarError(codigoEstadoError, mensaje, refLog, refTransaccion, null);

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
                                            if (!utilities.isEmpty(tipoComprobanteElectronico)) {
                                                var obj_type = search.lookupFields({
                                                    type: 'customrecord_zim_cl_tipo_documento',
                                                    id: tipoComprobanteElectronico,
                                                    columns: ['custrecord_zim_cl_tipo_doc_cod']
                                                });
                                                log.debug(process, "Tipo Doc = " + JSON.stringify(obj_type));

                                                codigoComprobanteElectronico = obj_type.custrecord_zim_cl_tipo_doc_cod;
                                            }

                                            var tranID = recordTransaction.getValue({ fieldId: 'tranid' });

                                            // grabarDatosFolio(informacionRespuestaAux, codigoEstadoSinError, codigoEstadoError, FOLIOGENERADO, recType, recId, mensaje, refLog, refTransaccion, idXMLFE)
                                            grabarDatosFolio(informacionRespuestaAux, codigoEstadoSinError, codigoEstadoError, FOLIOGENERADO, recType, recId, mensaje, refLog, refTransaccion, idXMLFE, codigoComprobanteElectronico, tranID)
                                        }
                                    }
                                }
                            } else {
                                mensaje = "La transacción ya posee Folio.";
                                //
                                log.error(process, mensaje);
                                grabarError(codigoEstadoError, mensaje, refLog, refTransaccion, null);
                            }
                        } else {
                            mensaje = "La transacción no posee asociado el XML con los datos para generar el folio, proceda a editar la transacción y a guardarla nuevamente para posteriormente generar el Folio";
                            //
                            log.error(process, mensaje);
                            grabarError(codigoEstadoError, mensaje, refLog, refTransaccion, null);
                        }
                    } catch (error) {
                        mensaje = 'Excepción inesperada en la función generarFolio - Detalles: ' + error;
                        log.error(process, mensaje);
                        grabarError(codigoEstadoError, mensaje, refLog, refTransaccion, null);

                    }
                    log.debug(process, "FIN - Generar Folio (CL) - unidades disponibles: " + currentScript.getRemainingUsage() + ' --- time: ' + new Date());
                } catch (error) {
                    mensaje = 'Excepción inesperada en la función generarFolio - Detalles: ' + error;
                    log.error(process, mensaje);
                    grabarError(codigoEstadoError, mensaje, refLog, refTransaccion, null);
                }
            }


        }

        // function grabarDatosFolio(informacionRespuestaAux, codigoEstadoSinError, codigoEstadoError, FOLIOGENERADO, recType, recId, mensaje, refLog, refTransaccion, idXMLFE) {
        function grabarDatosFolio(informacionRespuestaAux, codigoEstadoSinError, codigoEstadoError, FOLIOGENERADO, recType, recId, mensaje, refLog, refTransaccion, idXMLFE, codigoComprobanteElectronico, tranIDOriginal) {

            var proceso = 'grabarDatosFolio';
            log.debug(proceso, 'INICIO - grabarDatosFolio');
            var mensajeFinal = '';

            if (FOLIOGENERADO == true && !utilities.isEmpty(informacionRespuestaAux.folio) && informacionRespuestaAux.folio != "0" && informacionRespuestaAux.folio != 0) {

                log.debug(proceso, 'Generación de Folio OK - informacionRespuestaAux: ' + JSON.stringify(informacionRespuestaAux));
                mensajeFinal = 'Se ha generado correctamente el folio para la transacción. Número de folio: ' + informacionRespuestaAux.folio + '. Recargue la página y visualice el detalle en la subficha CHL-Facturación Electrónica.';
                grabarError(codigoEstadoSinError, mensajeFinal, refLog, refTransaccion, idXMLFE);

                log.debug(proceso, 'INICIO - actualizar el Record Transaccion');
                // Grabo el Record Trnasaccion
                if (recType === 'CustInvc') {
                    recType = 'invoice'

                }
                if (recType === 'CustCred') {
                    recType = 'creditmemo'

                }

                var tranID = tranIDOriginal;
                
                if(!utilities.isEmpty(codigoComprobanteElectronico)){
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

            //alert_msg(mensajeFinal);
        }


        function verificarCAETransaccionDetalleLogFE(recordTransaction) {

            var proceso = 'verificarCAETransaccionDetalleLogFE';
            var response = { error: false, mensaje: '', informacionCAE: '', poseeCAE: false };

            log.debug(proceso, 'INICIO - verificarCAETransaccionDetalleLogFE');

            try {
                var cantDetalleLog = recordTransaction.getLineCount({ sublistId: 'recmachcustrecord_l598_fact_elec_dlog_rtrans' });
                log.debug(proceso, 'cantDetalleLog: ' + cantDetalleLog);

                for (var j = 0; j < cantDetalleLog; j++) {

                    recordTransaction.selectLine({ sublistId: 'recmachcustrecord_l598_fact_elec_dlog_rtrans', line: j });
                    var datosCAE = recordTransaction.getCurrentSublistValue({ sublistId: 'recmachcustrecord_l598_fact_elec_dlog_rtrans', fieldId: 'custrecord_l598_fact_elec_dlog_datos_cae' });
                    var caeGenerado = recordTransaction.getCurrentSublistValue({ sublistId: 'recmachcustrecord_l598_fact_elec_dlog_rtrans', fieldId: 'custrecord_l598_fact_elec_dlog_cae_gener' });

                    /* var datosCAE = recordTransaction.getSublistValue({sublistId: 'recmachcustrecord_l598_fact_elec_dlog_rtrans', fieldId: 'custrecord_l598_fact_elec_dlog_datos_cae', line: j });
                    var caeGenerado = recordTransaction.getSublistValue({ sublistId: 'recmachcustrecord_l598_fact_elec_dlog_rtrans', fieldId: 'custrecord_l598_fact_elec_dlog_cae_gener', line: j }); */

                    if (!utilities.isEmpty(datosCAE) && caeGenerado) {
                        response.informacionCAE = datosCAE;
                        response.poseeCAE = true;
                        j = cantDetalleLog;
                        break;
                    }
                }
            } catch (error) {
                response.mensaje = 'Error al extraer información de CAE del RT URU-Factura Electronica Detalle Log - Detalles: ' + error.message;
                response.error = true;
                log.error(proceso, response.mensaje);
            }

            log.debug(proceso, 'FIN - verificarCAETransaccionDetalleLogFE');
            return response;
        }

        function agruparInformacionCAE(infoEnviadaAFIP, descripcionErrorFinal, fechaSolicitudAFIPFinal, fechaRespuestaAFIPFinal, codigoSeguridad, urlVerificacion, urlVerificacionQR, caeNumero, caeSerie, fechaFirma, caeNroInicial, caeNroFinal, resolucionIVA, correspondeSobre, CAE, CAEVencimientoFinal, codigoBarras) {

            var proceso = 'agruparInformacionCAE';
            var informacionCAE = {};

            try {
                informacionCAE.infoEnviadaAFIP = infoEnviadaAFIP;
                informacionCAE.descripcionErrorFinal = descripcionErrorFinal;
                informacionCAE.fechaSolicitudAFIPFinal = fechaSolicitudAFIPFinal;
                informacionCAE.fechaRespuestaAFIPFinal = fechaRespuestaAFIPFinal;
                informacionCAE.codigoSeguridad = codigoSeguridad;
                informacionCAE.urlVerificacion = urlVerificacion;
                informacionCAE.urlVerificacionQR = urlVerificacionQR;
                informacionCAE.caeNumero = caeNumero;
                informacionCAE.caeSerie = caeSerie;
                informacionCAE.fechaFirma = fechaFirma;
                informacionCAE.caeNroInicial = caeNroInicial;
                informacionCAE.caeNroFinal = caeNroFinal;
                informacionCAE.resolucionIVA = resolucionIVA;
                informacionCAE.correspondeSobre = correspondeSobre;
                informacionCAE.CAE = CAE;
                informacionCAE.CAEVencimientoFinal = CAEVencimientoFinal;
                informacionCAE.codigoBarras = codigoBarras;
            } catch (error) {
                log.error(proceso, 'Error al agrupar información de CAE - Detalles: ' + error.message);
            }

            return informacionCAE;
        }

        function grabarDatosCAE(informacionCAE, recType, recordTransaction, CAEGENERADO, codigoEstadoSinError, tipoMensajeSinError, erroresRespuesta, punto_venta, tipoTransaccion, refLog, refTransaccion, serie, informacionAuxiliarCAE, codigoEstadoError, tipoMensajeErrorCAE, recId) {

            var proceso = 'grabarDatosCAE';

            log.debug(proceso, 'INICIO - grabarDatosCAE');

            if (CAEGENERADO == true && !utilities.isEmpty(informacionCAE.CAE) && informacionCAE.CAE != "0" && informacionCAE.CAE != 0) {
                log.debug(proceso, 'Generación de CAE OK.');
                grabarError(codigoEstadoSinError, tipoMensajeSinError, erroresRespuesta, punto_venta, tipoTransaccion, refLog, refTransaccion, serie, informacionAuxiliarCAE, recordTransaction);
            } else {
                log.debug(proceso, 'Generación de CAE NULL.');
                grabarError(codigoEstadoError, tipoMensajeErrorCAE, erroresRespuesta, punto_venta, tipoTransaccion, refLog, refTransaccion, serie, '', recordTransaction);
            }

            if (recType != 'customtransaction_l598_resguardos') {
                recordTransaction.setValue({ fieldId: 'custbody_l598_cae_envio_dgi', value: informacionCAE.infoEnviadaAFIP });
                recordTransaction.setValue({ fieldId: 'custbody_l598_cae_respuesta_dgi', value: informacionCAE.descripcionErrorFinal });
                recordTransaction.setValue({ fieldId: 'custbody_l598_cae_fecha_hora_envio', value: informacionCAE.fechaSolicitudAFIPFinal });
                recordTransaction.setValue({ fieldId: 'custbody_l598_cae_fecha_hora_respuesta', value: informacionCAE.fechaRespuestaAFIPFinal });
                recordTransaction.setValue({ fieldId: 'custbody_l598_codigo_seguridad', value: informacionCAE.codigoSeguridad });
                recordTransaction.setValue({ fieldId: 'custbody_l598_url_verificacion', value: informacionCAE.urlVerificacion });
                recordTransaction.setValue({ fieldId: 'custbody_l598_url_verif_qr', value: informacionCAE.urlVerificacionQR });
                recordTransaction.setValue({ fieldId: 'custbody_l598_cae_nro', value: informacionCAE.caeNumero });
                recordTransaction.setValue({ fieldId: 'custbody_l598_cae_serie', value: informacionCAE.caeSerie });
                recordTransaction.setValue({ fieldId: 'custbody_l598_fecha_firma', value: informacionCAE.fechaFirma });
                recordTransaction.setValue({ fieldId: 'custbody_l598_cae_nro_inicial', value: informacionCAE.caeNroInicial });
                recordTransaction.setValue({ fieldId: 'custbody_l598_cae_nro_final', value: informacionCAE.caeNroFinal });
                recordTransaction.setValue({ fieldId: 'custbody_l598_resolucion_iva', value: informacionCAE.resolucionIVA });
                recordTransaction.setValue({ fieldId: 'custbody_l598_corresponde_sobre', value: informacionCAE.correspondeSobre });
                recordTransaction.setValue({ fieldId: 'custbody_l598_cae', value: informacionCAE.CAE });
                recordTransaction.setValue({ fieldId: 'custbody_l598_cae_vto', value: informacionCAE.CAEVencimientoFinal });
                recordTransaction.setValue({ fieldId: 'custbody_l598_codigo_qr', value: informacionCAE.codigoBarras });
            }

            if (!utilities.isEmpty(informacionCAE.CAE) && recType == 'customtransaction_l598_resguardos') {
                //recordTransaction.setValue({ fieldId: 'transtatus', value: 'B' });
                var cantDetalleRet = recordTransaction.getLineCount({ sublistId: 'recmachcustrecord_l598_ret_detalle_resguardo' });
                log.debug(proceso, 'cantDetalleRet: ' + cantDetalleRet);

                for (var j = 0; j < cantDetalleRet; j++) {
                    try {
                        recordTransaction.selectLine({ sublistId: 'recmachcustrecord_l598_ret_detalle_resguardo', line: j });
                        recordTransaction.setCurrentSublistValue({ sublistId: 'recmachcustrecord_l598_ret_detalle_resguardo', fieldId: 'custrecord_l598_ret_detalle_status_resgu', value: 'B', ignoreFieldChange: false });
                        recordTransaction.commitLine({ sublistId: 'recmachcustrecord_l598_ret_detalle_resguardo' });
                    } catch (e) {
                        log.error(proceso, 'ERROR ESTABLECIENDO ESTADO DE RESGUARDO DETALLE: ' + JSON.stringify(e));
                    }
                }
                recordTransaction.save();
            }

            log.debug(proceso, 'LINE 279 - Antes de grabar el Record Transaccion');

            // Grabo el Record Trnasaccion
            if (recType == 'customtransaction_l598_resguardos') {
                var idTransaccionFinal = record.submitFields({
                    type: recType,
                    id: recId,
                    values: {
                        transtatus: 'B',
                        custbody_l598_cae_envio_dgi: informacionCAE.infoEnviadaAFIP,
                        custbody_l598_cae_respuesta_dgi: informacionCAE.descripcionErrorFinal,
                        custbody_l598_cae_fecha_hora_envio: informacionCAE.fechaSolicitudAFIPFinal,
                        custbody_l598_cae_fecha_hora_respuesta: informacionCAE.fechaRespuestaAFIPFinal,
                        custbody_l598_codigo_seguridad: informacionCAE.codigoSeguridad,
                        custbody_l598_url_verificacion: informacionCAE.urlVerificacion,
                        custbody_l598_url_verif_qr: informacionCAE.urlVerificacionQR,
                        custbody_l598_cae_nro: informacionCAE.caeNumero,
                        custbody_l598_cae_serie: informacionCAE.caeSerie,
                        custbody_l598_fecha_firma: informacionCAE.fechaFirma,
                        custbody_l598_cae_nro_inicial: informacionCAE.caeNroInicial,
                        custbody_l598_cae_nro_final: informacionCAE.caeNroFinal,
                        custbody_l598_resolucion_iva: informacionCAE.resolucionIVA,
                        custbody_l598_corresponde_sobre: informacionCAE.correspondeSobre,
                        custbody_l598_cae: informacionCAE.CAE,
                        custbody_l598_cae_vto: informacionCAE.CAEVencimientoFinal,
                        custbody_l598_codigo_qr: informacionCAE.codigoBarras
                    },
                    options: {
                        enablesourcing: false,
                        ignoreMandatoryFields: true
                    }
                });
            } else {
                var idTransaccionFinal = recordTransaction.save();
            }

            log.debug(proceso, 'FIN - grabarDatosCAE - idTransaccionFinal: ' + idTransaccionFinal);
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

        function handleErrorAndSendNotification(e, stage) {
            log.error('Estado : ' + stage + ' Error', e);

            var author = runtime.getCurrentUser().id;
            var recipients = runtime.getCurrentUser().id;
            var subject = proceso + " : " + runtime.getCurrentScript().id + ' Error en Estado : ' + stage;
            var body = 'Ocurrio un error con la siguiente informacion : \n' +
                'Codigo de Error: ' + e.name + '\n' +
                'Mensaje de Error: ' + e.message;

            email.send({
                author: author,
                recipients: recipients,
                subject: subject,
                body: body
            });
        }

        function handleErrorIfAny(summary) {
            var inputSummary = summary.inputSummary;
            var mapSummary = summary.mapSummary;
            var reduceSummary = summary.reduceSummary;

            if (inputSummary.error) {
                var e = error.create({
                    name: 'INPUT_STAGE_FAILED',
                    message: inputSummary.error
                });
                handleErrorAndSendNotification(e, 'getInputData');
            }

            handleErrorInStage('map', mapSummary);
            handleErrorInStage('reduce', reduceSummary);
        }

        function handleErrorInStage(stage, summary) {
            var errorMsg = [];
            summary.errors.iterator().each(function (key, value) {
                var msg = 'Error: ' + key + '. Error was: ' + JSON.parse(value).message + '\n';
                errorMsg.push(msg);
                return true;
            });
            if (errorMsg.length > 0) {
                var e = error.create({
                    name: 'ERROR_CUSTOM',
                    message: JSON.stringify(errorMsg)
                });
                handleErrorAndSendNotification(e, stage);
            }
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

            var txId = params.transactionId;
            var txObject = params.transactionRecord;

            var isOneWorld = runtime.isFeatureInEffect({
                feature: "SUBSIDIARIES"
            });

            var regionEmi, comunaEmi, provinciaEmi;
            if (isOneWorld) {
                var recSubsi = search.lookupFields({
                    type: search.Type.SUBSIDIARY,
                    id: txObject.getValue('subsidiary'),
                    columns: ['address.custrecord_zim_region', 'address.custrecord_zim_comuna', 'address.custrecord_zim_provincia']
                });

                log.debug('inject', 'recSubsi lookupFields: ' + JSON.stringify(recSubsi));
                regionEmi = recSubsi["address.custrecord_zim_region"];
                comunaEmi = recSubsi["address.custrecord_zim_comuna"][0].text;
                provinciaEmi = recSubsi["address.custrecord_zim_provincia"][0].text;
            } else {
                var configCompany = config.load({
                    type: config.Type.COMPANY_INFORMATION
                });
                var addressCompany = configCompany.getSubrecord({
                    fieldId: 'mainaddress'
                });
                regionEmi = addressCompany.getText('custrecord_zim_region');
                comunaEmi = addressCompany.getText('custrecord_zim_comuna');
                provinciaEmi = addressCompany.getText('custrecord_zim_provincia');
            }

            var obj_supplier = {};
            obj_supplier.region = regionEmi;
            obj_supplier.comuna = comunaEmi;
            obj_supplier.provincia = provinciaEmi;

            var obj_injection = {};
            obj_injection.supplier = obj_supplier;

            recType = txObject.getValue('type');
            obj_injection.reference = recType;

            if (recType.toLowerCase() == 'itemship') {
                var orderType = txObject.getValue('ordertype');
                var obj_ref = {};
                if (orderType.toLowerCase() == 'salesord') {
                    var recSO = search.lookupFields({
                        type: 'salesorder',
                        id: txObject.getValue('createdfrom'),
                        columns: ['billingaddress.custrecord_zim_region', 'billingaddress.custrecord_zim_comuna', 'billingaddress.address1']
                    });
                    billAddressSO = recSO["billingaddress.address1"];
                    billRegionSO = recSO["billingaddress.custrecord_zim_region"];
                    billComunaSO = recSO["billingaddress.custrecord_zim_comuna"][0].text;
                    obj_ref.address = billAddressSO;
                    obj_ref.region = billRegionSO;
                    obj_ref.comuna = billComunaSO;
                } else if (orderType.toLowerCase() == 'trnfrord') {
                    shipAddressTO = txObject.getValue('shippingaddress.address1');
                    shipRegionTO = txObject.getValue('shippingaddress.custrecord_zim_region');
                    shipComunaTO = txObject.getValue('shippingaddress.custrecord_zim_comuna');
                    obj_ref.address = shipAddressTO;
                    obj_ref.region = shipRegionTO;
                    obj_ref.comuna = shipComunaTO;
                }
                obj_injection.reference = obj_ref;
            } else {
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

            return obj_injection;
        }

        /***************************** FUNCIONES AUXILIARES - FIN ********************************/

        return {
            getInputData: getInputData,
            map: map,
            reduce: reduce,
            summarize: summarize
        };
    });