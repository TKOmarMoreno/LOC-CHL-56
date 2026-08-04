/**
 * @NApiVersion 2.x
 * @NScriptType ClientScript
 * @NAmdConfig /SuiteScripts/configuration.json
 */

 define(['N/search', 'N/error', 'N/record', 'N/currentRecord', 'N/runtime', 'N/format', 'N/ui/dialog'],

 function (search, error, record, currentRecord, runtime, format, dialog) {

     function isEmpty(value) {

         return value === '' || value === null || value === undefined || value === 'null' || value === 'undefined';
     }

    function saveRecord(context) { //criterioEval

        var proceso = 'saveRecord';
        var isOW = runtime.isFeatureInEffect("SUBSIDIARIES");
        log.debug(proceso, 'IsOW result:  ' + isOW);

        var criterioEval = context.currentRecord;
        var recId = criterioEval.id;
        var recType = criterioEval.type;

        var i = 0;
        
        var subsidiaria = criterioEval.getValue({fieldId:'custrecord_l56_conf_prov_fe_subsidiaria'});
        
        var filters = new Array();
    
        filters[i++] = search.createFilter({
            name:'isinactive',
            operator:search.Operator.IS, 
            values : 'F' });

        /*FDS2*/
        if (!isEmpty(subsidiaria))
            filters[i++] = search.createFilter({
                name:'custrecord_l56_conf_prov_fe_subsidiaria',
                operator:search.Operator.ANYOF, 
                values : subsidiaria });
    
        if (!isEmpty(recId))
            filters[i++] = search.createFilter({
                name:'internalid',
                operator:search.Operator.NONEOF, 
                values : recId });
    
        var results = search.create({
            type: 'customrecord_l56_config_proveedor_fe',
            filters: filters,
        }).run().getRange({
            start: 0,
            end: 1000
        });

    
        if (results != null && results.length > 0) {
            
                dialog.alert({
                    title: "Mensaje de Error del Sistema",
                    message: "Solo se admite una (1) configuración de Proveedor Electrónico por subsidiaria, Por favor, verifique e intente nuevamente."
                })

                return false;

        }
    
        return true;
    }

    return {
        saveRecord : saveRecord
    };

});