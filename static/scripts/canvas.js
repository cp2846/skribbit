
//initialize the color picker
new KellyColorPicker({
    place : 'picker',
    input: 'colorpicker',
    size: 120,
});

var inputBuffer = [];


socket.on('join', function(data) {
    room_id = siteData.room;
    
    if (data) {
        artPad.addUser(data.uid, artPad);
        artPad.replay();
    }
});

socket.on('receive_input', function(data) {
    data = JSON.parse(data);
    
    
    if (data) {
        artPad.receiveInputs(data.uid, data.i, true);
    }   
    
});
artPad.using = false;
function usingControls() {
    artPad.using = true;
}
function notUsingControls() {
    artPad.using = false;
}

socket.on('room_history', function(data) {
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
    localUserId = siteData.uid;
    artPad.localAddUser(localUserId);
    
    artPad.localUser.handleLocalInput = function(input) {
        inputBuffer.push(input);
    }
    
    updateColor();
    updateAlpha();
    updateSize();
    removeSpinner();
    pushInputs();

});

socket.on('user_offline', function(data) {
    console.log(data);
});

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


function updateSize() {
    var sizeSlider = document.getElementById('sizeSlider');
    artPad.localSetBrushSize(sizeSlider.value);
    drawBrushSetting();
}

// draws a preview of what the brush looks like in the sizeDisplay element
function drawBrushSetting() {
    artisan.clearCanvas('sizeDisplay');
    x = document.getElementById('colorbar').clientWidth / 2;
    artisan.drawCircle('sizeDisplay', x, 100, sizeSlider.value * 0.5, artPad.getBrushColor(artPad.localUser.id), undefined, undefined, artPad.localUser.brushAlpha);
}

function updateColor(color) {
    color = document.getElementById("colorpicker").value;
    artPad.localSetBrushColor(color);
    drawBrushSetting();
}

function updateAlpha() {
    var alphaSlider = document.getElementById('alphaSlider');
    artPad.localSetBrushAlpha(alphaSlider.value * 0.01);
    drawBrushSetting();
}
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

document.getElementById("container").onmouseenter = function() {
    document.body.classList.add("unselectable");
}

    
// to maintain parity when user has multiple tabs open
function syncBrushValues() {

    var alphaSlider = document.getElementById('alphaSlider');
    var alphaSlider = document.getElementById('alphaSlider');
    var colorPicker = document.getElementById('colorpicker');
    alphaSlider.value = artPad.localUser.brushAlpha * 100;
    sizeSlider.value = artPad.localUser.brushSize;      
    colorPicker.value = artPad.localUser.brushColor;      
    drawBrushSetting();

}
function setColor(color) {
    var colorPicker = document.getElementById("colorpicker");
    colorPicker.value = color;
    updateColor();
}
function socketAlive() {
     setTimeout(function() {
        socket.emit('socket_alive');
        socketAlive();
    }, 3200);
}
socketAlive();