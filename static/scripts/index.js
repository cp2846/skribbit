


function getRoomsInfo() {
    user_auth = siteData.authToken;
    socket.emit('get_rooms_info', {'auth_token':user_auth});
}
function pingServer() {
    setTimeout(function() {
        getRoomsInfo();
        pingServer();
    }, 3200);
}

socket.on('rooms_info', function(data) {
    var roomsContainer = document.getElementById('rooms');
    roomsContainer.innerHTML = "";
    // add table header
    roomsContainer.innerHTML += "<div class='room'><div class='room-title'>Room Name</div><div class='room-count'>Online </div></div>";
    // build the rest of the table
    data = JSON.parse(data);
    for (var i = 0; i < data['r'].length; i++) {
       var room = document.createElement("div");
       var roomTitle = document.createElement("div");
       var roomCount = document.createElement("div");
       var roomLink = document.createElement("a");
       
       room.classList.add("room");
       roomTitle.classList.add("room-title");
       
       roomCount.classList.add("room-count");
       
       
       roomCount.textContent = data['r'][i][1];
       roomLink.textContent = data['r'][i][0];
       roomLink.href = '/canvas/' + data['r'][i][2];
       
       roomTitle.appendChild(roomLink);
       room.appendChild(roomTitle);
       room.appendChild(roomCount);
       roomsContainer.appendChild(room);
       
    }
    if (data['r'].length == 0) {
        roomsContainer.innerHTML += "<div class='room'><p>No rooms online. <a href='/create_room'>Create one</a>!</p></div>";
    }
});
getRoomsInfo();
pingServer();
eye = siteData.eye;
mouth = siteData.mouth;
setEyes();
setMouth();