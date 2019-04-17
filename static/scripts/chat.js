var chatUsers = [];

/*
  Calling this function refreshes the details about online users.
  It then updates a Vue component with the fresh data.
*/
function showOnline() {
   onlineUsers = [];
   for (var i = 0; i < chatUsers.length; i++) {
       user.statusReady = false;
       user.statusGuessed = false;
       user.statusDrawing = false;
       user = chatUsers[i];
       if (user.online) {   
           if (typeof gameState !== 'undefined') { 
               if (!gameState.started && user.ready) {
                    user.statusReady = true;
               }
               if (user.guessed_this_round) {
                    user.statusGuessed = true;
               }
            }
            if (typeof gameState !== 'undefined' && gameState.started && !gameState.idle && currentlyDrawingUser() && currentlyDrawingUser().uid == user.uid) {
                user.statusDrawing = true;
            }
            onlineUsers.push(user);
       }
    }
    vueUsers.users = onlineUsers;
   
}

// simple object for storing information about users on the client end
function ChatUser(uid, username, frogvatarEyes, frogvatarMouth) {
    this.uid = uid;
    this.frogvatarEyes = frogvatarEyes;
    this.frogvatarMouth = frogvatarMouth;
    this.username = username;
    this.online = false;
}

// User info is sent from server, load it into RAM
socket.on('user_info', function(data) {
    data = JSON.parse(data);
    if (!getUser(data.uid)) {
        chatUsers.push(new ChatUser(data["uid"], data['username'], data['frogvatarEyes'], data['frogvatarMouth']));
    }
});

// retreive a user by their uid
function getUser(uid) {
    for (var i = 0; i < chatUsers.length; i++) {
        if (chatUsers[i].uid == uid) return chatUsers[i];
    }
}

function sendMessage(msg) {
    if (msg) {
        socket.emit('chat_send', {'message':msg});
    }
}



socket.on('chat_receive', function(data) {
    data = JSON.parse(data);
    vueChat.messages.push(data);
    
});


socket.on('user_online', function(data) {
    data = JSON.parse(data);
    user = getUser(data.uid);
    if (user) {
        user.online = true;
        showOnline();
    } else {
        console.log('no user for' + data.uid);
    }
});


socket.on('user_offline', function(data) {
    data = JSON.parse(data);
    user = getUser(data.uid);
    user.online = false;
    showOnline();
});


socket.on('server_message', function(data) {
    data = JSON.parse(data);
    vueChat.messages.push(data);
});                

/* 
   Hotfix for issue where hitting 'enter' in chat
   input window leads to undesired behavior
*/
function handleInput(e) {
    if ('Enter' == e.key) {
        e.preventDefault();
        sendMessage(e.currentTarget.value.trim());
        e.currentTarget.value = '';
    }
}



var vueUsers = new Vue({
    el: '#userbox',
    data: {
        users: [],
        fetched: false,
    },
    computed: {
        numUsers: function() {
            return this.users.length
        }
    },
    methods: {
        getFrogvatarEyes: function(u) {
             return '/resources/eyes-' + (u.frogvatarEyes + 1) + '.gif';
            
        },
        getFrogvatarMouth: function(u) {
             return '/resources/mouth-' + (u.frogvatarMouth + 1) + '.gif';
        }
    },
})

/* 
  Vue component for rendering chat --
  includes messages from users
  and backend systems.
*/
var vueChat = new Vue({
    el: '#chat',
    data: {
        messages: [],
        fetched: false,
    },
    methods: {
        getUsername: function(uid) {
             if (!getUser(uid)) return ""; // This is a system message, no username
             return getUser(uid).username;  
        },
    },
})


