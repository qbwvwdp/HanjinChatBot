/*
내가 적은 utterace를 LUIS에 저장된 정보(Intent, Entity)와 분석하여 해당되는 intent와 entity 정보를 추출한다. 
(참고문헌)
https://docs.microsoft.com/ko-kr/azure/cognitive-services/luis/luis-get-started-node-get-intent (Azure-Samples GitHub 리포지토리 링크타면 아래 url로 타짐)
https://github.com/Azure-Samples/cognitive-services-language-understanding/blob/master/documentation-samples/quickstarts/analyze-text/node/call-endpoint.js
*/
require('dotenv').config();

// var request = require('request');
var request = require('sync-request'); //비동기식인 코드를 동기식으로 바꾸기 위해(동시처리가 아닌 순차처리를 위해) npm -i sync-request --save 함
var querystring = require('querystring');

var restify = require('restify');//
var builder = require('botbuilder');
var botbuilder_azure = require("botbuilder-azure");
// Analyze text
//
// utterance = user's text
//
function getLuisIntent(utterance) {

    // endpoint URL
    var endpoint =
       // "https://westeurope.api.cognitive.microsoft.com/luis/v2.0/apps/";
        "https://westeurope.api.cognitive.microsoft.com/luis/v2.0/apps/bdafc1d1-0822-4eee-8853-458a76c6f935?verbose=true&timezoneOffset=60&subscription-key=41482f33437b46e9bdb081bfbdf29e30&q"
    
    // Set the LUIS_APP_ID environment variable 
    // to df67dcdb-c37d-46af-88e1-8b97951ca1c2, which is the ID
    // of a public sample application.    
    var luisAppId = process.env.LUIS_APP_ID;

    // Read LUIS key from environment file ".env"
    // You can use the authoring key instead of the endpoint key. 
	// The authoring key allows 1000 endpoint quersies a month.
    var endpointKey = process.env.LUIS_ENDPOINT_KEY;

    // Create query string 
    var queryParams = {
        "verbose":  true,
        "timezoneOffset": 60, //추가
        "subscription-key": endpointKey,
        "q": utterance
    }

    // append query string to endpoint URL
    var luisRequest =
        endpoint + luisAppId +
        '?' + querystring.stringify(queryParams);

    // HTTP Request
        
    var res = request('GET', luisRequest); 

    return JSON.parse(res.getBody()); //LUIS에서 추출한 정보를 반환

}

// Pass an utterance to the sample LUIS app
exports.getLuisIntent = getLuisIntent; //getLuistIntent 함수를 외부참조
