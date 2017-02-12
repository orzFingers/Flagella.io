/// Initialize Node.js
///----------------------------------------------
var express = require('express');  
var app = express();  
var server = require('http').createServer(app);  
var io = require('socket.io')(server);
var port = process.env.PORT || 3000;


/*
var sha1 = require(‘sha1’);
var msg = “super secret code”;
var hash = sha1(msg);
*/

var game_core = require(__dirname + '/public/game_core.js');

app.use(express.static('public'));
app.use(express.static(__dirname + '/bower_components'));  
app.get('/', function(req, res,next) {  
    res.sendFile(__dirname + '/index.html');
});


/// Initialize game_core
///----------------------------------------------
var gameCore = new game_core(true);
gameCore.init();


/// Set Node.js responses
///----------------------------------------------

// Update all clients
function sync() {
    io.emit('sync', gameCore.update() );
}
// ~22 times per second
setInterval(sync, 45);

// Client connected. Add player to game, give player to client.
io.on('connection', function(client) {
	console.log("User connected");
	
	client.on('joinGame', function(data){
		console.log(data.name + ' joined the game');
		var initX = Math.random()*400-200;
		var initY = Math.random()*400-200;
		var player = gameCore.addPlayer( {x: initX, y: initY, name: data.name, playerClass: data.playerClass} );
		
		
		client.emit('giveSelf',  {
			name: player.name,
			id: player.id, 
			x: player.x, 
			y: player.y,
			playerClass: player.playerClass
			});
			
		client.emit('givePlayers', gameCore.getPlayers() );
		
		client.emit('giveFood', gameCore.getFood() );
		
		client.broadcast.emit('giveEnemy', {
			name: player.name, 
			id: player.id, 
			x: player.x, 
			y: player.y,
			playerClass: player.playerClass
			});
		
	});
	client.on('rejoinGame', function(data){
		console.log(data.name + ' joined the game');
		var initX = Math.random()*100;
		var initY = Math.random()*100;
		var player = gameCore.addPlayer( {x: initX, y: initY, name: data.name, playerClass: data.playerClass} );
		
		
		client.emit('giveSelf',  {
			name: player.name,
			id: player.id, 
			x: player.x, 
			y: player.y,
			playerClass: player.playerClass
			});
		
		client.broadcast.emit('giveEnemy', {
			name: player.name, 
			id: player.id, 
			x: player.x, 
			y: player.y,
			playerClass: player.playerClass
			});
		
	});

	client.on('sync', function(data){
		//Receive data from clients
		if(data != undefined){
			gameCore.addInput(data.id, data.input);
		}
	});
	client.on('latency', function(data){
		data.server_time = new Date().getTime();
		client.emit('latency', data );
		gameCore.heartBeat(data.playerID);
	});
});

console.log("listening on port: "+port);

server.listen(port);