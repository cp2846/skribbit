function getRoomsInfo() {
    user_auth = siteData.authToken;
    socket.emit('get_rooms_info', {'auth_token':user_auth});
}

// ping server for updates every 3.2 seconds
function pingServer() {
    setTimeout(function() {
        getRoomsInfo();
        pingServer();
    }, 3200);
}


socket.on('rooms_info', function(data) {
    dataParsed = JSON.parse(data);
    vueRooms.rooms = dataParsed;
    vueRooms.fetched = true;
});


getRoomsInfo();
pingServer();

// for displaying the user's silly frog avatar
eye = siteData.eye;
mouth = siteData.mouth;
setEyes();
setMouth();


var vueRooms = new Vue({
    el: '#rooms',
    data: {
        rooms: [],
        fetched: false,
    },
    computed: {
        roomLength: function() {
            return this.rooms.length
        }
    },
    methods: {
        roomLink: function(room) {
            return 'canvas/' + room.room_code
        }
    },
})
