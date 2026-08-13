/**
 * @NApiVersion 2.0
 * @NModuleScope Public
 */
define(['N/record', 'N/error', 'N/search'],
    function (record, error, search) {

        function isEmpty(value) {
            if (value === '') {
                return true;
            }

            if (value === null) {
                return true;
            }

            if (value === undefined) {
                return true;
            }

            if (value === 'undefined') {
                return true;
            }

            if (value === 'null') {
                return true;
            }

            return false;
        }

        function l56esOneworld() {

            var proceso = 'l56esOneworld';

            try {
                var mySS = search.create({
                    type: 'customrecord_l54_datos_impositivos_emp',
                    columns: [{
                        name: 'internalid'
                    }]
                });

                var arraySearchParams = [];

                var objParam = new Object({});
                objParam.name = 'isinactive';
                objParam.operator = search.Operator.IS;
                objParam.values = ['F'];
                arraySearchParams.push(objParam);

                var objParam2 = new Object({});
                objParam2.name = 'custrecord_l54_es_oneworld';
                objParam2.operator = search.Operator.IS;
                objParam2.values = ['T'];
                arraySearchParams.push(objParam2);

                var filtro = '';

                for (var i = 0; i < arraySearchParams.length; i++) {
                    filtro = search.createFilter({
                        name: arraySearchParams[i].name,
                        operator: arraySearchParams[i].operator,
                        values: arraySearchParams[i].values
                    });
                    mySS.filters.push(filtro);
                }

                var searchResults = mySS.runPaged();

                if (searchResults != null && searchResults.count > 0)
                    return true;
                else
                    return false;
            } catch (error) {
                log.error(proceso, 'Error consultando si la empresa es one world - Detalles: ' + error.message);
                return false;
            }
        }

        function searchSavedPro(idSavedSearch, arrayParams) {
            var objRespuesta = new Object();
            objRespuesta.error = false;
            try {
                var savedSearch = search.load({
                    id: idSavedSearch
                });

                if (!isEmpty(arrayParams) && arrayParams.length > 0) {

                    for (var i = 0; i < arrayParams.length; i++) {
                        var nombre = arrayParams[i].name;
                        arrayParams[i].operator = operadorBusqueda(arrayParams[i].operator);
                        var join = arrayParams[i].join;
                        if (isEmpty(join)) {
                            join = null;
                        }
                        var value = arrayParams[i].values;
                        if (!Array.isArray(value)) {
                            value = [value];
                        }
                        var filtroID = '';
                        if (!isEmpty(join)) {
                            filtroID = search.createFilter({
                                name: nombre,
                                operator: arrayParams[i].operator,
                                join: join,
                                values: value
                            });
                        } else {
                            filtroID = search.createFilter({
                                name: nombre,
                                operator: arrayParams[i].operator,
                                values: value
                            });
                        }
                        savedSearch.filters.push(filtroID);
                    }
                }
                var resultSearch = savedSearch.run();
                var completeResultSet = [];
                var resultIndex = 0;
                var resultStep = 1000; // Number of records returned in one step (maximum is 1000)
                var resultado; // temporary variable used to store the result set

                do {
                    // fetch one result set
                    resultado = resultSearch.getRange({
                        start: resultIndex,
                        end: resultIndex + resultStep
                    });
                    if (!isEmpty(resultado) && resultado.length > 0) {
                        if (resultIndex == 0) completeResultSet = resultado;
                        else completeResultSet = completeResultSet.concat(resultado);
                    }
                    // increase pointer
                    resultIndex = resultIndex + resultStep;
                    // once no records are returned we already got all of them
                } while (!isEmpty(resultado) && resultado.length > 0 && resultado.length == 1000)
                //} while (!isEmpty(resultado) && resultado.length > 0)
                objRsponseFunction = new Object();
                objRsponseFunction.result = completeResultSet;
                objRsponseFunction.search = resultSearch;
                var r = armarArreglosSS(completeResultSet, resultSearch);
                objRsponseFunction.array = r.array;
                objRespuesta.objRsponseFunction = objRsponseFunction;
            } catch (e) {
                objRespuesta.error = true;
                objRespuesta.tipoError = 'RORV007';
                objRespuesta.descripcion = 'function searchSavedPro: ' + e.message;
                log.error('RORV007', 'function searchSavedPro: ' + e.message);
            }
            return objRespuesta;
        }

        function armarArreglosSS(resultSet, resultSearch) {
            var array = [];
            var respuesta = new Object({});
            respuesta.error = false;
            respuesta.msj = "";
            //log.debug('armarArreglosSS', 'resultSet: ' + JSON.stringify(resultSet));
            //log.debug('armarArreglosSS', 'resultSearch: ' + JSON.stringify(resultSearch));
            try {

                for (var i = 0; i < resultSet.length; i++) {
                    var obj = new Object({});
                    obj.indice = i;
                    for (var j = 0; j < resultSearch.columns.length; j++) {
                        var nombreColumna = resultSearch.columns[j].name;
                        //log.debug('armarArreglosSS','nombreColumna inicial: '+ nombreColumna);
                        if (nombreColumna.indexOf("formula") !== -1 || !isEmpty(resultSearch.columns[j].join)) {
                            nombreColumna = resultSearch.columns[j].label;

                            //if (nombreColumna.indexOf("Formula"))
                        }
                        //log.debug('armarArreglosSS','nombreColumna final: '+ nombreColumna);
                        if (Array.isArray(resultSet[i].getValue({ name: resultSearch.columns[j] }))) {
                            //log.debug('armarArreglosSS', 'resultSet[i].getValue({ name: nombreColumna }): ' + JSON.stringify(resultSet[i].getValue({ name: nombreColumna })));
                            var a = resultSet[i].getValue({ name: resultSearch.columns[j] });
                            //log.debug('armarArreglosSS', 'a: ' + JSON.stringify(a));
                            obj[nombreColumna] = a[0].value;
                        } else {
                            //log.debug('armarArreglosSS', 'resultSet[i].getValue({ name: nombreColumna }): ' + JSON.stringify(resultSet[i].getValue({ name: nombreColumna })));
                            obj[nombreColumna] = resultSet[i].getValue({ name: resultSearch.columns[j] });
                        }

                        /*else {
   
                            if (Array.isArray(resultSet[i].getValue({ name: nombreColumna }))) {
                                //log.debug('armarArreglosSS', 'resultSet[i].getValue({ name: nombreColumna }): ' + JSON.stringify(resultSet[i].getValue({ name: nombreColumna })));
                                var a = resultSet[i].getValue({ name: nombreColumna });
                                //log.debug('armarArreglosSS', 'a: ' + JSON.stringify(a));
                                obj[nombreColumna] = a[0].value;
                            } else {
                                //log.debug('armarArreglosSS', 'resultSet[i].getValue({ name: nombreColumna }): ' + JSON.stringify(resultSet[i].getValue({ name: nombreColumna })));
                                obj[nombreColumna] = resultSet[i].getValue({ name: nombreColumna });
                            }
                        }*/
                    }
                    //log.debug('armarArreglosSS', 'obj: ' + JSON.stringify(obj));
                    array.push(obj);
                }
                //log.debug('armarArreglosSS', 'arrayArmado cantidad: ' + array.length);
                respuesta.array = array;

            } catch (e) {
                respuesta.error = true;
                respuesta.tipoError = "RARR001";
                respuesta.msj = "Excepción: " + e;
                log.error('RARR001', 'armarArreglosSS Excepción: ' + e);
            }

            return respuesta;
        }

        function operadorBusqueda(operadorString) {
            var operator = '';
            switch (operadorString) {

                case 'IS':
                    operator = search.Operator.IS;
                    break;

                case 'AFTER':
                    operator = search.Operator.AFTER;
                    break;

                case 'ALLOF':
                    operator = search.Operator.ALLOF;
                    break;

                case 'ANY':
                    operator = search.Operator.ANY;
                    break;
                case 'ANYOF':
                    operator = search.Operator.ANYOF;
                    break;

                case 'BEFORE':
                    operator = search.Operator.BEFORE;
                    break;

                case 'BETWEEN':
                    operator = search.Operator.BETWEEN;
                    break;

                case 'CONTAINS':
                    operator = search.Operator.CONTAINS;
                    break;

                case 'DOESNOTCONTAIN':
                    operator = search.Operator.DOESNOTCONTAIN;
                    break;

                case 'DOESNOTSTARTWITH':
                    operator = search.Operator.DOESNOTSTARTWITH;
                    break;

                case 'EQUALTO':
                    operator = search.Operator.EQUALTO;
                    break;

                case 'GREATERTHAN':
                    operator = search.Operator.GREATERTHAN;
                    break;

                case 'GREATERTHANOREQUALTO':
                    operator = search.Operator.GREATERTHANOREQUALTO;
                    break;

                case 'HASKEYWORDS':
                    operator = search.Operator.HASKEYWORDS;
                    break;

                case 'ISEMPTY':
                    operator = search.Operator.ISEMPTY;
                    break;

                case 'ISNOT':
                    operator = search.Operator.ISNOT;
                    break;

                case 'ISNOTEMPTY':
                    operator = search.Operator.ISNOTEMPTY;
                    break;

                case 'LESSTHAN':
                    operator = search.Operator.LESSTHAN;
                    break;

                case 'LESSTHANOREQUALTO':
                    operator = search.Operator.LESSTHANOREQUALTO;
                    break;

                case 'NONEOF':
                    operator = search.Operator.NONEOF;
                    break;

                case 'NOTAFTER':
                    operator = search.Operator.NOTAFTER;
                    break;

                case 'NOTALLOF':
                    operator = search.Operator.NOTALLOF;
                    break;

                case 'NOTBEFORE':
                    operator = search.Operator.NOTBEFORE;
                    break;

                case 'NOTBETWEEN':
                    operator = search.Operator.NOTBETWEEN;
                    break;

                case 'NOTEQUALTO':
                    operator = search.Operator.NOTEQUALTO;
                    break;

                case 'NOTGREATERTHAN':
                    operator = search.Operator.NOTGREATERTHAN;
                    break;

                case 'NOTGREATERTHANOREQUALTO':
                    operator = search.Operator.NOTGREATERTHANOREQUALTO;
                    break;

                case 'NOTLESSTHAN':
                    operator = search.Operator.NOTLESSTHAN;
                    break;

                case 'NOTLESSTHANOREQUALTO':
                    operator = search.Operator.NOTLESSTHANOREQUALTO;
                    break;

                case 'NOTON':
                    operator = search.Operator.NOTON;
                    break;

                case 'NOTONORAFTER':
                    operator = search.Operator.NOTONORAFTER;
                    break;

                case 'NOTONORBEFORE':
                    operator = search.Operator.NOTONORBEFORE;
                    break;

                case 'NOTWITHIN':
                    operator = search.Operator.NOTWITHIN;
                    break;

                case 'ON':
                    operator = search.Operator.ON;
                    break;

                case 'ONORAFTER':
                    operator = search.Operator.ONORAFTER;
                    break;

                case 'ONORBEFORE':
                    operator = search.Operator.ONORBEFORE;
                    break;

                case 'STARTSWITH':
                    operator = search.Operator.STARTSWITH;
                    break;

                case 'WITHIN':
                    operator = search.Operator.WITHIN;
                    break;
            }
            return operator;
        }

        return {
            isEmpty: isEmpty,
            l56esOneworld: l56esOneworld,
            searchSavedPro: searchSavedPro
        };
    });
