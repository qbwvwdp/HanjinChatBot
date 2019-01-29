/*-----------------------------------------------------------------------------
A simple echo bot for the Microsoft Bot Framework. 
-----------------------------------------------------------------------------*/

var restify = require('restify');//
var builder = require('botbuilder');
var botbuilder_azure = require("botbuilder-azure");

// 로컬 실행 시 환경 변수 값 읽기 
if (process.env.exec_env!="production") {     
    require('dotenv').config(); 
} 
    
// (추가)대화 로그 기록
var log = require('./db/log');

// (추가) - 측정을 위한 모듈 실행 코드 추가  
const appInsights = require("applicationinsights"); 
appInsights.setup(process.env.ApplicationInsightsKey); 
appInsights.start(); 


// Setup Restify Server
var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
   console.log('%s listening to %s', server.name, server.url);
   // 대화 로그 기록을 위한 초기화
   log.Init(function() {
       console.log('챗봇 로그 디비 초기화 성공');
   }); 
});
  

// Create chat connector for communicating with the Bot Framework Service
var connector = new builder.ChatConnector({
    appId: process.env.MicrosoftAppId,
    appPassword: process.env.MicrosoftAppPassword,
    openIdMetadata: process.env.BotOpenIdMetadata
});

// Listen for messages from users 
server.post('/api/messages', connector.listen());

/*----------------------------------------------------------------------------------------
* Bot Storage: This is a great spot to register the private state storage for your bot. 
* We provide adapters for Azure Table, CosmosDb, SQL Azure, or you can implement your own!
* For samples and documentation, see: https://github.com/Microsoft/BotBuilder-Azure
* ---------------------------------------------------------------------------------------- */

var tableName = 'botdata';
var azureTableClient = new botbuilder_azure.AzureTableClient(tableName, process.env['AzureWebJobsStorage']);
var tableStorage = new botbuilder_azure.AzureBotStorage({ gzipData: false }, azureTableClient);

// Create your bot with a function to receive messages from the user
var bot = new builder.UniversalBot(connector);
bot.set('storage', tableStorage);

 // (추가) middleware logging 
 bot.use({ 
     receive: function (event, next) { 
         log.Log(event,() => {}) 
         next(); 
     }, 
     send: function (event, next) { 
         log.Log(event,() => {}) 
         next(); 
     } 
 }); 

// (추가) Create a recognizer that gets intents from LUIS, and add it to the bot 
const LuisModelUrl = process.env.LuisURL; 
console.log(`connect LUIS ${LuisModelUrl}`); 
var recognizer = new builder.LuisRecognizer(LuisModelUrl); 
bot.recognizer(recognizer); 


// (추가) conversationUpdate 이벤트 핸들러
bot.on('conversationUpdate', function (message) {
    if (message.membersAdded) {
        message.membersAdded.forEach(function (identity) {
            if (identity.id === message.address.bot.id) {
                bot.beginDialog(message.address, '/'); // '/'를 만나면  /에 해당되는 dialog로 가라
            }
        });
    }
});

/*
bot.dialog('/', function (session) {
    session.send('Echo server  ' + session.message.text);
});
*/

