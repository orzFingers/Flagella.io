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
//gameCore.init();

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
		
		startTime: currentFrame,
		deltaTime: currentFrame-lastFrame,
		inputID: ++numInputs,
		x: player.x, // First set here, 
		y: player.y,  // then set by the server.
		angle: Math.atan2(mouseY - ScreenH/2, mouseX - ScreenW/2),
		move: { // the client creates the move attribute, but the server sets it.
			x: 0, // works as xChange, slowed by friction
			y: 0
		}
	}];
	
	// wipe temporary input
	keys.REQUEST_INCREASE_STAT = null;
	
	gameCore.addInput(player.id, input);
}

/// World Variables
///-----------------------------------------
var ScreenX = 0;
var ScreenY = 0;
var ScreenW = c.width;
var ScreenH = c.height;
var gameState = "login"; // "login", "connecting", "playing"

var name = "Jim"+Math.random();
var id = null;
var player = null; // just a reference to me.
var hasPreviouslyConnected = false;




function drawPlayers(){
	//context.beginPath();
	var players = gameCore.players;//.getPlayers();
	context.lineWidth = 5;
	context.strokeStyle = '#555555';
	context.font = "14px Arial";
	context.textAlign="center"
	for(var i=players.length-1; i>=0; --i){
		var p = players[i];
		var x = p.x - ScreenX;
		var y = p.y - ScreenY;
		
		// draw player
		context.beginPath();
		context.arc( x, y, gameCore.getPlayerBodyRadius(p), 0, 2 * Math.PI, false);
		if(p == player) // User
			context.fillStyle = '#00b2e1';
		else // Other players
			context.fillStyle = '#f14e54';
		context.fill();
		context.lineWidth = 3;
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
		context.fillText(p.name,x, y + gameCore.getPlayerBodyRadius(p)+15);
	}
}



