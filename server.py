#coding=utf-8
from __future__ import division
import flask
from flask import Flask
from flask import request, render_template, send_from_directory, redirect, url_for
from flask_sqlalchemy import SQLAlchemy
from flask_sse import sse
import flask.ext.login as flask_login
from flask_cors import CORS, cross_origin
import hashlib
import json
import requests
from openpyxl import Workbook, load_workbook

app = Flask(__name__)
CORS(app)
app.config["REDIS_URL"] = "redis://localhost:6379"
app.register_blueprint(sse, url_prefix='/stream')
app.config['SECRET_KEY'] = "123456789"
# database config
host = 'ec2-54-199-158-232.ap-northeast-1.compute.amazonaws.com'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = True
app.config['SQLALCHEMY_DATABASE_URI'] = 'mysql://root:27271992@'+host+':3306/map'
db = SQLAlchemy(app)
md5 = hashlib.md5()

# login management
login_manager = flask_login.LoginManager()
login_manager.init_app(app)

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(20), unique=True)
    password = db.Column(db.String(32))
    configs = db.relationship('Config', backref='user')

    def __init__(self, username, psd):
        self.name = username
        md5.update(psd)
        self.password = md5.hexdigest()

    def __repr__(self):
        return '<User %r %r>' % (self.name, self.id)

class Config(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50))
    uid = db.Column(db.Integer, db.ForeignKey('user.id'))
    points = db.relationship('Point', backref='config')
    def __init__(self, config_name, uid):
        self.name = config_name
        self.uid = uid

    def __repr__(self):
        return '<User %r Config %r>' % (self.uid, self.name)

