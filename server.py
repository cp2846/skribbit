"""
-------------------------------------------------------------
                    server.py
    For defining the routes and API endpoints for the application
-------------------------------------------------------------
"""


from flask import Flask, render_template, request, flash, redirect, url_for
from flask_socketio import SocketIO
from flask_socketio import send, emit
from flask import session
from random import randint
from flask import jsonify
from flask_socketio import join_room, leave_room
from flask import json as flask_json
import models
import controllers
from functools import wraps
from datetime import datetime, timedelta
from operator import methodcaller
import outside

app = models.app
app.config['SECRET_KEY'] = outside.secret_key


socketio = SocketIO(app)

def authenticated_only(f):
    @wraps(f)
    def wrapped(*args, **kwargs):
        if not get_socket(request.sid):
            print("user not allowed")
            return {"data:":"error: you are not authorized to make that action"}    
        else:
            return f(*args, **kwargs)
    return wrapped


def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not get_user():
            flash('Not logged in.', 'error')
            
            return redirect(url_for('register'))
        
        return f(*args, **kwargs)

    return decorated_function
    
def clear_session(f):
    @wraps(f)
    def wrapped(*args, **kwargs):
        ret = f(*args, **kwargs)
        models.db.session.close()
        return ret
    return wrapped
    
def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        user = get_user()
        if not user or not user.is_admin:
            
            abort(404)
        return f(*args, **kwargs)
    return decorated_function
    
    
def currently_drawing_only(f):
    @wraps(f)
    def wrapped(*args, **kwargs):
        sock = get_socket(request.sid)

        pictionary_room = models.PictionaryManager.query.filter_by(room_id=sock.room.id).first()
        if pictionary_room and not pictionary_room.currently_drawing() == sock.user:
            emit('error', "not authorized to do that right now")
        else:
            return f(*args, **kwargs)
    return wrapped
    
def currently_drawing_only(f):
    @wraps(f)
    def wrapped(*args, **kwargs):
        sock = get_socket(request.sid)
        pictionary_room = models.PictionaryManager.query.filter_by(room_id=sock.room.id).first()
        if (pictionary_room and not pictionary_room.currently_drawing() == sock.user) or (pictionary_room and pictionary_room.idle):
            emit('error', "not authorized to do that right now")
        else:
            return f(*args, **kwargs)
    return wrapped
    
def pictionary_only(f):
    @wraps(f)
    def wrapped(*args, **kwargs):
        sock = get_socket(request.sid)
        pictionary_room = models.PictionaryManager.query.filter_by(room_id=sock.room.id).first()
        if not pictionary_room:
            emit('error', "invalid request")
        else:
            return f(*args, **kwargs)
    return wrapped
    
    
def pictionary_owner_only(f):
    @wraps(f)
    def wrapped(*args, **kwargs):
        sock = get_socket(request.sid)
        pictionary_room = models.PictionaryManager.query.filter_by(room_id=sock.room.id).first()
        if not pictionary_room.owner == sock.user:
            emit('error', "not authorized to do that right now")
        else:
            return f(*args, **kwargs)
    return wrapped

def record_activity(f):
    @wraps(f)
    def wrapped(*args, **kwargs):
        sock = get_socket(request.sid)
        sock.record_activity()
        sock.room.record_activity()
        sock.user.record_activity()
        prune()
        return f(*args, **kwargs)
    return wrapped    

    
@socketio.on('join')
@clear_session
def handle_join(json):
    data = json
    return_data = {}
    room = get_room(data["room"])
    auth_token = data["auth_token"]
    user = models.User.query.filter_by(auth_token=auth_token).first()
    if not user or not room or get_socket(request.sid):
        emit('error', "data error")
    else:
        sock = user.create_socket(request.sid, room.id)
        join_room(room.id)
        return_data["room"] = room.id
        return_data["uid"] = user.id
        
        room_history = room.get_room_history()
        room.add_socket(sock)
        emit('join', flask_json.dumps(return_data), broadcast=True, include_self=False, room=room.id)
        emit('room_history', flask_json.dumps(room_history), room=request.sid, include_self=True)
        
        uinfo = {}
        uinfo["uid"] = user.id
        uinfo["username"] = user.username
        uinfo["frogvatarMouth"] = user.frogvatar_mouth
        uinfo["frogvatarEyes"] = user.frogvatar_eyes

        emit('user_info', flask_json.dumps(uinfo), broadcast=True, include_self=True, room=room.id)
        
        uinfo = {}
        uinfo["uid"] = user.id
        emit('user_online', flask_json.dumps(uinfo), broadcast=True, include_self=False, room=room.id)
        
        

        for u in room.get_all_users():

            uinfo = {}
            uinfo["uid"] = u.id
            uinfo["username"] = u.username
            uinfo["frogvatarMouth"] = u.frogvatar_mouth
            uinfo["frogvatarEyes"] = u.frogvatar_eyes
            emit('user_info', flask_json.dumps(uinfo), room=request.sid, include_self=True)

        
        
        pictionary_room = models.PictionaryManager.query.filter_by(room_id=room.id).first()
        
        if pictionary_room:
            pictionary_room.add_tracker(user)
            if user != pictionary_room.owner and user == pictionary_room.room.creator:
                pictionary_room.transfer_ownership(user)
                data = {}
                data["uid"] = user.id
                emit('ownership',flask_json.dumps(data), room=room.id, broadcast=True)
            
            notify_game_state(pictionary_room)
            
        for u in room.get_active_users():
            uinfo = {}
            uinfo["uid"] = u.id
            emit('user_online', flask_json.dumps(uinfo), room=request.sid, include_self=True)
        room.record_activity()
            
