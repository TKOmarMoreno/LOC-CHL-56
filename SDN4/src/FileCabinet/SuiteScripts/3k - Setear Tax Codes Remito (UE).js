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

                    if (objRecord.type == 'invoice' || objRecord.type == 'salesorder' || objRecord.type == 'transferorder' || objRecord.type == 'vendorreturnauthorization' || objRecord.type == 'creditmemo' || objRecord.type == 'cashsale' || objRecord.type == 'vendorbill') {

                        log.debug(proceso, 'Ingreso a condicion de invoice / salesorder / transferorder / vendorreturnauthorization / cashsale / creditmemo / vendorbill');
                        // crear ss de tax code y luego filtrar con filter y a cada linea asignar el rate correspondiente
                        const taxDetailsQuantity = objRecord.getLineCount('taxdetails');
                        log.debug(proceso, `Line 51 - taxDetailsQuantity: ${JSON.stringify(taxDetailsQuantity)}`);
                        const arrayTaxDetails = [];

                        // Obtencion de taxCodes por taxDetails
                        for (let i = 0; i < taxDetailsQuantity; i++) {
                            const infoTaxDetail = {};
                            infoTaxDetail.taxDetailReference = objRecord.getSublistValue('taxdetails', 'taxdetailsreference', i);
                            infoTaxDetail.taxCode = objRecord.getSublistValue('taxdetails', 'taxcode', i);
                            infoTaxDetail.taxRate = objRecord.getSublistValue('taxdetails', 'taxrate', i);
                            arrayTaxDetails.push(infoTaxDetail);
                            log.debug(proceso, `line nro: ${i} / infoTaxDetail: ${JSON.stringify(infoTaxDetail)}`);
                        }

                        log.debug(proceso, `arrayTaxDetails: ${JSON.stringify(arrayTaxDetails)}`);

                        setearColumnasConTaxDetails("item", objRecord, arrayTaxDetails, taxDetailsQuantity);
                        setearColumnasConTaxDetails("expense", objRecord, arrayTaxDetails, taxDetailsQuantity);

                        // desaplicarYAplicarNC(recType, objRecord);

                        const idRec = objRecord.save();

                        log.debug(proceso, `FIN - afterSubmit / id interno: ${idRec} / type: ${scriptContext.newRecord.type}`);

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

        /**
         * 
         * @param {"item" | "expense"} tipoLista 
         * @param {*} objRecord 
         * @param {*} arrayTaxDetails 
         */
        function setearColumnasConTaxDetails(tipoLista, objRecord, arrayTaxDetails, taxDetailsQuantity) {
            const proceso = "setearColumnasConTaxDetails";
            log.debug(proceso + " entrar", tipoLista);
            // Obtencion de taxCodes por items
            if (arrayTaxDetails.length > 0) {
                const listaQuantity = objRecord.getLineCount({
                    sublistId: tipoLista
                });

                log.debug(proceso, `${tipoLista}Quantity: ${listaQuantity} / taxDetailsQuantity: ${taxDetailsQuantity}`);
                if (listaQuantity > 0) {
                    for (let i = 0; i < listaQuantity; i++) {

                        const taxDetailReferenceItem = objRecord.getSublistValue(tipoLista, "taxdetailsreference", i);
                        const itemInGroup = objRecord.getSublistValue(tipoLista, "ingroup", i);
                        const taxCodeItemResult = arrayTaxDetails.filter(obj => { return (obj.taxDetailReference == taxDetailReferenceItem); });
                        const itemType = objRecord.getSublistValue(tipoLista, "itemtype", i);
                        log.debug(proceso, `line nro: ${i} / taxCodeItemResult: ${JSON.stringify(taxCodeItemResult)} / itemType: ${itemType} / itemInGroup: ${itemInGroup}`);

                        if (!isEmpty(taxCodeItemResult) && taxCodeItemResult.length > 0) {

                            objRecord.setSublistValue(tipoLista, "custcol_l56_codigo_impuesto", i, taxCodeItemResult[0].taxCode);
                            objRecord.setSublistValue(tipoLista, "custcol_3k_rate_item_tax_code", i, taxCodeItemResult[0].taxRate);

                            if (!isEmpty(itemInGroup) && (itemInGroup == "T" || itemInGroup == true)) {

                                const beforeLine = i - 1;
                                const itemTypeItemBefore = objRecord.getSublistValue(tipoLista, "itemtype", beforeLine);
                                log.debug(proceso, `beforeLine: ${beforeLine} / itemTypeItemBefore: ${itemTypeItemBefore}`);

                                if (itemTypeItemBefore == "Group") {
                                    objRecord.setSublistValue(tipoLista, "custcol_l56_codigo_impuesto", beforeLine, taxCodeItemResult[0].taxCode);
                                    objRecord.setSublistValue(tipoLista, "custcol_3k_rate_item_tax_code", beforeLine, taxCodeItemResult[0].taxRate);
                                }
                            }
                        } else if (itemType == "Discount" && i > 0) {
                            // Verificacion de si es mayor a la primera posicion para verificar si es descuento.
                            // Esto se realiza porque el descuento no se refleja en el tax details.

                            const taxCodeLineItemBefore = objRecord.getSublistValue(tipoLista, "custcol_l56_codigo_impuesto", i - 1);
                            const taxRateLineItemBefore = objRecord.getSublistValue(tipoLista, "custcol_3k_rate_item_tax_code", i - 1);

                            objRecord.setSublistValue(tipoLista, "custcol_l56_codigo_impuesto", i, taxCodeLineItemBefore);
                            objRecord.setSublistValue(tipoLista, "custcol_3k_rate_item_tax_code", i, taxRateLineItemBefore);

                        } else {
                            log.error(proceso, `No se encuentra resultado de tax reference y tax code en la linea de articulos nro: ${i} / taxDetailsReference: ${taxDetailReferenceItem}, verifique por favor.`);
                        }
                    }   
                }

                /*for (let i = 0; i < listaQuantity; i++) {
                    log.debug(proceso, `indice: ${i} / codigo impuesto: ${objRecord.getSublistValue(tipoLista, "custcol_l56_codigo_impuesto", i)} / tasa: ${objRecord.getSublistValue(tipoLista, "custcol_3k_rate_item_tax_code", i)}`);
                }¨*/
            } else {
                log.error(proceso, `No se encuentra resultado de tax details en la transaccion, verifique por favor.`);
            }

        }

        function isEmpty(val) {
            return val === "" || val === undefined || val === "undefined" || val === null || val === "null" || (val.length === 0) || (typeof val == "object" && Object.keys(val).length === 0);
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

        function desaplicarYAplicarNC(recType, objRecord) {
            const idTransApply = [];
            if (recType == "creditmemo" || recType == "vendorcredit") {
                const cantidadItems = objRecord.getLineCount({ sublistId: "apply" });
                for (let j = 0; j < cantidadItems; j++) {
                    const aplicado = objRecord.getSublistValue({ sublistId: "apply", fieldId: "apply", line: j });
                    if (aplicado == "T" || aplicado == true) {
                        const internalIdLine = objRecord.getSublistValue({ sublistId: "apply", fieldId: "internalid", line: j });
                        idTransApply.push({
                            internalId: internalIdLine,
                            line: j
                        });
                        objRecord.setSublistValue({ sublistId: "apply", fieldId: "apply", line: j, value: false });
                    }
                }

                log.debug("desaplicarYAplicarNC", "LINE 153 - idTransApply: " + JSON.stringify(idTransApply));
                if (idTransApply && idTransApply.length > 0) {
                    for (let j = 0; j < idTransApply.length; j++) {
                        log.debug("desaplicarYAplicarNC", "LINE 156 - INVOICE DATA APPLIED (T): " + idTransApply[j].internalId);
                        objRecord.setSublistValue({ sublistId: "apply", fieldId: "apply", line: idTransApply[j].line, value: true });
                    }
                }
            }
        }

        return {
            afterSubmit: afterSubmit,
            beforeSubmit: beforeSubmit
        };
    });
