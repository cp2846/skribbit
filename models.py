"""
            MODELS for Skribbit!
Models contain all of the basic information about
            the Skribbit game state. 


"""


from flask import Flask, session
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug import secure_filename
import os
from flask_script import Manager
from flask_migrate import Migrate, MigrateCommand
from random import SystemRandom
from datetime import datetime, timedelta
import outside
import json


app = Flask(__name__, static_url_path='/resources')
app.config['SQLALCHEMY_DATABASE_URI'] = outside.database_URI
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False


db = SQLAlchemy(app)

# INITIATE MIGRATIONS ON RUN
migrate = Migrate(app, db)
manager = Manager(app)
manager.add_command('db', MigrateCommand)
db.create_all()

class User(db.Model):
 
    id = db.Column(db.Integer(), primary_key=True)
    username = db.Column(db.String(30), unique=True, nullable=False)
    date = db.Column(db.DateTime)
    auth_token = db.Column(db.String(35))
    created_rooms = db.relationship('Room', 
                               backref='creator', 
                               lazy='dynamic')
                               
    owned_pictionary_rooms = db.relationship('PictionaryManager', 
                               backref='owner', 
                               lazy='dynamic')
    sockets = db.relationship('Socket', 
                               backref='user', 
                               lazy='dynamic')
                               
    inputs = db.relationship('UserInput', 
                               backref='user', 
                               lazy='dynamic')
                               
    trackers = db.relationship('PictionaryUserTracker', 
                               backref='user', 
                               lazy='dynamic')
                               
    is_admin = db.Column(db.Boolean())

    frogvatar_eyes = db.Column(db.Integer(), default=0)
    frogvatar_mouth = db.Column(db.Integer(), default=0)
    last_active_time = db.Column(db.DateTime)
    
    def __init__(self, username, is_admin=False, frogvatar_eyes=0, frogvatar_mouth=0):
        
        self.username = username
        self.date = datetime.utcnow()
        self.is_admin = is_admin
        self.frogvatar_eyes = frogvatar_eyes
        self.frogvatar_mouth = frogvatar_mouth
        
    def create_room(self, name, type=1, persistent=False):
        new_room = Room(name, self.id)
        db.session.add(new_room)
        db.session.commit()
        return new_room
    
    # creates a persistent MODEL of a socket 
    def create_socket(self, sid, rid):
        socket = Socket.query.filter_by(user=self,sid=sid).first()
        if not socket:
            socket = Socket(sid, self.id, rid)
            db.session.add(socket)
            self.sockets.append(socket)
            room = Room.query.filter_by(id=rid).first()
            room.add_socket(socket)
            db.session.flush()
            return socket
        
    def set_auth_token(self):
        self.auth_token = generate_random_string(35)
        db.session.flush()
        return self.auth_token
    
    def check_auth_token(self, token):
        return self.auth_token == token 
       
    def create_pictionary_room(self, name, turn_length=6000, max_rounds=3, word_list=[], persistent=False):
        new_pictionary_room = PictionaryManager(name, self.id, turn_length, max_rounds, word_list)
        db.session.add(new_pictionary_room)
        db.session.flush()
        return new_pictionary_room
    
    def record_activity(self):
        self.last_active_time = datetime.utcnow()
        db.session.flush()
        
        
