/*-----------------------------------------------------------------------------
A simple echo bot for the Microsoft Bot Framework. 
-----------------------------------------------------------------------------*/
// import/include 개념
var restify = require('restify');// restify : 유명한 라이브러리
var builder = require('botbuilder');// 
var botbuilder_azure = require("botbuilder-azure");


if(process.env.exec_env!="production"){
    require('dotenv').config();
}

// (추가)대화 로그 기록
var log = require('./db/log');

// (추가) - 측정을 위한 모듈 실행 코드 추가 
const appInsights = require("applicationinsights");
appInsights.setup(process.env.ApplicationInsightsKey);
appInsights.start();


// Setup Restify Server
var server = restify.createServer(); // instance 생성
server.listen(process.env.port || process.env.PORT || 3978, function () {  // listen 상태로 변환 (port 지정 - 대소문자 구문 해주기 때문에 port,PORT)
   console.log('%s listening to %s', server.name, server.url);   // parameter로 funtion ( closer ) 사용 가능
   // 대화 로그 기록을 위한 초기화
   log.Init(function() {
    console.log('챗봇 로그 디비 초기화 성공');
    });
});
  
// Create chat connector for communicating with the Bot Framework Service
var connector = new builder.ChatConnector({
    appId: process.env.MicrosoftAppId,                  // azure에 있음
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
//스토리지랑 연결하는 기본 정보
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
                bot.beginDialog(message.address, '/');
            }
        });
    }
});

/*
bot.dialog('/', function (session) {
    session.send('Echo Server ' + session.message.text);
});
*/

bot.dialog('/', [
    function (session) {        
        session.send('안녕하세요. 날씨 알림 챗봇입니다.');        
        builder.Prompts.text(session, "알고 싶은 지역을 알려주세요.");
    },
    function (session, results) {
        session.userData.location = results.response;
        session.send(`${session.userData.location} 지역이요? 알겠습니다.`);
        builder.Prompts.choice(
            session,
            "오늘 날씨를 알려드릴까요. 주간 날씨를 알려드릴까요", ["오늘날씨", "주간날씨"],
            { listStyle: builder.ListStyle.button });        
    },
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
]);

// (추가) 날씨문의 Dialog 추가
// matches 영역에 직접 작성한 intent 명을 입력하시고, 응답 문구를 수정하세요.
bot.dialog('날씨문의Dialog',
    (session) => {
        session.send('오늘 날씨는 온도 O도 습도 O%입니다.');
        session.endDialog();
    }
).triggerAction({
    matches: '날씨문의'
});