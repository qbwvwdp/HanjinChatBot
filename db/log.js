var mongoClient = require("mongodb").MongoClient;
var assert = require('assert');
var objectId = require('mongodb').ObjectID;
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

function Init(callback) {    
    mongoClient.connect(url, { useNewUrlParser: true }, function (err, client) {
        assert.equal(null, err);
        cosmosDB = client.db(chatlogDb);    
        callback();
    });
}

function Log(log, callback) {    
    cosmosDB.collection(logCollection).insertOne(
        { 
            log,
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
}

exports.Init = Init; // 다른 곳에서 실행 가능하도록 해줌. ex) app.js
exports.Log = Log;