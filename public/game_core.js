/*
game_core.js
functionality: 
	Creates and interfaces game world to:
	control characers, collide items, adjust internal state.
	All game logic is here, both for client and server (which are generally the same)

*/

/// Helper Functions 
///-----------------------------------------------
function dynamicSort(property) {
    var sortOrder = 1;
    if(property[0] === "-") {
        sortOrder = -1;
        property = property.substr(1);
    }
    return function (a,b) {
        var result = (a[property] < b[property]) ? -1 : (a[property] > b[property]) ? 1 : 0;
        return result * sortOrder;
    }
}

function getDistance(x1, y1, x2, y2){
	return Math.sqrt( (x1-x2)*(x1-x2) + (y1-y2)*(y1-y2) );
}
function getWithinSquare(x1, y1, x2, y2, size){
	return (Math.abs(x2-x1)<size  &&  Math.abs(y2-y1)<size);
}

// collision stuff
function sqr(x) { return x * x }
function dist2(v, w) { return sqr(v.x - w.x) + sqr(v.y - w.y) }
function distToSegmentSquared(p, v, w) {
  var l2 = dist2(v, w);
  if (l2 == 0) return dist2(p, v);
  var t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  return dist2(p, { x: v.x + t * (w.x - v.x),
                    y: v.y + t * (w.y - v.y) });
}
/// Distance of point{x,y} from point, to lineP0, lineP1
function distToSegment(p, v, w) { return Math.sqrt(distToSegmentSquared(p, v, w)); }



function getPN0(x){
	if(x > 0)
		return 1;
	if(x < 0)
		return -1;
	return 0;
}
function getAngleDiff(currentAngle, requestAngle){ // get normalized difference between 2 angles
	var diff = requestAngle - currentAngle;
	var dist = Math.abs(diff);
	if(dist > Math.PI){
		var oppSign = -1 * getPN0(diff);
		dist = Math.PI * 2 - dist;
		var angleChange = oppSign * dist;
	}
	else
		var angleChange = diff;
	
	return angleChange;
}

function getCircleY(r, x){
  return Math.sqrt(r*r - x*x);
}


// Check if on server or client... actually, this should also set the "isServer" variable. Minor oversight, you understand.
if( 'undefined' !== typeof global ) {
    module.exports = global.game_core = game_core;
}

// All body code is declared outside the game_core class. It will probably be integrated into it's own class,
// because it will be so large, and functionally separate from the game_core

function addSegment(body, radius){ // takes array, possibly empty, as argument.
	body.push(
		{ radius: radius,
		  x: 0, // initial value doesn't matter
		  y: 0,
		  displayFrame: 0 // Useful in determining which input this will represent
		  // and attachments...
		}
	);
}

function createBody( species ){
	var body = [];
	var numSegments = 4;
	var radius = 15; // we need to get number of segments, segment radius, and attachments from a species data function.
	for( var i=0; i<numSegments; i++){
		addSegment(body, radius - 2*i);
	}
	
	return body;
}

function updateBody(player){
	var body = player.body;
	var angle = player.angle + Math.PI;
	var turnInertia = player.turnInertia;//10; // turnIneria must always have an absolute value of <= 1.0
	var x = 0;//player.x;
	var y = 0;//player.y;
	// For all segments, update (x,y) positions by turnInertia and radius
	var radius = 0;
	var segmentAngle = angle;
	for( var i=0; i<body.length; i++){
		//segmentAngle = angle + bodyAngle;//(getCircleY(1, bodyAngle)-1) * getPN0(bodyAngle);
		//segmentAngle = angle + (bodyAngle*bodyAngle)/1 * getPN0(bodyAngle)*-1;
		
		body[i].x = x + Math.cos(segmentAngle + turnInertia*i*0.0018) * radius;
		body[i].y = y + Math.sin(segmentAngle + turnInertia*i*0.0018) * radius;
		
		radius = body[i].radius; // comes last
		x = body[i].x; // comes last
		y = body[i].y; // comes last
		segmentAngle += radius * turnInertia * -0.026;
	}
}
/*
var Attachments{
	
}

var Species = {};


function generateSpecies(){
	Species.
}

*/
function createModularBody( species ){
	var body = {
		segments: [],
		actionAttachments: [] // attachment references
	};
	// For the species, add the number of segments of the correct type and their attachments, and for each attachment that does an action, add it to actionAttachments
	
	
}
/*

body{
 actionAttachments[]{ internalAttachmentReference }
 segments[]{ attachment{ type, placement }, shape, radius, placementDistance }
}
body{
 actionAttachments[]{ internalAttachmentReference },
 segments[]{ x, y, angle, shape, radius, placementDistance, attachments[]{ x, y }, }
}
*/





/*
Body Segment Process:
init
-createBody(){ addSegment() }
update
-updateBody() // once per update, not per input


*/


