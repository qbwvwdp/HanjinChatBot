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

// Setup Restify Server
var server = restify.createServer(); // instance 생성
server.listen(process.env.port || process.env.PORT || 3978, function () {  // listen 상태로 변환 (port 지정 - 대소문자 구문 해주기 때문에 port,PORT)
   console.log('%s listening to %s', server.name, server.url);   // parameter로 funtion ( closer ) 사용 가능
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