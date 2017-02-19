import './index.html';
import './index.css';
import ReactDOM from 'react-dom';
import React from 'react';
import {Icon, Upload, message, InputNumber, Input, Row, Col, Tag, Select, Button, Progress} from 'antd';
const InputGroup = Input.Group;
const Option = Select.Option;
import Split from 'split.js';
Split(['#map', '#table'], {
    sizes: [60, 40],
    gutterSize: 8,
    cursor: 'col-resize',
    minSize: 400
});

window.map = new BMap.Map("map");
window.map.centerAndZoom(new BMap.Point(121.492, 31.245), 14);
window.map.enableScrollWheelZoom();
window.map.enableInertialDragging();
window.map.enableContinuousZoom();

var top_right_navigation = new BMap.NavigationControl({
    anchor: BMAP_ANCHOR_TOP_RIGHT,
    type: BMAP_NAVIGATION_CONTROL_SMALL});
var cityListControl = new BMap.CityListControl({
    anchor: BMAP_ANCHOR_TOP_LEFT,
    offset: new BMap.Size(10, 20)});
window.map.addControl(top_right_navigation);
window.map.addControl(cityListControl);
window.cid = -1;
map.basic_marker = null;


var upload_props = {
    name: 'file',
    action: '/batch',
    headers: {
      authorization: 'authorization-text',
    },
    onChange(info) {
      if (info.file.status !== 'uploading') {
        console.log(info.file, info.fileList);
      }
      if (info.file.status === 'done') {
        message.success(`${info.file.name} 上传成功。`);
        console.log(info.file.response.file);
        window.location.href = 'download?file='+info.file.response.file
      } else if (info.file.status === 'error') {
        message.error(`${info.file.name} 上传失败。`);
      }
    },
  };

var PointList = React.createClass({
  getInitialState() {
    window.map.addEventListener("click", this.addReferPoint);
    console.log("init");
    var max_idx = -1;
    var fields = {};
    this.props.data.map(function(x) {
      if (max_idx < x.idx) {
        max_idx = x.idx;
      }
      x.show = true;
      if (x.name == null){
        x.name = '';
      }
      fields[String(x.idx)] = x;
    });
    return {
      mode: "1",
      points: fields,
      basic: null,
      max_idx: max_idx,
      data_for_upload: {},
      config_id: -1,
      configs: []
    };
  },
  componentDidMount() {
    this.getNewConfig();
    console.log("componentDidMount");
  },
  getNewConfig() {
    $.get('/configs', function (result) {
      this.setState({
        configs: result['configs']
      });
    }.bind(this));
  },
  changeClickListener(m) {
    switch(this.state.mode)
    {
      case "1":
        window.map.removeEventListener("click", this.addReferPoint);
        break;
      case "2":
        window.map.removeEventListener("click", this.addBasicPoint);
      default:
        break;
    }
    switch(m)
    {
      case "1":
        window.map.addEventListener("click", this.addReferPoint);
        break;
      case "2":
        window.map.addEventListener("click", this.addBasicPoint);
        break;
      default:
        break;
    }
    this.setState({
      mode: m
    });
  },
  componentWillReceiveProps(nextProps) {
    var max_idx = -1;
    var fields = {};
    nextProps.data.map(function(x) {
      if (max_idx < x.idx) {
        max_idx = x.idx;
      }
      x.show = true;
      fields[String(x.idx)] = x;
    });
    this.setState({
      points: fields,
      max_idx: max_idx,
      name: null
    });
    console.log("componentWillReceiveProps");
  },
  addReferPoint(e){
    const new_idx = this.state.max_idx + 1;
    this.state.points[String(new_idx)] = {
      idx: new_idx,
      lat: e.point.lat,
      lng: e.point.lng,
      ra: 1,
      rb: 1,
      rc: 1,
      name: '',
      show: true
    };
    this.setState({
      max_idx: new_idx,
      points: this.state.points
    });
  },
  addBasicPoint(e){
    if (map.basic_marker)
    {
      map.removeOverlay(map.basic_marker);
    }
    var bd_point = new BMap.Point(e.point.lng, e.point.lat);
  	var marker = new BMap.Marker(bd_point);
    var label = new BMap.Label("基点", {offset: new BMap.Size(20,-10)});
  	window.map.addOverlay(marker);
    marker.setLabel(label);
    map.basic_marker = marker;
    this.setState({
      basic: e.point
    });
  },
  onChangeValue(id, propertyName, value) {
    this.state.points[id][propertyName] = value;
    this.setState({
      points: this.state.points
    });
  },
  removeMarker(e, ee, marker){
    marker.hide();
    this.state.points[marker.idx].show = false;
    this.setState({ points: this.state.points });
  },
  configNameChange(e) {
    this.setState({
      name: e.target.value
    });
  },
  prepareData() {
    var new_upload = {};
    for(var key in this.state.points){
      const p = this.state.points[key];
      if (p.show == false){
        continue;
      }
      new_upload[key] = {
        'idx': p.idx,
        'name': p.name,
        'lat': p.lat,
        'lng': p.lng,
        'ra': p.ra,
        'rb': p.rb,
        'rc': p.rc
      }
    }
    this.state.data_for_upload = new_upload;
    this.forceUpdate();
  },

  onClickSave() {
    this.prepareData();
    $.post('/save',
    {'name': this.state.name, 'points': JSON.stringify(this.state.data_for_upload)},
    function(data, status){
      console.log(status);
      this.getNewConfig();
    }.bind(this)
  );
  },
  onClickDelete() {
    $.get('/delete',
      {'config_id': window.cid},
        function(data, status){
          this.getNewConfig();
          ReactDOM.render(<PointList data={[]} />, document.getElementById('points'));
        }.bind(this)
      );

  },
  render: function() {
    var keys = [];
    var pointNodes = [];
    for (var key in this.state.points) {
      if (this.state.points.hasOwnProperty(key)) {
        //keys.push(key);
        var point = this.state.points[key];
        if (!point.show) continue;
        var marker;
        if (point.marker == null){
          marker = addMarker(point);
          marker.idx = point.idx;
          var markerMenu=new BMap.ContextMenu();
        	markerMenu.addItem(new BMap.MenuItem('删除', this.removeMarker));
          marker.addContextMenu(markerMenu);
          point.marker = marker;
        }
        pointNodes.push(
          <Point val={point} changeFunc={this.onChangeValue} key={point.idx} marker={marker}/>
        );
      }
    }
    var width_style = {width: 60};
    return (
      <div>
        <div>
          <Select defaultValue="1" style={{ width: 60 }} onChange={this.changeClickListener}>
            <Option value="1">参考点</Option>
            <Option value="2">基点</Option>
            <Option value="3">禁用</Option>
          </Select>
          <Select style={width_style} onChange={renderPoints}>
            {
              this.state.configs.map(function(config){
                return <Option value={String(config.id)} key={config.id}>{config.name}</Option>
              })
            }
          </Select>

          <Upload style={width_style} data={{"points": JSON.stringify(this.state.data_for_upload)}} {...upload_props}>
            <Button id="import" type="ghost" onClick={this.prepareData}>
              <Icon type="upload" />导入
            </Button>
          </Upload>
        </div>
        <div>
          <Tag style={{width: '40px'}}>ID</Tag>
          <Tag style={{width: '70px'}}>Name</Tag>
          <Tag style={{width: '70px'}}>Lat</Tag>
          <Tag style={{width: '70px'}}>Lng</Tag>
          <Tag style={{width: '50px'}}>Ra</Tag>
          <Tag style={{width: '50px'}}>Rb</Tag>
          <Tag style={{width: '50px'}}>Rc</Tag>
        </div>
        <div className="pointList">{pointNodes}</div>
        <Input style={width_style} onChange={this.configNameChange}/>
        <Button style={width_style} type="primary" onClick={this.onClickSave}>Save</Button>
        <Button style={width_style} type="primary" onClick={this.onClickDelete}>Delete</Button>
      </div>
    );
  }
});

