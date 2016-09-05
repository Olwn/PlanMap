import './index.html';
import './index.css';
import ReactDOM from 'react-dom';
import React from 'react';
import {Icon, Upload, message, InputNumber, Input, Row, Col, Tag, Select, Button, Progress} from 'antd';
const InputGroup = Input.Group;
const Option = Select.Option;
import Split from 'split.js';

window.map = new BMap.Map("map");
window.map.centerAndZoom(new BMap.Point(121.492, 31.245), 14);

Split(['#map', '#table'], {
    sizes: [50, 50],
    gutterSize: 8,
    cursor: 'col-resize',
    minSize: 400
});

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
    window.map.addEventListener("click", this.addPoint);
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
      points: fields,
      max_idx: max_idx,
      data_for_upload: {}
    };
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
  addPoint(e){
    const new_idx = this.state.max_idx + 1;
    this.state.points[String(new_idx)] = {
      idx: new_idx,
      lat: e.point.lat,
      lng: e.point.lng,
      ra: 1,
      rb: 1,
      rc: 1,
      show: true
    };
    this.setState({
      max_idx: new_idx,
      points: this.state.points
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
    for(var key in this.state.points){
      const p = this.state.points[key];
      this.state.data_for_upload[key] = {
        'idx': p.idx,
        'name': p.name,
        'lat': p.lat,
        'lng': p.lng,
        'ra': p.ra,
        'rb': p.rb,
        'rc': p.rc
      }
    }
    this.forceUpdate();
  },
  onClick() {
    this.prepareData();
    $.post('/save',
    {'name': this.state.name, 'points': JSON.stringify(this.state.data_for_upload)},
    function(data, status){
      console.log(status);
    }
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
    return (
      <div>
        <div className="pointList">{pointNodes}</div>
        <div>
          <Input onChange={this.configNameChange}/>
          <Button type="primary" onClick={this.onClick}>Save</Button>
          <Upload data={{"points": JSON.stringify(this.state.data_for_upload)}} {...upload_props}>
            <Button id="import" type="ghost" onClick={this.prepareData}>
              <Icon type="upload" />导入
            </Button>
        </Upload>
        </div>
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

const ConfigSelect = React.createClass({
  getInitialState: function() {
    return {
      configs: []
    }
  },
  componentWillMount: function() {
    this.serverRequest = $.get('/configs', function (result){
      this.setState({
        configs: result['configs']
      });
    }.bind(this));
  },
  render: function() {
    return (
      <div>
        <Select style={{width: 100}} onChange={renderPoints}>
          {
            this.state.configs.map(function(config){
              return <Option value={String(config.id)} key={config.id}>{config.name}</Option>
            })
          }
        </Select>
      </div>
    );
  }
});

function renderPoints(cid) {
  $.get('/points?cid='+cid, function(result) {
    var pointss = result.points.sort(function(a, b) {
      return a.idx - b.idx;
    });
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

ReactDOM.render(
  (<div>
    <Tag style={{width: '40px'}}>ID</Tag>
    <Tag style={{width: '70px'}}>Name</Tag>
    <Tag style={{width: '70px'}}>Lat</Tag>
    <Tag style={{width: '70px'}}>Lng</Tag>
    <Tag style={{width: '50px'}}>Ra</Tag>
    <Tag style={{width: '50px'}}>Rb</Tag>
    <Tag style={{width: '50px'}}>Rc</Tag>
  </div>), document.getElementById("title")
  );
ReactDOM.render(<PointList data={[]} />, document.getElementById('points'));
ReactDOM.render(<ConfigSelect />, document.getElementById('select'));
