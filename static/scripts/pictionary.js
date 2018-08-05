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

function Timer() {

    this.currentSecondsLeft = 0;
    this.turnLength = 0;
    
    this.updateTimer = function() {
    
        this.currentSecondsLeft--;
        
        tf = document.getElementById("timer-foreground"); 

        timer_width = ((this.currentSecondsLeft + 1) / this.turnLength) * 200;
        tf.style.width = timer_width + "px"; 
        
        
        if (this.currentSecondsLeft + 1 > 0 && !gameState.idle && gameState.started) {
            showTimer();
           
        } else {

            hideTimer();
        }
    };
    
    
    this.setTimer = function(t1, t2) {
        this.currentSecondsLeft = t1;
        this.turnLength = t2;
        if (!this.timerRunning) {
            this.timerRunning = true;
            this.updateTimer();
        }
        
    };
    
}

 

timer = new Timer();
hideTimer();

function runTimer() {
    timer.updateTimer();
    setTimeout(runTimer, 1000);

}
runTimer();

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
        if (chatUser) chatUser.ready = gameState.udata[i].ready;
        if (chatUser) chatUser.score = gameState.udata[i].score;
        if (chatUser) chatUser.guessed_this_round = gameState.udata[i].guessed_this_round;
    }
    showWord(gameState.word);
    showOnline();
});

socket.on('next_turn', function(data) {
    console.log(data);
    data = JSON.parse(data);
    wipePad();  
    gameState.word = data.word;
    if (gameState.word) {
        showWord(gameState.word);
    }
    updateColor();
    updateSize();
    updateAlpha();
    syncBrushValues();
});

socket.on('end_turn', function(data) {
    console.log(data);
});

socket.on('idle', function(data) {
    console.log(data);

    enterIdleState();
    setTimeout(pingServer, gameState.idle_length * 10);
});

gameState = {};

function wipePad() {
    artPad.users = [];
    artPad.localAddUser(siteData.uid);
    artPad.localUser.handleLocalInput = function(input) {
        inputBuffer.push(input);
    }
}

function getPictionaryUser(uid) {

}
function PictionaryController() {
    
    
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
            updateColor();
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
    document.getElementById("colorbar").style.display = 'none';
    document.getElementById("container").style.width="72%";
}
function unhideTools() {
    document.getElementById("colorbar").style.display = 'block';
    document.getElementById("container").style.width="60%";
}

pingServer();
socket.on('user_ready', function(data) {
    data = JSON.parse(data);
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