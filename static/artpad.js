function ArtPad(container) {
    
    container.innerHTML += "<canvas id='"+container.id+"artpad'></canvas>";
    this.canvas = document.getElementById(container.id+"artpad");

    this.canvas.artpad = this;
    container.artpad = this;
    this.canvas.getCursorPosition = function(event) {
        var rect = this.getBoundingClientRect();
        var x = event.clientX - rect.left;
        var y = event.clientY - rect.top;
        return {x:x, y:y};
    }
    this.painting = false;
    this.canvas.oldMouseX = -1;
    this.canvas.oldMouseY = -1;
    this.undoCount = 0;
    this.ctx = this.canvas.getContext('2d');
    this.lastResetIndex = 0;
    COLOR_ERASE = 'erase';
    
    
     /* 
        an encoded sequence of input actions
        items in the stack follow 4 different formats
        and allow for a canvas to be simulated, saved, and re-drawn
        
        Type 1: Painting
        [1, oldMouseX, oldMouseY, mouseX, mouseY]
        
        Type 2: Setting the brush color
        [2, color]
        
        Type 3: Setting the brush size
        [3, size]
        
        Type 4: Setting the 'painting' property
        [4, true]
        
    */
    this.inputSequence = [];
    
    
    this.canvas.onmousedown = function(e){
        if (!(this.artpad.painting === true)) {
            this.artpad.painting = true;
            this.artpad.inputSequence.push([4, true]);
        };
    };
    this.canvas.onmouseup = function(e){
        if (this.artpad.painting === true) {
            this.artpad.painting = false;
            this.artpad.inputSequence.push([4, false]);
        }
    };
    this.canvas.onmouseout = function(e) {
        if (this.artpad.painting === true) {
            this.artpad.painting = false;
            this.artpad.inputSequence.push([4, false]);
        }
    }
    
    this.canvas.onmousemove = function(e) {
        if (this.artpad.painting === true) {
            var coords = this.getCursorPosition(e);
            this.mouseX = coords.x;
            this.mouseY = coords.y;
            
                this.artpad.paint(this.oldMouseX, this.oldMouseY, this.mouseX, this.mouseY);
                this.artpad.inputSequence.push([1, this.oldMouseX, this.oldMouseY, this.mouseX, this.mouseY]);
                
                if (this.artpad.undoCount > 0) {
                    this.artpad.deleteUndos();
                }
            
            this.oldMouseX = this.mouseX;
            this.oldMouseY = this.mouseY;
        
        }
        

    };
    
    
    this.paint = function(oldMouseX, oldMouseY, mouseX, mouseY) {
        
        if (oldMouseY !== -1 && oldMouseX !== -1) {
            artisan.drawLine(canvas.id, oldMouseX, oldMouseY, mouseX, mouseY, this.brushSize, this.brushColor);
        }
        artisan.drawCircle(canvas.id, mouseX, mouseY, this.brushSize * 0.5, this.brushColor);
    };
    

    
    this.setBrushColor = function(color) {
        this.setColorMode(color);
        this.inputSequence.push([2, color]);

    }
    
    this.setColorMode = function(color) {
        if (color === COLOR_ERASE) {
            this.ctx.globalCompositeOperation = "destination-out";
            this.brushColor = 'rgba(0,0,0,0.7)';
        } else {
            this.brushColor = color;
            this.ctx.globalCompositeOperation = "source-over";
        }
        
    }
    
    this.setBrushSize = function(size) {
        this.brushSize = size;
        this.inputSequence.push([3, size]);
    }
    this.clear = function() {
        artisan.clearCanvas(this.canvas.id);
    }
    
    this.replay = function(inputSequence) {
        var g = JSON.stringify(inputSequence);
        this.ctx.globalCompositeOperation = "source-over";
        this.clear();
        
        for (var i = 0; i < inputSequence.length; i++) {
            
            // skip over the current input if it's been undone
            var skipIndex = this.getUndoEndIndex(i);
            if (skipIndex != -1) {
                i = skipIndex;
            } else {
                var input = this.decodeInput(inputSequence[i]);
                if (input.type == 1) {

                    this.paint(input.oldMouseX, input.oldMouseY, input.mouseX, input.mouseY);
                }
                else if (input.type == 2) {
                    this.setColorMode(input.color);
                }
                else if (input.type == 3) {
                    this.brushSize = input.size;
                }
                else if (input.type == 4) {
                    this.painting = input.painting;
                }
                else if (input.type == 5) {
                    this.clear();
                }
            }  
        }
        
    }
    
    this.undoSequence = [];
    this.getUndoEndIndex = function(startIndex) {
       
        for (var i = 0; i < this.undoSequence.length; i++) {
            if (this.undoSequence[i][0] == startIndex) {
                
                return this.undoSequence[i][1];
            }
        }
        return -1;
    }
    
    this.undo = function() {
        
        if (this.undoSequence.length > 0) {
            var lastUndoStartIndex = this.undoSequence[this.undoSequence.length - 1][0];
        } else {
            var lastUndoStartIndex = this.inputSequence.length;
        }
        
        var startIndex = -1;
        var endIndex = -1;
       
        /*
            search for the last undo-able action

        */
        
        
        
        for (var i = lastUndoStartIndex - 1; i > 0 && endIndex == -1; i--) {
            var input = this.decodeInput(this.inputSequence[i]);
            if (input.type == 4 && input.painting === false) {
                endIndex = i;
            }
            else if (input.type == 5) {
                endIndex = i;
                startIndex = i;
            }
        } 
        for (var i = endIndex - 1; i > 0 && startIndex == -1; i--) {
            var input = this.decodeInput(this.inputSequence[i]);
            if (input.type == 4 && input.painting === true) {
                startIndex = i;
            }
        } 
        if (startIndex != -1 && endIndex != -1) {
            this.undoSequence.push([startIndex, endIndex]);
            this.replay(this.inputSequence);
            this.undoCount++;
        }
        
    }
    
    // clears undos from the history, making them... un-..re-doable? 
    // this is needed when user scribbles new lines after undoing something
    this.deleteUndos = function() {
        newInputSequence = new Array();
        for (var i = 0; i < this.inputSequence.length; i++) {
            
            var skipIndex = this.getUndoEndIndex(i);
            if (skipIndex !== -1) {
                i = skipIndex;
            } else {
                newInputSequence.push(this.inputSequence[i]);
            }
        }
        this.inputSequence = newInputSequence;
        this.undoCount = 0;
        this.undoSequence = new Array();
    }
    
    
    /* 
        decodes an encoded input sequence
        returns an object that's a little nicer to deal with
        
        Type 1: Painting
        [1, oldMouseX, oldMouseY, mouseX, mouseY]
        
        returns:
        {
            type:1,
            typedesc:"paint",
            oldMouseX:14,
            oldMouseY:32,
            mouseX:12,
            mouseY:44
        }
        
        
        Type 2: Setting the brush color
        [2, color]
        
        returns:
        {
            type:2,
            typedesc:"set brush color",
            color:#ffffff;
        }
        
        Type 3: Setting the brush size
        [3, size]
        
        returns:
        {
            type:3,
            typedesc:"set brush size",
            size:12;
        }
        
        
        Type 4: Setting the 'painting' property
        [4, true]
        
        returns:
        {
            type:4,
            typedesc:"set paiting",
            painting:false;
        }
        
        Type 5: Setting the 'painting' property
        [5]
        
        returns:
        {
            type:5,
            typedesc:"reset canvas",
        }
        
    */
    this.decodeInput = function(input) {
        var type = input[0];
        
        if (type == 1) {

            return {
                type:1,
                typedesc:"paint",
                oldMouseX:input[1], 
                oldMouseY:input[2], 
                mouseX:input[3], 
                mouseY:input[4]
            };
        }
        else if (type == 2) {
            return {
                type:2,
                typedesc:"set brush color",
                color:input[1],
            };
            
        }
        else if (type == 3) {
            return {
                type:3,
                typedesc:"set brush size",
                size:input[1],
            };
        }
        else if (type == 4) {
            return {
                type:4,
                typedesc:"set painting",
                painting:input[1],
            };
        }
        else if (type == 5) {
            return {
                type:5,
                typedesc:"reset canvas",
            };
        }
        else if (type == 6) {
            return {
                type:6,
                typedesc:"undo",
            };
        }
        else if (type == 7) {
            return {
                type:7,
                typedesc:"redo",
            };
        }
        else if (type == 8) {
            return {
                type:8,
                typedesc:"select layer",
                layer:input[1],
            };
        }
        else if (type == 9) {
            return {
                type:9,
                typedesc:"add layer",
            };
        }
        
        else if (type == 10) {
            return {
                type:10,
                typedesc:"set alpha",
                alpha:input[1],
            };
        }
    }
    
    this.redo = function() {
        if (this.undoCount > 0) {
            this.undoSequence.pop();
            this.replay(this.inputSequence);
            this.undoCount--;
        }
    }
    
    this.reset = function() {
        this.clear();
        this.inputSequence.push([5]);
    }
    
    this.layers = [];
    this.addLayer = function() {
        
        
    }
    
    this.setBrushSize(5);
    this.setBrushColor('#000');
}

