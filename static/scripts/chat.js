var chatUsers = [];


function appendChatMessage(uid, message) {
   var user = getUser(uid);
   var chatNode = document.createElement("div");
   var chatMessageUsername = document.createElement("span");
   var chatMessageBody = document.createElement("div");
   
   chatNode.classList.add("chat-message");
   chatMessageUsername.classList.add("username");
   chatMessageBody.classList.add("chat-message-body");
   
   var chatMessageBodyText = document.createElement("p");
   
   
   var messageFrogvatar = document.createElement("div");
   
   if (uid == 'ribbot') {
        messageFrogvatar.innerHTML +=  "<img src=\""+staticURL + "ribbot.gif" + "\"class='frogvatar'/>";
        chatNode.classList.add("ribbot-text");
        chatMessageUsername.innerHTML = 'RIBBOT';
   } else {
   
   
  
       
       messageFrogvatar.innerHTML +=  "<img src=\""+staticURL + "head.gif" + "\"class='frogvatar'/>";
       messageFrogvatar.innerHTML +=  "<img src=\""+staticURL  +"eyes-" + (user.frogvatarEyes + 1) + ".gif\"class='frogvatar'/>";
       messageFrogvatar.innerHTML +=  "<img src=\""+staticURL  +"mouth-" + (user.frogvatarMouth + 1) + ".gif\"class='frogvatar'/>";
       chatMessageUsername.innerHTML = user.username;
       
       
   }
   messageFrogvatar.classList.add("chat-frogvatar-container");
   message = String(message);
   
   chatMessageBodyText.textContent = message;
   chatMessageBody.appendChild(chatMessageUsername);
   chatMessageBody.appendChild(chatMessageBodyText);

   chatNode.appendChild(chatMessageBody);
   chatNode.appendChild(messageFrogvatar);
   messageContainer = document.getElementById("chat-messages");
   messageContainer.appendChild(chatNode);
   messageContainer.scrollTop = messageContainer.scrollHeight;
   
}



        
function showOnline() {
    var userbar = document.getElementById("userbar");
    userbar.innerHTML = "";
   for (var i = 0; i < chatUsers.length; i++) {
       user = chatUsers[i];
       if (user.online) {
           var userNode = document.createElement("div");
           var userInfo = document.createElement("p");
           
           userNode.classList.add("user-box");
           userInfo.classList.add("notification");
           
           
           var  userFrogvatar = document.createElement("div");
           

           
           userFrogvatar.classList.add("chat-frogvatar-container");
           
           userFrogvatar.innerHTML +=  "<img src=\""+staticURL  + "head.gif" + "\"class='frogvatar'/>";
           userFrogvatar.innerHTML +=  "<img src=\""+staticURL   +"eyes-" + (user.frogvatarEyes + 1) + ".gif\"class='frogvatar'/>";
           userFrogvatar.innerHTML +=  "<img src=\""+staticURL   +"mouth-" + (user.frogvatarMouth + 1) + ".gif\"class='frogvatar'/>";
           
           userInfo.textContent = user.username;
           

           
          var crayon = "{{url_for('static', filename='crayon.gif')}}";
          
           if (typeof gameState !== 'undefined' && gameState.started && !gameState.idle && currentlyDrawingUser() && currentlyDrawingUser().uid == user.uid) {
                userNode.innerHTML += "<img src=\""+ crayon + "class='status-icon'/>"
           }
           if (typeof gameState !== 'undefined') { 
                if (!gameState.started && user.ready) {
                    
                    userNode.innerHTML += "<img src=\""+ checkmark + "class='status-icon'/>";
               }
               if (user.score) {
                    userInfo.textContent = user.username + " (" + user.score + ")";
               }
               if (user.guessed_this_round) {
                    userNode.classList.add("user-guessed");
               }
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