class Room(db.Model):
    
    id = db.Column(db.Integer(), primary_key=True)
    name = db.Column(db.String(100))
    type = db.Column(db.Integer())
    date = db.Column(db.DateTime)
    active_sockets = db.relationship('Socket', backref='room', lazy='dynamic')
    creator_id = db.Column(db.Integer(), db.ForeignKey('user.id'))
    room_code = db.Column(db.String(15))
    inputs = db.relationship('UserInput', 
                               backref='room', 
                               lazy='dynamic')
    pictionary_manager = db.relationship('PictionaryManager', uselist=False, backref='room')
    persistent = db.Column(db.Boolean()) # persistent rooms are not included in removal of inactive rooms
    last_active_time = db.Column(db.DateTime)
    
    def __init__(self, name, creator_id, persistent=False):
        
        # username: str
        # password: str
        
        self.name = name
        self.creator_id = creator_id
        self.date = datetime.utcnow()
        self.room_code = generate_random_string(15)
        self.last_active_time = self.date
        self.persistent = persistent
        
        
    def user_active(self, user):
        return user in self.get_active_users()
        
    def get_active_users(self):
        return list(set([s.user for s in Socket.query.filter_by(room=self).all()]))
    
    # for transmitting through websockets/JSON
    def get_user_history(self, user):
        data = {}
        data["uid"] = user.id
        
        data["data"] = [x.data for x in UserInput.query.filter_by(room=self,user=user).order_by(UserInput.id)]
        return data
        
    def get_room_history(self):
        data = []
        
        for user in self.get_all_users():
            data.append(self.get_user_history(user))
    
        return data
        
    def add_socket(self, socket):
        socket.room_id = self.id
        self.active_sockets.append(socket)
        db.session.flush()

        
    def get_all_users(self):
        user_ids = set([u.user_id for u in UserInput.query.filter_by(room_id=self.id).all()] + [u.id for u in self.get_active_users()])
        if len(user_ids) > 0:
            return User.query.filter(User.id.in_(user_ids))
        return []
        
    def destroy(self):
        db.session.delete(self)
        if self.pictionary_manager:
            self.pictionary_manager.destroy()
        
        db.session.flush()
        
    def record_activity(self):
        self.last_active_time = datetime.utcnow()
        db.session.flush()

    def get_active_user_count(self):
        return len(self.get_active_users())
   
