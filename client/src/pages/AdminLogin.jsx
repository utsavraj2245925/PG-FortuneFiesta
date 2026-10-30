import React, { useState } from 'react';
import { Form, Input, Button, message, Card } from 'antd';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const LOGO = 'https://cms-complaint-avidence.s3.eu-north-1.amazonaws.com/pg-logo-Photoroom.png';

export default function AdminLogin() {
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();
  const navigate = useNavigate();

  const onFinish = async ({ username, password }) => {
    setLoading(true);
    try {
      const { data } = await axios.post('/api/auth/login', { username, password });
      localStorage.setItem('pg_admin_token', data.token);
      message.success('Login successful!');
      navigate('/admin');
    } catch (e) {
      if (e.response && e.response.data?.message) {
        message.error(e.response.data.message);
      } else {
        message.error('Connecting to backend server (waking up free instance)... Please wait 10 seconds and try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-orange-50 to-yellow-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-4xl mb-2">🪔</div>
          <img src={LOGO} alt="PG" className="h-14 mx-auto mb-3 object-contain" />
          <h1 className="text-2xl font-bold text-gray-800">Admin Panel</h1>
          <p className="text-gray-500 text-sm mt-1">PG Grand Diwali Lucky Draw 2026</p>
        </div>
        <Card className="shadow-2xl rounded-2xl border-0">
          <Form
            form={form}
            layout="vertical"
            onFinish={onFinish}
          >
            <Form.Item
              name="username"
              label="Username"
              rules={[{ required: true, message: 'Please enter username' }]}
            >
              <Input size="large" placeholder="Enter username" autoFocus />
            </Form.Item>
            <Form.Item
              name="password"
              label="Password"
              rules={[{ required: true, message: 'Please enter password' }]}
            >
              <Input.Password size="large" placeholder="Enter password" />
            </Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              block
              size="large"
              loading={loading}
              style={{ backgroundColor: '#C8102E', borderColor: '#C8102E', height: 46, fontSize: 16 }}
            >
              Login
            </Button>
          </Form>
        </Card>
      </div>
    </div>
  );
}
