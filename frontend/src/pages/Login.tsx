import { useState } from 'react';
import { Form, Input, Button, Card, Tabs, Typography, message, Space } from 'antd';
import { UserOutlined, LockOutlined, MailOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../api';
import { useAppStore } from '../store';

const { Title, Paragraph } = Typography;

export default function Login() {
  const [activeTab, setActiveTab] = useState('login');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const setUser = useAppStore(s => s.setUser);
  const setToken = useAppStore(s => s.setToken);

  const handleLogin = async (values: any) => {
    setLoading(true);
    try {
      const res = await authApi.login(values);
      setUser(res.user);
      setToken(res.token);
      message.success('登录成功！欢迎来到跨维度商业帝国');
      navigate('/');
    } catch (e: any) {
      message.error(e.response?.data?.error || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (values: any) => {
    setLoading(true);
    try {
      const res = await authApi.register(values);
      setUser(res.user);
      setToken(res.token);
      message.success('注册成功！开始你的商业帝国之旅吧');
      navigate('/');
    } catch (e: any) {
      message.error(e.response?.data?.error || '注册失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="cosmic-bg" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ maxWidth: 900, width: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40 }}>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <Title level={1} className="glow-text" style={{ color: '#fff', marginBottom: 20 }}>
            🌌 跨维度商业帝国
          </Title>
          <Paragraph style={{ color: 'rgba(255,255,255,0.7)', fontSize: 16, lineHeight: 1.8 }}>
            在平行宇宙交错的魔法世界中，创建并经营你的跨维度商业帝国。
            下设运输、金融、情报、文化四大事业部，与数万玩家实时交易与对抗。
          </Paragraph>
          <Space direction="vertical" size="large" style={{ marginTop: 20 }}>
            <div style={{ color: 'rgba(255,255,255,0.8)' }}>
              <strong>🚀 运输部</strong> — 传送门网络与星际商队
            </div>
            <div style={{ color: 'rgba(255,255,255,0.8)' }}>
              <strong>💰 金融部</strong> — 魔力银行与跨服交易所
            </div>
            <div style={{ color: 'rgba(255,255,255,0.8)' }}>
              <strong>🕵️ 情报部</strong> — 间谍潜入与策反行动
            </div>
            <div style={{ color: 'rgba(255,255,255,0.8)' }}>
              <strong>🎨 文化部</strong> — 跨宇宙艺术节与作品传播
            </div>
          </Space>
        </div>

        <Card
          style={{
            background: 'rgba(20, 20, 50, 0.8)',
            border: '1px solid rgba(114, 46, 209, 0.3)',
            borderRadius: 16,
            backdropFilter: 'blur(20px)',
          }}
          styles={{ body: { padding: 30 } }}
        >
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            centered
            items={[
              { key: 'login', label: '登录' },
              { key: 'register', label: '注册' },
            ]}
          />

          {activeTab === 'login' ? (
            <Form onFinish={handleLogin} layout="vertical" size="large">
              <Form.Item name="username" rules={[{ required: true, message: '请输入用户名' }]}>
                <Input prefix={<UserOutlined />} placeholder="用户名或邮箱" />
              </Form.Item>
              <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
                <Input.Password prefix={<LockOutlined />} placeholder="密码" />
              </Form.Item>
              <Form.Item>
                <Button type="primary" htmlType="submit" loading={loading} block style={{ height: 44 }}>
                  进入商业帝国
                </Button>
              </Form.Item>
            </Form>
          ) : (
            <Form onFinish={handleRegister} layout="vertical" size="large">
              <Form.Item name="username" rules={[{ required: true, message: '请输入用户名', min: 3 }]}>
                <Input prefix={<UserOutlined />} placeholder="用户名（至少3位）" />
              </Form.Item>
              <Form.Item name="email" rules={[{ required: true, message: '请输入邮箱', type: 'email' }]}>
                <Input prefix={<MailOutlined />} placeholder="邮箱" />
              </Form.Item>
              <Form.Item name="password" rules={[{ required: true, message: '请输入密码', min: 6 }]}>
                <Input.Password prefix={<LockOutlined />} placeholder="密码（至少6位）" />
              </Form.Item>
              <Form.Item>
                <Button type="primary" htmlType="submit" loading={loading} block style={{ height: 44 }}>
                  创建账号
                </Button>
              </Form.Item>
            </Form>
          )}

          <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 10 }}>
            测试账号: admin / admin123
          </div>
        </Card>
      </div>
    </div>
  );
}
