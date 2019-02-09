var mongoClient = require("mongodb").MongoClient;
var assert = require('assert');


mongoClient.connect("mongodb://qbwvwdp-bot-cosmosmongodb:gsQvhucxBJJeLD4obOe0i4qT8VVXRo4vUq7vs97qfkpRp2eCboBfrvxxnNtnoCt5BQ70JNYxxGXlqfGAEKRCQw%3D%3D@qbwvwdp-bot-cosmosmongodb.documents.azure.com:10255/?ssl=true", function (err, client) {
    var tid = 'qbwvwdp'
    var db = client.db('chat-log');
    var cursor =db.collection('chat').find({ UserID: tid },{UserID : 1, _id : 0} );
    console.log(cursor)
    
    console.log("-----------------------------------------------------------------------------------");
    cursor.each(function(err, doc) {
        assert.equal(err, null);
        if (doc != null) {
            console.dir(doc);
        } else {
            console.log('끝');
        }
    });

    console.log("==================================================================================");

    
    client.close();
});