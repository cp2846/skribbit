
// stores local inputs before they're sent to the server.
var inputBuffer = [];

// another user joined room; add them to our artPad instance
socket.on('join', function(data) {
    room_id = siteData.room;    
    if (data) {
        artPad.addUser(data.uid, artPad);
        artPad.replay();
    }
});

// another user did something; add their inputs to our local artPad instance
socket.on('receive_input', function(data) {
    data = JSON.parse(data);
    if (data) {
        executeAsync(artPad.receiveInputs(data.uid, data.i, true));
    }    
});

artPad.using = false;
function usingControls() {
    artPad.using = true;
}
function notUsingControls() {
    artPad.using = false;
}


/* 
  load a pre-filled canvas based on JSON data
*/
function prepareCanvas(data) {
    if (data) {
        var JSONdata = JSON.parse(data); 
        for (var i = 0; i < JSONdata.length; i++) {
            for (var j = 0; j < JSONdata[i].data.length; j++) {
                var inputStr = JSONdata[i].data[j];                
                inputJSON = JSON.parse(inputStr);
                artPad.loadInputs(JSONdata[i].uid, inputJSON);
            }
        }

        for (var i = 0; i < artPad.users.length; i++) {
            artPad.longFormReplay(artPad.users[i].id);
        }   
    }  
    updateColor("#000000");
    updateAlpha();
    updateSize();
    removeSpinner();
    pushInputs();
}


// Received room input history from server, load it into canvas
socket.on('room_history', function(data) {
    localUserId = siteData.uid;
    artPad.localAddUser(localUserId);
    artPad.localUser.handleLocalInput = function(input) {
        inputBuffer.push(input);
    }
    executeAsync(prepareCanvas(data));
});

/* 
socket.on('user_offline', function(data) {
    console.log(data);
});
*/


/*
  A function which, once called, sends unsent local inputs to the server
  once every 320 ms. 
*/
function pushInputs () {

     setTimeout(function() {

        if (artPad.localUser) {
            artPad.localUser.handleLocalInput = function(input) {
                inputBuffer.push(input);
            }
        }

        if (inputBuffer.length > 0 && artPad.localUser) {
            var roomid = siteData.room;
            socket.emit('input', {room:roomid, i:inputBuffer});
            inputBuffer = [];        
        }

        pushInputs();
    }, 320);
}


// function for updating the brush size based on current slider value
function updateSize() {
    var sizeSlider = document.getElementById('sizeSlider');
    artPad.localSetBrushSize(sizeSlider.value);
    drawBrushSetting();
}

// function for drawing a preview of what the brush looks like
function drawBrushSetting() {
    artisan.clearCanvas('sizeDisplay');
    x = document.getElementById('toolbar').clientWidth / 2;
    artisan.drawCircle('sizeDisplay', x, 75, sizeSlider.value * 0.5, 
                       artPad.getBrushColor(artPad.localUser.id), 
                       undefined, undefined, artPad.localUser.brushAlpha);
}

// when the window resizes, update the brush preview
window.addEventListener('resize', 
    function(){
        if (artPad.localUser) drawBrushSetting(); 
    }, true
);


function updateColor(color) {
    artPad.localSetBrushColor(color);
    drawBrushSetting();
}

function updateAlpha() {
    var alphaSlider = document.getElementById('alphaSlider');
    artPad.localSetBrushAlpha(alphaSlider.value * 0.01);
    drawBrushSetting();
}

/* 
  a function to be called when the local user stops
  painting with their brush. 
*/ 
function stopPainting() {
    if (artPad.localUser && artPad.localUser.painting == true) {
        artPad.localUser.painting = false;
        artPad.localUser.inputSequence.push([4, false]);
        artPad.localUser.handleLocalInput([4, false]);
    }        
    document.body.classList.remove("unselectable");
}

document.body.onmouseup = function(e)  {
   stopPainting();
}

function removeSpinner() {
    document.getElementById('spinnerContainer').style.display = 'none';
}

// make body unselectable when local user's mouse enters canvas area 
document.getElementById("canvas-container").onmouseenter = function() {
    document.body.classList.add("unselectable");
}

    
// function to maintain brush settings parity when user has multiple tabs open
function syncBrushValues() {
    var alphaSlider = document.getElementById('alphaSlider');
    var alphaSlider = document.getElementById('alphaSlider');
    alphaSlider.value = artPad.localUser.brushAlpha * 100;
    sizeSlider.value = artPad.localUser.brushSize;       
    drawBrushSetting();
}

// ping server every 3.2 seconds to notify that this socket is still alive
function socketAlive() {
     setTimeout(function() {
        socket.emit('socket_alive');
        socketAlive();
    }, 3200);
}
socketAlive();

function executeAsync(func) {
    setTimeout(func, 0);
}
