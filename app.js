/*-----------------------------------------------------------------------------
A simple echo bot for the Microsoft Bot Framework. 
-----------------------------------------------------------------------------*/

var restify = require('restify');//
var builder = require('botbuilder');
var botbuilder_azure = require("botbuilder-azure");
//웹페이지 오픈하기 위해(npm install opn 먼저해야함)
var opn = require('opn');
var util = require('util');

const LoadInfo = require('./InfoExtraction'); //InfoExtraction.js불러옴

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
var TempID = "TEST-ID005";
// (수정)
bot.dialog('/', [
    function (session) {        
        session.send('안녕하세요. 제이드(Jaid)입니다.');        
        builder.Prompts.choice(
            session, 
            " 다음의 항목들 중 선택해 주시면 최선을 다해 도와드리겠습니다. ", ["스케줄조회", "출도착조회", "이벤트", "특가상품", "맞춤항공권","최근검색이력"],
            { listStyle: builder.ListStyle.button });
    },
    function(session, results){
        session.userData.Type = results.response.entity;
        if(session.userData.Type == "스케줄조회") {
            session.beginDialog('스케줄조회Dialog');

        } else if(session.userData.Type == "출도착조회"){

            session.beginDialog('출도착조회Dialog');
        } 
        else if(session.userData.Type == "이벤트"){

            session.beginDialog('이벤트Dialog');
        } 
        else if(session.userData.Type == "특가상품"){

            session.beginDialog('특가Dialog');
        } 
        else if(session.userData.Type == "맞춤항공권"){

            session.beginDialog('맞춤항공권Dialog');
        }
        else if(session.userData.Type == '최근검색이력') {
            session.beginDialog('최근검색이력Dialog');
        }else {

            session.endDialog();
            session.beginDialog('/')
        }
    }
]);

bot.dialog('스케줄조회Dialog', [ //여기에 matching됨
    function (session) {
        session.beginDialog('ask');
    },
    function(session, results) { 
        session.userData.text = results.response.entity;
        if(session.userData.text == '주간스케줄') {
            session.beginDialog('tnum');
        }
        else if(session.userData.text == '예약 확인') {
            session.beginDialog('pass');
        }
    }
]).triggerAction({
    matches: '스케줄조회'
});

bot.dialog('ask', [
    function (session) {
        builder.Prompts.choice(session, " 본인의 예약 일정을 보시겠습니까? 또는 주간 비행기 일정을 보시겠습니까? ", ["예약 확인", "주간스케줄"], { listStyle: builder.ListStyle.button});
    }
])

bot.dialog('tnum', [
    function (session) {
        // Display Welcome card with Hotels and Flights search options

        if (session.message && session.message.value) {
            var Query_ = session.message.value.checkin + ' ' + session.message.value.destination;
            console.log("q = "+Query_);
            var data = LoadInfo.getLuisIntent(Query_);
            console.log("data = ", data);
            var Origin_Entity;
            var Destination_Entity;
            var Date_Entity;
            Origin_Entity = builder.EntityRecognizer.findEntity(data.entities, '항공조회.출발지');
            Destination_Entity = builder.EntityRecognizer.findEntity(data.entities, '항공조회.목적지');
            Date_Entity = builder.EntityRecognizer.findEntity(data.entities, '항공조회.날짜');
            console.log(`data: ${Origin_Entity}`);
            console.log(`data: ${Destination_Entity}`);
            console.log(`data: ${Date_Entity}`);
            // A Card's Submit Action obj was received
            if(Origin_Entity != null && Destination_Entity != null && Date_Entity != null){
                console.log('모든 값이 제대로 나올 시');
                session.send(`출발지 : ${Origin_Entity.entity}, 목적지 : ${Destination_Entity.entity}, 날짜 : ${Date_Entity.entity}`);
            // 정상인 경우
            
                log.FuncUpsert(['schedule',Origin_Entity.entity,Destination_Entity.entity,Date_Entity.entity],TempID);
                session.beginDialog('weeksche', session.message.value);
                return;
            }
            else{
                if(Origin_Entity == null){
                    session.send('출발지가 아닙니다.');
                };
                if(Destination_Entity == null){
                    session.send('목적지가 아닙니다.');
                };
                if(Date_Entity == null){
                    session.send('날짜가 아닙니다.');
                };
                session.send('정보를 다시 입력해주세요.');
                session.message.value = null; //이전의 잘못된 메세지 내용이 저장되어있어 다음으로 안넘어가고 무한루프로 실행됨. => 메세지 내용 삭제 => 다시 시작함
                };
        }

        var card = {
            'contentType': 'application/vnd.microsoft.card.adaptive',
            'content': {
                '$schema': 'http://adaptivecards.io/schemas/adaptive-card.json',
                'type': 'AdaptiveCard',
                'version': '1.0',
                'body': [
                    {
                        'type': 'Container',
                        'speak': '<s>안녕하세요!</s><s>비행기 목적지와 출발날짜를 입력해 주세요.</s>',
                        'items': [
                            {
                                'type': 'ColumnSet',
                                'columns': [
                                    {
                                        'type': 'Column',
                                        'size': 'auto',
                                        'items': [
                                            {
                                                'type': 'Image',
                                                'url': 'https://imgur.com/jxxSK5s.png',
                                                'size': 'medium',
                                                'style': 'person'
                                            }
                                        ]
                                    },
                                    {
                                        'type': 'Column',
                                        'size': 'stretch',
                                        'items': [
                                            {
                                                'type': 'TextBlock',
                                                'text': '안녕하세요!',
                                                'weight': 'bolder',
                                                'isSubtle': true
                                            },
                                            {
                                                'type': 'TextBlock',
                                                'text': '비행기 목적지와 출발날짜를 입력해 주세요.',
                                                'wrap': true
                                            }
                                        ]
                                    }
                                ]
                            }
                        ]
                    }
                ],
                'actions': [
                    // 입력하기 Search form
                    {
                        'type': 'Action.ShowCard',
                        'title': '입력하기',
                        'speak': '<s>입력하기</s>',
                        'card': {
                            'type': 'AdaptiveCard',
                            'body': [
                                {
                                    'type': 'TextBlock',
                                    'text': '진에어 방문을 환영합니다!',
                                    'speak': '<s>진에어 방문을 환영합니다!</s>',
                                    'weight': 'bolder',
                                    'size': 'large'
                                },
                                {
                                    'type': 'TextBlock',
                                    'text': '목적지를 입력해주세요 :'
                                },
                                {
                                    'type': 'Input.Text',
                                    'id': 'destination',
                                    'speak': '<s>목적지를 입력해주세요 :</s>',
                                    'placeholder': '예) 김포에서 제주',
                                    'style': 'text'
                                },
                                {
                                    'type': 'TextBlock',
                                    'text': '출발날짜를 입력해주세요 :'
                                },
                                {
                                    'type': 'Input.Date',
                                    'id': 'checkin',
                                    'speak': '<s>출발날짜를 입력해주세요 :</s>'
                                }
                            ],
                            'actions': [
                                {
                                    'type': 'Action.Submit',
                                    'title': '검색',
                                    'speak': '<s>Search</s>',
                                    'data': {
                                        'type': 'hotelSearch'
                                    }
                                }
                            ]
                        }
                    }
                ]
            }
        };
    
        var msg = new builder.Message(session).addAttachment(card);
        session.send(msg);
    }
])
bot.dialog('최근검색이력Dialog', [
    function (session) {
        session.beginDialog('talk');
    },
    function (session, results) {
        session.userData.text = results.response.entity;
        if(session.userData.text == '최근 조회 내역') {
            session.beginDialog('recently');
        }
        else if(session.userData.text == '맞춤항공권 예약 현황') {
            session.beginDialog('fit');
        }
    }
])