/// Game_Core Functions
///----------------------------------------------
function game_core(isServer){ // takes truthy or falsey value

	this.isServer = (isServer == true); // just to be safe

	this.frameRate = 0; // for drawing. Not currently averaged over time for slow change.
	
	this.food = [];
	this.MaxFood = 1000;
	this.foodCount = 0;
	this.foodRadius = 25;
	this.foodToAdd = [];
	this.foodToRemove = [];
	
	this.foodEatenAnimations = []; // client only.
	this.foodEatenAnimationLength = 450; // animation will play for 450ms
	
	this.sectors = []; // sectors[][].{food[], characters[]} // object references organized into sectors of the map
	this.SectorSize = 500;
	
	this.players = [];
	this.currentFrame = new Date().getTime();
	this.displayFrame = this.currentFrame;
	this.lastFrame = this.currentFrame;
	this.timeOut = 10 * 1000;// 10 seconds;
	
	this.msPerFrame =  1000/45;//45;//1000/60;// ~60fps
	this.fps = 1000/this.msPerFrame;
	
	this.MapSize = 4000;
	
	this.delayAmount = 200; // 12 frames
	
	var PlayerMovePerSecond = 6.5;
	this.PlayerMoveSpeed = PlayerMovePerSecond/(this.fps); // move per frame
	this.PlayerMoveForce = this.PlayerMoveSpeed / (500.0); // 500 frames to reach max
	this.Friction = 1.00 / (this.fps);//almost nothing
	this.PlayerRotateSpeed = Math.PI / 60; // 100
	
	this.PlayerFistForce = 0.2;
	
	this.PlayerBodyRadius = 36;
	this.PlayerFistExtend = 1;
	this.BaseFistRadius = 20;
	this.BaseFistTime = 750;// Full extend time
	this.BaseFistExtend = this.PlayerBodyRadius*2;
	
	
	this.positionLookUpTable = []; // use "getRandomPosition()", random (x, y) positions on map.
	this.positionLookUpIndex = 0;
	
	this.offsetLookUpTable = []; // use "getRandomOffset()", set of 5(star shaped) (x,y) offsets generated as angled distanced points from origin, each 50 px from (0,0)
	this.offsetLookUpIndex = 0;
	// Initialize
	this.generateLookUpTables = function(){
		// offsetLookUpTable: set of 5 (x,y) offsets generated as angled distanced points from origin
		var increment = (2 * Math.PI) / 5 * 3; // 5 potential positions
		var radius = 350;
		for (var i=0; i<5; i++) {
		  this.offsetLookUpTable.push( { 
			x: Math.cos(i * increment) * radius,
			y: Math.sin(i * increment) * radius
		  } );
		}
		
		if(!this.isServer)
			return;
		
		// positionLookUpTable
		var SpawnRange = 0.9; // positions will be within 90% of the map
		var HalfSpawnArea = this.MapSize * SpawnRange;
		var TotalSpawnArea = HalfSpawnArea * 2;
		for (var i=1e6; i>0; i--) {
		  this.positionLookUpTable.push( { 
			x: Math.random() * TotalSpawnArea - HalfSpawnArea,
			y: Math.random() * TotalSpawnArea - HalfSpawnArea
		  } );
		}
	}
	
	this.createSectors = function(){
		var width = this.MapSize*2 / this.SectorSize;
		var height = this.MapSize*2 / this.SectorSize; // width and height may be different values later
		for(var x=0; x<width; ++x){
			this.sectors[x] = [];
			for(var y=0; y<height; ++y){
				this.sectors[x][y] = { food: [] };
			}
		}
	}
	
	this.getRandomPosition = function(){
		return ++this.positionLookUpIndex >= this.positionLookUpTable.length ? this.positionLookUpTable[this.positionLookUpIndex=0] : this.positionLookUpTable[this.positionLookUpIndex];
	}
	this.getRandomOffset = function(){
		return ++this.offsetLookUpIndex >= this.offsetLookUpTable.length ? this.offsetLookUpTable[this.offsetLookUpIndex=0] : this.offsetLookUpTable[this.offsetLookUpIndex];
	}
	
	
	
	
	// client variables
	if(!this.isServer){
		this.server_offset = 0;
		this.latency = 0;
	}
	
	
	
	this.init = function(){
		this.generateLookUpTables();
		this.createSectors();
	}
	
	
	/// Food Functions
	
	this.spawnFood = function(){
		var MaxFoodSpawn = 5; // local variable temporarily
		var SpawnArea = 0.9; // 90% of the map, from the center
		// spawn food when we have room to fill highest spawn group.
		var myRand = Math.random();
		var loopCount = 0;
		var amount;
		while(loopCount < 3 && this.food.length < this.MaxFood - MaxFoodSpawn){ // only 3 spawn groups per server frame.
			// Get amount
			if(myRand < 0.2){ // 20%
				var extra = Math.floor( myRand * 10 ); // extra is 0-2
				amount = 1 + extra;
			}
			else{ // 80%
				//var extra = Math.floor( myRand * 2 ); // extra is 0-1
				amount = 1;//+ extra;
			}
			
			// Get position
			var pos = this.getRandomPosition();
			
			// Spawn amount
			for(var i=0; i<amount; i++){
				var offset = this.getRandomOffset();
				this.addFood( pos.x + offset.x, pos.y + offset.y);
			}
			
			++loopCount;
		}
	}
	
	this.getSectorFromCoordinates = function(x, y){
		var sectorX = Math.floor((x + this.MapSize) / this.SectorSize);
		var sectorY = Math.floor((y + this.MapSize) / this.SectorSize);
		return this.sectors[sectorX][sectorY];
	}
	
	this.removeFoodFromSector = function(foodItem){ // only called by removeFood()
		var sectorFood = this.getSectorFromCoordinates( foodItem.x, foodItem.y ).food;
		// Performance: We should use a better method for searching for the food item, rather than just looping through the whole thing
		// Search for food in sector
		var id = foodItem.id;
		for(var i=0; i<sectorFood.length; i++){
			if(sectorFood[i].id == id){
				sectorFood[i] = sectorFood[ sectorFood.length-1 ]
				sectorFood.pop();
				break;
			}
		}
	}
	this.removeFood = function(id){
		// if on server, remove food from sector in addition to this.food[]
		
		// Performance: We should use a better method for searching for the food item, rather than just looping through the whole thing
		// Search for food in this.food[]
		for(var i=0; i<this.food.length; i++){
			if(this.food[i].id == id){
				console.log("removed food, id: "+id);
				
				if(this.isServer)
					this.removeFoodFromSector(this.food[i]);
				else
					this.addFoodEatenAnimation( this.food[i].x, this.food[i].y );
				
				this.foodToRemove.push( this.food[i] );
				this.food[i] = this.food[ this.food.length-1 ]
				this.food.pop();
				break;
			}
		}
		
		
	}
	
	this.addFood = function(x, y, id){ // only called by spawnFood()
		if(this.food.length >= this.MaxFood)
			return;
		if(!id) // on server
			var id = ++this.foodCount;
		this.food.push( {x: x, y: y, id: id} );
		var newFood = this.food[this.food.length-1];
		// Add food to sector array
		if(this.isServer)
			this.getSectorFromCoordinates(x, y).food.push( newFood );
		// Add food to foodToAdd so we can give it to players 
		this.foodToAdd.push( newFood );
		console.log("Added food at ("+x+", "+y+")");
	}
	
	this.getFood = function(){ // What? Does this have a purpose? ::REMOVEME::
		return this.food;
	}
	
	this.getFoodToAddCopy = function(){
		var foodToAddCopy = [];
		for(var i=0; i<this.foodToAdd.length; i++){
			foodToAddCopy.push( { 
				x: this.foodToAdd[i].x,
				y: this.foodToAdd[i].y,
				id: this.foodToAdd[i].id
			} );
		}
		return foodToAddCopy;
	}
	this.getFoodToRemoveCopy = function(){
		var foodToRemoveCopy = [];
		for(var i=0; i<this.foodToRemove.length; i++){
			foodToRemoveCopy.push( { 
				id: this.foodToRemove[i].id
			} );
		}
		return foodToRemoveCopy;
	}
	
	this.addFoodEatenAnimation = function(x, y){
		var offsets = [];
		for(var i=0; i<3; i++)
			offsets.push( this.getRandomOffset() );
		
		this.foodEatenAnimations.push( {
			x: x,
			y: y,
			frame: this.currentFrame,
			offsets: offsets
		} );
	}
	this.updateFoodEatenAnimations = function(){
		// remove old animations
		for(var i=0; i<this.foodEatenAnimations.length; ++i){
			if( this.currentFrame - this.foodEatenAnimations[i].frame > this.foodEatenAnimationLength ){
				this.foodEatenAnimations[i] = this.foodEatenAnimations[ this.foodEatenAnimations.length-1 ];
				this.foodEatenAnimations.pop();
			}
		}
	}
	
	
	
	/// Player Interface Functions
	///----------------------------------------------
	this.numPlayers=0;
	this.addPlayer = function(data, isUser){ // generates id on server
		var x = data.x;
		var y = data.y;
		var name = data.name;
		var _id = data.id;
		var playerClass = data.playerClass;
		
		
		
		// --- Body Stuff
		var species = 0;
		var body = createBody(species); // segment array
		// --- End Body Stuff
		
		
		
		
		if(!name) name = "Unnamed Player";
		console.log("adding player "+ name +", ("+x.toFixed(2)+","+y.toFixed(2)+")");
		var id;
		if(this.isServer) // setting id should be simplified.
			id = this.numPlayers++;
		else{ // on client
			id = _id;
			// if id is already a player, return
			var player = this.getPlayer(id);
			if(player != null){
				console.log("player '"+player.name+"', id:"+player.id+", is already present");
				return -1;
			}
		}
		
		
		this.players[this.players.length] = {
			x: x,
			y: y,
			angle: 0,
			xPrev: x, // previous coordinates. Used in collision
			yPrev: y,
			interpX: x,
			interpY: y,
			interpAngle: 0,
			name: name,
			id: id,
			playerClass: playerClass,
			
			species: species,
			body: body,
			turnInertia: 0,
			interpTurnInertia: 0,
			
			score: 0,
			lastInputProcessed: 0,
			lastPlayerToHitMe: -1, // no player hit me
			lastInputUpdate: 0, // last time an input was received.
			punchUsed: true, // if false, punch can hurt
			isUser: !!isUser,
			input: [{
				W: false, 
				S: false, 
				A: false, 
				D: false,
				SPACE: false,
				L_MOUSE: false,
				REQUEST_INCREASE_STAT: null, // request to increase stat. when falsey, none
				attackStart: 0, // set to previous attackTime/start. Used to see if we're attacking, but missed the input for it.
				turnInertia: 0,
				
				
				startTime: new Date().getTime(),
				deltaTime: 0,
				inputID: 0,//(this.isServer?0:1),
				x: x, 
				y: y,
				angle: 0, // current angle player is facing
				requestAngle: 0, // requested angle player wants to face
				move: {
					x: 0, // not initialized properly (...how?)
					y: 0
				},
				validated: true
			}],
			state: {
				fistOffset: 0 // just for drawing purposes. get fistExtend with getPlayerFistExtend(player)
			},
			stats: {
				FIST_SIZE: 0,
				BODY_SIZE: 0,
				MOVE_SPEED: 0,
				FIST_FORCE: 0
			}
		}
		
		return this.players[this.players.length-1];
	}
	this.getStatDisplayName = function(i){ // return display name of stat
		switch(i){
			case 0:
				return "Fist Size";
			case 1:
				return "Body Size";
			case 2:
				return "Movement Speed";
			case 3:
				return "Fist Force";
			default:
				return "[Unknown Stat]";
		}
	}
	this.playerRequestIncreaseStat = function(player, stat){
		//if player does not have enough exp, return
		switch(stat){
			case 0:
				if(player.stats.FIST_SIZE<9) ++player.stats.FIST_SIZE;
				break;
			case 1:
				if(player.stats.BODY_SIZE<9) ++player.stats.BODY_SIZE;
				break;
			case 2:
				if(player.stats.MOVE_SPEED<9) ++player.stats.MOVE_SPEED;
				break;
			case 3:
				if(player.stats.FIST_FORCE<9) ++player.stats.FIST_FORCE;
				break;
			default:
				break;
		}
		// now use exp.
	}
	this.playerGetStat = function(player, i){
		switch(i){
			case 0:
				return player.stats.FIST_SIZE;
			case 1:
				return player.stats.BODY_SIZE;
			case 2:
				return player.stats.MOVE_SPEED;
			case 3:
				return player.stats.FIST_FORCE;
			default:
				return 0;
		}
	}
	
	// this function should be renamed and expanded to "popItemFromObjectArray" and requires unique IDs
	this.removePlayer = function(id){ // Player is dead
		console.log("removing player, id: "+id);
		var length = this.players.length;
		for(var i=0; i<length; i++){
			if(this.players[i].id === id){
				console.log("removed player "+this.players[i].name
							+", id: "+this.players[i].id + ", coordinates: ("
							+this.players[i].x.toFixed(2)+","+this.players[i].y.toFixed(2)+")");
				if(i != length-1){ // not last item. Make it so.(really, derefence it and move last to this)
					this.players[i] = this.players[length-1];
				}
				// pop it off the end.
				--this.players.length;
				return;
			}
		}
	}
	this.heartBeat = function(id){ // server only. called by client via calling socket.on("latency")
		player = this.getPlayer(id);
		if(!player)
			return;
		
		player.heartBeat = this.currentFrame; // new Date() would be more accurate, but this is good enough.
	}
	
	// called by client per frame,
	// called by server with client update
	this.addInput = function(playerID, input){
		//console.log("in addInput(), input.length= "+input.length);
		// get player, add all new inputs
		var player = this.getPlayer(playerID);
		if(!player)
			return;
		
		for(var i=0; i<input.length; i++){
			if(input[i].inputID > player.input[player.input.length-1].inputID){ // received new input.
				/*
				if(false && this.isServer){
					if(input[i].inputID - player.input[player.input.length-1].inputID > 1){ // missed at least 1 input
						// add an empty input to move (glide) character for the missing time
						var lastInput = player.input[player.input.length-1];
						var startTime = input[i].startTime - input[i].deltaTime;
						var deltaTime = input[i].startTime - input[i].deltaTime - lastInput.startTime;
						var emptyInput = this.getEmptyInput(startTime, deltaTime, input[i].inputID-1);
						
						player.input[player.input.length] = emptyInput;
					}
					//player.lastInputReceived = input[i].inputID;
				}
				*/
				
				//debug
				if(this.isServer){
					// Log when input is missing, or in wrong order.
					var inputDifference = input[i].inputID - player.input[player.input.length-1].inputID;
					if(inputDifference !== 1)
						console.log("for "+player.name+", received new input, is ahead by an abnormal(not 1): " + inputDifference);
				}
				
				// finally, add the new input.
				player.input[player.input.length] = input[i];
				
				
			}
		}
	}
	
	// Should really be called confirmedInput(), called by client with the confirmed/validated input
	this.newInput = function(playerID, input){ // client only
		var player = this.getPlayer(playerID);
		if(!player) return;
		
		/*
		for(var i=0; i<player.input.length; i++){
			if(player.input[i].inputID <= input[0].inputID){
				player.input.splice(i, 1);
			}
			//else
				//break;
		}
		*/
		var now = new Date().getTime();
		var updateLag = player.lastInputUpdate - now;
		player.lastInputUpdate = now;
		
		// input argument is a single element input array
		// process: if player has this inputID, update it, else add to the end
		for(var i=0; i<player.input.length; i++){ // (user)
			if(player.input[i].inputID === input[0].inputID){
				var xChange = input[0].x - player.input[i].x;
				var yChange = input[0].y - player.input[i].y;
				if(xChange !== 0 || yChange !== 0){
					console.log("Input Update in ms: "+updateLag);
					var delta = player.input[0].deltaTime;
					console.log(player.name+"'s new input x/yChange ( "+(xChange)+", "+(yChange)+" )");
					console.log("Move= ( "+(player.input[0].move.x*delta)+", "+(player.input[0].move.y*delta)+" )");
					console.log("Recalculating input from this index");
					player.input[i] = input[0];
					this.processInput(player, true, i);
					return;
				}
				player.input[i] = input[0];
				return;
			}
		}
		// no matching inputID found, add this to the end (other players)
		// in case input is repeat of old input, don't insert it
		if(input[0].inputID < player.input[player.input.length-1].inputID){
			console.log("old input sent to client");
			return;
		}
		player.input[player.input.length] = input[0];
	}
	this.removeOldInput = function(player){ // client only
		
		// remove input behind the last validated input with startTime < currentFrame - delayAmount
		
		var input = player.input;
		
		var validatedInput = 0; // delete up to this (splice from 0 to this index)
		
		// run backwards, find the second to last validated input with a startTime <= displayFrame
		var numValidatedInput = 0; // counter, add to this to make sure we're at 2 before cutting off.
		for(var i=input.length-1; i>=0; --i){
			if(input[i].validated)
				++numValidatedInput;
			if(input[i].startTime > this.displayFrame)
				continue;
			if(input[i].validated && numValidatedInput >= 2){ // found our match, break
				validatedInput = i;
				break;
			}
		}
		input.splice(0, validatedInput);
		
	}
	/*
	this.OLD_removeOldInput = function(player){ // client only
		
		// remove input behind the last validated input with startTime < currentFrame - delayAmount
		
		var input = player.input;
		
		var lastValidatedInput = 0; //initialize to first input so we don't delete anything on accident.
		var displayFrame = this.currentFrame - this.delayAmount;
		
		// get the first inputID we want to keep
		for(var i=0; i<input.length; i++){
			if(input[i].startTime > displayFrame) // reached end of old input items
				break;
			
			if(input[i].validated)// validated by the server
				lastValidatedInput = i;//input[i].inputID;
			// We need the first input to be validated because it has move values that are modified by the succeeding input
		}
		
		input.splice(0, lastValidatedInput);
		
	}
	*/
	this.playerUpdateStats = function(playerID, stats){
		// Get player, set stats to the new stats
		var player = this.getPlayer(playerID);
		if(!player) return;
		
		player.stats = stats;
	}
	
	this.processInput = function(player, isInputCorrection, startPoint){ // process all input in list. only "player" is required for normal updates. Corrections use all parameters.
		var input = player.input;
		
		if(!input){ // when would it ever not have an input?
			alert("Critical Error: Missing input.");
			this.playerMove(player);
			return;
		}
		if(!input[0].validated && !this.isServer){ // should never happen
			alert("Critical Error: First input is not validated by server.");
			return;
		}

		// Set player location to first (validated) input.
		if(isInputCorrection){
			console.log("about to correct some input!, startPoint = "+startPoint+", inputLength = "+input.length);
			this.setPlayerLocation(player, input[startPoint]);// input[startPoint].x, input[startPoint].y, input[startPoint].angle);
			var move = {
				x: input[startPoint].move.x,
				y: input[startPoint].move.y
			};
		}
		else{
			this.setPlayerLocation(player, input[0]);// input[0].x, input[0].y, input[0].angle);
			var move = {
				x: input[0].move.x,
				y: input[0].move.y
			};
		}
		
			
		//if(!this.isServer)
		var displayFrame = this.displayFrame;//this.currentFrame - this.delayAmount;
	
		// Add all movements.
		var lastAttackStart = input[0].attackStart;
		var performedInterpolation = false;
		var i = (isInputCorrection) ? startPoint+1 : 1; // always skip first element, both on client and server
		for(; i<input.length; i++){
			var startTime = input[i].startTime; // technically, startTime is the endTime of the input. real start time would be start-delta
			var deltaTime = input[i].deltaTime;
			var isInterpFrame = false;
			var previousStartTime = (i==0) ? (startTime - deltaTime) : (input[i-1].startTime);
			if( (!this.isServer) && (displayFrame >= previousStartTime) && (displayFrame < startTime) ){
				// displayFrame is between the start and end of this input
				// interpolate from last input position (player.{x,y}) to this one
				//console.log("Performed interpolation on "+player.name);
				
				isInterpFrame = true;
				performedInterpolation = true;
				
				var weight = (displayFrame - previousStartTime)/(startTime - previousStartTime);
				if(weight > 1) console.log("weight: "+weight);
			}
			/*
			if(input[i].W){ // W
				this.playerApplyForceUp(player, deltaTime, move);
			}
			if(input[i].S){ // S
				this.playerApplyForceDown(player, deltaTime, move);
			}
			if(input[i].A){ // A
				this.playerApplyForceLeft(player, deltaTime, move);
			}
			if(input[i].D){ // D
				this.playerApplyForceRight(player, deltaTime,  move);
			}*/
			this.playerSetMoveByRotation(player, deltaTime, move);
			if(input[i].L_MOUSE){ // CLICK
				this.playerPunch(input[i]);
			}
			
			// Limit Move
			this.playerLimitMoveSpeed(player, move);
			
			/// Now that we have our input, move the player.
			var oldX, oldY, oldAngle, oldTurnInertia;
			oldX = player.x;
			oldY = player.y;
			oldAngle = player.angle;
			oldTurnInertia = player.turnInertia;
			
			this.playerMove(player, deltaTime, move);
			this.playerRotate(player, player.angle, input[i].requestAngle);
			// limit Turn inertia
			if(Math.abs(player.turnInertia) > 1.3)
				player.turnInertia = 1.3 * getPN0(player.turnInertia); // max is 1.0, we're multiplying by 1.0 just for clarity
			if(input[i].validated){ // use the updated values. This is bad coding, we should always start from the most recent, relevant, validated input.
				this.setPlayerLocation(player, input[i]);// input[0].x, input[0].y, input[0].angle);
				var move = {
					x: input[i].move.x,
					y: input[i].move.y
				};
			}
			if(this.isServer)
				this.playerUpdatePunch(player, input[i], startTime); // update every instance on server, so we can collide with all positions.
			
			if(isInterpFrame){
				isInterpFrame = false;
				if(player.isUser){
					var xDiff = player.x - oldX;
					var yDiff = player.y - oldY;
					var angleDiff = getAngleDiff(oldAngle, player.angle);
					var turnDiff = player.turnInertia - oldTurnInertia;
					player.interpX = oldX + xDiff*weight;
					player.interpY = oldY + yDiff*weight;
					player.interpAngle = oldAngle + angleDiff*weight;
					player.interpTurnInertia =  oldTurnInertia + turnDiff*weight;
				}
				else {
					var xDiff = input[i].x - input[i-1].x;
					var yDiff = input[i].y - input[i-1].y;
					var angleDiff = getAngleDiff(oldAngle, input[i].angle);
					var turnDiff = input[i].turnInertia - input[i-1].turnInertia;
					player.interpX = input[i-1].x + xDiff*weight;
					player.interpY = input[i-1].y + yDiff*weight;
					player.interpAngle = input[i-1].angle + angleDiff*weight;
					player.interpTurnInertia = input[i-1].turnInertia + turnDiff*weight;
				}
				// on client, fist position is always interpolated
				this.playerUpdatePunch(player, input[i], this.displayFrame );
				updateBody(player);
			}
			
			
			//console.log(player.name+"'s temp move: ( "+move.x+", "+move.y+" )"+". moved = "+changed);
			
			// server only stuff
			if(this.isServer){
				if(input[i].inputID > player.lastInputProcessed){ // process temporary input
					player.lastInputProcessed = input[i].inputID;
					if(input[i].REQUEST_INCREASE_STAT != null){
						this.playerRequestIncreaseStat(player, input[i].REQUEST_INCREASE_STAT);
						input[i].REQUEST_INCREASE_STAT = null;
					}
				}
			}
			else{ // client only stuff
				if(isInputCorrection){ // this was called to make an input correction
					input[i].move = {
						x: move.x,
						y: move.y
					};
					input[i].x = player.x;
					input[i].y = player.y;
					input[i].angle = player.angle;
					input[i].turnInertia = player.turnInertia; // DEBUG:: Is this correct?
					console.log("corrected input");
				}
			}
		}
		if(!performedInterpolation && !this.isServer){
			console.log("did not perform interpolation on "+player.name+"displayFrame= "+displayFrame);
			player.interpX = player.x;
			player.interpY = player.y;
			// Debug: display all input startTimes and start-delta
			for(var i=0; i<input.length; i++){
				console.log("input id: "+input[i].inputID+", startTime"+input[i].startTime);
			}
		}
		
		player.interpX = player.x; // turn off interpolation
		player.interpY = player.y;
		
		
		//// set player angle to most recent angle.
		//player.angle = input[input.length-1].angle;
		// as well as x and y
		if(this.isServer){
			// Now that we're up to date, clear input.
			player.input = [ input[ input.length-1 ] ];
			// Update first input's variables.
			player.input[0].x = player.x;
			player.input[0].y = player.y;
			player.input[0].angle = player.angle;
			player.input[0].move = {
				x: move.x,
				y: move.y
			};
			player.input[0].validated = true;
		}
		else if(player.isUser){ // Client. Set x and y of last input
			// this is the input that was just taken by the client.
			player.input[player.input.length-1].x = player.x;
			player.input[player.input.length-1].y = player.y;
			player.input[player.input.length-1].angle = player.angle;
			player.input[player.input.length-1].turnInertia = player.turnInertia;
		}
	}
	
	this.getEmptyInput = function(startTime, deltaTime, inputID){
		return {
				W: false, 
				S: false, 
				A: false, 
				D: false,
				SPACE: false,
				L_MOUSE: false,
				REQUEST_INCREASE_STAT: null, // request to increase stat. when falsey, none
				
				startTime: startTime,
				deltaTime: deltaTime,
				inputID: inputID,
				x: 0, 
				y: 0,
				angle: 0
			};
	}
	
	this.setPlayerLocation = function(player, input){// x, y, angle){
		if(this.isServer){
			player.xPrev = player.x;
			player.yPrev = player.y;
		}
		player.x = input.x;
		player.y = input.y;
		player.angle = input.angle;
		player.interpX = input.x;
		player.interpY = input.y;
		player.turnInertia = input.turnInertia;
	}
	
	this.playerApplyForceAngle = function(player, angle, force){
		// get x and y from angle, apply force to player.move
		x = Math.cos(angle) * force;
		y = Math.sin(angle) * force;
		player.input[0].move.x += x; // input[0] because we're on server and just cleared out the input
		player.input[0].move.y += y;
	}
	this.playerMove = function(player, deltaTime, move){
		// apply friction
		//move.x *= (1.0 - this.Friction) * deltaTime * 0.1;
		//move.y *= (1.0 - this.Friction) * deltaTime * 0.1;
		//
		
		// move
		player.x += move.x * deltaTime;
		player.y += move.y * deltaTime;
	}
	this.playerLimitMoveSpeed = function(player, move){
		var MaxSpeed = this.getPlayerMoveSpeed(player);
		
		// friction
		move.x *= 0.975;
		move.y *= 0.975;
		
		// limit
		
		if(Math.abs(move.x) > MaxSpeed)
			move.x = getPN0(move.x) * MaxSpeed;
		if(Math.abs(move.y) > MaxSpeed)
			move.y = getPN0(move.y) * MaxSpeed;
	}
	this.playerRotate = function(player, currentAngle, requestAngle){
		// turnInertiaSpeed constant is temporarilly defined here for tweaking purposes.
		var turnInertiaSpeed = 0.07; // should be gotten from getPlayerTurnInertiaSpeed(), which references player speed
		var turnInertiaSpeedHalf = turnInertiaSpeed/2.5;
		
		// rotate currentAngle closer to requestAngle, set player angle to it
		// Logic: if distance is greater than max, flip the direction, and distance is total set size minus original distance
		var rotateSpeed = this.getPlayerRotateSpeed(player);
		var diff = requestAngle - currentAngle;
		var dist = Math.abs(diff);
		if(dist > Math.PI){
			var oppSign = -1 * getPN0(diff);
			var dist = (Math.PI * 2 - dist);
			var angleChange = oppSign * dist;
		}
		else
			var angleChange = diff;
		
		// Rotate angle the correct amount
		if(dist <= rotateSpeed){ // not turning or in final turn frame.
			player.angle = requestAngle;
			
			// retract turnInertia
			var turnDirection = -1 * getPN0(player.turnInertia);
			if(Math.abs(player.turnInertia)< turnInertiaSpeedHalf)
				player.turnInertia = 0;
			else
				player.turnInertia += turnDirection * turnInertiaSpeedHalf;
			
			return;
		}
		else{ //still turning add to turnInertia
			player.turnInertia += getPN0(angleChange) * turnInertiaSpeed;
		}
		player.angle = currentAngle + getPN0(angleChange) * rotateSpeed;
		
		// keep angle within bounds of [-PI,PI]
		var absAngle = Math.abs(player.angle);
		if(absAngle > Math.PI){
			oppSign = -1 * getPN0(player.angle);
			player.angle = oppSign * Math.PI + -oppSign * (Math.PI - absAngle);
		}
	}

	this.playerApplyForceLeft = function(player, deltaTime, move){
		move.x -= this.getPlayerMoveForce(player) * deltaTime;
	}
	this.playerApplyForceRight = function(player, deltaTime, move){
		move.x += this.getPlayerMoveForce(player) * deltaTime;
	}
	this.playerApplyForceUp = function(player, deltaTime, move){
		move.y -= this.getPlayerMoveForce(player) * deltaTime;
	}
	this.playerApplyForceDown = function(player, deltaTime, move){
		move.y += this.getPlayerMoveForce(player) * deltaTime;
	}
	this.playerSetMoveByRotation = function(player, deltaTime, move){
		move.x =  Math.cos(player.angle) * this.getPlayerMoveForce(player) * deltaTime*50;
		move.y =  Math.sin(player.angle) * this.getPlayerMoveForce(player) * deltaTime*50;
	}
	this.playerPunch = function(input){ // activate attack
		var deltaTime = input.startTime - input.attackStart;
		if(deltaTime <= this.BaseFistTime*1.515) // Last attack is not finished
			return;
		// Previous attack (attackStart) is done. Set attackStart to the frame of this input.
		input.attackStart = input.startTime;
		player.punchUsed = false;
	}
	this.playerUpdatePunch = function(player, input, time){ // update fist extension, called once per input on server, once per update on client
		var deltaTime = (time - input.attackStart)*2.75;
		if(deltaTime < 0)
			return;
		
		
		if(deltaTime > this.BaseFistTime*1.515){ // no longer active
			player.state.fistOffset = 0;
			input.attackStart = 0;
			return;
		}
		
		// set extendTime to half full, so it begins to drop., or maybe not.
		//BaseFistTime
		//*CurrentDist = (playerFistForce*time)-(retractSpeed*time^2);
		var PlayerFistExtend = 0.001;
		var fistForce = PlayerFistExtend * (1.0 + player.stats.FIST_FORCE*0.09);//this.getPlayerFistForce(player) * 0.001;
		var retractSpeed = fistForce / this.BaseFistTime;
		//var retractAmount = retractSpeed*Math.pow(deltaTime,2); // original. gravity fall parabola
		var retractAmount = -( (fistForce * Math.pow(deltaTime,2))/2 - (retractSpeed*Math.pow(deltaTime,3))/3 ); // models rubber band pull
		var currentDist = (fistForce*deltaTime)-(retractAmount);
		player.state.fistOffset = currentDist;
	}
	this.getPlayerFistExtend = function(player){ // get the actual fist extend, based on fistOffset
		// player size + fist size + fist offset
		return this.getPlayerBodyRadius(player) + this.getPlayerFistRadius(player) + player.state.fistOffset;
	}
	this.getPlayerFistRadius = function(player){ // get the actual fist extend, based on fistOffset
		// player size + fist size + fist offset
		return this.BaseFistRadius * (1.0 + player.stats.FIST_SIZE * 0.1);
	}
	this.getPlayerFistLocation = function(player){ // get the actual fist extend, based on fistOffset
		var fistExtend = this.getPlayerFistExtend(player);
		
		return { x: player.x + Math.cos(player.angle) * fistExtend,
				 y: player.y + Math.sin(player.angle) * fistExtend };
	}
	this.getPlayerFistInterpLocation = function(player){ // get the actual fist extend, based on fistOffset
		var fistExtend = this.getPlayerFistExtend(player);
		
		return { x: player.interpX + Math.cos(player.interpAngle) * fistExtend,
				 y: player.interpY + Math.sin(player.interpAngle) * fistExtend };
	}
	this.getPlayerBodyRadius = function(player){ // get the actual fist extend, based on fistOffset
		// player size + fist size + fist offset
		return this.PlayerBodyRadius * (1.0 + player.stats.BODY_SIZE * 0.1);
	}
	this.getPlayerMoveSpeed = function(player){
		return this.PlayerMoveSpeed * (1.0 + player.stats.MOVE_SPEED * 0.1 );
	}
	this.getPlayerMoveForce = function(player){
		return this.PlayerMoveForce * (1.0 + player.stats.MOVE_SPEED * 0.1 );
	}
	this.getPlayerFistForce = function(player){
		return ( this.PlayerFistForce ) * (1.0 + player.stats.FIST_FORCE*0.15) * 2;
	}
	this.getPlayerRotateSpeed = function(player){
		return ( this.PlayerRotateSpeed ) * (1.0 - player.stats.FIST_SIZE*0.08);
	}
	this.getPlayerBodySizeAffector = function(player){ // a value between 0 and 1 to decrease force push by multiplying this with force
		return 1.0 - (player.stats.BODY_SIZE*0.065);
	}
	/*
	this.playerCollideFistWithOtherPlayers = function(player){
		var pos = this.getPlayerFistLocation(player);
		var fistRadius = this.getPlayerFistRadius(player);
		for(var i=0; i<this.players.length; i++){
			if(this.players[i] == player)
				continue;
			
			var distance = getDistance(pos.x, pos.y, this.players[i].x, this.players[i].y);
			var angle = Math.atan2( this.players[i].y - pos.y, this.players[i].x - pos.x );
			var radius = fistRadius + this.getPlayerBodyRadius(this.players[i])*0.9; // 10% of non collidable fat
			
			
			if(distance < radius){ // collision
				//this.addScoreToPlayer( player.id );
				this.players[i].lastPlayerToHitMe = player.id;
				//this.removePlayer( this.players[i].id );
				this.playerApplyForceAngle( this.players[i], angle, this.getPlayerFistForce(player) );
				return;
			}
			
		}
	}
	*/
	//distToSegment(p, v, w)
	this.playerCollideFistWithOtherPlayers = function(player){
		//if (player.punchUsed)
			//return;
		var playerSpeed = getDistance(player.input[player.input.length-1].move.x, player.input[player.input.length-1].move.y, 0,0);
		var fPosNew = this.getPlayerFistLocation(player);
		// var fPosOld
		var fistRadius = this.getPlayerFistRadius(player);
		for(var i=0; i<this.players.length; i++){
			var victim = this.players[i];
			if(victim === player)
				continue;
			
			// collide first with all players
			var pPosOld = { x: victim.xPrev, y: victim.yPrev };
			var pPosNew = { x: victim.x, y: victim.y };
			
			var distance = distToSegment(fPosNew, pPosOld, pPosNew);
			var angle = Math.atan2( victim.y - fPosNew.y, victim.x - fPosNew.x ); // Impact angle
			var radius = fistRadius + this.getPlayerBodyRadius(victim);
			
			
			if(distance < radius){ // collision
				player.punchUsed = true;
				victim.lastPlayerToHitMe = player.id;
				var force = playerSpeed + this.getPlayerFistForce(player) * this.getPlayerBodySizeAffector(victim);
				this.playerApplyForceAngle( victim, angle, force );
				console.log("fist collision [ " + player.name + " -> " + victim.name + " ], force "+force);
				return;
			}
			
		}
	}
	this.playerCollideMouthWithFood = function(player){
		var food = this.food; // this should be faster since we would constantly be dereferencing "this"
		var mouthPos = this.getPlayerFistLocation(player);
		var radius = this.getPlayerFistRadius(player) + this.foodRadius;
		for(var i=0; i<food.length; i++){
			//getWithinSquare(x1, y1, x2, y2, size)
			var distance = getDistance(mouthPos.x, mouthPos.y, food[i].x, food[i].y);
			//if( getWithinSquare(mouthPos.x, mouthPos.y, food[i].x, food[i].y, radius) ){
			if( distance <= radius ){
				// add to player score, add animation, remove food, break
				this.addScoreToPlayer( player.id );
				this.removeFood( this.food[i].id );
				break;
			}
		}
	}
	
	this.removeOutsideBoundsPlayers = function(){
		for(var i=0; i<this.players.length; i++){
			var isInsideMap = getWithinSquare(0,0, this.players[i].x, this.players[i].y, this.MapSize);
			if(!isInsideMap){
				this.addScoreToPlayer( this.players[i].lastPlayerToHitMe );
				this.removePlayer( this.players[i].id );
			}
		}
	}
	
	this.addScoreToPlayer = function(id){
		for(var i=0; i<this.players.length; i++){
			if(this.players[i].id == id){
				++this.players[i].score;
				break;
			}
		}
	}
	
	this.getPlayers = function(){
		var p = [];
		for(var i=0; i<this.players.length; i++){
			var player = this.players[i];
			p[i] = {
				id: player.id,
				name: player.name,
				x: player.x,
				y: player.y,
				playerClass: player.playerClass
			};
		}
		
		return p;
	}
	
	this.getPlayer = function(id){
		for(var i=0; i<this.players.length; i++){
			if(this.players[i].id == id)
				return this.players[i];
		}
		return null;
	}
	/*
	this.clearAllPlayerInput = function(){ // not used anymore.
		for(var i=0; i < this.players.length; i++){
			var player = this.players[i];
			player.input = [ player.input[ player.input.length-1 ] ];
			//console.log (player.name+"'s input.length is "+player.input.length);
		}
	}
	*/
	
	/// State Update Functions
	///----------------------------------------------
	// update(): process all player input, update game state
	this.update = function(){
		
		this.lastFrame = this.currentFrame;
		if(this.isServer)
			this.currentFrame = new Date().getTime();
		else{
			this.currentFrame = new Date().getTime() - this.latency - this.server_offset;
			this.displayFrame = this.currentFrame - this.delayAmount;
			this.frameRate = 1000/(this.currentFrame - this.lastFrame);
		}
		
		var playersUpdate = [];
		
		// For each player, take input, move/update attack, do collision(server)
		for(var i=0; i<this.players.length; i++){
			var player = this.players[i];
			// use input
			this.processInput(player);
			
			
			if(this.isServer){
				this.playerCollideFistWithOtherPlayers(player);
				this.playerCollideMouthWithFood(player);
				// delete this player if their heartBeat is too old
				if(this.currentFrame - player.heartBeat > this.timeOut){
					console.log("Player: "+player.name+" timed out.");
					this.removePlayer(player.id);
					--i; // i now references different player (or end of list), make a pass on it
				}
			}
			else{
				this.removeOldInput(player);
			}
		}
		
		// Do collision, remove dead players, add players to update
		if(this.isServer){
			this.removeOutsideBoundsPlayers();
			//; remove eaten food
			this.spawnFood(); // food collision is done. Add more.
		}
		else{ // on client
			this.updateFoodEatenAnimations();
		}
		for(var i=0; i<this.players.length; i++){
			if(this.isServer){
				// add their input and related data playersUpdate
				playersUpdate[i] = {
					id: this.players[i].id, 
					input: this.players[i].input,
					stats: this.players[i].stats
					};
			}
		}
		
		// if isServer, package data, clear old input, return.
		if(this.isServer){
			var foodToAdd = this.getFoodToAddCopy();
			var foodToRemove = this.getFoodToRemoveCopy();
			this.foodToAdd = [];
			this.foodToRemove = [];
			
			// Package data
			var data = {
				playersUpdate: playersUpdate, 
				score: this.getScoreList(),
				foodToAdd: foodToAdd,
				foodToRemove: foodToRemove
				};
			
			
			return data;
		}
	}
	
	
	
	
	/// Other Functions
	///----------------------------------------------
	this.getScoreList = function(){
		if(this.players.length == 0)
			return [];
		
		var p = this.players.sort( dynamicSort("score") );
		
		// return reverse list.
		var score = [];
		for(var i=p.length-1; i>=0; i--){
			score[p.length-i-1] = {name: p[i].name, score: p[i].score};
		}
		
		return score;
	}
	
}
//var gameCore = new game_core(false);