@socketio.on('next_state')            
@authenticated_only
@record_activity
@pictionary_only
@clear_session
def next_state():
    sock = get_socket(request.sid)
    pr = get_pictionary_room(sock.room)
    if pr.started and pr.time_limit_reached():
        if pr.idle:
            next_turn(pr)
        else:
            pr.go_idle()
            emit('idle', room=sock.room.id, broadcast=True, include_self=True) # have an intermediate idle period between important states
            emit('server_message', flask_json.dumps({'message':'Time\'s up! The word was: ' + pr.current_word}), broadcast=True, room=sock.room.id, include_self=True)
            
@socketio.on('start_game')
@authenticated_only
@record_activity
@pictionary_only
@clear_session
def start_game():
    pictionary_start_game()
        
        
        
@socketio.on('game_state')
@authenticated_only
@record_activity
@pictionary_only
@clear_session
def game_state():
    notify_game_state(pr)
    
    
@socketio.on('socket_alive')
@authenticated_only
@record_activity
@clear_session
def socket_alive():
    pass
    
@socketio.on('input')
@authenticated_only
@record_activity
@currently_drawing_only
@clear_session
def input(data):
    return_data = {}
    socket = get_socket(request.sid)
    if "i" in data: #and controllers.validate_inputs(data["i"]):
        return_data["rid"] = socket.room.id
        return_data["uid"] = socket.user.id
        return_data["i"] = data["i"]
        socket.push_input(data["i"])
        print(data["i"])
        emit('receive_input', flask_json.dumps(return_data), broadcast=True, include_self=False, room=socket.room.id) 


    
@socketio.on('chat_send')  
@authenticated_only
@record_activity
@clear_session 
def chat_send(data):
    return_data = {}
    socket = get_socket(request.sid)
    return_data["uid"] = socket.user.id
    return_data["message"] = data["message"]
    if data["message"].strip():
        pr = get_pictionary_room(socket.room)
        if pr and pr.started and not pr.idle:
            if not pr.currently_drawing() == socket.user:
            
                processed_message = data["message"].replace("\n", "").replace("\r", "").lower().strip()


                if pr.current_word.strip().lower() in processed_message:
                    pr_tracker = pr.get_tracker(socket.user)
                    if not pr_tracker.guessed_this_round:
                        points_awarded = pr.award_points(socket.user)
                        emit('server_message', flask_json.dumps({'message':socket.user.username + ' has guessed the word! +' + str(points_awarded) + ' points!'}), broadcast=True, room=socket.room.id, include_self=True)
                        notify_game_state(pr)
                    
                else:
                    emit('chat_receive', flask_json.dumps(return_data), broadcast=True, include_self=True, room=socket.room.id)
        else:
            emit('chat_receive', flask_json.dumps(return_data), broadcast=True, include_self=True, room=socket.room.id)
    
    
@socketio.on('ready')  
@authenticated_only
@record_activity
@clear_session 
def ready():
    return_data = {}
    socket = get_socket(request.sid)
    return_data["uid"] = socket.user.id
    pr = get_pictionary_room(socket.room)
    pr.user_is_ready(socket.user)
    emit('user_ready', flask_json.dumps(return_data), broadcast=True, include_self=True, room=socket.room.id)
    
    if not pr.started and pr.majority_ready():
        pictionary_start_game()
      
    
@app.route('/register', methods=['GET', 'POST'])
@clear_session
def register():
    return controllers.make_user()

@app.route('/create_room')
@login_required
@clear_session
def create_room():
    return controllers.create_room()

   