bot.dialog('talk', [
    function (session) {
        builder.Prompts.choice(session, " 본인의 최근 항공 조회 내역 혹은 맞춤항공권 예약 현황을 보시겠습니까? ", ["최근 조회 내역", "맞춤항공권 예약 현황"], { listStyle: builder.ListStyle.button});
    }
])

var charge = '150000';
function getImgLink(Name){
    if(Name == "다 낭"){
        return "https://imgur.com/4gJcePw.jpg";
    }
    else if(Name == "도 쿄"){
        return "https://imgur.com/0QtO63C.jpg";
    }
    else if(Name == "제 주"){
        return "https://imgur.com/BNmDqlR.jpg";
    }
    else if(Name == "쇼핑"){
        return "https://imgur.com/WoAvNAI.jpg";
    }
    else if(Name == "친구"){
        return "https://imgur.com/V3HTWCO.jpg";
    }
    else if(Name == "해변"){
        return "https://imgur.com/XCRJdV4.jpg";
    }
    else if(Name == "도시"){
        return "https://imgur.com/anX8G7g.jpg";
    }
    else if(Name == "미식"){
        return "https://imgur.com/YyUPyNf.jpg";
    }

}


bot.dialog('recently', [
    // 최근 조회 내역(출발지, 도착지, 출발날짜, 요금)
    (session)=>{
        log.FindUserFunc(TempID,(param)=>{
            data = JSON.parse(param);
            var count = Object.values(data.schedule.depart).length;
            if(count == 0){
                session.send("최근 조회 내역이 없습니다.\n처음으로 돌아갑니다.")
                session.beginDialog('/');
            }
            else if ( count == 1 ){
                let messageWithCarouselOfCards = [ //카드로 받아서
                    new builder.HeroCard(session)
                    .title('출발지 : ' + data.schedule.depart[0] + ' , 도착지 : ' + data.schedule.arrive[0])
                    .subtitle('출발날짜 : ' + data.schedule.date[0] + ' , 요금 : ' + charge + '원')
                    .images([
                        builder.CardImage.create(session, getImgLink(data.schedule.arrive[0]))
                    ])
                    .buttons([
                        builder.CardAction.openUrl(session, 'https://www.jinair.com/booking/index?NaPm=ct%3Djrvcjozo%7Cci%3Dcheckout%7Ctr%3Dds%7Ctrx%3D%7Chk%3Db0a4c08d367350e15b185fe659bd60258a3a1d82', '이동하기')
                    ])
                ];
                var reference = new builder.Message(session) //카드로 응답한다
                    .attachmentLayout(builder.AttachmentLayout.carousel)
                    .attachments(messageWithCarouselOfCards);
        
                session.send(reference);
                session.beginDialog('/');
            }
            else if(count == 2){
                let messageWithCarouselOfCards = [ //카드로 받아서
                    new builder.HeroCard(session)
                    .title('출발지 : ' + data.schedule.depart[0] + ' , 도착지 : ' + data.schedule.arrive[0])
                    .subtitle('출발날짜 : ' + data.schedule.date[0] + ' , 요금 : ' + charge + '원')
                    .images([
                        builder.CardImage.create(session, getImgLink(data.schedule.arrive[0]))
                    ])
                    .buttons([
                        builder.CardAction.openUrl(session, 'https://www.jinair.com/booking/index?NaPm=ct%3Djrvcjozo%7Cci%3Dcheckout%7Ctr%3Dds%7Ctrx%3D%7Chk%3Db0a4c08d367350e15b185fe659bd60258a3a1d82', '이동하기')
                    ]),
                    
                    new builder.HeroCard(session)
                    .title('출발지 : ' + data.schedule.depart[1] + ' , 도착지 : ' + data.schedule.arrive[1])
                    .subtitle('출발날짜 : ' + data.schedule.date[1] + ' , 요금 : ' + charge + '원')
                    .images([
                        builder.CardImage.create(session, getImgLink(data.schedule.arrive[1]))
                    ])
                    .buttons([
                        builder.CardAction.openUrl(session, 'https://www.jinair.com/booking/index?NaPm=ct%3Djrvcjozo%7Cci%3Dcheckout%7Ctr%3Dds%7Ctrx%3D%7Chk%3Db0a4c08d367350e15b185fe659bd60258a3a1d82', '이동하기')
                    ])
                ];
                var reference = new builder.Message(session) //카드로 응답한다
                    .attachmentLayout(builder.AttachmentLayout.carousel)
                    .attachments(messageWithCarouselOfCards);
        
                session.send(reference);
                session.beginDialog('/');
            }
            else if (count => 3){
                let messageWithCarouselOfCards = [ //카드로 받아서
                    new builder.HeroCard(session)
                    .title('출발지 : ' + data.schedule.depart[count-3] + ' , 도착지 : ' + data.schedule.arrive[count-3])
                    .subtitle('출발날짜 : ' + data.schedule.date[count-3] + ' , 요금 : ' + charge + '원')
                    .images([
                        builder.CardImage.create(session, getImgLink(data.schedule.arrive[count-3]))
                    ])
                    .buttons([
                        builder.CardAction.openUrl(session, 'https://www.jinair.com/booking/index?NaPm=ct%3Djrvcjozo%7Cci%3Dcheckout%7Ctr%3Dds%7Ctrx%3D%7Chk%3Db0a4c08d367350e15b185fe659bd60258a3a1d82', '이동하기')
                    ]),
                    
                    new builder.HeroCard(session)
                    .title('출발지 : ' + data.schedule.depart[count-2] + ' , 도착지 : ' + data.schedule.arrive[count-2])
                    .subtitle('출발날짜 : ' + data.schedule.date[count-2] + ' , 요금 : ' + charge + '원')
                    .images([
                        builder.CardImage.create(session, getImgLink(data.schedule.arrive[count-2]))
                    ])
                    .buttons([
                        builder.CardAction.openUrl(session, 'https://www.jinair.com/booking/index?NaPm=ct%3Djrvcjozo%7Cci%3Dcheckout%7Ctr%3Dds%7Ctrx%3D%7Chk%3Db0a4c08d367350e15b185fe659bd60258a3a1d82', '이동하기')
                    ]),
                    new builder.HeroCard(session)
                    .title('출발지 : ' + data.schedule.depart[count-1] + ' , 도착지 : ' + data.schedule.arrive[count-1])
                    .subtitle('출발날짜 : ' + data.schedule.date[count-1] + ' , 요금 : ' + charge + '원')
                    .images([
                        builder.CardImage.create(session, getImgLink(data.schedule.arrive[count-1]))
                    ])
                    .buttons([
                        builder.CardAction.openUrl(session, 'https://www.jinair.com/booking/index?NaPm=ct%3Djrvcjozo%7Cci%3Dcheckout%7Ctr%3Dds%7Ctrx%3D%7Chk%3Db0a4c08d367350e15b185fe659bd60258a3a1d82', '이동하기')
                    ])
                ];
                var reference = new builder.Message(session) //카드로 응답한다
                    .attachmentLayout(builder.AttachmentLayout.carousel)
                    .attachments(messageWithCarouselOfCards);
        
                session.send(reference);
                session.beginDialog('/');
            }
        })
    }
]).triggerAction({
    matches: '최근 조회'
});

