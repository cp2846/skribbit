/*

    Multi-user artpad
    
    The multi-user artpad makes it easy for multiple users to share the same artpad. 
    
    Each user is identified by a unique user-ID, which is up to you to assign and keep track of for each user.
    Each user has independent input sequence, undo sequence, brush size, and brush color.
    When the artpad is instantiated, a local user with id '0' is created. This user can be accessed by the artpad.localUser property.
    artpad.localUser is the one for which the canvas listens for input directly.
    
    You can add more users by calling the artpad.addUser() function, passing the user id as the argument:
    
        var artpad = new MultiUserArtPad(myCanvas);
        artpad.addUser("super unique ID key");
        
    This adds a new user with ID of "super unique ID key" to the list of current users. This user is an object with the following default properties:
    
    active = true;
    inputSequence = [];
    undoSequence = [];
    brushColor = '#000000';
    brushSize = 10;
    layers = artisan.create.stack();
    globalCompositeOperation = "source-over";
    undoCount = 0;
    painting = false;
    
    Because this new user is not the localUser, the artpad does not listen for its inputs directly. 
    You must instead pass inputs to the artpad, using the artPad.receiveInput() function (see below).
    
    
    ARTPAD FUNCTIONS
    
    artpad.addUser(userID)
        -- adds the user with the specified ID to the artpad.
            if the userID already exists, it will return the already-existing object.
            otherwise it will return a new user object with the default properties. 
            
    artpad.setBrushColor(userID, color)
    
    artpad.setBrushSize(userID, size)
    
    artpad.getBrushColor(userID)
    
    artpad.getBrushSize(userID)
    
    artPad.selectLayer(userID, layer) 
        -- sets the user's selected layer
        

        
    artpad.addLayer(userID) 
        -- adds a new layer for that user ID
    
    artpad.undo(userID)
    
    artpad.redo(userID)
    
    artpad.replay() 
        -- wipes and redraws the canvas based on the current input history
        
    artPad.receiveInput(userID, input)
        -- adds to the specified user's input sequence. This input follows the same encoding format as that for a standard artpad. 
    
    artpad.reset(userID)
        -- resets only the parts drawn by the specified user
      
      
    artpad.localUndo()
        -- should be called whenever the local user is undoing an action
    artpad.localRedo()
        -- should be called whenever the local user is redoing an action
    
    artpad.localSetBrushColor(color)
        -- should be called whenever the local user updates their brush color
        
    artpad.localSetBrushSize(size)
        -- should be called whenever the local user updates their brush size

    artpad.localAddLayer(layer) 
        -- adds a layer for the local user
        
    artpad.localSelectLayer(layer)
        -- sets the local user's selected layer
    
    
    
    ARTPAD USER HANDLER FUNCTIONS
    
    artpad.localUser.handleLocalInput(input)
        -- This function is called by the artpad's localUser whenever there's a mouse input. You can implement your own
        version of this function which allows you to respond in a custom way to local input. For example, you might wish to have
        it send the input to a remote API. This function is empty by default.
        -- note: this is also called whenever the artpad.localSetBrushColor() artpad.localSetBrushSize(), artpad.localAddLayer(), artpad.localSelectLayer() functions are called.
    
    artpad.localUser.handleLocalUndo()
        -- similar to handleLocalInput(), should be overridden to define your custom behavior whenever artpad.localUndo() is called
            (i.e. notifying a server, etc.)
        
    artpad.localUser.handleLocalRedo()
        -- similar to handleLocalInput(), should be overridden to define your custom behavior artpad.localRedo() is called
        
    artpad.localUser.handleLocalAddUser() 
        -- gets called when the localUser joins the artpad
    
        
        
*/