function drawBackground(){
	var spacing = 30;
	var width = ScreenW / spacing+1;
	var height = ScreenH / spacing+1;
	 xOffset = ScreenX % spacing;
	 yOffset = ScreenY % spacing;
	
	// draw vertical lines
	context.strokeStyle = "#ababab";
	context.beginPath();
	context.lineWidth = 1;
	
	var MapSize = gameCore.MapSize;
	
	var xStart = -MapSize - ScreenX;
	var yStart = -MapSize - ScreenY;
	var xEnd = xStart + MapSize*2;
	var yEnd = yStart + MapSize*2;
	
	for(var i=0; i<width; i++){
		var x = i*spacing - xOffset;
		if(x < xStart)
			continue;
		else if(x > xEnd)
			break;
		
		context.moveTo( x, yStart );
		context.lineTo( x, yEnd );
	}
	
	// draw horizontal lines
	for(var i=0; i<height; i++){
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

var IMG_stars = document.getElementById("IMG_stars");
function drawStarsBackground(){
	var IMG_SIZE = 300;
	
	for(var i=0; i<ScreenW/IMG_SIZE+1; i++){
		for(var j=0; j<ScreenH/IMG_SIZE+1; j++){
			var startX = -(ScreenX % IMG_SIZE)-IMG_SIZE;
			var startY = -(ScreenY % IMG_SIZE)-IMG_SIZE;
			
			var x = startX + i*IMG_SIZE;
			var y = startY + j*IMG_SIZE;
			context.drawImage(IMG_stars, x, y);
		}
	}
}

function drawSquareBackground(){
	var MapSize = 400;//gameCore.MapSize;
	
	var x = (-MapSize)-ScreenX;
	var y = (-MapSize)-ScreenY;
	context.fillStyle = '#555555';
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
/*
function drawStat(value){
	var statX = 20;
	var statY = 20;
	var spacing = 3;
	var boxSize = 15;
	
	//Damage
	// draw background
	
	context.beginPath();
	context.rect(statX-spacing, statY-spacing, boxSize + 10*(spacing+boxSize) +spacing*2, boxSize +spacing*2);
	context.fillStyle = 'yellow';
	context.fill();
	
	for(var i=0; i<10; i++){
		var x = statX + i*(spacing + boxSize);
		
		context.beginPath();
		context.rect(x, statY, boxSize, boxSize);
		if(i < value) // filled
			context.fillStyle = 'grey';
		else
			context.fillStyle = 'white';
		context.fill();
	}
	
}
*/

/// --------- Server Globals and Functions
var currentFrame = new Date().getTime();
var lastFrame = currentFrame;








// ---------- HTML Manipulation

function setupLogin(){
	document.getElementById("loginModal").style.display = "block";
}
function login(){
	name =  document.getElementById("username").value;
	document.getElementById("loginModal").style.display = "none";
	if(!hasPreviouslyConnected){
		hasPreviouslyConnected = true;
		socket.emit('joinGame', {data: 'foo!', name: name});
	}
	else
		socket.emit('rejoinGame', {data: 'foo!', name: name});
}

function populateScoreTable(score){
	var rows = document.getElementById("scoreTable").rows;
	
	for(var i=0; i<10; i++){
		var name;
		var value;
		if(i < score.length){
			name = score[i].name;
			value = score[i].score;
		}
		else{
			name = "-";
			value = "-";
		}
		
		var nameCell = rows[i+1].cells[0];
		var scoreCell = rows[i+1].cells[1];
		
		nameCell.innerHTML = name;
		scoreCell.innerHTML = value;
	}
}
populateScoreTable([]);


function createStatBox(){
	var size = 1+"px";
	var box = document.createElement("div");
	box.style.backgroundColor = "#373737";//"#6690ea";
	box.style.width = size;
	box.style.height = size;
	box.style.padding = "4px";
	box.style.border = "4px solid #373737";
	box.style.cssFloat = "left";
	
	return box;
}
function createStatButton(){
	var size = 1+"px";
	var box = document.createElement("div");
	
	box.style.backgroundColor = "green";
	box.style.width = size;
	box.style.height = size;
	box.style.padding = "4px";
	box.style.border = "4px solid #373737";
	box.style.cssFloat = "left";
	
	
	return box;
}

function createStatTitle(statText){
	var title = document.createElement("div");
	title.innerHTML = statText;
	title.style.position = "relative";
	title.style.cssFloat = "right";
	title.style.left = "-50%";
	title.style.textAlign = "center";
	title.style.margin = "auto";
	title.style.color = "magenta";
	title.style.width = "150px";
	
	return title;
}

function generateStatsTable(){
	var numStats = 5;
	var statLength = 10;
    var table = document.getElementById('stats');
	for(var i=0; i<numStats; i++){
		// add row
		// create rowDiv with box background
		// create divBoxes, and attach each to diV
		// Make divBoxes inline
		var row = document.createElement("div");
		// Add stat boxes
		for(var j=0; j<statLength; j++){
			//var cell = row.insertCell();
			var box = createStatBox();
			row.appendChild(box);
		}
		
		// add button
		var statButton = createStatButton();
		row.appendChild(statButton);
		row.style.paddingBottom = "22px";
		
		var title = createStatTitle( gameCore.getStatDisplayName(i) );
		row.appendChild(title);
		
		table.appendChild(row);
		statButton.addEventListener("click", addStat.bind(null, i) );
	}
}
generateStatsTable();

//var stats = [ 0, 0, 0, 0, 0 ];

function populateStatsTable(){
	
	var numStats = 5;
	var statLength = 10;
    var table = document.getElementById('stats');
	for(var i=0; i<numStats; i++){
		var row = table.children[i];
		var stat = gameCore.playerGetStat(player, i);
		for(var j=0; j<statLength; j++){
			var box = row.children[j];
			if(j < stat)
				box.style.backgroundColor = "#6690ea";
		}
	}
}
//populateStatsTable();

function addStat(i){
	if(!player)
		return;
	
	keys.REQUEST_INCREASE_STAT = i;
}
























var frameCount=0;
function draw(){
	++frameCount;
	//Get the time of this frame.
	lastFrame = currentFrame;
	currentFrame = new Date().getTime();
	
	// Get new input, save it, then process all
	if(player != null){
		processKeys();
	}
	
	// update game
	gameCore.update();
	
	// send our input updates to the server
	if(player != null){
		syncToServer();
		//console.log("player x="+player.x+" y="+player.y);
		//console.log("player.input.length = "+player.input.length);
	}
	
	// Update canvas size
	c.width = window.innerWidth;
	c.height = window.innerHeight;
	ScreenW = c.width;
	ScreenH = c.height;
	if(player != null){
		ScreenX = player.x - ScreenW/2;
		ScreenY = player.y - ScreenH/2;
	}
	
	
	// clear screen
	context.fillStyle = "#cdcdcd";
	context.fillRect(0,0,c.width, c.height);
	
	// draw
	drawStarsBackground();
	drawSquareBackground();
	//drawCircleBackground();
	drawBackground();
	drawPlayers();
	
	// draw done. update again.
	requestAnimationFrame(draw);
}
draw();





////------------ Server Functions

//var socket = io('http://punchoutio2.azurewebsites.net/');//('http://localhost:3000');
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
				//if(playersUpdate[j].move)
					//gameCore.playerUpdateMove(playersUpdate[j].id, playersUpdate[j].move);
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
				setupLogin();
			}
			gameCore.removePlayer(playerID);
		}
	}
	
	/// Use Score:
	populateScoreTable( data.score );
	/// Update Stats display:
	if(player)
		populateStatsTable();
	
});

// called at beginning
socket.on('giveSelf', function(data) { // Very Important! This should be called from server before 'givePlayers'
	console.log("given self. id= "+data.id);
	player = gameCore.addPlayer(data.x, data.y, data.name, data.id);
	id = data.id;
	//player = gameCore.getPlayer(data.id);
});
// called at begining
socket.on('givePlayers', function(data) {
	// add all players including self
	for(var i=0; i<data.length; i++){
		gameCore.addPlayer(data[i].x, data[i].y, data[i].name, data[i].id);
	}
	// find me in the list of players
	//player = gameCore.getPlayer(id);
});

socket.on('giveEnemy', function(data) {
	gameCore.addPlayer(data.x, data.y, data.name, data.id);
});

function syncToServer(){
	//inputChanged = false;
	// Give server most recent input data
	socket.emit('sync', {
		id: player.id, 
		input: player.input
		});
}