bot.dialog('fit', [
    // 맞춤 항공권 내역(목적지, 기간, 테마, 예산)
    function (session) {
        log.FindUserFunc(TempID,(param)=>{
            data = JSON.parse(param);
            var count = Object.values(data.notify.depart).length;
            if(count == 0){
                session.send("최근 조회 내역이 없습니다.\n처음으로 돌아갑니다.")
                session.beginDialog('/');
            }
            else if ( count == 1 ){
                let messageWithCarouselOfCards = [ //카드로 받아서
                    new builder.HeroCard(session)
                    .title('목적지 : ' + data.notify.depart[0] + ' , 테마 : ' + data.notify.theme[0])
                    .subtitle('기간 : ' + data.notify.period[0] + '일 , 예산 : ' + data.notify.asset[0] + '만원')
                    .images([
                        builder.CardImage.create(session, getImgLink(data.notify.theme[0]))
                    ])
                    .buttons([
                        builder.CardAction.openUrl(session, 'https://www.jinair.com/booking/index?NaPm=ct%3Djrvcjozo%7Cci%3Dcheckout%7Ctr%3Dds%7Ctrx%3D%7Chk%3Db0a4c08d367350e15b185fe659bd60258a3a1d82', '이동하기')
                    ])];
                    
                    var reference = new builder.Message(session) //카드로 응답한다
                        .attachmentLayout(builder.AttachmentLayout.carousel)
                        .attachments(messageWithCarouselOfCards);

                    session.send(reference);
                    session.beginDialog('/');
                }
            else if ( count == 2 ){
                let messageWithCarouselOfCards = [ //카드로 받아서
                    new builder.HeroCard(session)
                        .title('목적지 : ' + data.notify.depart[0] + ' , 테마 : ' + data.notify.theme[0])
                        .subtitle('기간 : ' + data.notify.period[0] + '일 , 예산 : ' + data.notify.asset[0] + '만원')
                        .images([
                            builder.CardImage.create(session, getImgLink(data.notify.theme[0]))
                        ])
                        .buttons([
                            builder.CardAction.openUrl(session, 'https://www.jinair.com/booking/index?NaPm=ct%3Djrvcjozo%7Cci%3Dcheckout%7Ctr%3Dds%7Ctrx%3D%7Chk%3Db0a4c08d367350e15b185fe659bd60258a3a1d82', '이동하기')
                        ]),
                        new builder.HeroCard(session)
                        .title('목적지 : ' + data.notify.depart[1] + ' , 테마 : ' + data.notify.theme[1])
                        .subtitle('기간 : ' + data.notify.period[1] + '일 , 예산 : ' + data.notify.asset[1] + '만원')
                        .images([
                            builder.CardImage.create(session, getImgLink(data.notify.theme[1]))
                        ])
                        .buttons([
                            builder.CardAction.openUrl(session, 'https://www.jinair.com/booking/index?NaPm=ct%3Djrvcjozo%7Cci%3Dcheckout%7Ctr%3Dds%7Ctrx%3D%7Chk%3Db0a4c08d367350e15b185fe659bd60258a3a1d82', '이동하기')
                        ])];
                        
                    var reference = new builder.Message(session) //카드로 응답한다
                    .attachmentLayout(builder.AttachmentLayout.carousel)
                    .attachments(messageWithCarouselOfCards);

                session.send(reference);
                session.beginDialog('/');
                    }
            else if ( count >= 3 ){
                let messageWithCarouselOfCards = [ //카드로 받아서
                    new builder.HeroCard(session)
                        .title('목적지 : ' + data.notify.depart[count-3] + ' , 테마 : ' + data.notify.theme[count-3])
                        .subtitle('기간 : ' + data.notify.period[count-3] + '일 , 예산 : ' + data.notify.asset[count-3] + '만원')
                        .images([
                                builder.CardImage.create(session, getImgLink(data.notify.theme[count-3]))
                            ])
                            .buttons([
                                builder.CardAction.openUrl(session, 'https://www.jinair.com/booking/index?NaPm=ct%3Djrvcjozo%7Cci%3Dcheckout%7Ctr%3Dds%7Ctrx%3D%7Chk%3Db0a4c08d367350e15b185fe659bd60258a3a1d82', '이동하기')
                            ]),
                            new builder.HeroCard(session)
                            .title('목적지 : ' + data.notify.depart[count-2] + ' , 테마 : ' + data.notify.theme[count-2])
                            .subtitle('기간 : ' + data.notify.period[count-2] + '일 , 예산 : ' + data.notify.asset[count-2] + '만원')
                            .images([
                                builder.CardImage.create(session, getImgLink(data.notify.theme[count-2]))
                            ])
                            .buttons([
                                builder.CardAction.openUrl(session, 'https://www.jinair.com/booking/index?NaPm=ct%3Djrvcjozo%7Cci%3Dcheckout%7Ctr%3Dds%7Ctrx%3D%7Chk%3Db0a4c08d367350e15b185fe659bd60258a3a1d82', '이동하기')
                            ]),
                            new builder.HeroCard(session)
                            .title('목적지 : ' + data.notify.depart[count-1] + ' , 테마 : ' + data.notify.theme[count-1])
                            .subtitle('기간 : ' + data.notify.period[count-1] + '일 , 예산 : ' + data.notify.asset[count-1] + '만원')
                            .images([
                                builder.CardImage.create(session, getImgLink(data.notify.theme[count-1]))
                            ])
                            .buttons([
                                builder.CardAction.openUrl(session, 'https://www.jinair.com/booking/index?NaPm=ct%3Djrvcjozo%7Cci%3Dcheckout%7Ctr%3Dds%7Ctrx%3D%7Chk%3Db0a4c08d367350e15b185fe659bd60258a3a1d82', '이동하기')
                            ])];
                            
                    var reference = new builder.Message(session) //카드로 응답한다
                    .attachmentLayout(builder.AttachmentLayout.carousel)
                    .attachments(messageWithCarouselOfCards);

                session.send(reference);
                session.beginDialog('/');
                        }
                    }
                )
            } 
]).triggerAction({
    matches: '맞춤항공권 예약 현황'
});