function MultiUserArtPad(container) {

    ArtPad.call(this, container);
    
    this.container = container;
    this.layers = []
    this.users = [];
    this.locked = false;
   
    
   this.container.getCursorPosition = function(event) {
        var rect = this.getBoundingClientRect();
        if (event.type == "touchmove" || event.type == "touchstart") {
            var x = Math.round(event.targetTouches[0].clientX - rect.left);
            var y = Math.round(event.targetTouches[0].clientY - rect.top);
        } else {
            var x = Math.round(event.clientX - rect.left);
            var y = Math.round(event.clientY - rect.top);
        }
        return {x:x, y:y};
    }
    
    this.container.onmousedown = function(e){
        
        this.mouseDownHandler(e);
    };
    this.container.ontouchstart = function(e){
        this.mouseDownHandler(e);
    };

    this.container.onmouseup = function(){
        this.mouseUpHandler();
    };
    this.container.ontouchend = function(){
        this.mouseUpHandler();
    };
    this.container.onmouseout = function() {
        
        //if (this.artpad.localUser.painting === true) {
            
        //    this.artpad.localUser.painting = false;
        //    this.artpad.localUser.inputSequence.push([4, false]);
        //    this.artpad.localUser.handleLocalInput([4, false]);
        //}
    }

    
    this.container.onmousemove = function(e) {
       this.mouseMoveHandler(e);

    };
    
    this.container.ontouchmove = function(e) {
       
       this.mouseMoveHandler(e);

    };

    // disable right click on canvas
    this.container.oncontextmenu = function(e) {
       e.preventDefault();
    }
    
    this.addUser = function(userID, artpad) {

        for (var i = 0; i < this.users.length; i++) {
            if (userID == this.users[i].id) {
                this.users[i].active = true;
                return this.users[i];
            }
        }
        
        var newUser = new ArtPadUser(userID, this);
        newUser.addLayer();
        this.users.push(newUser);
        this.replay();
        return newUser;
        
        
    }
    
    this.localAddUser = function(userID) {
        this.localUser = this.addUser(userID, this);
    }
    
    this.removeUser = function(userID) {
        //todo
    }
     
    this.deactivateUser = function(userID) {
        //todo
    }
    this.userJoin = function(userID) { 
        var exists = false;
        for (var i = 0; i < this.users.length && !exists; i++) {
            if (userID == this.users[i].id) {
                this.users[i].active = true;
                exists = true;
            }
        }
        if (!exists) {
            this.users.push(new ArtPadUser(userID));
        }
    }
    
    this.userLeave = function(userID) { 
        var exists = false;
        for (var i = 0; i < this.users.length && !exists; i++) {
            if (userID == this.users[i].id) {
                this.users[i].active = false;
                exists = true;
            }
        }
    }
    
    this.setBrushColor = function(userID, color) {
        var user = this.fetchUser(userID);
        this.setColorMode(userID, color);

    }
    
    this.setBrushSize = function(userID, size) {
        var user = this.fetchUser(userID);
        user.brushSize = size;
    }
    
    
    this.localSetBrushColor = function(color) {
        this.localUser.inputSequence.push([2,color]);
        this.setBrushColor(this.localUser.id, color);
        this.localUser.handleLocalInput([2, color]);
        
    }
    
    this.localSetBrushSize = function(size) {
        this.localUser.inputSequence.push([3,size]);
        this.localUser.handleLocalInput([3, size]);
        this.setBrushSize(this.localUser.id, size);
        
    }
    
    this.localSetBrushAlpha = function(alpha) {
        this.localUser.inputSequence.push([10, alpha]);
        this.localUser.handleLocalInput([10, alpha]);
        this.setBrushAlpha(this.localUser.id, alpha);
        
    }
    
    this.setBrushAlpha = function(userID, alpha) {
        var user = this.fetchUser(userID);
        user.brushAlpha = alpha;
    }
    
    
    this.getBrushColor = function(userID) {
        var user = this.fetchUser(userID);
        return user.brushColor;
    }
    
    this.getBrushSize = function(userID) {
        var user = this.fetchUser(userID);
        return user.brushSize;
    }
    
    
    
    
    this.setColorMode = function(userID, color) {
        var user = this.fetchUser(userID);
        user.brushColor = color;
        if (color === COLOR_ERASE) {
            user.globalCompositeOperation = "destination-out";
            user.brushColor = 'rgba(0,0,0,1)';
        } else {
            user.brushColor = color;
            user.globalCompositeOperation = "source-over";
        }
    }
    
    //todo: rename to getUser
    this.fetchUser = function(userID) {
        for (var i = 0; i < this.users.length; i++) {
            if (this.users[i].id == userID) 
                return this.users[i];
        }

        
    }

    this.reset = function(userID) {
        var user = this.fetchUser(userID);
        //for (var j = 0; j < user.layers.length; j++) {
        //    artisan.clearCanvas(user.layers[j].id);
        //}
        this.deleteUndos(userID);
        user.clearLayers();
        

        
    }
    
    this.redo = function(userID) {
        var user = this.fetchUser(userID);
        if (user.undoSequence.length > 0) {
            var lastUndo = user.undoSequence.pop();
            
            // must account for the brush settings at the time of the redone action!
            var oldColor = this.getBrushColor(userID);
            var newColor = oldColor;
            
            var oldAlpha = user.brushAlpha;
            var newAlpha = oldAlpha;
            
            var oldSize = this.getBrushSize(userID);
            var newSize = oldSize;
            
            
            for (var i = lastUndo[0]; i >= 0; i--) {
                if (user.inputSequence[i][0] == "2"){
                    newColor = user.inputSequence[i][1];
                    break;
                }
            }
            
            for (var i = lastUndo[0]; i >= 0; i--) {
                if (user.inputSequence[i][0] == "3"){
                    newSize = user.inputSequence[i][1];
                    break;
                }
            }
            
            for (var i = lastUndo[0]; i >= 0; i--) {
                if (user.inputSequence[i][0] == "10"){
                    newAlpha = user.inputSequence[i][1];
                    break;
                }
            }
            
            user.brushColor = newColor;
            user.brushAlpha = newAlpha;
            user.brushSize = newSize;
            for (var i = lastUndo[0]; i <= lastUndo[1]; i++) {
                this.playInput(user.id, user.inputSequence[i], true);
            }
            

            user.brushColor = oldColor;
            user.brushSize = oldSize;
            user.brushAlpha = oldAlpha;
            
        }
        
    }
    
    this.localUndo = function() {
        this.undo(this.localUser.id);
        this.localUser.handleLocalInput([6]);
        this.userReplay(this.localUser.id);
    }   
    
    this.localRedo = function() {
        
        this.redo(this.localUser.id);
        this.localUser.handleLocalInput([7]);
        
    }
    
    this.localReset = function() {
        var lastA = this.lastAction(this.localUser.id);
       
        if (lastA && lastA[0] != 5) {
             console.log(lastA);
            this.localUser.inputSequence.push([5]);
            this.localUser.handleLocalInput([5]);
            this.reset(this.localUser.id);
            this.userReplay(this.localUser.id);
        }
        
        
    }
    
    this.paint = function(userID, oldX, oldY, x, y) {
        var user = this.fetchUser(userID);
        var ctx = user.layers[user.selectedLayer].getContext('2d');
        ctx.globalCompositeOperation = user.globalCompositeOperation;
        if (oldY !== -1 && oldX !== -1) {
            artisan.drawLine(user.layers[user.selectedLayer].id, oldX, oldY, x, y, user.brushSize, hexToRGB(user.brushColor, user.brushAlpha));
        }
        if (user.brushAlpha >= 0.95)
            artisan.drawCircle(user.layers[user.selectedLayer].id, x, y, user.brushSize * 0.5, hexToRGB(user.brushColor, user.brushAlpha));
    };
    
    this.replay = function() {
        
        this.clear();
        for (var j = 0; j < this.users.length; j++) {
            this.userReplay(this.users[j].id);
        }
        
    };
    

    this.playInput = function(userID, input, fromRedo) {
        
        var user = this.fetchUser(userID);
        
        
        var input = this.decodeInput(input);

        if (input.type == 1) {
            this.paint(user.id, input.oldMouseX, input.oldMouseY, input.mouseX, input.mouseY);
        }
        else if (input.type == 2) {
            this.setBrushColor(user.id, input.color);
        }
        else if (input.type == 3) {
            this.setBrushSize(user.id, input.size);
        }
        else if (input.type == 4) {
            
            user.painting = input.painting;
        }
        else if (input.type == 5) {
            
            this.reset(user.id);
        }
        if (input.type == 6) { // UNDO
        
            this.undo(user.id);

            
        } else if (input.type == 7) { //REDO TYPE
            if (!fromRedo) {
                this.redo(user.id);
            }

        }
         else if (input.type == 9) { 
            this.addLayer(user.id);
        }
        else if (input.type == 8) {
            this.selectLayer(user.id, input.layer);
        }
        else if (input.type == 9) {
            
        }
        else if (input.type == 10) {
            this.setBrushAlpha(user.id, input.alpha);
        }
          
        
    };
    
    this.receiveInputs = function(userID, inputs, replay) {
        
        var user = this.fetchUser(userID);
        if (user == undefined) {
            user = this.addUser(userID, this);
        }

        
        for (var i = 0; i < inputs.length; i++) {
            
            this.playInput(userID, inputs[i]);
            
            if (inputs[i][0] == 4 && inputs[i][1] == true && user.undoCount > 0) {
                this.deleteUndos(user.id);
            } 
            if (inputs[i][0] == 7 || inputs[i][0] == 6) {
                this.userReplay(user.id);
            } else {
                user.inputSequence.push(inputs[i]);
                
            }
        }
        

        
    }
    
    this.loadInputs = function(userID, inputs) {
        var user = this.fetchUser(userID);
        if (user == undefined) {
            user = this.addUser(userID, this);
        }
        
        for (var i = 0; i < inputs.length; i++) {
           
            user.inputSequence.push(inputs[i]);
        }
        
    }
    
    this.getUndoEndIndex = function(userID, startIndex) {
        var user = this.fetchUser(userID);
        for (var i = 0; i < user.undoSequence.length; i++) {
            if (user.undoSequence[i][0] == startIndex) {
                
                return user.undoSequence[i][1];
            }
        }
        return -1;
    };
    
    this.getUndoStartIndex = function(userID, endIndex) {
        var user = this.fetchUser(userID);
        for (var i = user.undoSequence.length - 1; i >= 0; i--) {
            if (user.undoSequence[i][1] == endIndex) {
                
                return user.undoSequence[i][0];
            }
        }
        return -1;
    };
    
    
    
    // clears undos from the history, making them... un-..re-doable? 
    // this is needed when user scribbles new lines after undoing something
    this.deleteUndos = function(userID) {
        var user = this.fetchUser(userID);
        var deletedCells = 0;
        // for (var i = user.undoSequence.length - 1; i >= 0; i--) {
            // range = user.undoSequence[i][1] - user.undoSequence[i][0];
            // user.inputSequence.splice(user.undoSequence[i][0] - deletedCells, range + 1);
            // deletedCells += range;
            
            
        // }
        
        while (user.undoSequence.length > 0) {
            undo = user.undoSequence.pop();
            range = undo[1] - undo[0];
            user.inputSequence.splice(undo[0] - deletedCells, range + 1);
            deletedCells += range + 1;
        }
        
       
        user.undoCount = 0;
        user.undoSequence = new Array();
    };
    
    this.undo = function(userID) {
        var user = this.fetchUser(userID);
        
        
        var startIndex = -1;
        var endIndex = -1;
       
        /*
            search for the last undo-able action
        */
        
        for (var i = user.inputSequence.length - 1; i >= 0 && endIndex == -1; i--) {
                    // skip over the current input if it's been undone
            var skipIndex = this.getUndoStartIndex(user.id, i);
            if (skipIndex != -1) {
                i = skipIndex;
                continue;
            } else {
                var input = this.decodeInput(user.inputSequence[i]);
                if (input.type == 4 && input.painting === false) {
                    endIndex = i;
                }
                else if (input.type == 5) {
                    endIndex = i;
                    startIndex = i;
                }
            }
        } 
        for (var i = endIndex - 1; i >= 0 && startIndex == -1; i--) {
            var input = this.decodeInput(user.inputSequence[i]);
            if (input.type == 4 && input.painting === true) {
                startIndex = i;
            }
        } 
        if (startIndex != -1 && endIndex != -1) {
            user.undoSequence.push([startIndex, endIndex]);
            user.undoCount++;
        }
        
        
    };
    
    this.selectLayer = function(userID, layer) {
        var user = this.fetchUser(userID);
        user.selectedLayer = layer;
    };
    
    this.addLayer = function() {
        
        
     //   todo
    };
 
 
    this.localSelectLayer = function(layer) {
        this.localUser.inputSequence.push([8,selectedLayer]);
        this.localUser.handleLocalInput([8, selectedLayer]);
        this.selectLayer(localUser.id, layer);
        
    };
    
    this.localAddLayer = function(layer) {
        this.localUser.handleLocalInput([9]);
        this.addLayer(this.localUser.id);
    };

    
    this.rearrangeLayers = function(topLayer) {
        
        var newHTML = "";
        for (var i = 0; i < this.users.length; i++) {
            var user = fetchUser(users[i].id);
            if (user.id != localUser.id) {
                for (var j = 0; j < user.layers.length; j++) {
                    newHTML += user.layers[j];
                }
            }
        } 
        
        for (var j = 0; j < localUser.layers.length; j++) {
            if (j != topLayer) newHTML += User.layers[j];
        }
    };
    
    this.clear = function() {
        for (var i = 0; i < this.users.length; i++) {
            //this.reset(this.users[i].id);
            this.users[i].clearLayers();
        }
        
    };
    
    this.replayDepth = 0;
    this.userReplay = function(userID, startIndex) {
        
        /*
        include a little failsafe to ensure that userReplay 
        is not called as a result of itself, which could cause 
        an infinite recursive loop
        and cwash the web bwowser ;___;
        */
        this.replayDepth++;
        if (this.replayDepth == 1) { 
            startIndex = 0;
            user = this.fetchUser(userID);

            user.clearLayers();
           
            for (var i = startIndex; i < user.inputSequence.length; i++) {

                // skip over the current input if it's been undone
                var skipIndex = this.getUndoEndIndex(user.id, i);
                if (skipIndex != -1) {
                    i = skipIndex;
                    continue;
                } else {
                    
                    var input = user.inputSequence[i];
                    if(input[0] != 6) {
                        this.playInput(user.id, input);
                    }
                   
                }  

            }
        }
        this.replayDepth = 0;

    };
    
    
    /*
        NOTE:
        Long-Form replays are used for replaying the canvas from the very beginning - 
        the input should include all information about all undos, redos, etc. throughout the history of the canvas 
    */
    
    this.longFormReplay = function(userID) {
        
        //if (!startIndex) startIndex = 0;
        startIndex = 0;
        user = this.fetchUser(userID);
        //if (startIndex == 0) {
        user.clearLayers();
        //user.setBrushDefaults();
        
       // }
       user.longFormInputSequence = user.inputSequence;
       user.inputSequence = [];
       
        
       //this.receiveInputs(userID, user.longFormInputSequence);
        this.receiveInputs(user.id, user.longFormInputSequence, false);
        this.userReplay(userID);
        

    };
    
    // returns the last action
    this.lastAction = function(userID) {
        var user = this.fetchUser(userID);
        for (var i = user.inputSequence.length - 1; i >= 0; i--) {
            // skip over the current input if it's been undone
            var skipIndex = this.getUndoStartIndex(user.id, i);
            if (skipIndex != -1) {
                i = skipIndex;
                continue;
            } else {
                var input = user.inputSequence[i];
                if (input[0] == 5 || input[0] == 4 || input[0] == 1) {
                    return input;
                }
            }
        }
    };
    this.container.mouseDownHandler = function(e) {
        var coords = this.getCursorPosition(e);
        this.oldMouseX = coords.x;
        this.oldMouseY = coords.y;
        if (this.artpad.localUser && this.artpad.localUser.painting !== true && this.artpad.locked === false) {
            this.artpad.localUser.painting = true;
            this.artpad.localUser.inputSequence.push([4, true]);
            this.artpad.localUser.handleLocalInput([4, true]);
            if (this.artpad.localUser.undoCount > 0) {
                this.artpad.deleteUndos(this.artpad.localUser.id);
            }
            
            document.body.classList.add("unselectable");
                
        }
    };
    this.container.mouseMoveHandler = function(e) {
        var coords = this.getCursorPosition(e);
        this.mouseX = coords.x;
        this.mouseY = coords.y;
        if (this.artpad.localUser && this.artpad.localUser.painting && this.artpad.locked === false) {
            this.artpad.paint(this.artpad.localUser.id, this.oldMouseX, this.oldMouseY, this.mouseX, this.mouseY);
            this.artpad.localUser.inputSequence.push([1, this.oldMouseX, this.oldMouseY, this.mouseX, this.mouseY]);
            this.artpad.localUser.handleLocalInput([1, this.oldMouseX, this.oldMouseY, this.mouseX, this.mouseY]);
            
        }
        
        this.oldMouseX = this.mouseX;
        this.oldMouseY = this.mouseY;
    };
    this.container.mouseUpHandler = function() {
        if (this.artpad.localUser && this.artpad.localUser.painting === true && this.artpad.locked === false) {
            
            this.artpad.localUser.painting = false;
            this.artpad.localUser.inputSequence.push([4, false]);
            this.artpad.localUser.handleLocalInput([4, false]);
            document.body.classList.remove("unselectable");
        }
    };

   

}

