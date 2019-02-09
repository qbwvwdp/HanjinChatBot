var mongoClient = require("mongodb").MongoClient;
var assert = require('assert');
var objectId = require('mongodb').ObjectID;
var async = require('async');
var cosmosDB;
require('dotenv').config();

var username = encodeURIComponent(process.env.CosmosDBName);
var password = encodeURIComponent(process.env.CosmosDBPassword);
var cosmosHost = process.env.CosmosDBHost;
var cosmosPort = process.env.CosmosDBPort;
var connectString = `${cosmosHost}:${cosmosPort}/${process.env.CosmosDBName}?ssl=true&replicaSet=globaldb`;
var url = 'mongodb://';
url += username;
url += ':' + password;
url += '@' + connectString;

var chatlogDb = process.env.CosmosDBDB;
var logCollection = process.env.CosmosDBCollection;
var TempUserID = 'qbwvwdp';

function Init(callback) {    
    mongoClient.connect(url, { useNewUrlParser: true }, function (err, client) {
        assert.equal(null, err);
        cosmosDB = client.db(chatlogDb);    
        callback();
    });
}

function Log(log, callback) {
    
    /*
    cosmosDB.collection(logCollection).insertOne(
        { 
            log
        }, 
        function (err, result) {            
            if(err)
            {
                console.log(`${logCollection} 컬렉션에 로그 입력 실패`);
                callback();
            }else {                
                callback();
            }
        });
        */
}
function FuncUpsert(a,ID){
    var oldData;
    FindUserFunc(ID,(param)=>{
        oldData = JSON.parse(param);
        if(a[0]=='notify')
        {
            var cursor = cosmosDB.collection(logCollection).findOneAndUpdate(
                        {UserID:ID},
                        { $set: {
                            UserID : ID,
                            schedule:
                            {
                                depart : (oldData.schedule.depart === undefined  || oldData.schedule.depart === null ? null : oldData.schedule.depart),
                                arrive : (oldData.schedule.arrive === undefined  || oldData.schedule.arrive === null ? null : oldData.schedule.arrive),
                                date :   (oldData.schedule.date === undefined  || oldData.schedule.date === null ? null : oldData.schedule.date)
                            },
                            notify:
                            { 
                                depart : (oldData.notify.depart === undefined  || oldData.notify.depart === null ? new Array(a[1]) : (JSON.stringify(oldData.notify.depart+","+a[1]).substr(1,JSON.stringify(oldData.notify.depart+","+a[1]).length-2)).split(",")),
                                asset : (oldData.notify.asset === undefined  || oldData.notify.asset === null ? new Array(a[2].toString()) : (JSON.stringify(oldData.notify.asset+","+a[2]).substr(1,JSON.stringify(oldData.notify.asset+","+a[2]).length-2)).split(",")
                                ),
                                period : (oldData.notify.period === undefined  || oldData.notify.period === null ? new Array(a[3].toString()) : (JSON.stringify(oldData.notify.period+","+a[3]).substr(1,JSON.stringify(oldData.notify.period+","+a[3]).length-2)).split(",")),
                                theme : (oldData.notify.theme === undefined  || oldData.notify.theme === null ? new Array(a[4]) : (JSON.stringify(oldData.notify.theme+","+a[4]).substr(1,JSON.stringify(oldData.notify.theme+","+a[4]).length-2)).split(","))
                            }
                        }
                    },
                    {upsert : true, returnNewDocument: false },
                    function(err,doc) {
                        if (err) {throw(err);}
                        else { console.log("*@*@*@*@*@*  U p d a t e d  -  N O T I F Y  *@*@*@*@*@*@"); }}
            );
        }
        else if(a[0]=='schedule'){
            var cursor = cosmosDB.collection(logCollection).findOneAndUpdate(
                {UserID:ID},
                { $set: {
                    UserID : ID,
                    schedule:
                    {
                        depart : (oldData.schedule.depart === undefined  || oldData.schedule.depart === null ? new Array(a[1]) : (JSON.stringify(oldData.schedule.depart+","+a[1]).substr(1,JSON.stringify(oldData.schedule.depart+","+a[1]).length-2)).split(",")),
                        arrive : (oldData.schedule.arrive === undefined  || oldData.schedule.arrive === null ? new Array(a[2]) : (JSON.stringify(oldData.schedule.arrive+","+a[2]).substr(1,JSON.stringify(oldData.schedule.arrive+","+a[2]).length-2)).split(",")),
                        date :   (oldData.schedule.date === undefined  || oldData.schedule.date === null ? new Array(a[3]) : (JSON.stringify(oldData.schedule.date+","+a[3]).substr(1,JSON.stringify(oldData.schedule.date+","+a[3]).length-2)).split(","))
                    },
                    notify:
                    { 
                        depart : (oldData.notify.depart === undefined  || oldData.notify.depart === null ? null : oldData.notify.depart),
                        asset : (oldData.notify.asset === undefined  || oldData.notify.asset === null ? null : oldData.notify.asset),
                        period : (oldData.notify.period === undefined  || oldData.notify.period === null ? null : oldData.notify.period),
                        theme : (oldData.notify.theme === undefined  || oldData.notify.theme === null ? null : oldData.notify.theme)
                    }
                }
            },
            {upsert : true, returnNewDocument: false },
            function(err,doc) {
                if (err) {throw(err);}
                else { console.log("*@*@*@*@*@*  U p d a t e d   -   S C H E D U L E *@*@*@*@*@*@"); }}
    );

        }
    })
}
function FindUserFunc(ID,callback){
   var cursor = cosmosDB.collection(logCollection).find({ UserID: ID });
   cursor.each(function(err, doc) {
        assert.equal(err, null);
        if (doc != null) {
            var tmp = JSON.stringify(doc);
            //console.dir(doc);
            callback(tmp);
        } else {
            //console.log('끝');
        }
    });
}
function InsertFunc(ID){
        cosmosDB.collection(logCollection).insertOne(
            {UserID : ID,
                schedule:
                    {
                        depart : null,
                        arrive : null,
                        date : null
                    },
                notify:
                    { 
                        depart : null,
                        asset : null,
                        period : null,
                        theme : null
                    }
            },
            function (err, result) {            
                if(err)
                {
                    console.log(`${logCollection} 컬렉션에 로그 입력 실패`);
                }
            });
    

} 

exports.Init = Init; // 다른 곳에서 실행 가능하도록 해줌. ex) app.js
exports.Log = Log;
exports.InsertFunc = InsertFunc;
exports.FuncUpsert = FuncUpsert;
exports.FindUserFunc = FindUserFunc;