bot.dialog('weeksche', [//여기에 matching됨
        function (session, results) {
            console.log(`month : ${results.response}`);
            session.userData.month = results.response;
                let cards = [ //카드로 받아서
                    new builder.HeroCard(session)
                    .title('문의하신 목적지와 출발날짜에 따른 주간스케줄목록 입니다.')
                    .subtitle('예매하길 원하시면 지금 당장 이동할까요?')
                    .images([
                        builder.CardImage.create(session, 'https://imgur.com/6afZbMj.png')
                    ])
                    .buttons([
                        builder.CardAction.openUrl(session, 'https://www.jinair.com/booking/index?NaPm=ct%3Djrvcjozo%7Cci%3Dcheckout%7Ctr%3Dds%7Ctrx%3D%7Chk%3Db0a4c08d367350e15b185fe659bd60258a3a1d82', '이동하기')
                    ]),
                    
                    new builder.HeroCard(session)
                    .title('문의하신 목적지와 출발날짜에 따른 주간스케줄목록 입니다.')
                    .subtitle('예매하길 원하시면 지금 당장 이동할까요?')
                    .images([
                        builder.CardImage.create(session, 'https://imgur.com/iQsg8dv.png')
                    ])
                    .buttons([
                        builder.CardAction.openUrl(session, 'https://www.jinair.com/booking/index?NaPm=ct%3Djrvcjozo%7Cci%3Dcheckout%7Ctr%3Dds%7Ctrx%3D%7Chk%3Db0a4c08d367350e15b185fe659bd60258a3a1d82', '이동하기')
                    ]),
                ];

                var reply = new builder.Message(session) //카드로 응답한다
                    .attachmentLayout(builder.AttachmentLayout.carousel)
                    .attachments(cards);

                session.send(reply);
                session.beginDialog('recomnd');
            }             
    ])



