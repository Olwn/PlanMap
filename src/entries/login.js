import './antd.css';
import './index.css';
import './login.html';
import React from 'react';
import ReactDOM from 'react-dom';
import { Form, Input, Button, Checkbox } from 'antd';
import { Alert, notification} from 'antd';
const FormItem = Form.Item;
import Split from 'split.js';

window.map = new BMap.Map("map");
window.map.centerAndZoom(new BMap.Point(121.492, 31.245), 14);

Split(['#map', '#table'], {
    sizes: [50, 50],
    gutterSize: 8,
    cursor: 'col-resize',
    minSize: 400
});

const openNotification = function (status) {
  var message = (status==1)?"登录成功":"登录失败";
  var description =(status==1)?"跳转中":"请重新输入";
  notification.open({
    message: message,
    description: description
  });
};
const host = "http://127.0.0.1:5000"
let Demo = React.createClass({
  handleSubmit(e) {
    e.preventDefault();
    console.log('收到表单值：', this.props.form.getFieldsValue());
    //$(document).load('/login', JSON.stringify(this.props.form.getFieldsValue()));
    $.post(host+'/login', this.props.form.getFieldsValue(),
      function(data, status){
        openNotification(data['status']);
        if(data['status'] == 1)
          window.location.href = "index";
      }
    );
  },
  render() {
    const { getFieldProps } = this.props.form;
    return (
      <Form inline onSubmit={this.handleSubmit}>
        <FormItem
          label="账户"
        >
          <Input placeholder="请输入账户名"
            {...getFieldProps('userName')}
          />
        </FormItem>
        <FormItem
          label="密码"
        >
          <Input type="password" placeholder="请输入密码"
            {...getFieldProps('password')}
          />
        </FormItem>
        <FormItem>
          <Checkbox {...getFieldProps('agreement')}>记住我</Checkbox>
        </FormItem>
        <br/>
        <Button type="primary" htmlType="submit"
          style={{'margin-left': '172px', 'margin-top': '20px'}}>
          登录
        </Button>
      </Form>
    );
  },
});

Demo = Form.create()(Demo);

ReactDOM.render(<Demo />, document.getElementById('table'));