class PictionaryManager(db.Model):
    
    id = db.Column(db.Integer(), primary_key=True)      
    room_id = db.Column(db.Integer(), db.ForeignKey('room.id')) 
    started = db.Column(db.Boolean())
    round = db.Column(db.Integer()) 
    owner_id = db.Column(db.Integer(), db.ForeignKey('user.id'))
    turn_length = db.Column(db.Integer()) # measured in centiseconds (1/100th of a second)
    max_rounds = db.Column(db.Integer())
    current_turn_start_time = db.Column(db.DateTime) 
    current_idle_start_time = db.Column(db.DateTime)
    idle_length = db.Column(db.Integer()) # measured in centiseconds (1/100th of a second)
    idle = db.Column(db.Boolean())
    current_word = db.Column(db.String(100))
    word_list = db.Column(db.String(50000))
    
    def __init__(self, name, creator_id, turn_length=3000, max_rounds=3, word_list=[]):
        room = Room(name, creator_id)
        db.session.add(room)
        db.session.commit()
        self.room_id = room.id
        self.owner_id = creator_id
        self.turn_length = turn_length
        self.idle_length = 1000 # for now
        self.started = False
        self.idle = False
        self.current_turn_start_time = datetime.utcnow()
        self.current_idle_start_time = datetime.utcnow()
        self.round = 0
        self.max_rounds = max_rounds
        self.word_list = word_list
        
    def prepare_start_game(self):
        for t in PictionaryUserTracker.query.filter_by(pictionary_manager_id=self.id):
            t.drawing = False
            t.drawn_this_round = False
            t.guessed_this_round = False
            t.ready = False
            t.score = 0
        self.started = True
        self.round = 0
        self.wipe()
        
        db.session.flush()
        
    def give_next_turn(self, player):
        trackers = PictionaryUserTracker.query.filter_by(pictionary_manager_id=self.id).all()
        
        
        self.wipe()
        player_tracker = self.get_tracker(player)
        
        for t in trackers:
            t.drawing = False
            t.guessed_this_round = False
        
        self.choose_word()
        player_tracker.drawing = True
        player_tracker.drawn_this_round = True
        self.idle = False
        self.current_turn_start_time = datetime.utcnow()
        db.session.flush()
        
    def next_round(self):
        for t in PictionaryUserTracker.query.filter_by(pictionary_manager_id=self.id):
            t.drawing = False
            t.drawn_this_round = False
            t.guessed_this_round = False
        self.round += 1
        db.session.flush()

    def prepare_end_game(self):
        tracker = PictionaryUserTracker.query.filter_by(pictionary_manager_id=self.id,drawing=True).first()
        if tracker:
            tracker.drawing = False
            tracker.ready = False
        self.started = False
        
        self.idle = True
        db.session.flush()
        
    def wipe(self):
        UserInput.query.filter_by(room_id=self.room.id).delete()
        db.session.flush()
      
    def time_limit_reached(self):
      
        return (not self.idle and (datetime.utcnow() - self.current_turn_start_time).total_seconds() > self.turn_length/100) or (self.idle and (datetime.utcnow() - self.current_idle_start_time).total_seconds() > self.idle_length/100)
    
    def transfer_ownership(self, user):
        self.owner.owned_pictionary_rooms.remove(self)
        user.owned_pictionary_rooms.append(self)
        self.owner_id = user.id
        db.session.flush()
    
   
        
    def add_tracker(self, user):
        tracker = PictionaryUserTracker.query.filter_by(pictionary_manager_id=self.id,user_id=user.id).first()
        if not tracker:
            tracker = PictionaryUserTracker(user.id, self.id)
            db.session.add(tracker)
            db.session.flush()
        return tracker
    
    def get_tracker(self, user):
        return PictionaryUserTracker.query.filter_by(pictionary_manager_id=self.id,user_id=user.id).first()
        
    def currently_drawing(self):
        tracker = PictionaryUserTracker.query.filter_by(pictionary_manager_id=self.id,drawing=True).first()
        if tracker:
            return tracker.user
            
    def get_game_state(self):
        data = {}
        ptrackers = []
        for p in PictionaryUserTracker.query.filter_by(pictionary_manager_id=self.id).all():
            pdata = {}
            pdata["uid"] = p.user.id
            pdata["score"] = p.score
            pdata["drawing"] = p.drawing
            pdata["ready"] = p.ready
            pdata["guessed_this_round"] = p.guessed_this_round
            ptrackers.append(pdata)
           
        data["round"] = self.round
        data["idle"] = self.idle
        data["current_turn_time_left"] = (self.current_turn_start_time + timedelta(seconds=self.turn_length/100) - datetime.utcnow()).total_seconds()
        data["current_idle_time_left"] = (self.current_idle_start_time + timedelta(seconds=self.idle_length/100) - datetime.utcnow()).total_seconds()
        data["idle_length"] = self.idle_length
        data["turn_length"] = self.turn_length
        data["udata"] = ptrackers
        data["started"] = self.started
        data["word"] = self.blanked_word()
        return data
        
    def go_idle(self):
        self.idle = True
        self.current_idle_start_time = datetime.utcnow()
        db.session.flush()

    # returns true if a simple majority (n/2 + 1) active users
    # are ready
    def majority_ready(self):
        active_users = self.room.get_active_users()
        uids = set([u.id for u in active_users])
        trackers = PictionaryUserTracker.query.filter(PictionaryUserTracker.user_id.in_(uids)).filter_by(pictionary_manager_id=self.id).all()
        ready = 0
        for t in trackers:
            if t.ready:
                ready += 1
        return ready >= len(uids) // 2 + 1
        
    def is_user_ready(self, user):
        return self.get_tracker(user).ready
        
    def user_is_ready(self, user):
        self.get_tracker(user).ready = True
        db.session.flush()
        
    def user_not_ready(self, user):
        self.get_tracker(user).ready = False
        db.session.flush()
        
    def choose_word(self):
        wl = self.word_list.split("\n")
        sr = SystemRandom()
        self.current_word = sr.choice(wl)
        db.session.flush()
        return self.current_word
        
    def choose_player(self):
        user_ids = set([u.id for u in self.room.get_active_users()])
        eligible_users = list(set([p.user for p in PictionaryUserTracker.query.filter(PictionaryUserTracker.user_id.in_(user_ids)).filter_by(pictionary_manager_id=self.id,drawn_this_round=False).all()]))
        if eligible_users:
            sr = SystemRandom()
            return sr.choice(eligible_users)
        return None
        
    def award_points(self, user):
        previous_guesses = PictionaryUserTracker.query.filter_by(guessed_this_round=True,pictionary_manager_id=self.id).count()
        previous_guesses = min(previous_guesses, 5)
        user_tracker = self.get_tracker(user)
        points_awarded = [50, 40, 30, 20, 10, 5][previous_guesses]
        user_tracker.score += points_awarded
        self.get_tracker(self.currently_drawing()).score += points_awarded // 2
        user_tracker.guessed_this_round = True
        db.session.flush()
        return points_awarded
        
    def destroy(self):
        PictionaryUserTracker.query.filter_by(pictionary_manager_id=self.id).delete()
        db.session.delete(self)
        
    def blanked_word(self):
        blanked = ""
        if self.current_word:
            for c in self.current_word.strip():
                if c == ' ':
                    blanked += " "
                elif c == '-':
                    blanked += " - "
                else:
                    blanked += "_ "
        return blanked
        
