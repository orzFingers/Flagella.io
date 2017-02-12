/*
	client.js:
	creates new game_core,
	handles input and adds to player (client),
	draws all objects,
	handles client to server output,
	handles server to client input
*/

/// Get Window and game_core, Handle Input
///----------------------------------------------

var gameCore = new game_core(false);
gameCore.init();

var c = document.getElementById("gameCanvas");
var context = c.getContext("2d");

// Add key listener
window.addEventListener("keydown", doKeyDown, true);
window.addEventListener("keyup", doKeyUp, true);


var keys = {
	W: false, 
	S: false, 
	A: false, 
	D: false,
	L_MOUSE: false,
	REQUEST_INCREASE_STAT: null
	}
function resetKeys(){
	keys.W = false;
	keys.S = false;
	keys.A = false;
	keys.D = false;
	keys.L_MOUSE = false;
	keys.REQUEST_INCREASE_STAT = null;
}
	
var mouseX = 0;
var mouseY = 0;
	
var inputChanged = true;

function doKeyDown(e){
	inputChanged = true;
	
	if(e.keyCode == 87){ // W
		keys.W = true;
	}
	if(e.keyCode == 83){ // S
		keys.S = true;
	}
	if(e.keyCode == 65){ // A
		keys.A = true;
	}
	if(e.keyCode == 68){ // D
		keys.D = true;
	}
}
function doKeyUp(e){
	inputChanged = true;
	
	if(e.keyCode == 87){ // W
		keys.W = false;
	}
	if(e.keyCode == 83){ // S
		keys.S = false;
	}
	if(e.keyCode == 65){ // A
		keys.A = false;
	}
	if(e.keyCode == 68){ // D
		keys.D = false;
	}
}


window.addEventListener('mousemove', function(evt) {
		inputChanged = true;
        var mousePos = getMousePos(c, evt);
		mouseX = mousePos.x;
		mouseY = mousePos.y;
      }, false);
	  
function getMousePos(c, evt) {
        var rect = c.getBoundingClientRect();
        return {
          x: evt.clientX - rect.left,
          y: evt.clientY - rect.top
        };
}

function mouseDown(){
	inputChanged = true;
	keys.L_MOUSE = true;
}
function mouseUp(){
	inputChanged = true;
	keys.L_MOUSE = false;
}
// Attach mousedown to canvas
window.addEventListener("mousedown", mouseDown);
window.addEventListener("mouseup", mouseUp);




var numInputs = 0;


function processKeys(){ // called each frame.
	if(!player)
		return;
	
	// create input object and send to gameCore
	// preprocess: override keys if some are active
	if(keys.W)
		keys.S = false;
	if(keys.A)
		keys.D = false;
	if(keys.S)
		keys.W = false;
	if(keys.D)
		keys.A = false;
	
	var input = [{
		W: keys.W, 
		S: keys.S, 
		A: keys.A, 
		D: keys.D,
		SPACE: keys.SPACE,
		L_MOUSE: keys.L_MOUSE,
		REQUEST_INCREASE_STAT: keys.REQUEST_INCREASE_STAT, // an index, modified in addStat()
		attackStart: player.input[player.input.length-1].attackStart, // previous attackStart, potentially updated in gameCore
		turnInertia: 0,
		
		startTime: gameCore.currentFrame,
		deltaTime: gameCore.currentFrame - gameCore.lastFrame,
		inputID: ++numInputs,
		x: null,// Set in gameCore then server. Server writes to, but does not read the coordinates
		y: null,
		angle: 0, // Must be set in gameCore then server, like .x/.y
		requestAngle: Math.atan2(mouseY - ScreenH/2, mouseX - ScreenW/2),
		validated: false
	}];
	
	// wipe temporary input
	keys.REQUEST_INCREASE_STAT = null;
	
	gameCore.addInput(player.id, input);
}