var Point = React.createClass({
  onChangeName(e) {
    this.props.changeFunc(this.props.val.idx, 'name', e.target.value);
  },
  onChangeLat(e) {
    this.props.changeFunc(this.props.val.idx, 'lat', e.target.value);
  },
  onChangeLng(e) {
    this.props.changeFunc(this.props.val.idx, 'lng', e.target.value);
  },
  onChangeRa(value) {
    this.props.changeFunc(this.props.val.idx, 'ra', value);
  },
  onChangeRb(value) {
    this.props.changeFunc(this.props.val.idx, 'rb', value);
  },
  onChangeRc(value) {
    this.props.changeFunc(this.props.val.idx, 'rc', value);
  },
  onSubmit() {
    console.log(this.State);
  },
  render() {
    return (
      <div>
        <Tag>{this.props.val.idx}</Tag>
        <Input value={this.props.val.name} onChange={this.onChangeName} />
        <Input value={this.props.val.lat} onChange={this.onChangeLat} />
        <Input value={this.props.val.lng} onChange={this.onChangeLng} />
        <InputNumber value={this.props.val.ra} onChange={this.onChangeRa} />
        <InputNumber value={this.props.val.rb} onChange={this.onChangeRb} />
        <InputNumber value={this.props.val.rc} onChange={this.onChangeRc} />
      </div>
    );
  }
});

function renderConfigSelect() {
  $.get('/configs', function (result){
      var ConfigSelect = React.createClass({
        render() {
          return(
            <div>
              <Select style={{width: 100}} onChange={renderPoints}>
                {
                  result['configs'].map(function(config){
                    return <Option value={String(config.id)} key={config.id}>{config.name}</Option>
                  })
                }
              </Select>
            </div>
          );
        }
      });
      ReactDOM.render(<ConfigSelect />, document.getElementById('select'));

  });
}
function renderPoints(cid) {
  window.cid = cid;
  $.get('/points?cid='+cid, function(result) {
    var pointss = result.points.sort(function(a, b) {
      return a.idx - b.idx;
    });
    window.map.clearOverlays();
    console.log('rendering poitns');
    ReactDOM.render(<PointList data={pointss} />, document.getElementById('points'));
  });
}

function removeMarker(e,ee,marker){
  window.map.removeOverlay(marker);
};

function addMarker(point){
  var bd_point = new BMap.Point(point.lng, point.lat);
	var marker = new BMap.Marker(bd_point);
  var label = new BMap.Label(point.idx, {offset: new BMap.Size(20,-10)});

	window.map.addOverlay(marker);
  marker.setLabel(label);
  return marker;
}

var source = new EventSource("/stream");
source.addEventListener('report', function(event) {
    var data = JSON.parse(event.data);
    console.log(data.progress);
    ReactDOM.render(<Progress percent={data.progress} />, document.getElementById("progress"));
}, false);

ReactDOM.render(<PointList data={[]}/>, document.getElementById('points'));
//renderConfigSelect();
