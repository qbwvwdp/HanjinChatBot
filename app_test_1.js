/*-----------------------------------------------------------------------------
A simple echo bot for the Microsoft Bot Framework. 
-----------------------------------------------------------------------------*/

var restify = require('restify');//
var builder = require('botbuilder');
var botbuilder_azure = require("botbuilder-azure");
//웹페이지 오픈하기 위해(npm install opn 먼저해야함)
var opn = require('opn');


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

// (수정)
bot.dialog('/', [
    function (session) {        
        session.send('안녕하세요. 제이드(Jaid)입니다.');        
        builder.Prompts.choice(
            session, 
            " 다음의 항목 중 선택해 주시면 최선을 다해 도와드리겠습니다. ", ["스케줄조회", "출도착조회", "예약조회", "이벤트 / 특가","알리미"],
          { listStyle: builder.ListStyle.button });
    },
]);

// matches 영역에 직접 작성한 intent 명을 입력하시고, 응답 문구를 수정하세요. 
bot.dialog('스케줄조회Dialog', [//여기에 matching됨
    (session) => { 
        //로그인 했을 시
        builder.Prompts.choice(
            session, 
            " 본인의 예약 일정을 보시겠습니까? 또는 주간 비행기 일정을 보시겠습니까? ", ["예약 일정", "주간스케줄"],
            { listStyle: builder.ListStyle.button });
        },
        function(session, results) {
            session.userData.text = results.response.entity;
            //console.log(`entity: ${results.response.entity}`);
            
            if(session.userData.text == '주간스케줄'){
               // opens the url in the default browser 
               opn('https://www.jinair.com/promotion/index');
               // specify the app to open in 
               //opn('https://www.jinair.com/promotion/index', {app: 'chrome'});
            }

       // session.endDialog(); 
    } 
]).triggerAction({ 
    matches: '스케줄조회' 
}); 

bot.dialog('출도착조회Dialog', //여기에 matching됨
    (session) => { 
        session.send({
            attachments : [{
                contentType: "image/jpeg",
                contentUrl: "https://postfiles.pstatic.net/MjAxOTAxMjlfNjEg/MDAxNTQ4NzIyNDUxMzA3.rjebs_uxmNX35B_UsZjKsfE6TVGO4H4SAnDcN_cfVSgg.bZIU2ms4TFXULFQU3ecb-WHWaS941w3nP5LHnxHVwaAg.PNG.fdclub123/출도착조회.PNG?type=w773"
            }]
        });
    } 
).triggerAction({ 
    matches: '출도착조회' 
}); 

bot.dialog('예약조회Dialog', //여기에 matching됨
    (session) => { 
        session.send({
            attachments : [{
                contentType: "image/jpeg",
                contentUrl: "https://postfiles.pstatic.net/MjAxOTAxMjlfMTcg/MDAxNTQ4NzIyNzI1MjE1.2JeiOZajUx1_TuQNo6FqmJBrZXiIm2gTJsryje2psp0g.sXBelwjD6IbwZf2XPutrz07As7S4oMQNnn0PiUtk69Mg.PNG.fdclub123/예약조회.PNG?type=w773"
            }]
        });
        
    } 
).triggerAction({ 
    matches: '예약조회' 
}); 

bot.dialog('특가Dialog', [//여기에 matching됨
    function (session) {        
        builder.Prompts.choice(
            session, 
            " 특가 및 이벤트에 대한 내용으로 이동하겠습니까? ", ["예", "아니요"],
            { listStyle: builder.ListStyle.button });
        },
        function(session, results) {
            session.userData.text = results.response.entity;
            //console.log(`entity: ${results.response.entity}`);
            if(session.userData.text == '예'){
               // opens the url in the default browser 
               opn('https://www.jinair.com/promotion/index');
               // specify the app to open in 
               //opn('https://www.jinair.com/promotion/index', {app: 'chrome'});
            }
            else{
                session.endDialog();
                session.beginDialog('/')
            }
        }          
    ]).triggerAction({ 
    matches: ['특가', '이벤트']
}); 

bot.dialog('알리미Dialog',[
    (session)=>{
        builder.Prompts.text(session,'진에어 항공편의 맞춤항공권 알리미 입니다. 출발지를 입력 해주세요.')
    },
    (session, results)=>{
        session.userData.start = results.response;
        builder.Prompts.number(session,"선택하신 출발지는 "+results.response+"입니다.\n예산 (성인 1인 기준)을 입력 해주세요. ")
    },
    (session,results)=>{
        var themelist = ['해변','도시','쇼핑','유소아동반','미식','친구']
        session.userData.asset = results.response;
        builder.Prompts.choice(session,"여행 테마를 선택해주세요.",themelist,
        { listStyle: builder.ListStyle.button })
        session.userData.theme = results.response.entity;
        if(themelist.find(results.response.entity))
        {
            console.log("Notify Complete.")
            session.endDialog();
            session.beginDialog();
        }
    }
]).triggerAction({
        matches: '알리미'
});


bot.dialog('시작화면Dialog', //여기에 matching됨
    (session) => { 
            session.beginDialog('/')
            
        } 
    
).triggerAction({ 
    matches: '시작화면' 
}); 