function ArtPadUser(userID, artpad) {             
    this.id = userID;
    this.active = true;
    this.inputSequence = [];
    this.undoSequence = [];
    this.brushColor = '#000000';
    this.brushSize = 10;
    this.brushAlpha = 1;
    this.layers = artisan.create.stack();
    this.globalCompositeOperation = "source-over";
    this.undoCount = 0;
    this.painting = false;
    this.selectedLayer = 0;
    this.layers = [];
    this.artpad = artpad;
    
    
    this.handleLocalInput = function(input) {
      /*  you can override or modify this function to
        define what happens when a local user does something 
        (for example, call an API or emit an event)
    */
    };
    
    
    this.createLayerStack = function() {
        this.stackID = this.artpad.container.id+this.id+"LayerStack";
        var layerContainerHTML = "<div id='"+this.stackID+"' style='position:relative'></div>";
        container = document.getElementById(this.artpad.container.id);
        container.innerHTML += layerContainerHTML;

    }
    
    this.addLayer = function() {
        if (this.artpad) {
            var layerName = this.artpad.container.id+this.id+"layer"+this.layers.length;
            var layerContainer = document.getElementById(this.stackID);
            var mw = this.artpad.container.style.maxWidth;
            var mh = this.artpad.container.style.maxHeight;
            if (mw == "") mw = this.artpad.container.clientWidth;
            if (mh == "") mh = this.artpad.container.clientHeight;
            layerContainer.innerHTML += "<canvas id='"+layerName+"' width='1300' height='"+mh+"' style='pointer-events:none;position:absolute;top:0;left:0;'></canvas>";
            var newLayer = document.getElementById(layerName);
            newLayer.parentNode = this.artpad.container;
            this.layers.push(newLayer);
            
            
            /*  canvas won't display properly unless Artisan's canvas contexts are wiped...
                so added a function for it in artisan to be called whenever a layer is added
            */
            artisan.clear.contexts(); 
            this.resetReferences();
            
            
        }
    };
    
    this.resetReferences = function() {
        for (var i = 0; i < this.layers.length; i++) {
            this.layers[i] = document.getElementById(this.layers[i].id);
        }
    };
    
    this.clearLayers = function() {
        var layerContainer = document.getElementById(this.stackID);
        
        var newHTML = "";
        
        for (var i = 0; i < this.layers.length; i++) {
            newHTML += this.layers[i].outerHTML;
        }

        layerContainer.innerHTML = newHTML;
        this.layers = [];
        this.selectedLayer = 0;
        this.resetReferences();
        this.addLayer();
    };

    
    this.createLayerStack();
    
    

}






function hexToRGB(hex, alpha) {
    var r = parseInt(hex.slice(1, 3), 16),
        g = parseInt(hex.slice(3, 5), 16),
        b = parseInt(hex.slice(5, 7), 16);

    if (alpha) {
        return "rgba(" + r + ", " + g + ", " + b + ", " + alpha + ")";
    } else {
        return "rgb(" + r + ", " + g + ", " + b + ")";
    }
}

function rgbToHex(r, g, b) {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}