/// World Variables
///-----------------------------------------
var ScreenX = 0;
var ScreenY = 0;
var MidScreenX = 0;
var MidScreenY = 0;
var ScreenW = c.width;
var ScreenH = c.height;
var ScreenWHalf = ScreenW / 2;
var ScreenHHalf = ScreenH / 2;
var gameState = "login"; // "login", "connecting", "playing"

var name = "Jim"+Math.random();
var id = null;
var player = null; // just a reference to me.
var playerClass = 0;
var hasPreviouslyConnected = false;

//var latency = 0;
//var server_offset = 0;

// Images
var IMG_bg = document.getElementById("IMG_bg");
var IMG_Bear = document.getElementById("IMG_Bear");
var IMG_Creature1 = document.getElementById("IMG_Creature1");
var IMG_Fire = document.getElementById("IMG_Fire");
var IMG_Mouth1 = document.getElementById("IMG_Mouth1");
var IMG_Food = document.getElementById("IMG_Food");
var IMG_FoodEaten = document.getElementById("IMG_FoodEaten");


var classImages = [IMG_Creature1, IMG_Bear, IMG_Fire];



/*
function drawPlayers_OLD(){
	//context.beginPath();
	var players = gameCore.players;//.getPlayers();
	context.lineWidth = 5;
	context.strokeStyle = '#555555';
	context.font = "14px Arial";
	context.textAlign="center"
	for(var i=players.length-1; i>=0; --i){
		var p = players[i];
		var x = p.interpX - ScreenX;
		var y = p.interpY - ScreenY;
		
		// draw player
		context.beginPath();
		context.arc( x, y, gameCore.getPlayerBodyRadius(p), 0, 2 * Math.PI, false);
		if(p == player) // User
			context.fillStyle = '#00b2e1';
		else // Other players
			context.fillStyle = '#f14e54';
		context.fill();
		context.lineWidth = 30;
		context.strokeStyle = '#555555';
		context.stroke();
		
		// draw fist
		var fistExtend = gameCore.getPlayerFistExtend(p);
		var fistPos = gameCore.getPlayerFistLocation(p);
		fistPos.x -= ScreenX;
		fistPos.y -= ScreenY;
		context.beginPath();
		context.arc( fistPos.x, fistPos.y, gameCore.getPlayerFistRadius(p), 0, 2 * Math.PI, false);
		context.fill();
		
		// draw player name
		context.fillStyle = '#ffffff';
		context.fillText(p.name,x, y + gameCore.getPlayerBodyRadius(p)+15);
	}
}
*/
function drawPlayers(){
	
	//context.beginPath();
	var players = gameCore.players;//.getPlayers();
	context.lineWidth = 0.00001;
	context.strokeStyle = '#f6f7f8';
	context.font = "16px Arial Black";
	context.textAlign="center"
	var fistImage;
	for(var i=players.length-1; i>=0; --i){
		var p = players[i];
		var x = p.interpX - ScreenX;
		var y = p.interpY - ScreenY;
		var radius = gameCore.getPlayerBodyRadius(p);
		
		// -- Draw Player (image, first body segment)
		context.lineWidth = 0.00001;
		context.beginPath();
		context.arc( x, y, radius, 0, 2 * Math.PI, false);
		context.save(); // -- we want to remove the clip after drawing players
		context.clip();
		context.strokeStyle = '#f6f7f8';
		context.stroke();
		// rotate
		context.translate(x, y);
		context.rotate(p.interpAngle);
		//draw
		context.drawImage(classImages[p.playerClass], -radius, -radius, radius*2, radius*2);
		context.restore(); // -- restore context
		
		
		
		// -- Draw Fist
		context.lineWidth = 0.00001;
		fistImage = IMG_Mouth1;
		var fistRadius = gameCore.getPlayerFistRadius(p);
		var fistExtend = gameCore.getPlayerFistExtend(p);
		var fistPos = gameCore.getPlayerFistInterpLocation(p);
		fistPos.x -= ScreenX;
		fistPos.y -= ScreenY;
		
		// outline (cutout)
		context.beginPath();
		context.arc( fistPos.x, fistPos.y, fistRadius, 0, 2 * Math.PI, false);
		
		// rotated clipped image
		context.save(); // -- we want to remove the clip after drawing players
		context.clip();
		context.strokeStyle = '#f6f7f8';
		context.stroke();
		
		//draw
		context.translate(fistPos.x, fistPos.y);
		context.rotate(p.interpAngle);
		context.drawImage(fistImage, -fistRadius, -fistRadius, fistRadius*2, fistRadius*2);
		context.restore(); // -- restore context
		// End Draw Fist Image
		
		// -- Draw Body
		context.lineWidth = 2;
		var body = p.body;
		context.strokeStyle = '#f6f7f8';
		for(var j=1; j<body.length; j++){
			context.beginPath();
			context.arc( x + body[j].x, y + body[j].y, body[j].radius, 0, 2 * Math.PI, false);
			context.stroke();
		}
		
		
		
		// draw player name
		context.fillStyle = '#888';
		context.fillText(p.name,x, y + gameCore.getPlayerBodyRadius(p)+15);
	}
}
function isVisible(x, y){
	return (Math.abs(x-MidScreenX) < ScreenWHalf*1.2  &&  Math.abs(y-MidScreenY) < ScreenHHalf*1.2);
}
function drawFood(){
	// draw food
	for(var i=0; i<gameCore.food.length; i++){
		if( isVisible( gameCore.food[i].x, gameCore.food[i].y ) )
			context.drawImage(IMG_Food, gameCore.food[i].x - ScreenX, gameCore.food[i].y - ScreenY);
	}
	// draw food eaten animation
	var animations = gameCore.foodEatenAnimations;
	var animationSpeed = 0.00015;
	console.log("foodEatenAnimations.length: "+animations.length);
	for(var i=0; i<animations.length; ++i){ // check each animation
		if(gameCore.currentFrame > animations[i].frame){
			var x = animations[i].x;
			var y = animations[i].y;
			var frameDiff = gameCore.currentFrame - animations[i].frame;
			var size = (1.0 - frameDiff / gameCore.foodEatenAnimationLength) * 12;
			for(var j=0; j<animations[i].offsets.length; j++){
				console.log("animations[i].offsets.length: "+animations[i].offsets.length);
				var offsetX = animations[i].offsets[j].x;
				var offsetY = animations[i].offsets[j].y;
				var distance = (frameDiff * animationSpeed) + 0.015;
				context.drawImage(IMG_FoodEaten,  (x + offsetX * distance ) - ScreenX, (y + offsetY * distance ) - ScreenY, size, size);
			}
			
		}
		
	}
}



