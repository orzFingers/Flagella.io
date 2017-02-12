/*
game_core.js
functionality: 
	interfaces game world to:
	control characers, collide items, adjust internal state.

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



function getPN0(x){
	if(x > 0)
		return 1;
	if(x === 0)
		return 0;
	return -1;
}



if( 'undefined' !== typeof global ) {
    module.exports = global.game_core = game_core;
}



/// Game_Core Functions
///----------------------------------------------
function game_core(isServer){ // takes truthy or falsey value
	
	
	this.players = [];
	this.currentFrame = new Date().getTime();
	this.lastFrame = this.currentFrame;
	this.isServer = (isServer == true);//isServer !== undefined;
	this.MapSize = 400;
	
	
	
	
	var msPerFrame = 1000/60;
	
	this.delayAmount = 100; // turns out to be 6 frames
	
	this.PlayerMoveSpeed = 1.3/msPerFrame; // base max speed per milisecond
	this.PlayerMoveForce = this.PlayerMoveSpeed / (90.0 * msPerFrame); // 60 frames to reach max
	this.Friction = 0.01 / (msPerFrame);//almost nothing
	
	this.PlayerFistForce = this.PlayerMoveForce*100; // 60 frames to reach max
	
	this.PlayerBodyRadius = 40;
	this.BaseFistRadius = 30;
	this.BaseFistTime = 250;// Full extend time is double this
	this.BaseFistExtend = this.PlayerBodyRadius*2;
	
	
	
	this.init = function(){ // probably won't be used
		//this.addPlayer(0,0, "default player");
	}
	
	
	
	
	/// Player Interface Functions
	///----------------------------------------------
	this.numPlayers=0;
	this.addPlayer = function(x, y, name, _id){ // generates id on server
		console.log("adding player "+ name);
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
			name: name,
			id: id,
			score: 0,
			//lastInputReceived: 0,
			lastInputProcessed: 0,
			lastPlayerToHitMe: -1, // no player hit me
			move: {
				x: 0, // works as xChange, slowed by friction
				y: 0
			},
			input: [{
				W: false, 
				S: false, 
				A: false, 
				D: false,
				SPACE: false,
				L_MOUSE: false,
				REQUEST_INCREASE_STAT: null, // request to increase stat. when falsey, none
				
				startTime: new Date().getTime(),
				deltaTime: 0,
				inputID: 0,//(this.isServer?0:1),
				x: 0, 
				y: 0,
				angle: 0
			}],
			state: {
				attackTime: 0,// if 0, not punching
				fistOffset: 0 // get fistExtend with getPlayerFistExtend(player)
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
				++player.stats.FIST_SIZE;
				break;
			case 1:
				++player.stats.BODY_SIZE;
				break;
			case 2:
				++player.stats.MOVE_SPEED;
				break;
			case 3:
				++player.stats.FIST_FORCE;
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
				console.log("removed player "+this.players[i].name+", id: "+this.players[i].id);
				if(i != length-1){ // not last item. Make it so.(really, derefence it and move last to this)
					this.players[i] = this.players[length-1];
				}
				// pop it off the end.
				--this.players.length;
				return;
			}
		}
	}
	
	// called by client per frame,
	// called by server with client update
	this.addInput = function(playerID, input){ // called often by clients.
		//console.log("in addInput(), input.length= "+input.length);
		// get player, add all new inputs
		var player = this.getPlayer(playerID);
		if(!player)
			return;
		
		for(var i=0; i<input.length; i++){
			if(input[i].inputID > player.input[player.input.length-1].inputID){ // received new input.
				if(this.isServer){
					if(input[i].inputID - player.input[player.input.length-1].inputID > 1){ // missed at least 1 input
						// add an empty input to move (glide) character for the missing time
						var lastInput = player.input[player.input.length-1];
						var startTime = input[i].startTime - input[i].deltaTime;
						var deltaTime = input[i].startTime - input[i].deltaTime - lastInput.startTime;
						var emptyInput = this.getEmptyInput(startTime, deltaTime, input[i].inputID-1);
						
						player.input[player.input.length] = emptyInput;
					}
					player.lastInputReceived = input[i].inputID;
				}
				
				// finally, add the new input.
				player.input[player.input.length] = input[i];
			}
		}
	}
	
	this.newInput = function(playerID, input){
		// Run through player input,
		// find first match > input[input.length-1]
		// copy all remaining of player.input to input
		var player = this.getPlayer(playerID);
		if(!player) return;
		
		// remove old input
		/*
		for(var i=0; i<player.input.length; i++){
			if(player.input[i].inputID <= input[0].inputID){
				player.input.splice(i, 1);
			}
			//else
				//break;
		}
		*/// don't remove old input here. remove it after we do processInput, in removeOldInputs()
		
		//copy over any new
		for(var i=0; i<player.input.length; i++){
			input[input.length] = player.input[i];
		}
		player.input = input;
	}
	this.removeOldInput = function(player){ // client only
		
		var startFrame = this.currentFrame - this.delayAmount*3;
		
		for(var i=0; i<player.input.length; i++){
			if(player.input[i].startTime < startFrame){
				player.input.splice(i, 1);
			}
			//else
				//break;
		}
	}
	
	this.playerUpdateStats = function(playerID, stats){
		// Get player, set stats to the new stats
		var player = this.getPlayer(playerID);
		if(!player) return;
		
		player.stats = stats;
	}
	this.playerUpdateMove = function(playerID, move){
		// Get player, set stats to the new stats
		var player = this.getPlayer(playerID);
		if(!player) return;
		
		player.move = move;
	}
	
	this.processInput = function(player){ // process all input in list.
		var input = player.input;
		if(!input){ // when would it ever not have an input?
			this.playerMove(player);
			return;
		}

		// Set player location to the first item in input.
		this.setPlayerLocation(player, input[0].x, input[0].y, input[0].angle);
		
		var move = {
			x: player.move.x, 
			y: player.move.y
			};
		
		// Add all movements.
		for(var i=0; i<input.length; i++){
			var startTime = input[i].startTime;
			var deltaTime = input[i].deltaTime;
			
			if(input[i].W){ // W
				this.playerApplyForceUp(player, deltaTime,  move);
			}
			if(input[i].S){ // S
				this.playerApplyForceDown(player, deltaTime, move);
			}
			if(input[i].A){ // A
				this.playerApplyForceLeft(player, deltaTime, move);
			}
			if(input[i].D){ // D
				this.playerApplyForceRight(player, deltaTime,  move);
			}
			if(input[i].L_MOUSE){ // CLICK
				this.playerPunch(player, startTime);
			}
			
			/// Now that we have our input, move the player.
			this.playerMove(player, deltaTime, move);
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
		}
		
		
		// set player angle to most recent angle.
		player.angle = input[input.length-1].angle;
		// as well as x and y
		if(this.isServer){
			player.input[player.input.length-1].x = player.x;
			player.input[player.input.length-1].y = player.y;
			player.move.x = move.x;
			player.move.y = move.y;
			//console.log(player.name+"'s coordinates: ( "+player.x+", "+player.y+" )");
		}
	}
	
	this.getEmptyInput = function(startTime, deltaTime, inputID){
		return [{
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
			}];
	}
	
	this.setPlayerLocation = function(player, x, y, angle){
		player.x = x;
		player.y = y;
		player.angle = angle;
	}
	
	this.playerApplyForceAngle = function(player, angle, force){
		// get x and y from angle, apply force to player.move
		x = Math.cos(angle) * force;
		y = Math.sin(angle) * force;
		player.move.x += x;
		player.move.y += y;
	}
	this.playerMove = function(player, deltaTime, move){
		// 1: apply friction on move(.x,.y) of deltaTime from last update 
		//    (multiple inputs' worth on server, one input on client)
		// 2: apply move to player
		
		
		
		// apply friction
		//move.x *= (1.0 - this.Friction) * deltaTime * 0.1;
		//move.y *= (1.0 - this.Friction) * deltaTime * 0.1;
		
		// move
		player.x += move.x * deltaTime;
		player.y += move.y * deltaTime;
		
	}

	this.playerApplyForceLeft = function(player, deltaTime, move){
		//deltaTime = 1;
		// check MoveSpeed of x, if less than getPlayerSpeed, apply force up to getPlayerSpeed
		// for playerApplyForceDirection() limit maxspeed(maxforce) to a multiple of numInputs
		var MaxSpeed = this.getPlayerMoveSpeed(player);
		var request = -1; // direction we wish to go
		
		// if moving less than max speed, or we're moving in the opposite direction
		if( Math.abs(move.x) < MaxSpeed || 
			getPN0(move.x) != getPN0(request) ){ 
			// apply force
			move.x -= this.getPlayerMoveForce(player) * deltaTime;
		}
	}
	this.playerApplyForceRight = function(player, deltaTime, move){
		//deltaTime = 1;
		// check MoveSpeed of x, if less than getPlayerSpeed, apply force up to getPlayerSpeed
		var MaxSpeed = this.getPlayerMoveSpeed(player);
		var request = 1; // direction we wish to go
		
		// if moving less than max speed, or we're moving in the opposite direction
		if( Math.abs(move.x) < MaxSpeed || 
			getPN0(move.x) != getPN0(request) ){ 
			// apply force
			move.x += this.getPlayerMoveForce(player) * deltaTime;
		}
	}
	this.playerApplyForceUp = function(player, deltaTime, move){
		//deltaTime = 1;
		// check MoveSpeed of y, if less than getPlayerSpeed, apply force up to getPlayerSpeed
		var MaxSpeed = this.getPlayerMoveSpeed(player);
		var request = -1; // direction we wish to go
		
		// if moving less than max speed, or we're moving in the opposite direction
		if( Math.abs(move.y) < MaxSpeed || 
			getPN0(move.y) != getPN0(request) ){ 
			// apply force
			move.y -= this.getPlayerMoveForce(player) * deltaTime;
		}
	}
	this.playerApplyForceDown = function(player, deltaTime, move){
		//deltaTime = 1;
		// check MoveSpeed of y, if less than getPlayerSpeed, apply force up to getPlayerSpeed
		var MaxSpeed = this.getPlayerMoveSpeed(player);
		var request = 1; // direction we wish to go
		
		// if moving less than max speed, or we're moving in the opposite direction
		if( Math.abs(move.y) < MaxSpeed || 
			getPN0(move.y) != getPN0(request) ){ 
			// apply force
			move.y += this.getPlayerMoveForce(player) * deltaTime;
		}
	}
	this.playerPunch = function(player, startTime){ // activate attack
		if(player.state.attackTime != 0) // already active
			return;
		player.state.attackTime = startTime;
	}
	this.playerUpdatePunch = function(player){ // update attack, called once per update
		if(player.state.attackTime == 0)
			return;
		// move fist based on BaseFistTime
		// 
		var deltaTime = this.currentFrame - player.state.attackTime;
		// greater than BaseFistTime, retract,
		if(deltaTime > this.BaseFistTime*2){ // no longer active
			player.state.fistOffset = 0;
			player.state.attackTime = 0;
		}
		else if(deltaTime > this.BaseFistTime){ // retracting from full extension
			player.state.fistOffset = this.BaseFistExtend - (( deltaTime - this.BaseFistTime )/this.BaseFistTime) * this.BaseFistExtend;
		}
		else{ // extending from start
			player.state.fistOffset = (deltaTime / this.BaseFistTime) * this.BaseFistExtend;
		}
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
		return ( this.PlayerFistForce + Math.abs( getDistance(0,0, player.move.x, player.move.y ) ) ) * (1.0 + player.stats.FIST_FORCE);
	}
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
			p[i] = {
				id: this.players[i].id,
				name: this.players[i].name,
				x: this.players[i].x,
				y: this.players[i].y
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
	
	this.clearAllPlayerInput = function(){
		for(var i=0; i < this.players.length; i++){
			var player = this.players[i];
			player.input = [ player.input[ player.input.length-1 ] ];
			//console.log (player.name+"'s input.length is "+player.input.length);
		}
	}
	
	/// State Update Functions
	///----------------------------------------------
	// update(): process all player input, update game state
	this.update = function(){
		
		this.lastFrame = this.currentFrame;
		this.currentFrame = new Date().getTime();
		
		var playersUpdate = [];
		
		// Take input, move players, update attack
		for(var i=0; i<this.players.length; i++){
			// Process all player input
			this.processInput(this.players[i]);
			//console.log(this.players[i].name+"  x="+this.players[i].x+" y="+this.players[i].y);
			// update attack (punch)
			this.playerUpdatePunch(this.players[i]);
			if(!this.isServer)
				this.removeOldInput(this.players[i]);
		}
		
		// Do collision, remove dead players, add players to update
		if(this.isServer){
			for(var i=0; i<this.players.length; i++){
				this.playerCollideFistWithOtherPlayers(this.players[i]);
			}
			this.removeOutsideBoundsPlayers();
		}
		for(var i=0; i<this.players.length; i++){
			if(this.isServer){
				// Now that we're up to date, clear input.
				this.clearAllPlayerInput();
				// add their input and related data playersUpdate
				playersUpdate[i] = {
					id: this.players[i].id, 
					input: this.players[i].input,
					stats: this.players[i].stats,
					move: this.players[i].move
					};
			}
		}
		
		// if isServer, package data, clear old input, return.
		if(this.isServer){
			// Package data
			var data = {
				playersUpdate: playersUpdate, 
				score: this.getScoreList()
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
