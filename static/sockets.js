var inputBuffer = [];
var socket = io.connect('http://127.0.0.1:5000');
socket.on('connect', function() {
    room_code = '{{ room.room_code }}';
    user_auth = '{{ user.auth_token }}';
    socket.emit('join', {'room':room_code, 'auth_token':user_auth});
});

socket.on('join', function(data) {
    room_id = '{{ room.id }}'
    
    if (data) {
        artPad.addUser(data.uid, artPad);
        artPad.replay();
    }
});

socket.on('receive_input', function(data) {
    data = JSON.parse(data);
    
    
    if (data && data.uid != artPad.localUser.id) {
        artPad.receiveInputs(data.uid, data.i);
        artPad.userReplay(data.uid);
     }   
    
});

socket.on('room_history', function(data) {
    
    if (data) {
        var JSONdata = JSON.parse(data);
        for (var i = 0; i < JSONdata.length; i++) {
            
            for (var j = 0; j < JSONdata[i].data.length; j++) {
                var inputStr = JSONdata[i].data[j];
                
                inputStr = inputStr.replace(/True/g, 'true');
                inputStr = inputStr.replace(/False/g, 'false');
                inputStr = inputStr.replace(/'/g, '"');
                inputStr = inputStr.replace(/None/g, '"undefined"');
                console.log(inputStr);
                inputJSON = JSON.parse(inputStr);
                artPad.loadInputs(JSONdata[i].uid, inputJSON);
                
            }
            
        }
        for (var i = 0; i < artPad.users.length; i++) {
        
            artPad.longFormReplay(artPad.users[i].id);
        }
        
    }
    localUserId = '{{ user.id }}';
    artPad.localAddUser(localUserId);
    console.log("done");
    removeSpinner();
    updateAlpha();
});

function pushInputs () {
    setTimeout(function() {
        
        
        if (inputBuffer.length > 0) {
            var roomid = '{{ room.id }}';
            
            socket.emit('input', {room:roomid, i:inputBuffer});
            inputBuffer = [];
        }
        if (artPad.localUser) {
            artPad.localUser.handleLocalInput = function(input) {
                inputBuffer.push(input);

            }
        }
        

        pushInputs();
    }, 600);
}
pushInputs();

function updateSize() {
    var sizeSlider = document.getElementById('sizeSlider');
    artPad.localSetBrushSize(sizeSlider.value);
    artisan.clearCanvas('sizeDisplay');
    artisan.drawCircle('sizeDisplay', 100, 100, sizeSlider.value * 0.5, artPad.getBrushColor(artPad.localUser.id), undefined, undefined, artPad.localUser.brushAlpha);
}

function updateColor(color) {
    artPad.localSetBrushColor(color);
    updateSize();
}

function updateAlpha() {
    var alphaSlider = document.getElementById('alphaSlider');
    artPad.localSetBrushAlpha(alphaSlider.value * 0.01);
    updateSize();
}
function stopPainting() {
    if (artPad.localUser && artPad.localUser.painting == true) {
        artPad.localUser.painting = false;
        artPad.localUser.inputSequence.push([4, false]);
        artPad.localUser.handleLocalInput([4, false]);
    }        
}

document.body.onmouseup = function(e)  {
   stopPainting();
}

function removeSpinner() {
    document.getElementById('spinnerContainer').style.display = 'none';
}
