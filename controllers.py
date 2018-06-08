"""
-------------------------------------------------------------
                        CONTROLLERS
For controlling the web-based routines, such as user registration,
          login, room creation, deletion, etc.
-------------------------------------------------------------
"""


from models import *
from flask import redirect, url_for, flash, request, abort, render_template
from sqlalchemy import func
import json

def register():

    errors = []
    
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        password_confirm = request.form['password_confirm']
        frogvatar_eyes = request.form['eyes-setting']
        frogvatar_mouth = request.form['mouth-setting']
        existing_user = User.query.filter(func.lower(User.username) == func.lower(username)).first()
        
        if not valid_username(username):
            errors.append("Invalid username: must contain only alphanumeric characters and be less than or equal to 20 characters in length")
        
        if existing_user:
            errors.append("Username is already taken")
            
        if password != password_confirm:
            errors.append("Passwords do not match")

        if len(password) < 6:
            errors.append("Password must be at least 6 characters.")
            
        try:
            frogvatar_eyes = int(frogvatar_eyes)
            frogvatar_eyes = max(frogvatar_eyes, 0)
            frogvatar_eyes = min(frogvatar_eyes, 5)
            frogvatar_mouth = int(frogvatar_mouth)
            frogvatar_mouth = max(frogvatar_mouth, 0)
            frogvatar_mouth = min(frogvatar_mouth, 5)
            
        except:
            errors.append("Could not process your request; please try again later.")
        
        if len(errors) > 0:
            for error in errors:
                flash(error, 'error')
            return redirect(url_for('register'))
            
        
        else:
            new_user = User(username, password, frogvatar_eyes=frogvatar_eyes, frogvatar_mouth=frogvatar_mouth)
            db.session.add(new_user)
            new_user.set_auth_token()
            db.session.commit()

            session['username'] = request.form['username']
            
            

            return redirect(url_for('index'))
            

    if get_user():
        return redirect(url_for('index'))

    return render_template('register.html')  

def login():
    if request.method == 'POST':
    
        username = request.form['username']
        password = request.form['password']

        user = User.query.filter(func.lower(User.username) == func.lower(username)).first()

        if user and user.check_password(password):
         
            # create session
            session['username'] = request.form['username']
            user.set_auth_token()
            return redirect(url_for('index'))
            
        else:
            flash('Invalid login credentials.', 'error')
            
    
    if get_user():
        return redirect(url_for('index'))  
        
    return render_template('login.html')

def logout():
    session.pop('username', None)
    return redirect(url_for('login'))


def create_room():
    return render_template('create_room.html', user=get_user())
            
            
def create_room_pictionary():
    if request.method == 'POST':
        user = get_user()
        room_name = request.form['room_name']
        room_name = room_name[0:min(100, len(room_name))]
        room_turn_length = request.form['room_turn_length']
        room_max_rounds = request.form['room_max_rounds']
        room_wordlist = request.form['room_wordlist']
        room_turn_length = int(room_turn_length)
        room_max_rounds = int(room_max_rounds)
        room_wordlist = list(set([w.strip() for w in room_wordlist.replace("\r\n", "\n").split("\n")]))
        room_wordlist = "\r\n".join([w for w in room_wordlist if not w == ''])
        if not room_name or not room_wordlist or not room_turn_length or not room_max_rounds:
            flash('Fields cannot be empty.', 'error')
            return redirect(url_for('create_room_pictionary'))
        new_room = user.create_pictionary_room(room_name,turn_length=room_turn_length*100,max_rounds=room_max_rounds,word_list=room_wordlist)
        return redirect(url_for('canvas', room_code=new_room.room.room_code))
    return render_template('create_room_pictionary.html', user=get_user())
            
def create_room_normal():
    if request.method == 'POST':
        user = get_user()
        room_name = room_name[0:min(100, len(room_name))]
        if not room_name:
            flash('Fields cannot be empty.', 'error')
            return redirect(url_for('create_room_normal'))
        new_room = user.create_room(room_name)
        return redirect(url_for('canvas', room_code=new_room.room_code))
    return render_template('create_room_normal.html', user=get_user())   
    
    
def get_user():

    """Returns the User record associated with the active session. 
       Retuns None if no active session is found.
    """
    if not 'username' in session:
        return None
    username = session['username']
    return User.query.filter_by(username=username).first()
    

def valid_username(username):

    # username: str
    # return: bool
    
    return username.isalnum() and len(username) <= 20
    
    

def validate_inputs(inputs):

    for input in inputs:
        if not validate_input(input):
            print("invalid")
            return False

    return True

# a function for validating that user-supplied 
# input matches the artpad's expected input format    
def validate_input(input):
    
    if not input:
        return False

    type = int(input[0])
    if type == 1:
        if len(input) != 5:
            return False
        input[1] = int(input[1])
        input[2] = int(input[2])
        input[3] = int(input[3])
        input[4] = int(input[4])
        return input[1] > 0 and input[2] > 0 and input[3] > 0 and input[4] > 0
    
    elif type == 2:
        if len(input) != 2 or len(input[1]) != 7:
            return False
        color = input[1][1:7]
        color = int(color, 16)
        
    elif type == 3 or type == 8:       
        if len(input) != 2:
            return False
        input[1] = int(input[1])
    
    elif type == 4:       
        if len(input) != 2:
            return False
        return input[1] in [True, False]
        
    elif type == 5 or type == 6 or type == 7 or type == 9:       
        if len(input) != 1:
            return False
            
    elif type == 10:
        input[1] = float(input[1])
        return input[1] >= 0 and input[1] <= 1
        
    else:
        return False
        
    return True