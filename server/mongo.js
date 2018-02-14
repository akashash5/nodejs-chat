var {MongoClient} = require('mongodb');
//var url = 'mongodb://akash:clash22@ds127443.mlab.com:27443/node-chat-app';      
var url='mongodb://localhost:27017/Auth';
var _db;

module.exports = {

  connectToServer: function( callback ) {
    MongoClient.connect( url, function( err, db ) {
      _db = db;
      return callback( err );
    } );
  },

  getDb: function() {
    return _db;
  }
};