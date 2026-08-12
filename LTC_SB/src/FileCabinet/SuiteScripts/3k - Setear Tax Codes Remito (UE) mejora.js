/**
 *@NApiVersion 2.1
 *@NScriptType UserEventScript
 
 */
define(
    [
        'N/record', 'N/error', 'N/search', 'N/runtime'
    ],
    (record, error, search, runtime) => {

        let beforeSubmit = (scriptContext) => {
            log.debug("Before Submit", "Log de verificacion");
        }
        /**
         * Function definition to be triggered before record is loaded.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {Record} scriptContext.oldRecord - Old record
         * @param {string} scriptContext.type - Trigger type
         * @Since 2015.2
         */
        let afterSubmit = (scriptContext) => {

            var proceso = 'afterSubmit';
            var name = 'NOTICE (SuiteScript)';

            try {

                if (scriptContext.type != scriptContext.UserEventType.DELETE) {
                    log.debug(proceso, 'INICIO - function scriptContext.type: ' + scriptContext.type);
                    let recType = scriptContext.newRecord.type;
                    let recId = scriptContext.newRecord.id;
                    let objRecord = record.load({
                        type: recType,
                        id: recId
                    })
                    let cantidadItems = objRecord.getLineCount('item');
                    let currentScript = runtime.getCurrentScript();

                    if (objRecord.type == 'invoice' || objRecord.type == 'salesorder' || objRecord.type == 'transferorder' || objRecord.type == 'vendorreturnauthorization' || objRecord.type == 'creditmemo' || objRecord.type == 'cashsale') {

                        log.debug(proceso, 'Ingreso a condicion de invoice / salesorder / transferorder / vendorreturnauthorization / cashsale / creditmemo');
                        // crear ss de tax code y luego filtrar con filter y a cada linea asignar el rate correspondiente
                        let taxDetailsQuantity = objRecord.getLineCount('taxdetails');
                        log.debug(proceso, `Line 51 - taxDetailsQuantity: ${JSON.stringify(taxDetailsQuantity)}`);
                        let arrayTaxDetails = [];

                        // Obtencion de taxCodes por taxDetails
                        for (let i = 0; i < taxDetailsQuantity; i++) {
                            let infoTaxDetail = {};
                            infoTaxDetail.taxDetailReference = objRecord.getSublistValue('taxdetails', 'taxdetailsreference', i);
                            infoTaxDetail.taxCode = objRecord.getSublistValue('taxdetails', 'taxcode', i);
                            infoTaxDetail.taxRate = objRecord.getSublistValue('taxdetails', 'taxrate', i);
                            arrayTaxDetails.push(infoTaxDetail);
                            log.debug(proceso, `line nro: ${i} / infoTaxDetail: ${JSON.stringify(infoTaxDetail)}`);
                        }

                        // Obtencion de taxCodes por items
                        if (arrayTaxDetails.length > 0) {
                            for (let i = 0; i < cantidadItems; i++) {
                                let taxDetailReferenceItem = objRecord.getSublistValue('item', 'taxdetailsreference', i);

                                let taxCodeItemResult = arrayTaxDetails.filter(obj => {
                                    return (obj.taxDetailReference == taxDetailReferenceItem)
                                });

                                log.debug(proceso, `line nro: ${i} / taxCodeItemResult: ${JSON.stringify(taxCodeItemResult)} `);

                                if (taxCodeItemResult.length > 0) {
                                    objRecord.setSublistValue('item', 'custcol_3k_rate_item_tax_code', i, taxCodeItemResult[0].taxRate);
                                } else {
                                    objRecord.setSublistValue('item', 'custcol_3k_rate_item_tax_code', i, 0);
                                }
                            }
                        } else {
                            for (let i = 0; i < cantidadItems; i++) {
                                objRecord.setSublistValue('item', 'custcol_3k_rate_item_tax_code', i, 0);
                            }
                        }
                    } else if (objRecord.type == 'itemfulfillment') {

                        log.debug(proceso, 'Ingreso a condicion de itemfulfillment');
                        let createdfrom = objRecord.getValue('createdfrom');
                        let metodoEnvio = objRecord.getValue('shipmethod');
                        let idDireccionEnvio = objRecord.getValue('shipaddresslist');

                        log.debug(proceso, `createdfrom: ${createdfrom} - metodoEnvio: ${metodoEnvio} - idDireccionEnvio: ${idDireccionEnvio}`);

                        if (!isEmpty(metodoEnvio) && !isEmpty(idDireccionEnvio) && !isEmpty(createdfrom)) {

                            let resultCreadoDesde = getDataCreatedFrom(createdfrom, objRecord.type, metodoEnvio, idDireccionEnvio);
                            log.debug(proceso, `resultCreadoDesde: ${JSON.stringify(resultCreadoDesde)}`);

                            if (!resultCreadoDesde.error) {
                                if (!isEmpty(resultCreadoDesde.taxRate)) {
                                    objRecord.setValue('custbody_3k_codigo_impu_articulo_envio', parseInt(resultCreadoDesde.taxRate, 10));
                                } else {
                                    objRecord.setValue('custbody_3k_codigo_impu_articulo_envio', 0);
                                    log.debug(proceso, 'No existe taxRate a setear en el remito');
                                }
                            } else {
                                objRecord.setValue('custbody_3k_codigo_impu_articulo_envio', 0);
                                log.error(proceso, resultCreadoDesde.mensaje);
                            }
                        } else {
                            objRecord.setValue('custbody_3k_codigo_impu_articulo_envio', 0);
                            log.debug(proceso, 'Ingreso a condicion de itemfulfillment pero no existe metodo de envio, o direccion de envio');
                        }
                    }

                    objRecord.save({ enableSourcing: false, ignoreMandatoryFields: true, disableTriggers: true });
                }

                log.debug(proceso, 'FIN - function scriptContext.type: ' + scriptContext.type);
            } catch (error) {
                log.error(proceso, 'Ocurrió un error mientras se setean los códigos de impuestos en el remito, detalles: ' + error.message);
            }
        }

        let getDataCreatedFrom = (idCreadoDesde, recordType, metodoEnvio, idDireccionEnvio) => {

            let proceso = 'getDataCreatedFrom';
            let response = { error: false, mensaje: '', taxRate: '' };

            try {
                let resultCreadoDesde = search.lookupFields({
                    type: 'transaction',
                    id: idCreadoDesde,
                    columns: 'recordtype'
                });

                log.debug(proceso, 'resultCreadoDesde: ' + JSON.stringify(resultCreadoDesde));

                if (recordType == 'itemfulfillment' && !isEmpty(resultCreadoDesde.recordtype) && (resultCreadoDesde.recordtype == 'salesorder' || resultCreadoDesde.recordtype == 'transferorder')) {
                    let recordOV = record.load({ type: resultCreadoDesde.recordtype, id: idCreadoDesde });
                    let cantidadLineasEnvio = recordOV.getLineCount('shipgroup');

                    for (let i = 0; i < cantidadLineasEnvio; i++) {
                        let shipMethod = recordOV.getSublistValue('shipgroup', 'shippingmethodref', i);
                        let shipTaxRate = parseInt(recordOV.getSublistValue('shipgroup', 'shippingtaxrate', i), 10);
                        let billingRef = recordOV.getSublistValue('shipgroup', 'destinationaddressref', i);

                        log.debug(proceso, `line i: ${i} - shipMethod: ${shipMethod} - shipTaxRate: ${shipTaxRate} - billingRef: ${billingRef}`);
                        if (metodoEnvio == shipMethod) {
                            response.taxRate = shipTaxRate;
                            i = cantidadLineasEnvio;
                            break;
                        }
                    }
                }
            } catch (error) {
                response.error = true;
                response.mensaje = `Ocurrio un error mientras se obtenian los datos de la transaccion de referencia para la parte de lineas de envio, detalles: ${error.message}`;
                log.error(proceso, response.mensaje);
            }

            return response;
        }

        let getResultsSalesTaxItem = () => {

            let proceso = 'getResultsSalesTaxItem';
            let response = { error: false, mensaje: '', infoResultados: [] };

            try {
                let objResultSet = search.load({
                    id: 'customsearch_3k_scr_codigos_imp_dipisa'
                });

                /* if (!isEmpty(subsidiaria)) {
                    let filtroSubsidiaria = search.createFilter({
                        name: 'subsidiary',
                        operator: search.Operator.IS,
                        values: subsidiaria
                    });
                    objResultSet.filters.push(filtroSubsidiaria);
                } */

                var resultSet = objResultSet.run();

                var searchResult = resultSet.getRange({
                    start: 0,
                    end: 1000
                });

                if (!isEmpty(searchResult) && searchResult.length > 0) {
                    for (let i = 0; i < searchResult.length; i++) {
                        let info = {};

                        info.internalid = searchResult[i].getValue({
                            name: resultSet.columns[0]
                        }); //Get internalid

                        info.rate = parseFloat(searchResult[i].getValue({
                            name: resultSet.columns[1]
                        }), 10); //Get RATE

                        response.infoResultados.push(info);
                    }
                } else {
                    log.error(proceso, 'No se encontró ningún resultado de código de impuesto');
                }
            } catch (error) {
                response.error = true;
                response.mensaje = 'Error NetSuite - Excepción mientras se obtenían los códigos de impuestos - Detalles: ' + error.message;
                log.error(proceso, response.mensaje);
            }

            return response;
        }

        let isEmpty = (value) => {

            return value === '' || value === null || value === undefined || value === 'null' || value === 'undefined';
        }

        return {
            afterSubmit: afterSubmit,
            beforeSubmit: beforeSubmit
        };
    });