class PictionaryUserTracker(db.Model):

    id = db.Column(db.Integer(), primary_key=True)      
    user_id = db.Column(db.Integer(), db.ForeignKey('user.id'))
    drawn_this_round = db.Column(db.Boolean())
    score =  db.Column(db.Integer())
    drawing = db.Column(db.Boolean())
    pictionary_manager_id = db.Column(db.Integer(), db.ForeignKey('pictionary_manager.id'))
    ready = db.Column(db.Boolean())
    guessed_this_round = db.Column(db.Boolean())
    
    def __init__(self, user_id, pictionary_manager_id):
        self.user_id = user_id
        self.pictionary_manager_id = pictionary_manager_id
        self.score = 0
        self.drawing = False
        self.drawn_this_round = False
        
    
class Socket(db.Model):
    id = db.Column(db.Integer(), primary_key=True)
    sid = db.Column(db.String(32), unique=True)
    user_id = db.Column(db.Integer(), db.ForeignKey('user.id'))
    room_id = db.Column(db.Integer(), db.ForeignKey('room.id'))
    last_active_time = db.Column(db.DateTime)
    
    def __init__(self, sid, user_id, room_id):
        self.sid = sid
        self.user_id = user_id
        self.room_id = room_id
        self.last_active_time = datetime.utcnow()
    
    def destroy(self):
        db.session.delete(self)
        db.session.flush()
        
    def push_input(self, data):
        inp = UserInput(self.user.id, self.room.id, json.dumps(data))
        db.session.add(inp)
        db.session.flush()
    
    def record_activity(self):
        self.room.record_activity()
        self.last_active_time = datetime.utcnow()
        db.session.flush()
     
class UserInput(db.Model):
    id = db.Column(db.Integer(), primary_key=True)
    user_id = db.Column(db.Integer(), db.ForeignKey('user.id'))
    room_id = db.Column(db.Integer(), db.ForeignKey('room.id'))
    data = db.Column(db.String())
    
    def __init__(self, user_id, room_id, data):
        self.user_id = user_id
        self.room_id = room_id
        self.data = data
    
    
def generate_random_string(length):

    # length: int
    # return: str
    
    """Generates cryptographically random base-64 string.
    """
    number_generator = SystemRandom()
    chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-"
    id = ""
    for i in range(length):
        id += chars[ number_generator.randrange(len(chars)) ]
    return id
    

    
if __name__ == '__main__':
    manager.run()
