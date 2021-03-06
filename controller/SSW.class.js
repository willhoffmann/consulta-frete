const xml2js = require('xml2js');
const utils  = require('./Utils.class.js');
const soap   = require("soap");

var xmlParser = new xml2js.Parser();

/**
 * Autor Henrique S. Ribeiro <henriqueribeiro42@gmail.com>
 * Desde 10/07/2019 v0.1
 * 
 * Atualizado por Vinicius para unificar todas as transportadoras que utilizam SSW
 */
var SSW = function(){};

/**
 * Operação dos correios que calcula o frete e o prazo
 */
SSW.calc = (carrierid, payload) => {
    let answerList = [];
    
    return new Promise(function(resolve,reject){
        let start = new Date();
        let end   = null;
        let diff  = 0;
        
        let input = payload.input;
        let config = Object.get2(input.config,carrierid);
        
        if (Object.get("debug") == 1) {
            console.log(`${carrierid}: inicio`);
        }
        
        // montando url
        let params = {
            "dominio": config.dominio,
            "login": config.login,
            "senha": config.senha,
            "cnpjPagador": config.cnpjPagador,
            "cepOrigem": config.cepOrigem,
            "cepDestino": input.zipcode,
            "valorNF": input.total,
            "quantidade": 1,
            "peso": input.weight,
            "volume": "0.1",
            "mercadoria": 1,
            "cnpjDestinatario": input.docnr
        };
        
        let url = "http://ssw.inf.br/ws/sswCotacao/index.php?wsdl";
        
        let args = [];
        for(let i in params){
            args.push(i+"="+params[i]);
        }
        args = args.join("&");
        url += "?"+args;
        
        // fazendo requisição
        soap.createClient(url,{"wsdl_options":{"timeout":10000}}, (cliErr, client) => {
            if (typeof(client)=="undefined") {
                end = new Date();
                diff = end - start;
                
                if (Object.get("debug") == 1) {
                    console.log(`${carrierid}: fim`);
                }

                resolve({
                    "carrierid": carrierid,
                    "status": "E",
                    "duration": diff,
                    "message": "Serviço indisponível",
                    "result": answerList
                });
                return;
            }

            client.cotar(params,(cotErr, data) => {
                end = new Date();
                diff = end - start;
                
                if (Object.get("debug") == 1) {
                    console.log(`${carrierid}: fim`);
                }

                if (cotErr) {
                    resolve({
                        "carrierid": carrierid,
                        "status": "E",
                        "duration": diff,
                        "message": cotErr,
                        "result": answerList
                    });
                    return;
                }

                xmlParser.parseString(data.return.$value, (err, result) => {
                    if (err) {
                        resolve({
                            "carrierid": carrierid,
                            "status": "E",
                            "duration": diff,
                            "message": err,
                            "result": answerList
                        });
                        return;
                    }
                    let cot = result.cotacao;
                    if (cot.erro[0]!="0") {
                        resolve({
                            "carrierid": carrierid,
                            "status": "E",
                            "duration": diff,
                            "message": cot.mensagem[0],
                            "result": answerList
                        });
                        return;
                    }
                    
                    let answer = utils.getDefaultAnswer();
                    answer.carrierid = carrierid;
                    answer.product.id = "default";
                    answer.product.name = config.name;
                    answer.price = cot.totalFrete[0];
                    answer.deliveryDays = cot.prazo[0];
                    answer.status = "S";
                    answerList.push(answer);
                    
                    resolve({
                        "carrierid": carrierid,
                        "status"   : "S",
                        "duration" : diff,
                        "message"  : "",
                        "result"   : answerList
                    });
                });
            },{"timeout": config.timeout});
        });
    });
}

module.exports = SSW;