bot.dialog ('recomnd', [
    function (session) {
        builder.Prompts.choice(
            session,
            "[초특가알림] 고객님께 추천하는 특가상품이 있는데 보시겠습니까?  ", ["예", "아니오"],
            { listStyle: builder.ListStyle.button });
    },
    function(session, results) {
        session.userData.text = results.response.entity;
        if(session.userData.text == '예'){
           var rand = Math.floor(Math.random() * 7);
           if(rand==1){
                let cards = [ //카드로 받아서
                    new builder.HeroCard(session)
                    .title('1~3월 출발편 대상 특가 프로모션')
                    .subtitle('막내가 사장실 구경가는 프로모션')
                    .text('#막내야_우리는_ #수하물도_주고 #기내식도_주는데 #이_가격은_어디서_왔어?^^')
                    .images([
                        builder.CardImage.create(session, 'https://imgur.com/3AzjrdQ.png')
                    ])
                    .buttons([
                        builder.CardAction.openUrl(session, 'https://www.jinair.com/promotion/eventView?evntSeq=10784', '자세히 보기')
                    ]),

                     new builder.HeroCard(session)
                    .title('오키나와 가족여행 -인싸등극 프로젝트-')
                    .subtitle('오키나와 가족맞춤형 특급혜택')
                    .text('#일본여행_ #핵인싸의 길_ 진에어가 깐깐하게 준비한 오키나와 가족맞춤형 특급혜택을 만나보세요!')
                    .images([
                        builder.CardImage.create(session, 'https://imgur.com/jdGdMET.png')
                    ])
                    .buttons([
                        builder.CardAction.openUrl(session, 'https://www.jinair.com/promotion/eventView?evntSeq=10742', '자세히 보기')
                    ]),
                ];

                var reply = new builder.Message(session) //카드로 응답한다
                    .attachmentLayout(builder.AttachmentLayout.carousel)
                    .attachments(cards);
                session.send(reply);
                session.beginDialog('/');
            }
            else if(rand==2){
                let cards = [ //카드로 받아서
                    new builder.HeroCard(session)
                    .title('하와이 커플여행 특전')
                    .subtitle('둘만의 사진들, 둘만의 비밀거리! 지금 하와이에서 만들어보세요.')
                    .text('무료수하물에 기내식까지, 가성비 넘치는 가격으로 부담 없이 하와이 커플 여행을 떠나보세요.')
                    .images([
                        builder.CardImage.create(session, 'https://imgur.com/mKFjivc.png')
                    ])
                    .buttons([
                        builder.CardAction.openUrl(session, 'https://www.jinair.com/promotion/endEventView?evntSeq=10456', '자세히 보기')
                    ]),

                    new builder.HeroCard(session)
                    .title('괌 모녀여행 특전')
                    .subtitle('디어, 마이맘 : 베스트 프렌드 엄마와 함께하는 특별한 괌여행')
                    .text('엄마와 함께하는 여행을 응원합니다! 가족이 사랑하는 괌, 괌 여행정보를 한눈에 만나보세요!')
                    .images([
                        builder.CardImage.create(session, 'https://imgur.com/rfFCh1F.png')
                    ])
                    .buttons([
                        builder.CardAction.openUrl(session, 'https://www.jinair.com/promotion/endEventView?evntSeq=10455', '자세히 보기')
                    ]),
                ];

                var reply = new builder.Message(session) //카드로 응답한다
                    .attachmentLayout(builder.AttachmentLayout.carousel)
                    .attachments(cards);

                session.send(reply);
                session.beginDialog('/');
            }

            else if(rand==3){

                let cards = [ //카드로 받아서
                    new builder.HeroCard(session)
                    .title('하와이 소아운임 특가이벤트')
                    .subtitle('가족 할인에 쇼핑혜택까지, 특별한 섬 하와이 오아후로 가족여행 떠나세요!')
                    .text('어린이 동반 하와이 여행시 어린이 인원 제한 없이 소아 운임 할인!')
                    .images([
                        builder.CardImage.create(session, 'https://imgur.com/2ySorwk.png')
                    ])
                    .buttons([
                        builder.CardAction.openUrl(session, 'https://www.jinair.com/promotion/endEventView?evntSeq=10533', '자세히 보기')
                    ]),
    
                    new builder.HeroCard(session)
                    .title('도심 속 여름휴양지 홍콩으로 떠나자!')
                    .subtitle('쇼핑, 음식, 휴양, 화려한 밤까지 완벽한 홍콩으로 떠나자!')
                    .text('다양한 루프탑 수영장과 한 시간 내 거리에 있는 호젓한 해변, 이 모두를 품고 있는 홍콩이 바로 리얼 휴양지!')
                    .images([
                        builder.CardImage.create(session, 'https://imgur.com/K5LQn4v.png')
                    ])
                    .buttons([
                        builder.CardAction.openUrl(session, 'https://www.jinair.com/promotion/endEventView?evntSeq=10635', '자세히 보기')
                    ]),
                ];

                var reply = new builder.Message(session) //카드로 응답한다
                    .attachmentLayout(builder.AttachmentLayout.carousel)
                    .attachments(cards);

                session.send(reply);
                session.beginDialog('/');
            }
            else if(rand==4){

                let cards = [ //카드로 받아서
                        new builder.HeroCard(session)
                    .title('진에어와 함께 기타큐슈로 떠나자!')
                    .subtitle('새롭게 떠오르고 있는 규슈여행의 관문 기타큐슈로 고고씽~!')
                    .text('진에어가 추천하는 기타큐슈 여행코스로 잊지 못할 추억을 만들어 보자!')
                    .images([
                        builder.CardImage.create(session, 'https://imgur.com/kesGmed.png')
                    ])
                    .buttons([
                        builder.CardAction.openUrl(session, 'https://www.jinair.com/promotion/endEventView?evntSeq=10694', '자세히 보기')
                    ]),

                    new builder.HeroCard(session)
                    .title('조호르바루 특가부터 헤택까지!')
                    .subtitle('요즘 핫한 가족 여행지, 조호르바루 특가부터 혜택까지!')
                    .text('슈퍼로우 운임 347,600원 부터[무료 수하물 15KG, 기내식 포함]')
                    .images([
                     builder.CardImage.create(session, 'https://imgur.com/XD6GvJF.png')
                    ])
                    .buttons([
                        builder.CardAction.openUrl(session, 'https://www.jinair.com/promotion/endEventView?evntSeq=10656', '자세히 보기')
                    ]),

                    ];

                var reply = new builder.Message(session) //카드로 응답한다
                    .attachmentLayout(builder.AttachmentLayout.carousel)
                    .attachments(cards);

                session.send(reply);
                session.beginDialog('/');
            }
           
           else{

              let cards = [ //카드로 받아서
                new builder.HeroCard(session)
                .title('규슈를 한 번에, 다구간 특별혜택!')
                .subtitle('후쿠오카와 기타큐슈를 진에어와 함께 한 방에!')
                .text('후쿠오카와 기타큐슈를 한 방에 즐기고자 하는 분들께 진에어가 푸짐하게 경품 쏩니다.')
                .images([
                    builder.CardImage.create(session, 'https://imgur.com/GcxKQBE.png')
                ])
                .buttons([
                    builder.CardAction.openUrl(session, 'https://www.jinair.com/promotion/endEventView?evntSeq=10741', '자세히 보기')
                ]),

                new builder.HeroCard(session)
                .title('도쿄 감성여행 인싸등극 프로젝트')
                .subtitle('올 FW시즌, 감성지수 폭발하는 도쿄로 떠나자!')
                .text('#일본여행_ #핵인싸의 길')
                .images([
                    builder.CardImage.create(session, 'https://imgur.com/JnHMZtn.png')
                ])
                .buttons([
                    builder.CardAction.openUrl(session, 'https://www.jinair.com/promotion/endEventView?evntSeq=10739', '자세히 보기')
                ]),
            ];

            var reply = new builder.Message(session) //카드로 응답한다
                .attachmentLayout(builder.AttachmentLayout.carousel)
                .attachments(cards);

            session.send(reply);
            session.beginDialog('/');
           }
        }
        else {
          session.beginDialog('/');
        }
    }  
])

bot.dialog('출도착조회Dialog', //여기에 matching됨
    (session) => { 
        session.send({
            attachments : [{
                contentType: "image/jpeg",
                contentUrl: "https://postfiles.pstatic.net/MjAxOTAxMjlfNjEg/MDAxNTQ4NzIyNDUxMzA3.rjebs_uxmNX35B_UsZjKsfE6TVGO4H4SAnDcN_cfVSgg.bZIU2ms4TFXULFQU3ecb-WHWaS941w3nP5LHnxHVwaAg.PNG.fdclub123/출도착조회.PNG?type=w773"
            }]
        });
        session.beginDialog('/');
    } 
).triggerAction({ 
    matches: '출도착조회' 
}); 

bot.dialog('pass', //여기에 matching됨
    (session) => { 
        session.send({
            attachments : [{
                contentType: "image/jpeg",
                contentUrl: "https://postfiles.pstatic.net/MjAxOTAxMjlfMTcg/MDAxNTQ4NzIyNzI1MjE1.2JeiOZajUx1_TuQNo6FqmJBrZXiIm2gTJsryje2psp0g.sXBelwjD6IbwZf2XPutrz07As7S4oMQNnn0PiUtk69Mg.PNG.fdclub123/예약조회.PNG?type=w773"
            }]
        });
        session.beginDialog('/');
    } 
).triggerAction({ 
    matches: ['예약 확인', '예약조회']
}); 