@app.route('/index')
@login_required
@clear_session
def index():
    rooms = models.Room.query.all()
    rooms = sorted(rooms, key=methodcaller('get_active_user_count'))[::-1]
    user = get_user()
    return render_template('index.html',rooms=rooms,user=user)
    
    
@app.route('/')
@clear_session
def home():
    if get_user():
        return redirect(url_for('index'))
    return redirect(url_for('register'))
  
@app.route('/canvas/<room_code>')
@login_required  
@clear_session
def canvas(room_code):
    user = get_user()
    room = get_room(room_code)
    if not room:
        return redirect(url_for('index'))
    pictionary = get_pictionary_room(room)
    
    return render_template('canvas.html', room=room, user=user, pictionary=pictionary)

@app.route('/create_room_pictionary', methods=['GET','POST'])
@login_required  
@clear_session
def create_room_pictionary():
    return controllers.create_room_pictionary()
   
@app.route('/create_room_normal', methods=['GET','POST'])
@login_required  
@clear_session
def create_room_normal():
    return controllers.create_room_normal()

@socketio.on('disconnect')
@authenticated_only
@clear_session
def disconnect():
    sock = get_socket(request.sid)
    user = sock.user
    room = sock.room
    
    sock.destroy()

    active_users = room.get_active_users()
    if not user in active_users:
        data = {}
        data["uid"] = user.id
        emit('user_offline', flask_json.dumps(data), room=room.id, broadcast=True)

    
def get_socket(sid):
    return models.Socket.query.filter_by(sid=sid).first()
    

def get_room(room_code):
    return models.Room.query.filter_by(room_code=room_code).first()

def get_pictionary_room(room):
    return models.PictionaryManager.query.filter_by(room_id=room.id).first()
 
def get_user():

    """Returns the User record associated with the active session. 
       Retuns None if no active session is found.
    """
    if not 'username' in session:
        return None
    username = session['username']
    return models.User.query.filter_by(username=username).first()
    
    
def next_turn(pr):
    sock = get_socket(request.sid)
    next_player = pr.choose_player()
    if next_player:
        
        pr.give_next_turn(next_player)
        
        for s in pr.room.active_sockets: 
            data = {}
            data['uid'] = next_player.id
            if next_player == s.user:
                data['word'] = pr.current_word
            else:
                data['word'] = pr.blanked_word()
            emit('next_turn', flask_json.dumps(data), broadcast=False, room=s.sid, include_self=True)
        
        emit('server_message', flask_json.dumps({'message':'Up next: ' + next_player.username}), broadcast=True, room=sock.room.id, include_self=True)
    else:
        pr.next_round()
        emit('next_round', broadcast=True, room=sock.room.id, include_self=True)
        print(pr.round, pr.max_rounds)
        if pr.round > pr.max_rounds and pr.started:
            pr.prepare_end_game()
            emit('end_game', broadcast=True, room=sock.room.id, include_self=True)
    
    notify_game_state(pr)
            
def pictionary_start_game():
    sock = get_socket(request.sid)
    pr = get_pictionary_room(sock.room)
    if not pr.started:
        pr.prepare_start_game()
        pr.next_round()
        emit('next_round', broadcast=True, room=sock.room.id, include_self=True)
        next_turn(pr)
        
def notify_game_state(pictionary_room):
    game_state = pictionary_room.get_game_state()
    for s in pictionary_room.room.active_sockets: 
        if pictionary_room.started and not pictionary_room.idle and not (pictionary_room.currently_drawing() == s.user or pictionary_room.get_tracker(s.user).guessed_this_round):
            game_state["word"] = pictionary_room.blanked_word()
        else:
            game_state["word"] = pictionary_room.current_word  
           
        emit('game_state', flask_json.dumps(game_state), broadcast=False, room=s.sid, include_self=(s.sid == request.sid))
        
@clear_session 
def delete_sockets():
    models.Socket.query.delete()
    models.db.session.commit()

@clear_session 
def delete_rooms():
    for r in models.Room.query.all():
        r.destroy()
    models.db.session.commit()    

@clear_session
def prune():
    deadline = datetime.utcnow() - timedelta(seconds=30)
    for s in models.Socket.query.filter(models.Socket.last_active_time <= deadline).all():
        s.destroy()
    deadline = datetime.utcnow() - timedelta(seconds=300)
    for r in models.Room.query.filter(models.Room.last_active_time <= deadline).filter_by(persistent=False).all():
       r.destroy()
    deadline = datetime.utcnow() - timedelta(seconds=3000)
    models.User.query.filter(models.User.last_active_time <= deadline).filter_by(is_admin=False).delete()
    pass
		
if __name__ == '__main__':
    prune()
    socketio.run(app,debug=True)