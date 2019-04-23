
showTimer = function() {
        tf = document.getElementById("timer-foreground"); 
        tb = document.getElementById("timer-background"); 
        tf.style.display = 'block';
        tb.style.display = 'block';
};
        
hideTimer = function() {
    tf = document.getElementById("timer-foreground"); 
    tb = document.getElementById("timer-background"); 
    tf.style.display = 'none';
    tb.style.display = 'none';

};

/*
  TODO: Turn Timer into Vue component?
*/
function Timer() {
    this.currentSecondsLeft = 0;
    this.turnLength = 0;
    this.updateTimer = function() {
        
        this.currentSecondsLeft--;
        
        // update width of html timer element
        tf = document.getElementById("timer-foreground"); 
        timer_width = ((this.currentSecondsLeft + 1) / this.turnLength) * 200;
        tf.style.width = timer_width + "px"; 
        
        // only display the timer when the game isn't active
        if (this.currentSecondsLeft + 1 > 0 && !gameState.idle && gameState.started) {
            showTimer();
        } else {
            hideTimer();
        }
    };
    
    // used to update timer with specific values 
    this.setTimer = function(secondsLeft, turnLength) {
        this.currentSecondsLeft = secondsLeft;
        this.turnLength = turnLength;
        if (!this.timerRunning) {
            this.timerRunning = true;
            this.updateTimer();
        }       
    };
}


timer = new Timer();
hideTimer();

/*
  A function which refreshes the timer once per second
*/
function runTimer() {
    timer.updateTimer();
    setTimeout(runTimer, 1000);

}
runTimer();

/*
  Received an updated game state from the server,
  update Pictionary board to reflect new values
*/
socket.on('game_state', function(data) {

    gameState = JSON.parse(data);

    if (gameState.started && gameState.idle) {
        enterIdleState();
        if (gameState.current_idle_time_left > 0) {
            setTimeout(pingServer, gameState.current_idle_time_left * 1000);
        }
    } else if (gameState.started) {
        console.log("fff");
        nextTurn(gameState.current_turn_time_left * 1000);
    } else {
        enterIdleState();
        document.getElementById("ready-button").style.display = 'block';
        setTimeout(pingServer, 20000);
    }

    for (var i = 0; i < gameState.udata.length; i++) {
        chatUser = getUser(gameState.udata[i].uid);
        if (chatUser) {
            chatUser.ready = gameState.udata[i].ready;
            chatUser.score = gameState.udata[i].score;
            chatUser.guessed_this_round = gameState.udata[i].guessed_this_round;
        }
    }

    showWord(gameState.word);
    showOnline();
});

/*
  Received information from server about next turn,
  clear the board and update the game state
*/
socket.on('next_turn', function(data) {
    console.log(data);
    data = JSON.parse(data);
    wipePad();  
    gameState.word = data.word;
    if (gameState.word) {
        showWord(gameState.word);
    }
    updateColor(artPad.localUser.brushColor);
    updateSize();
    updateAlpha();
    syncBrushValues();
});

/*
socket.on('end_turn', function(data) {
    console.log(data);
});
*/

// Server says to deactivate the canvas ("go idle")
socket.on('idle', function(data) {
    enterIdleState();
    setTimeout(pingServer, gameState.idle_length * 10);
});

gameState = {};

// function for wiping the wiping the current artPad canvas and handing it to the active user
function wipePad() {
    artPad.users = [];
    artPad.localAddUser(siteData.uid);
    artPad.localUser.handleLocalInput = function(input) {
        inputBuffer.push(input);
    }
}



/*

    updates the turn to the current drawing player.
    input: time (int)
        - time left for turn(in seconds)
*/

function nextTurn(time) {
    
    drawingUser = currentlyDrawingUser();
    timer.setTimer(time / 1000, gameState.turn_length / 100);
    if (drawingUser) {
        
        artPad.locked = true;
        hideTools();
        unhideChatInput();
        
        for (var i = 0; i < gameState.udata.length; i++) {
            if (gameState.udata[i].drawing) {
                gameState.udata[i].drawing = false;
            }
            if (gameState.udata[i].uid == drawingUser.uid) {
                gameState.udata[i].drawing = true;
            }
        }
        
        
        if (time !== undefined) {
            setTimeout(pingServer, time * 1000);
        } else {
            setTimeout(pingServer, gameState.turn_length * 10 + 500);
        }
        setTimeout(pingServer, gameState.turn_length * 10 + 500);
        
        if (drawingUser.uid == artPad.localUser.id) {
            artPad.locked = false;
            unhideTools();
            hideChatInput();
            updateColor(artPad.localUser.brushColor);
            updateSize();
            updateAlpha();
        }
        
    }
    leaveIdleState();
    showOnline();
}

function enterIdleState() {
    artPad.locked = true;
    gameState.idle = true;
    hideTools();
    document.getElementById("idle-message-container").style.display = 'flex';
    if (gameState.started) {
        document.getElementById("ready-button").style.display = 'none';
    }
    unhideChatInput();
    showOnline();
}

function leaveIdleState() {
    document.getElementById("idle-message-container").style.display = 'none';
    
}

function updateGame() {

    if (gameState.started) {
    
  
    
        if (gameState.idle) {
            enterIdleState();
        } else {
            currentlyDrawing = currentlyDrawingUser();
            nextTurn(gameState.current_turn_time_left);
        }
    }
    showOnline();
    
}

function currentlyDrawingUser() {
    for (var i = 0; i < gameState.udata.length; i++) {
        if (gameState.udata[i].drawing) {
            return gameState.udata[i];
        }
    }
}


function pingServer() {
    console.log("pinging...");
    socket.emit('next_state');
}


function startGame() {
    socket.emit('start_game');
}

function userReady() {
    socket.emit('ready');
    document.getElementById("ready-button").style.display = 'none';
}

function hideTools() {
    document.getElementById("toolbar-holder").style.display = 'none';
    document.getElementById("canvas-wrapper").classList.remove("all-80");
    document.getElementById("canvas-wrapper").classList.add("all-100");
    document.getElementById("toolbar-holder").classList.add("all-0");
    document.getElementById("toolbar-holder").classList.remove("all-20");
}
function unhideTools() {
    document.getElementById("toolbar-holder").style.display = 'block';
    document.getElementById("canvas-wrapper").classList.remove("all-100");
    document.getElementById("canvas-wrapper").classList.add("all-80");
    document.getElementById("toolbar-holder").classList.remove("all-0");
    document.getElementById("toolbar-holder").classList.add("all-20");
}

pingServer();
socket.on('user_ready', function(data) {
    data = JSON.parse(data);
    console.log(data);
    getUser(data.uid).ready = true;
    showOnline();
});



function askUpdates() {
    pingServer();
    showOnline();
    setTimeout(askUpdates, 3000);
    
}
function showWord(word) {
    document.getElementById("word-display").textContent = word;
}
function hideChatInput() {
    document.getElementById("chat-input").style.display= 'none';
}
function unhideChatInput() {
    document.getElementById("chat-input").style.display= "block" ;
}

askUpdates();
