const path = require('path');
const http = require('http');
const express = require('express');
const socketIO = require('socket.io');
var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;
// var mongoose = require('mongoose/');
var {MongoClient}=require('mongodb');
const {generateMessage, generateLocationMessage} = require('./message');
const {isRealString} = require('./validation');
const {Users}=require('./users');
var session = require('express-session');
const publicPath = path.join(__dirname, '../public');
const port = process.env.PORT || 3000;
var app = express();
app.use(session({
    secret: 'node-chat-app',
    resave: false,
    saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());


app.use(express.static(publicPath));
var bodyParser = require('body-parser');
app.use(bodyParser.json()); // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true }));


  
var url = 'mongodb://akash:clash22@ds127443.mlab.com:27443/node-chat-app';      
//var url='mongodb://localhost:27017/Auth';
//mongoose.connect(url);
var _db;
 MongoClient.connect(url, function (err, db) {
  if (err) 
   return console.log('Unable to connect to the mongoDB server. Error:', err);
  else 
    console.log('Connection established to', url);
       _db=db;
    });    
app.post('/signup', function(req, res) {
    var user = req.body.name;
    var pass = req.body.pass;
    var pass2 = req.body.pass2;

    console.log(user,pass,pass2);
   
    
    _db.collection('Users').insertOne({
      username:user,
      password:pass
    }, (err,result)=>{
      if(err)
      return console.log('Unable to insert data',err);
      console.log(JSON.stringify(result.ops,undefined,2));
    });
     // req.session.username=user; 
    res.redirect(301, '/');
res.end();
});

app.get('/login', function(req, res) {
  res.sendFile(publicPath+'/login.html');
});
app.get('/signup', function(req, res) {
  res.sendFile(publicPath+'/signup.html');
});

app.post('/login',
  passport.authenticate('local', {
    successRedirect: '/loginSuccess',
    failureRedirect: '/loginFailure',
    session:true
  })
);

app.get('/loginFailure', function(req, res, next) {
  res.sendFile(publicPath+'/loginFail.html');
});

app.get('/loginSuccess', function(req, res, next) {
  
   console.log('Logged in',req.user,req.user.username,req.user.password);
   res.redirect('/room');
});

app.get('/room',function(req,res){
  res.sendFile(publicPath+'/join.html');
});
app.get('/api/user_data', function(req, res) {

            if (req.user === undefined) {
                // The user is not logged in
                res.json({});
            } else {
                res.json({
                    username: req.user.username
                });
            }
        });

var users=new Users();
 app.get('/api/room_data', function(req, res) {

      var roomsArray=users.getRooms();
      console.log(roomsArray);
      res.json(JSON.stringify(roomsArray));
  
        });

passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(user, done) {
  done(null, user);
});



passport.use(new LocalStrategy(function(username, password, done) {
  process.nextTick(function() {
    _db.collection('Users').findOne({username:username}).then((docs)=>{
        console.log(JSON.stringify(docs,undefined,2));
         if (!docs) {
        return done(null, false);
      }

      if (docs.password != password) {
        return done(null, false);
      }
     
      return done(null, docs);
     },(err)=>{
         console.log(err);
         return done(err);
     });
  })
}));

  
var server = http.createServer(app);
var io = socketIO(server);

io.on('connection', (socket) => {
  console.log('New user connected');

 
  socket.on('join', (params,callback)=>{
if(!isRealString(params.name)||!isRealString(params.room))
return callback('Name and room number are required');

socket.join(params.room);
users.removeUser(socket.id);
users.addUser(socket.id,params.name,params.room);
io.to(params.room).emit('updateUserList',users.getUserList(params.room));
 socket.emit('newMessage', generateMessage('Admin', 'Welcome to the chat app'));
 socket.broadcast.to(params.room).emit('newMessage', generateMessage('Admin', `${params.name} has joined`));


callback();
  });

  socket.on('createMessage', (message, callback) => {
    var user=users.getUser(socket.id);
    if(user&&isRealString(message.text))
    io.to(user.room).emit('newMessage', generateMessage(user.name, message.text));
    
    callback();
  });

  socket.on('createLocationMessage', (coords) => {
    var user=users.getUser(socket.id);
    if(user)
    io.to(user.room).emit('newLocationMessage', generateLocationMessage(user.name, coords.latitude, coords.longitude));
  });

  socket.on('disconnect', () => {
    console.log('User was disconnected');
    var user=users.removeUser(socket.id);
    if(user){
      io.to(user.room).emit('updateUserList',users.getUserList(user.room));
      io.to(user.room).emit('newMessage',generateMessage('Admin',`${user.name} has left`));
    }
  });
});

server.listen(port, () => {
  console.log(`Server is up on ${port}`);
});
