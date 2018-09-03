var chatUsers = [];


function appendChatMessage(uid, message) {
   var user = getUser(uid);
   var chatNode = document.createElement("div");
   var chatMessageUsername = document.createElement("span");
   var chatMessageBody = document.createElement("span");
   
   chatNode.classList.add("message");
   chatMessageUsername.classList.add("username");
   chatMessageBody.classList.add("chat-message-body");
   
   
   
   var messageFrogvatar = document.createElement("div");
   
   if (uid == 'ribbot') {
        chatMessageUsername.textContent = "";
   } else {
       
       chatMessageUsername.textContent = user.username + ": ";
   }
   
   messageFrogvatar.classList.add("frogvatar-chat");
   message = String(message);
   
   chatMessageBody.textContent = message;
   chatNode.appendChild(chatMessageUsername);
   chatNode.appendChild(chatMessageBody);

   messageContainer = document.getElementById("messages");
   messageContainer.appendChild(chatNode);
   messageContainer.scrollTop = messageContainer.scrollHeight;
   
}



        
function showOnline() {
    var userbar = document.getElementById("users");
    userbar.innerHTML = "";
   for (var i = 0; i < chatUsers.length; i++) {
       user = chatUsers[i];
       if (user.online) {
           var userNode = document.createElement("div");
           var userInfo = document.createElement("span");
           
           userInfo.classList.add("userInfo");
           
           userNode.classList.add("user");
           userNode.classList.add("pane");
           userNode.classList.add("all-100");
           userNode.classList.add("cell");
           
           var  userFrogvatar = document.createElement("div");
           

           
           userFrogvatar.classList.add("frogvatar-chat");
           
           userFrogvatar.innerHTML +=  "<img src=\""+staticURL  + "head.gif" + "\"class='frogvatar'/>";
           userFrogvatar.innerHTML +=  "<img src=\""+staticURL   +"eyes-" + (user.frogvatarEyes + 1) + ".gif\"class='frogvatar'/>";
           userFrogvatar.innerHTML +=  "<img src=\""+staticURL   +"mouth-" + (user.frogvatarMouth + 1) + ".gif\"class='frogvatar'/>";
           
           userInfo.innerHTML = user.username;
           
           if (typeof gameState !== 'undefined') { 

               if (user.score) {
                    userInfo.innerHTML = user.username + " (" + user.score + ")";
               }
               if (!gameState.started && user.ready) {
                    userInfo.innerHTML += "<img src=\""+ staticURL + "checkmark.gif" +"\" class='status-icon'/>";
               }
               if (user.guessed_this_round) {
                    userNode.classList.add("user-guessed");
               }
            }
            if (typeof gameState !== 'undefined' && gameState.started && !gameState.idle && currentlyDrawingUser() && currentlyDrawingUser().uid == user.uid) {
                userInfo.innerHTML += "<img src=\""+ staticURL + "crayon.gif" + "\" class='status-icon'/>";
            }
            userNode.appendChild(userInfo);
           
            userNode.appendChild(userFrogvatar);
           
            
            userbar.appendChild(userNode);


       }
    }
   
}




function ChatUser(uid, username, frogvatarEyes, frogvatarMouth) {
    this.uid = uid;
    this.frogvatarEyes = frogvatarEyes;
    this.frogvatarMouth = frogvatarMouth;
    this.username = username;
    this.online = false;
}

socket.on('user_info', function(data) {
    data = JSON.parse(data);
    if (!getUser(data.uid)) {
        chatUsers.push(new ChatUser(data["uid"], data['username'], data['frogvatarEyes'], data['frogvatarMouth']));
    }
});

function getUser(uid) {
    for (var i = 0; i < chatUsers.length; i++) {
        if (chatUsers[i].uid == uid) return chatUsers[i];
    }
}



var localUid = '{{user.id}}';
var localFrogvatarMouth = '{{user.frogvatar_mouth}}';
var localFrogvatarEyes = '{{user.frogvatar_eyes}}';
var localUsername = '{{user.username}}';
localFrogvatarMouth = parseInt(localFrogvatarMouth);
localFrogvatarEyes = parseInt(localFrogvatarEyes);
chatUsers.push(new ChatUser(localUid, localUsername, localFrogvatarEyes, localFrogvatarMouth));


function sendMessage(msg) {

    
    
    if (msg) {
        socket.emit('chat_send', {'message':msg});
    }
    
}

socket.on('chat_receive', function(data) {
    data = JSON.parse(data);
    appendChatMessage(data.uid, data.message);
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
    appendChatMessage("ribbot", data.message);
});                

function handleInput(e) {
    if ('Enter' == e.key) {
        e.preventDefault();
        sendMessage(e.currentTarget.value.trim());
        e.currentTarget.value = '';
    }
}

document.getElementById("chat-textarea").addEventListener('keydown', e => {
    handleInput(e);
});

document.getElementById("chat-button").addEventListener('mousedown', e => {
    chatArea = document.getElementById('chat-textarea');
    sendMessage(chatArea.value);
    chatArea.value = '';
});
