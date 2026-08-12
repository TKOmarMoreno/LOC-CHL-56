/**
 * User Event
 */
/**
 * Script Description:
 */

/*******************************************************************************
 * * ZIMPLO * Esau Ocrospoma *
 * **************************************************************************
 * Date:
 * Script name:
 * Script id:
 * customer Deployment id:
 * Applied to:
 *

 ******************************************************************************/
/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 * @NModuleScope public
 */
// define(['N/search', 'N/record', 'N/error','N/runtime'],
define(['N/search', 'N/record', 'N/runtime'],

    // function(search, record, error,runtime) {
    function(search, record, runtime) {

        var getAllResults = function (searchObj) {
            var results = [];
            var searchResultSet = searchObj.run();
            var index = 0;
            var pageSize = 1000;
            var hasMore = true;
            while (hasMore) {
                var page = searchResultSet.getRange({ start: index, end: index + pageSize });
                results = results.concat(page);
                hasMore = page.length >= pageSize;
                index += pageSize;
            }
            return results;
        };

        var main = {
          beforeSubmit: function(scriptContext) {
             if(scriptContext.type=='delete' ){

               try{
                 var featuresZIM = search.lookupFields({
                        type: 'customrecord_zim_features',
                        id: 1,
                        columns: ['custrecord_zim_feature_guias_factura']
                    });
                 if(featuresZIM.custrecord_zim_feature_guias_factura){
                     var rec = scriptContext.newRecord;
                var transaRelacio = search.create({
                    type: 'customrecord_zim_fact_guias',
                    columns: ['custrecord_zim_guia_relacionada.internalid'],
                    filters: [ [ 'custrecord_zim_factura_relacion.internalid', 'is',rec.id],"AND",['custrecord_zim_factura_relacion.mainline','is',true],"AND",['custrecord_zim_guia_relacionada.mainline','is',true]]});

                // resulttransaRelacio = transaRelacio.run().getRange(0,50);
                var resulttransaRelacio = getAllResults(transaRelacio);
                if(resulttransaRelacio != null && resulttransaRelacio.length != 0){
                for (var i = 0; i < resulttransaRelacio.length; i++) {
                    // row  = resulttransaRelacio[i].columns;
                    var row = resulttransaRelacio[i].columns;
                     record.submitFields({
                       type  : 'itemfulfillment',
                       id    :  resulttransaRelacio[i].getValue(row[0]),
                       values: {custbody_zim_guia_facturada: false}
                     });
                 }

                }
                    }

              }catch(e){
                log.error("catch",e);
              }
             }
             if(scriptContext.type=='create' || scriptContext.type=='copy' || scriptContext.type=='edit'){
                try{
                    var invoice = scriptContext.newRecord;
                    var numLines = invoice.getLineCount({
                        sublistId: 'item'
                    });
                    for(var i=1;i<numLines;i++){

                        var itemtype = invoice.getSublistValue({
                            sublistId:'item',
                            fieldId:'itemtype',
                          line:i
                        });
                      if(itemtype=="Discount" ){
                         var precio= invoice.getSublistValue({
                            sublistId:'item',
                            fieldId:'amount',
                           line:i
                        });

                      invoice.setSublistValue({
                        sublistId:'item',
                        fieldId:'custcol_zim_discount_amount',
                        line:(i-1),
                        value: precio*-1
                      });
                        var porcentaje= invoice.getSublistValue({
                            sublistId:'item',
                            fieldId:'custcol_zim_discount_amount',
                           line:(i-1)
                        });

                         }


                    } // fin for(var i=0;i<numLines;i++){
                }catch(e){
                    log.error('beforeSubmit', e);
                }
             }
          },
            afterSubmit: function(scriptContext) {
               try{


            if(scriptContext.type=='create' || scriptContext.type=='copy'){
                     var rec = scriptContext.newRecord;
                     var salesOrderid = rec.getValue('createdfrom');
              		 var formulario = rec.getValue('customform');
              var featuresZIM = search.lookupFields({
                        type: 'customrecord_zim_features',
                        id: 1,
                        columns: ['custrecord_zim_feature_guias_factura','custrecord_zim_feature_agrupacion']
                    });
                if(featuresZIM.custrecord_zim_feature_guias_factura){
                  if(salesOrderid!=null ){

                     var transa = search.create({
                    type: 'transaction',
                    columns: [search.createColumn({name : 'fulfillingtransaction',summary: "GROUP"})],
                    filters: [  ["internalid","is",salesOrderid],
                                "AND",
                                ["fulfillingtransaction.type","anyof","ItemShip"],
                                "AND",
                                ["fulfillingtransaction.custbody_zim_guia_facturada","is","F"]
                              ]});

                	// resultTransa = transa.run().getRange(0,50);
                	var resultTransa = getAllResults(transa);
                    if(resultTransa != null && resultTransa.length != 0){
                      for (var i = 0; i < resultTransa.length; i++) {
                        // row  = resultTransa[i].columns;
                        var row = resultTransa[i].columns;
                          	// factvs=record.create({type: 'customrecord_zim_fact_guias'});
                          	var factvs=record.create({type: 'customrecord_zim_fact_guias'});
                             record.submitFields({
                                type  : 'itemfulfillment',
                                id    : resultTransa[i].getValue(row[0]),
                                values: {custbody_zim_guia_facturada: true}
                            });
                            factvs.setValue('custrecord_zim_guia_relacionada',resultTransa[i].getValue(row[0]));
                            factvs.setValue('custrecord_zim_factura_relacion',rec.id);
                            factvs.save();
                      }
                    }

                  }
                }
              if(featuresZIM.custrecord_zim_feature_agrupacion){
                if(rec.getValue('custbody_zim_factura_agrupada')){
                    /*var mySearch = search.load({
                        id: 'customsearch_ma_detalle_factura_agrupada'
                    });*/
                  var mySearch = search.create({
                   type: "transaction",
                   filters:
                   [
                      ["taxline","is","F"],
                      "AND",
                      ["item","noneof","@NONE@"]
                   ],
                   columns:
                   [
                      search.createColumn({
                         name: "custcol_zim_criterio_agrupacion_factu",
                         summary: "GROUP",
                         label: "DESCRIPCION"
                      }),
                      search.createColumn({
                         name: "quantity",
                         summary: "SUM",
                         label: "CANTIDAD"
                      }),
                      search.createColumn({
                         name: "formulanumeric",
                         summary: "SUM",
                         formula: "SUM({netamountnotax})/SUM({quantity})",
                         label: "PRECIO"
                      }),
                      search.createColumn({
                         name: "taxcode",
                         summary: "GROUP",
                         label: "COD IMPUESTO"
                      }),
                      search.createColumn({
                         name: "taxamount",
                         summary: "SUM",
                         label: "IMPUESTO"
                      }),
                      search.createColumn({
                         name: "netamountnotax",
                         summary: "SUM",
                         label: "SUBTOTAL"
                      }),
                      search.createColumn({
                         name: "formulanumeric",
                         summary: "SUM",
                         formula: "{netamount}-{taxamount}",
                         label: "TOTAL"
                      }),
                      search.createColumn({
                         name: "unit",
                         summary: "GROUP",
                         label: "Units"
                      }),
                      search.createColumn({
                         name: "unitabbreviation",
                         summary: "GROUP",
                         label: "Units"
                      })
                   ]
                });
                    var filters = mySearch.filters;

                      var filter = search.createFilter({
                          name: 'internalid',
                          operator: search.Operator.ANYOF,
                          values: rec.id
                      });
                      //filters.push(filterOne);
                      filters.push(filter);
                     // resultTransa = mySearch.run().getRange(0,50);
                     var resultTransa = getAllResults(mySearch);
                        if(resultTransa != null && resultTransa.length != 0){
                          for (var i = 0; i < resultTransa.length; i++) {
                            // row  = resultTransa[i].columns;
                            var row = resultTransa[i].columns;


                              // factvs=record.create({type: 'customrecord_zim_articulos_agrupados'});
                              var factvs=record.create({type: 'customrecord_zim_articulos_agrupados'});
                        factvs.setValue('custrecord_zim_agrupacion_factura',rec.id);
                            factvs.setValue('custrecord_zim_agrupacion_grupo',resultTransa[i].getValue(row[0]));
                        factvs.setValue('custrecord_zim_agrupacion_cantidad',resultTransa[i].getValue(row[1]));
                            factvs.setValue('custrecord_zim_agrupacion_precio',resultTransa[i].getValue(row[2]));
                            factvs.setValue('custrecord_zim_agrupacion_impuesto',resultTransa[i].getValue(row[3]));
                            factvs.setValue('custrecord_zim_agrupacion_impuesto_monto',resultTransa[i].getValue(row[4]));
                            factvs.setValue('custrecord_zim_agrupacion_subtotal',resultTransa[i].getValue(row[5]));
                            factvs.setValue('custrecord_zim_agrupacion_total',resultTransa[i].getValue(row[6]));
                            factvs.setValue('custrecord_zim_agrupacion_unidad',resultTransa[i].getValue(row[7]));
                            factvs.setValue('custrecord_zim_unidad_abreviatura',resultTransa[i].getValue(row[8]));

                                factvs.save();


                          }
                        }
                  }
              }

            }
              }
            catch(e){
              log.error(e);
            }
            // if(scriptContext.type=='create' || scriptContext.type=='copy' || scriptContext.type=='edit'){
            //     var invoice = scriptContext.newRecord;
            //     var invoice = record.load({
            //             "type": record.Type.INVOICE,
            //             "id": invoice.id
            //             //"isDynamic": true
            //           });
            //     var numLines = invoice.getLineCount({
            //         sublistId: 'item'
            //     });
            //     for(var i=1;i<numLines;i++){
            //
            //         var itemtype = invoice.getSublistValue({
            //             sublistId:'item',
            //             fieldId:'itemtype',
            //           line:i
            //         });
            //       if(itemtype=="Discount" ){
            //          var precio= invoice.getSublistValue({
            //             sublistId:'item',
            //             fieldId:'amount',
            //            line:i
            //         });
            //
            //       invoice.setSublistValue({
            //         sublistId:'item',
            //         fieldId:'custcol_zim_discount_amount',
            //         line:(i-1),
            //         value: precio*-1
            //       });
            //         var porcentaje= invoice.getSublistValue({
            //             sublistId:'item',
            //             fieldId:'custcol_zim_discount_amount',
            //            line:(i-1)
            //         });
            //
            //          }
            //
            //
            //     } // fin for(var i=0;i<numLines;i++){
            //     invoice.save();
            // }// if(scriptContext.type=='create' || scriptContext.type=='copy'){

            }
        };

        return main;
    });