function drawBackground(){
	var spacing = 500;
	var width = ScreenW / spacing+1;
	var height = ScreenH / spacing+1;
	 xOffset = ScreenX % spacing;
	 yOffset = ScreenY % spacing;
	
	// draw vertical lines
	context.strokeStyle = "#ababab";
	context.beginPath();
	context.lineWidth = 1;
	
	var MapSize = gameCore.MapSize+1;
	
	var xStart = -MapSize - ScreenX;
	var yStart = -MapSize - ScreenY;
	var xEnd = xStart + MapSize*2;
	var yEnd = yStart + MapSize*2;
	
	for(var i=0; i<=width; i++){
		var x = i*spacing - xOffset;
		if(x < xStart)
			continue;
		else if(x > xEnd)
			break;
		
		context.moveTo( x, yStart );
		context.lineTo( x, yEnd );
	}
	
	// draw horizontal lines
	for(var i=0; i<=height; i++){
		var y = i*spacing - yOffset;
		
		if(y < yStart)
			continue;
		else if(y >  yEnd)
			break;
		
		context.moveTo( xStart, y );
		context.lineTo( xEnd, y );
	}
	context.stroke();
}

function getCircleY(r, x){
  return Math.sqrt(r*r - x*x);
}


function drawStarsBackground(){
	//var IMG_SIZE = 18;
	var IMG_W = 610;//IMG_SIZE;//78;
	var IMG_H = 386;//IMG_SIZE;//107;
	
	for(var i=0; i<ScreenW/IMG_W+2; i++){
		for(var j=0; j<ScreenH/IMG_H+2; j++){
			var startX = -( (ScreenX/4) % IMG_W)-IMG_W;
			var startY = -( (ScreenY/4) % IMG_H)-IMG_H;
			
			var x = startX + i*IMG_W;
			var y = startY + j*IMG_H;
			context.drawImage(IMG_bg, x, y);
		}
	}
}