bot.dialog('이벤트Dialog', [//여기에 matching됨
    function (session) {        
        builder.Prompts.choice(
            session, 
            " 이벤트에 대한 내용으로 이동하겠습니까? ", ["예", "아니요"],
            { listStyle: builder.ListStyle.button });
        },
        function(session, results) {
            session.userData.text = results.response.entity;
            if(session.userData.text == '예'){
               // opens the url in the default browser 
               opn('https://www.jinair.com/promotion/eventList');
               session.beginDialog('/');
            }
            else{
                session.endDialog();
                session.beginDialog('/')
            }
        }          
    ]).triggerAction({ 
    matches: '이벤트'
}); 

bot.dialog('next_process', [
    function(session){
        builder.Prompts.choice(
            session,
            "다른 특가상품을 보여드릴까요?  ", ["예", "아니오"],
            { listStyle: builder.ListStyle.button });
    },
    function(session, results) {
        session.userData.text = results.response.entity;
        //console.log(`entity: ${results.response.entity}`);
        
        if(session.userData.text == '예'){
            session.beginDialog('특가Dialog');
        }
        else if(session.userData.text == '아니오'){
            session.beginDialog('/');
        }
    }
])


bot.dialog('특가Dialog', [//여기에 matching됨
    function (session) {        
        session.send('현재 진행중인 특가를 알려드립니다.'); 
        session.send('알고싶은 월(달)을 선택 해주세요.'); 
        builder.Prompts.choice(
            session, 
            " 해당 월(달)의 특가로 이동합니다.", ["1월 ~ 3월", "4월 ~ 6월", "7월 ~ 9월", "10월 ~ 12월"],
            { listStyle: builder.ListStyle.button });
        },

        function (session, results) {
            console.log(`month : ${results.response.entity}`);

            session.userData.month = results.response.entity;
            if(session.userData.month === '1월 ~ 3월'){
                let cards = [ //카드로 받아서
                    new builder.HeroCard(session)
                    .title('1~3월 출발편 대상 특가 프로모션')
                    .subtitle('막내가 사장실 구경가는 프로모션')
                    .text('#막내야_우리는_ #수하물도_주고 #기내식도_주는데 #이_가격은_어디서_왔어?^^')
                    .images([
                        builder.CardImage.create(session, 'https://imgur.com/3AzjrdQ.png')
                    ])
                    .buttons([
                        builder.CardAction.openUrl(session, 'https://www.jinair.com/promotion/eventView?evntSeq=10784', '자세히 보기')
                    ]),

                    new builder.HeroCard(session)
                    .title('오키나와 가족여행 -인싸등극 프로젝트-')
                    .subtitle('오키나와 가족맞춤형 특급혜택')
                    .text('#일본여행_ #핵인싸의 길_ 진에어가 깐깐하게 준비한 오키나와 가족맞춤형 특급혜택을 만나보세요!')
                    .images([
                        builder.CardImage.create(session, 'https://imgur.com/jdGdMET.png')
                    ])
                    .buttons([
                        builder.CardAction.openUrl(session, 'https://www.jinair.com/promotion/eventView?evntSeq=10742', '자세히 보기')
                    ]),

                    new builder.ThumbnailCard(session)
                    .title('Unbelievable! Is it true?')
                    .subtitle('진에어가 보다 완벽한 여행을 위한\n여행도우미 3총사를 소개합니다.')
                    .text('최대 50% 호텔 할인 혜택, 특별한 렌터카 할인 혜택, 안전한 여행을 위한 내 보험')
                    .images([
                        builder.CardImage.create(session, 'https://imgur.com/hLWb8Qy.png')
                    ])
                    .buttons([
                        builder.CardAction.openUrl(session, 'https://www.jinair.com/travel/rentcar', '자세히 보기')
                    ]),
                ];

                var reply = new builder.Message(session) //카드로 응답한다
                    .attachmentLayout(builder.AttachmentLayout.carousel)
                    .attachments(cards);

                session.send(reply);
                session.beginDialog('next_process');

            }else if(session.userData.month == '4월 ~ 6월'){
                let cards = [ //카드로 받아서
                    new builder.HeroCard(session)
                    .title('하와이 커플여행 특전')
                    .subtitle('둘만의 사진들, 둘만의 비밀거리! 지금 하와이에서 만들어보세요.')
                    .text('무료수하물에 기내식까지, 가성비 넘치는 가격으로 부담 없이 하와이 커플 여행을 떠나보세요.')
                    .images([
                        builder.CardImage.create(session, 'https://imgur.com/mKFjivc.png')
                    ])
                    .buttons([
                        builder.CardAction.openUrl(session, 'https://www.jinair.com/promotion/endEventView?evntSeq=10456', '자세히 보기')
                    ]),

                    new builder.HeroCard(session)
                    .title('괌 모녀여행 특전')
                    .subtitle('디어, 마이맘 : 베스트 프렌드 엄마와 함께하는 특별한 괌여행')
                    .text('엄마와 함께하는 여행을 응원합니다! 가족이 사랑하는 괌, 괌 여행정보를 한눈에 만나보세요!')
                    .images([
                        builder.CardImage.create(session, 'https://imgur.com/rfFCh1F.png')
                    ])
                    .buttons([
                        builder.CardAction.openUrl(session, 'https://www.jinair.com/promotion/endEventView?evntSeq=10455', '자세히 보기')
                    ]),

                    new builder.HeroCard(session)
                    .title('진에어 부킹닷컴 동남아 지역 프로모션')
                    .subtitle('즐거움이 넘치는 동남아로 가요')
                    .text('진에어와 부킹닷컴이 추천하는 동남아 지역 주요 숙박지와 주요특가 호텔 리스트를 만나보세요!')
                    .images([
                        builder.CardImage.create(session, 'https://imgur.com/RZrnKBp.png')
                    ])
                    .buttons([
                        builder.CardAction.openUrl(session, 'https://www.jinair.com/promotion/endEventView?evntSeq=10475', '자세히 보기')
                    ]),

                    new builder.ThumbnailCard(session)
                    .title('Unbelievable! Is it true?')
                    .subtitle('진에어가 보다 완벽한 여행을 위한\n여행도우미 3총사를 소개합니다.')
                    .text('최대 50% 호텔 할인 혜택, 특별한 렌터카 할인 혜택, 안전한 여행을 위한 내 보험')
                    .images([
                        builder.CardImage.create(session, 'https://imgur.com/hLWb8Qy.png')
                    ])
                    .buttons([
                        builder.CardAction.openUrl(session, 'https://www.jinair.com/travel/rentcar', '자세히 보기')
                    ]),
                ];

                var reply = new builder.Message(session) //카드로 응답한다
                    .attachmentLayout(builder.AttachmentLayout.carousel)
                    .attachments(cards);

                session.send(reply);
                session.beginDialog('next_process');

            } else if(session.userData.month == '7월 ~ 9월'){
                let cards = [ //카드로 받아서
                    new builder.HeroCard(session)
                    .title('하와이 소아운임 특가이벤트')
                    .subtitle('가족 할인에 쇼핑혜택까지, 특별한 섬 하와이 오아후로 가족여행 떠나세요!')
                    .text('어린이 동반 하와이 여행시 어린이 인원 제한 없이 소아 운임 할인!')
                    .images([
                        builder.CardImage.create(session, 'https://imgur.com/2ySorwk.png')
                    ])
                    .buttons([
                        builder.CardAction.openUrl(session, 'https://www.jinair.com/promotion/endEventView?evntSeq=10533', '자세히 보기')
                    ]),

                    new builder.HeroCard(session)
                    .title('도심 속 여름휴양지 홍콩으로 떠나자!')
                    .subtitle('쇼핑, 음식, 휴양, 화려한 밤까지 완벽한 홍콩으로 떠나자!')
                    .text('다양한 루프탑 수영장과 한 시간 내 거리에 있는 호젓한 해변, 이 모두를 품고 있는 홍콩이 바로 리얼 휴양지!')
                    .images([
                        builder.CardImage.create(session, 'https://imgur.com/K5LQn4v.png')
                    ])
                    .buttons([
                        builder.CardAction.openUrl(session, 'https://www.jinair.com/promotion/endEventView?evntSeq=10635', '자세히 보기')
                    ]),

                    new builder.HeroCard(session)
                    .title('진에어와 함께 기타큐슈로 떠나자!')
                    .subtitle('새롭게 떠오르고 있는 규슈여행의 관문 기타큐슈로 고고씽~!')
                    .text('진에어가 추천하는 기타큐슈 여행코스로 잊지 못할 추억을 만들어 보자!')
                    .images([
                        builder.CardImage.create(session, 'https://imgur.com/kesGmed.png')
                    ])
                    .buttons([
                        builder.CardAction.openUrl(session, 'https://www.jinair.com/promotion/endEventView?evntSeq=10694', '자세히 보기')
                    ]),

                    new builder.ThumbnailCard(session)
                    .title('Unbelievable! Is it true?')
                    .subtitle('진에어가 보다 완벽한 여행을 위한\n여행도우미 3총사를 소개합니다.')
                    .text('최대 50% 호텔 할인 혜택, 특별한 렌터카 할인 혜택, 안전한 여행을 위한 내 보험')
                    .images([
                        builder.CardImage.create(session, 'https://imgur.com/hLWb8Qy.png')
                    ])
                    .buttons([
                        builder.CardAction.openUrl(session, 'https://www.jinair.com/travel/rentcar', '자세히 보기')
                    ]),
                ];

                var reply = new builder.Message(session) //카드로 응답한다
                    .attachmentLayout(builder.AttachmentLayout.carousel)
                    .attachments(cards);

                session.send(reply);
                session.beginDialog('next_process');

            }else if(session.userData.month == '10월 ~ 12월'){
                let cards = [ //카드로 받아서
                    new builder.HeroCard(session)
                    .title('조호르바루 특가부터 헤택까지!')
                    .subtitle('요즘 핫한 가족 여행지, 조호르바루 특가부터 혜택까지!')
                    .text('슈퍼로우 운임 347,600원 부터[무료 수하물 15KG, 기내식 포함]')
                    .images([
                        builder.CardImage.create(session, 'https://imgur.com/XD6GvJF.png')
                    ])
                    .buttons([
                        builder.CardAction.openUrl(session, 'https://www.jinair.com/promotion/endEventView?evntSeq=10656', '자세히 보기')
                    ]),

                    new builder.HeroCard(session)
                    .title('규슈를 한 번에, 다구간 특별혜택!')
                    .subtitle('후쿠오카와 기타큐슈를 진에어와 함께 한 방에!')
                    .text('후쿠오카와 기타큐슈를 한 방에 즐기고자 하는 분들께 진에어가 푸짐하게 경품 쏩니다.')
                    .images([
                        builder.CardImage.create(session, 'https://imgur.com/GcxKQBE.png')
                    ])
                    .buttons([
                        builder.CardAction.openUrl(session, 'https://www.jinair.com/promotion/endEventView?evntSeq=10741', '자세히 보기')
                    ]),

                    new builder.HeroCard(session)
                    .title('도쿄 감성여행 인싸등극 프로젝트')
                    .subtitle('올 FW시즌, 감성지수 폭발하는 도쿄로 떠나자!')
                    .text('#일본여행_ #핵인싸의 길')
                    .images([
                        builder.CardImage.create(session, 'https://imgur.com/JnHMZtn.png')
                    ])
                    .buttons([
                        builder.CardAction.openUrl(session, 'https://www.jinair.com/promotion/endEventView?evntSeq=10739', '자세히 보기')
                    ]),

                    new builder.ThumbnailCard(session)
                    .title('Unbelievable! Is it true?')
                    .subtitle('진에어가 보다 완벽한 여행을 위한\n여행도우미 3총사를 소개합니다.')
                    .text('최대 50% 호텔 할인 혜택, 특별한 렌터카 할인 혜택, 안전한 여행을 위한 내 보험')
                    .images([
                        builder.CardImage.create(session, 'https://imgur.com/hLWb8Qy.png')
                    ])
                    .buttons([
                        builder.CardAction.openUrl(session, 'https://www.jinair.com/travel/rentcar', '자세히 보기')
                    ]),
                ];

                var reply = new builder.Message(session) //카드로 응답한다
                    .attachmentLayout(builder.AttachmentLayout.carousel)
                    .attachments(cards);

                session.send(reply);
                session.beginDialog('next_process');

            }else{
                session.endDialog();
                session.beginDialog('/')
            }
        }          
    ]).triggerAction({ 
    matches: '특가'
}); 