class Point(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    cid = db.Column(db.Integer, db.ForeignKey('config.id'))
    lat = db.Column(db.Float)
    lng = db.Column(db.Float)
    ra = db.Column(db.Float)
    rb = db.Column(db.Float)
    rc = db.Column(db.Float)
    idx = db.Column(db.Integer)
    name = db.Column(db.String(50))

    def __init__(self, config_id, lat, lng, ra, rb, rc, idx, name):
        self.cid = config_id
        self.lat = lat
        self.lng = lng
        self.ra = ra
        self.rb = rb
        self.rc = rc
        self.idx = idx
        self.name = name

    def __repr__(self):
        return '<Point lat: %r lng: %r>' % (self.lat, self.lng)

class UserForAuth(flask_login.UserMixin):

    def get_id(self):
        user = User.query.filter_by(id=self.id).first()
        if user is None:
            return None
        else:
            return user.id

@login_manager.user_loader
def load_user(user_id):
    user = User.query.filter_by(id=user_id).first()
    user_auth = UserForAuth()
    user_auth.username = user.name
    user_auth.id = user.id
    return user_auth

def authenticate(name, password):
    user = User.query.filter_by(name=name).first()
    if user is None:
        return False
    else:
        md5.update(password)
        print password
        print md5.hexdigest(), user.password
        is_auth = md5.hexdigest() == user.password
        is_auth = True
        if is_auth:
            user_auth = UserForAuth()
            user_auth.username = name
            user_auth.id = user.id
            flask_login.login_user(user_auth, force=True)
            return True
        return False

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'GET':
        return render_template('login.html')

    name = request.form['userName']
    password = request.form['password']
    is_auth = authenticate(name, password)
    if not is_auth:
        return flask.jsonify({'status': 2})
    else:
        return flask.jsonify({'status': 1})

@app.route('/index', methods=['GET'])
@flask_login.login_required
def index():
    print flask_login.current_user.username
    return render_template('index.html')

# use requests to use baidu api
def baidu_route(origin, destination, mode):
    pass

def baidu_direction(origin, destination, mode):
    params={
        'origin': origin,
        'destination': destination,
        'mode': mode,
        'origin_region': '上海',
        'destination_region': '上海',
        'region': '上海',
        'output': 'json',
        'ak': 'E8k0hkMHteAkrUj9ZXkAARzh'
    }
    baidu_url = 'http://api.map.baidu.com/direction/v1'
    ret = requests.get(url=baidu_url, params = params)
    response = json.loads(ret.text)

    if response['status'] != 0 or not response['result'].has_key('routes'):
        return -1
    if mode == 'driving':
        return response['result']['routes'][0]['duration'] / 60
    else:
        return response['result']['routes'][0]['scheme'][0]['duration'] / 60

# compute the score of point
def compute(points, basic):
    start_p = str(basic['lat'])+','+str(basic['lng'])
    total = 0
    total_c = 0
    batch_size = 50
    times_drive = []
    times_bus = []
    for key, p in points:
        end_p = str(p['lat']) + ',' + str(p['lng'])
        t_drive = baidu_direction(start_p, end_p, 'driving')
        t_bus = baidu_direction(start_p, end_p, 'transit')
        times_drive.append(t_drive)
        times_bus.append(t_bus)
        # print 'driver time: %d, bus time: %d ' % (t_drive, t_bus)
        if t_drive == -1 or t_bus == -1:
            continue
        t = (t_bus*p['ra'] + t_drive*p['rb']) / (p['ra'] + p['rb'])
        total += t * p['rc']
        total_c += p['rc']
    if total_c == 0:
        total = 0
    else:
        total = total / total_c

    return total, times_drive, times_bus

@app.route('/export', methods=['POST'])
@flask_login.login_required
def export():
    #return flask.send_from_directory('files', 'result.xls'), 200
    data = json.loads(request.form['data'])
    points = json.loads(data['points'])
    basic = data['basic']
    # compute the total score
    total = 0
    total_c = 0
    for p in points:
        t = (p['busTime']*p['Ra'] + p['carTime']*p['Rb']) / (p['Ra'] + p['Rb'])
        total += t * p['Rc']
        total_c += p['Rc']
    total = total / total_c
    # prepare a excel file
    wb = Workbook()
    ws = wb.active
    ws.title = 'result'
    ws.append(('No.', 'Lat', 'Lng', 'BusTime(m)', 'CarTime(m)', 'Ra', 'Rb', 'Rc'))
    for p in points:
        ws.append((p['key'], p['lat'], p['lng'], p['busTime'], \
        p['carTime'], p['Ra'], p['Rb'], p['Rc']))
    ws.append(())
    ws.append(('basic', basic['lat'], basic['lng'], 'total->', total))
    wb.save(filename="files/result.xlsx")
    return flask.send_from_directory('files', 'result.xlsx'), 200

@app.route('/batch', methods=['POST'])
@flask_login.login_required
def batch():
    if 'file' not in request.files:
        flash('No file part')
        return 'no file'
    file_prefix = flask_login.current_user.username
    # file_prefix = '1'
    points = json.loads(request.form['points'])
    points = points.items()
    points.sort()
    file = request.files['file']
    name_save = file_prefix+'_'+file.filename
    file.save('./files/'+ name_save)
    wb = load_workbook('./files/'+ name_save)
    st = wb.active
    wb_result = Workbook()
    ws = wb_result.active
    ws.title = 'result'

    ws.append(('Id', 'Name', 'Lat', 'Lng', 'Ra', 'Rb', 'Rc'))
    for key, p in points:
        ws.append((p['idx'], p['name'], p['lat'], p['lng'], p['ra'], \
                  p['rb'], p['rc']))
    ws.append(())
    ids = [x[0] for x in points]
    ws.append(('lat', 'lng', 'score')+tuple([str(id)+'_drive' for id in ids])
              +tuple([str(id)+'_bus' for id in ids]))
    for idx, r in enumerate(st.rows[1:]):
        basic = {'lat': r[0].value, 'lng': r[1].value}
        score, t_drive, t_bus = compute(points, basic)
        ws.append((basic['lat'], basic['lng'], score)+tuple(t_drive)+tuple(t_bus))
        sse.publish({"progress": (idx+1)/len(st.rows[1:])*100}, type="report")
    wb_result.save(filename='./files/'+file_prefix + '_result.xlsx')
    return flask.jsonify({'file': file_prefix + '_result.xlsx'}), 200

@app.route('/save', methods=['POST'])
@flask_login.login_required
def save_refer():
    refer_name = request.form['name']
    points = json.loads(request.form['points'])
    userid = flask_login.current_user.id
    # userid = 1;
    print refer_name, userid
    config = Config(refer_name, userid)
    db.session.add(config)
    db.session.commit()
    for i, key in enumerate(points):
        p = points[key]
        point = Point(config.id, p['lat'], p['lng'],
            p['ra'], p['rb'], p['rc'], i, p['name'])
        db.session.add(point)
    db.session.commit()
    return 'success', 200

@app.route('/configs', methods=['GET', 'POST'])
@flask_login.login_required
def get_config():
    userid = flask_login.current_user.id
    configs = Config.query.filter_by(uid=userid).all()
    ret = []
    for config in configs:
        ret.append({'id': config.id, 'name': config.name})
    return flask.jsonify({'status': 1, 'configs': ret})

@app.route('/points', methods=['GET'])
# @flask_login.login_required
def get_point():
    cid = request.args['cid']
    points = Point.query.filter_by(cid=cid).all()
    print points
    ret = []
    for p in points:
        ret.append({
            'lat': p.lat,
            'lng': p.lng,
            'ra': p.ra,
            'rb': p.rb,
            'rc': p.rc,
            'idx': p.idx,
            'name': p.name
        })
    return flask.jsonify({'points': ret})


@app.route('/download', methods=['GET'])
@flask_login.login_required
def download():
    if request.args.has_key('file'):
        return flask.send_from_directory('files', request.args['file']), 200
    else:
        return 'no file specifid', 400

@app.route('/protected')
@flask_login.login_required
def protected():
    return 'Logged in as: ' + flask_login.current_user.username