function drawSquareBackground(){
	var MapSize = 400;//gameCore.MapSize;
	
	var x = (-MapSize)-ScreenX;
	var y = (-MapSize)-ScreenY;
	context.fillStyle = '#555555';//'#eeeeee';//'#555555';
	context.fillRect(x,y, MapSize*2,MapSize*2);
}


function drawCircleBackground(){
	// draw stars background
	
	
	
	
	
	var circleX = 0;
	var circleY = 0;
	var CircleRadius = gameCore.MapSize;
	
	var x = circleX - ScreenX;
	var y = circleY - ScreenY;
	
	
	
	
	
	context.lineWidth = 3;
	context.strokeStyle = '#555555';
	context.arc( x, y, CircleRadius, 0, 2 * Math.PI, false);
	context.fillStyle = '#eeeeee';
	context.fill();
	context.stroke();
	
	/*
	var spacing = 30;
	var width = ScreenW / spacing+1;
	var height = ScreenH / spacing+1;
	 xOffset = ScreenX % spacing;
	 yOffset = ScreenY % spacing;
	
	// draw vertical lines
	context.strokeStyle = "#ababab";
	context.beginPath();
	context.lineWidth = 1;
	for(var i=0; i<width; i++){
		var x = i*spacing - xOffset;
		
		context.moveTo( x, 0 );
		context.lineTo( x, ScreenH );
	}
	
	
	// draw horizontal lines
	for(var i=0; i<height; i++){
		var size = getCircleY(CircleRadius, i*spacing);
		//var startX = circleX - ScreenX - size;
		//var endX = startX + y*2;
		var startY = circleY - ScreenY - size;
		//var endY = startX + y*2;
		
		var lineY = i*spacing;
		startX = y - getCircleY(CircleRadius, lineY);
		endX = getCircleY(CircleRadius, lineY) * 2; 
		
		
		
		var y = i*spacing - yOffset;
		
		context.moveTo( startX, startY );
		context.lineTo( endX, startY );
	}
	context.stroke();
	*/
}


// ---------- HTML Manipulation

function setupLogin(){
	document.getElementById("loginModal").style.display = "block";
	document.getElementById("username").focus(); // set focus to input
}
function login(){
	name =  document.getElementById("username").value;
	document.getElementById("loginModal").style.display = "none";
	if(!hasPreviouslyConnected){
		hasPreviouslyConnected = true;
		socket.emit('joinGame', {name: name, playerClass: playerClass});
	}
	else
		socket.emit('rejoinGame', {name: name, playerClass: playerClass});
}

function selectCharacter(elem, i){
	playerClass = i;
	// reset the class of it's siblings, as we don't know which was selected previously
	var children = elem.parentNode.parentNode.children;
	for(var i=0; i<children.length; i++){
		//if(children[i] === elem) continue;
		children[i].children[0].setAttribute("class", "classImage spinning");
	}
	// now set the class of this element
	elem.setAttribute("class", "classImage spinning fastSpinning");
	// return focus to player name
	document.getElementById("username").focus();
}