bot.dialog('맞춤항공권Dialog',[
    function (session) {
        // Display Welcome card with Hotels and Flights search options
        if (session.message && session.message.value) {
            console.log(session.message.value);
            var Query_2 = session.message.value.destination;
            var data_2 = LoadInfo.getLuisIntent(Query_2);
            var Place_Entity;
            Place_Entity = builder.EntityRecognizer.findEntity(data_2.entities, '도시/공항');
            // A Card's Submit Action obj was received
            if(session.message.value.type != 'cancel'){
                if(Place_Entity != null){
                // 정상인 경우
                    if(session.message.value.type == 'search_info'){
                        session.beginDialog('hotels-search', session.message.value);
                        return;
                    }
                    else if(session.message.value.type == 'save_info'){
                        session.beginDialog('save-info', session.message.value);
                        return;
                    }
                }
                else{
                    if(Place_Entity == null){
                        session.send('진에어 취항지가 아닙니다.');
                    };
                    session.message.value = null; //이전의 잘못된 메세지 내용이 저장되어있어 다음으로 안넘어가고 무한루프로 실행됨. => 메세지 내용 삭제 => 다시 시작함
                };
            }
            else{
                session.beginDialog('/');
                return;
            }
            
        }
        var card = {
            'contentType': 'application/vnd.microsoft.card.adaptive',
            'content': {
                '$schema': 'http://adaptivecards.io/schemas/adaptive-card.json',
                'type': 'AdaptiveCard',
                'version': '1.0',
                'body': [
                    {
                        'type': 'Container',
                        'speak': '<s>안녕하세요 맞춤항공권 서비스 입니다!</s><s>아래의 항목에 정보를 기입해주세요. </s>',
                        'items': [
                            {
                                'type': 'ColumnSet',
                                'columns': [
                                    {
                                        'type': 'Column',
                                        'size': 'auto',
                                        'items': [
                                            {
                                                'type': 'Image',
                                                'url': 'https://imgur.com/jxxSK5s.png',
                                                'size': 'medium',
                                                'style': 'person'
                                            }
                                        ]
                                    },
                                    {
                                        'type': 'Column',
                                        'size': 'stretch',
                                        'items': [
                                            {
                                                'type': 'TextBlock',
                                                'text': '안녕하세요!',
                                                'weight': 'bolder',
                                                'isSubtle': true
                                            },
                                            {
                                                'type': 'TextBlock',
                                                'text': '비행기 출발지와 출발날짜, 기간, 테마를 입력해주세요.',
                                                'wrap': true
                                            }
                                        ]
                                    }
                                ]
                            }
                        ]
                    }
                ],
                'actions': [
                    // 입력하기 Search form
                    {
                        'type': 'Action.ShowCard',
                        'title': '입력하기',
                        'speak': '<s>입력하기</s>',
                        'card': {
                            'type': 'AdaptiveCard',
                            'body': [
                                {
                                    'type': 'TextBlock',
                                    'text': '진에어 방문을 환영합니다!',
                                    'speak': '<s>진에어 방문을 환영합니다!</s>',
                                    'weight': 'bolder',
                                    'size': 'large'
                                },
                                {
                                    'type': 'TextBlock',
                                    'text': '출발지를 입력해주세요 :'
                                },
                                {
                                    'type': 'Input.Text',
                                    'id': 'destination',
                                    'speak': '<s>출발지를 입력해주세요 :</s>',
                                    'placeholder': '예) 인천',
                                    'default' : '인천',
                                    'style': 'text'
                                },
                                {
                                    'type': 'TextBlock',
                                    'text': '예산을 입력해주세요 ( 단위 KRW10,000 ):'
                                },
                                {
                                    'type': 'Input.Text',
                                    'id': 'budget',
                                    'speak': '<s>예산을 입력해주세요 :</s>',
                                    'default' : '1'
                                },
                                {
                                    'type': 'TextBlock',
                                    'text': '기간을 입력해주세요 ( 단위 일 ) :'
                                },
                                {
                                    'type': 'Input.Text',
                                    'id': 'period',
                                    'speak': '<s>기간을 입력해주세요 :</s>',
                                    'default' : '1'
                                },
                                {
                                    'type': 'TextBlock',
                                    'text': '테마를 선택해주세요 :'
                                },
                                {
                                    'type': 'Input.ChoiceSet',
                                    'id': 'theme',
                                    "style":"compact",
                                    "choices": [
                                        {
                                            "title": "해변",
                                            "value": "해변",
                                            "isSelected": true
                                        },
                                        {
                                            "title": "도시",
                                            "value": "도시"
                                        },
                                        {
                                            "title": "쇼핑",
                                            "value": "쇼핑"
                                        },
                                        {
                                            "title": "유소아동반",
                                            "value": "유소아동반"
                                        },
                                        {
                                            "title": "미식",
                                            "value": "미식"
                                        },
                                        {
                                            "title": "친구",
                                            "value": "친구"
                                        }
                                    ],
                                    'speak': '<s>테마를 선택해주세요 :</s>',
                                    'default' : '친구'
                                }
                            ],
                            'actions': [
                                {
                                    'type': 'Action.Submit',
                                    'title': '검색',
                                    'speak': '<s>Search</s>',
                                    'data': {
                                        'type': 'search_info'
                                    }
                                },
                                {
                                    'type': 'Action.Submit',
                                    'title': '알림 설정',
                                    'speak': '<s>Search</s>',
                                    'data': {
                                        'type': 'save_info'
                                    }
                                },
                                {
                                    'type': 'Action.Submit',
                                    'title': '취소',
                                    'speak': '<s>Search</s>',
                                    'data': {
                                        'type': 'cancel'
                                    }
                                }
                            ]
                        }
                    }
                ]
            }
             };
             var msg = new builder.Message(session).addAttachment(card);
             session.send(msg);
    }
]).triggerAction({
        matches: '맞춤항공권'
});


bot.dialog('hotels-search', [(session, value, next)=>{
    console.log(value);
    session.send('해당 내용이 없습니다.');
    session.message.value = null;
    session.beginDialog('맞춤항공권Dialog');
    }
]);

bot.dialog('save-info', [(session, value, next)=>{
    console.log(value);
    log.FuncUpsert(['notify',value.destination,value.budget,value.period,value.theme],TempID);
    session.send("선택하신 내용으로 알림 설정 완료 되었습니다.");
    session.message.value = null;
    session.beginDialog('/');
    }
]);

bot.dialog('시작화면Dialog', //여기에 matching됨
    (session) => { 
            session.beginDialog('/')
        } 
    
).triggerAction({ 
    matches: '시작화면' 
});