// (수정)
bot.dialog('/', [
    function (session) {        
        session.send('안녕하세요. 노진수님 제이드(Jaid)입니다.');        
        builder.Prompts.choice(
            session, 
            " 다음의 항목 중 선택해 주시면 최선을 다해 도와드리겠습니다. ", ["스케줄조회", "출도착조회", "예약조회", "맞춤항공권"],
            { listStyle: builder.ListStyle.button });
    },

    function (session, results) {
        session.userData.Type = results.response.entity;
        if (session.userData.Type == "스케줄조회") {
            session.send("노진수님의 스케줄조회 입니다.");
            session.send({
                attachments : [{
                    contentType: "image/jpeg",
                    contentUrl: "https://postfiles.pstatic.net/MjAxOTAxMjlfMTIz/MDAxNTQ4NzIyMjQ0MzQx.fE0UIgJ_3ZInUPEFMUJc_57VVgM6ZSDk7dcctjq9vnsg.ccNiUiJhNx1T_NY5PTv-IZZWeArsK47CtGV5x_z0vn8g.PNG.fdclub123/스케줄조회.PNG?type=w773"
                }]

            });
        } else if (session.userData.Type == "출도착조회") {
            session.send("노진수님의 출도착조회 입니다.");
            session.send({
                attachments : [{
                    contentType: "image/jpeg",
                    contentUrl: "https://postfiles.pstatic.net/MjAxOTAxMjlfNjEg/MDAxNTQ4NzIyNDUxMzA3.rjebs_uxmNX35B_UsZjKsfE6TVGO4H4SAnDcN_cfVSgg.bZIU2ms4TFXULFQU3ecb-WHWaS941w3nP5LHnxHVwaAg.PNG.fdclub123/출도착조회.PNG?type=w773"
                }]

            });
        } 
        else if (session.userData.Type == "예약조회") {
            session.send("노진수님의 예약조회 입니다.");
            session.send({
                attachments : [{
                    contentType: "image/jpeg",
                    contentUrl: "https://postfiles.pstatic.net/MjAxOTAxMjlfMTcg/MDAxNTQ4NzIyNzI1MjE1.2JeiOZajUx1_TuQNo6FqmJBrZXiIm2gTJsryje2psp0g.sXBelwjD6IbwZf2XPutrz07As7S4oMQNnn0PiUtk69Mg.PNG.fdclub123/예약조회.PNG?type=w773"
                }]

            });
        } 
        else if (session.userData.Type == "맞춤항공권") {
            session.send("현재 노진수님의 설정사항 및 맞춤항공권 입니다.");
            session.send({
                attachments : [{
                    contentType: "image/jpeg",
                    contentUrl: "https://postfiles.pstatic.net/MjAxOTAxMjlfNDcg/MDAxNTQ4NzIyODMxODEw.6GF5WRVNuoRIvnMxPYmQDF3LYQgGc6Ho-RviSk7go4cg.nZYiPP_TSXX1leUV_GI8T9HQYDZv011H8Mvs0Ox6t9Ig.PNG.fdclub123/노진수님의_맞춤항공설정.PNG?type=w773"
                }]

            });
            session.send({
                attachments : [{
                    contentType: "image/jpeg",
                    contentUrl: "https://postfiles.pstatic.net/MjAxOTAxMjlfMjUg/MDAxNTQ4NzIzMDc4OTE1.88GshgQJYtgRSMc_tk5gNF1TCI0UKIKNU89YJhPsujgg.TqfuJiwjjTMzfavoCf9ep7Aat6IdKGV8Eo0o9IpbCZkg.PNG.fdclub123/검색결과.PNG?type=w773"
                }]

            });
        } 
        else {
            session.send("위의 항목에 대해서만 조회하실 수 있습니다.");    
            session.endDialog();
        }
    },
    /*
    function (session, results) {
        session.userData.weatherType = results.response.entity;
        if (session.userData.weatherType == "오늘날씨") {
            session.send("오늘 날씨는 O도입니다.");
        } else if (session.userData.weatherType == "주간날씨") {
            session.send("주간 날씨는 O요일 O도, O요일 O도, O요일 O도입니다.");
        } else {
            session.send("대화를 종료합니다.");    
            session.endDialog();
        }
    },
    */
]);

/*
//
// (추가) 날씨문의 Dialog 추가 
// matches 영역에 직접 작성한 intent 명을 입력하시고, 응답 문구를 수정하세요. 
bot.dialog('날씨문의Dialog', //여기에 matching됨
    (session) => { 
        session.send('오늘 날씨는 온도 O도 습도 O%입니다.'); 
        session.endDialog(); 
    } 
).triggerAction({ 
    matches: '날씨문의' 
}); 
*/