function createMeter(text, hasButton){
	// outline and background
	var meter = document.createElement("div");
	meter.setAttribute("class", "meter");
		
	// bar
	var bar = document.createElement("span");
	bar.setAttribute("class", "meterBar");
		
	// name
	var name = document.createElement("span");
	name.setAttribute("class", "meterText");
	name.innerHTML = text;
	
	// button
	if(hasButton){
		var button = document.createElement("span");
		button.setAttribute("class", "meterButton");
		
		var plus = document.createElement("span");
		plus.setAttribute("class", "cross");
		button.appendChild(plus);
		
		meter.appendChild(button);
	}
	
	// attach elements together
	meter.appendChild(bar);
	
	meter.appendChild(name);
	
	
	return meter;
}

function generateScore(){
	var numScores = 10;
    var collection = document.getElementById('score');
	collection.setAttribute("class", "scoreTable");
	
	// title
	var title = document.createElement("div");
	title.setAttribute("class", "scoreTitle");
	title.innerHTML = "Scoreboard";
	collection.appendChild(title);
	
	// each score
	for(var i=0; i<numScores; i++){
		
		// outline and background
		var meter = createMeter("");
		
		// attach
		collection.appendChild(meter);
	}
}
generateScore();

function populateScoreTable(score){

    var collection = document.getElementById('score');
	for(var i=0; i<10; i++){
		var name;
		var value;
		if(i < score.length){
			name = score[i].name;
			value = score[i].score;
			value = value>10 ? 10 : value;
		}
		else{
			name = "";
			value = 0;
		}
		
		var meter = collection.children[i+1]; // offset by 1 for the title.
		var bar = meter.children[0];
		var nameCell = meter.children[1];
		
		bar.style.width = value*10 + "%";
		nameCell.innerHTML = name;
	}
}
//populateScoreTable([]);

var numStats = 4;
var statsLength = 9;
var sepOffset = 15;
var sepSpacing = (100-sepOffset*2) / (statsLength-1);

function generateStats(){
	
	
    var collection = document.getElementById('stats');
	collection.setAttribute("class", "statsTable");
	
	
	// each stat
	for(var i=0; i<numStats; i++){
		
		// outline and background
		var statName = gameCore.getStatDisplayName(i);
		var meter = createMeter(statName, true);
		meter.children[1].style.borderRadius = "5px 0px 0px 5px";
		
		// separators
		for(var j=0; j<9; j++){
			var left = sepOffset + sepSpacing * j + "%";
			var separator = document.createElement("div");
			separator.setAttribute("class", "meterSeparator");
			separator.style.left = left;
			
			meter.appendChild(separator);
		}
		
		
		// attach
		collection.appendChild(meter);
		// give the meter button an action.
		meter.children[0].addEventListener("click", addStat.bind(null, i) );
	}
}
generateStats();

function populateStatsTable(){
	
	var numStats = 4;
	var statsLength = 9;
    var collection = document.getElementById('stats');
	for(var i=0; i<numStats; i++){
		var stat = gameCore.playerGetStat(player, i);
		var meter = collection.children[i];
		var bar = meter.children[1];
		var offset=0;
		if(stat > 0){
			--stat;
			offset = sepOffset;
		}
		bar.style.width = offset + sepSpacing * stat + "%";
	}
}





function addStat(i){
	if(!player)
		return;
	
	keys.REQUEST_INCREASE_STAT = i;
}

















function update(){
	// Take input
	// Sync to server
	
	if(player != null){
		processKeys();
		gameCore.processInput(player); // for logging. So we can reference any x/y change
		syncToServer();
	}
}
setInterval( update, gameCore.msPerFrame);






var frameCount=0;
function draw(){
	++frameCount;
	//Get the time of this frame.
	//currentFrame = new Date().getTime() - latency - server_offset;
	
	// Get new input, save it, then process all
	
	/*if(player != null){
		//processKeys();
	}*/
	
	// update game
	gameCore.update();
	//document.getElementById("fps").innerHTML = parseInt(gameCore.frameRate);
	
	// send our input updates to the server
	
	/*if(player != null){
		//syncToServer();
	}*/
	
	// Update canvas size
	c.width = window.innerWidth;
	c.height = window.innerHeight;
	ScreenW = c.width;
	ScreenH = c.height;
	ScreenWHalf = ScreenW / 2;
	ScreenHHalf = ScreenH / 2;
	if(player != null){
		ScreenX = player.interpX - ScreenW/2;
		ScreenY = player.interpY - ScreenH/2;
		MidScreenX = ScreenX + ScreenWHalf;
		MidScreenY = ScreenY + ScreenHHalf;
	}
	
	
	// clear screen
	context.fillStyle = "#ffffff";
	context.fillRect(0,0,c.width, c.height);
	
	// draw
	drawStarsBackground();
	//drawSquareBackground();
	//drawCircleBackground();
	drawBackground();
	drawFood();
	drawPlayers();
	
	// draw done. update again.
	requestAnimationFrame(draw);
}
draw();





////------------ Server Functions

//var socket = io('http://punchoutio2.azurewebsites.net/');
var socket = io('http://localhost:3000');

socket.on('sync', function(data) {
	// Take all data from other players/objects
	// update all character inputs. special case for self.
	var playersUpdate = data.playersUpdate;
	// Do the opposite. Run through all players. If an update is not available for them delete it.
	for(var i=0; i<gameCore.players.length; i++){
		var foundMatch = false;
		var playerID = gameCore.players[i].id;
		for(var j=0; j<playersUpdate.length; j++){
			if(playerID == playersUpdate[j].id){ // found a match
				foundMatch = true;
				//console.log("found match in playersUpdate");
				// Set the character's input to this new input.
				if(playersUpdate[j].input)
					gameCore.newInput(playersUpdate[j].id, playersUpdate[j].input);
				if(playersUpdate[j].stats)
					gameCore.playerUpdateStats(playersUpdate[j].id, playersUpdate[j].stats);
			}
		}
		if(!foundMatch){
			// if user, set gameState to login
			if( player != null && playerID == player.id){
				console.log("-----Removing Self----");
				player = null;
				id = null;
				numInputs = 0;
				gameState = "login";
				resetKeys();
				setupLogin();
			}
			gameCore.removePlayer(playerID);
		}
	}
	
	// Use Score:
	populateScoreTable( data.score );
	// Update Stats display:
	if(player)
		populateStatsTable();
	// Use foodToAdd, foodToRemove
	if(data.foodToAdd){
		for(var i=0; i<data.foodToAdd.length; i++){
			gameCore.addFood( data.foodToAdd[i].x, data.foodToAdd[i].y, data.foodToAdd[i].id );
		}
	}
	//if(data.foodToRemove){
		for(var i=0; i<data.foodToRemove.length; i++){
			gameCore.removeFood( data.foodToRemove[i].id );
		}
	//}
	
});

// called at beginning
socket.on('giveSelf', function(data) { // Very Important! This should be called from server before 'givePlayers'
	console.log("given self. id= "+data.id);
	player = gameCore.addPlayer(data, true);
	id = data.id;
	//player = gameCore.getPlayer(data.id);
});
// called at begining
socket.on('givePlayers', function(data) {
	// add all players including self
	for(var i=0; i<data.length; i++){
		gameCore.addPlayer(data[i]);
	}
	// find me in the list of players
	//player = gameCore.getPlayer(id);
});
socket.on('giveFood', function(data) {
	// add all current food
	for(var i=0; i<data.length; i++){
		gameCore.addFood(data[i].x, data[i].y, data[i].id);
	}
});

socket.on('giveEnemy', function(data) {
	gameCore.addPlayer(data);
});

socket.on('latency', function(data) {
	gameCore.latency = 0;//( new Date().getTime() - data.client_time )/2;
	gameCore.server_offset = 0;//(data.client_time - gameCore.latency) - data.server_time;
});

function syncToServer(){
	//inputChanged = false;
	// Give server most recent input data
	socket.emit('sync', {
		id: player.id, 
		input: [player.input[player.input.length-1]]
		});
}

setInterval(function(){
	socket.emit('latency', {
		client_time: new Date().getTime(),
		playerID: player.id
		});
}, 5000);

