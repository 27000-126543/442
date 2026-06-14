import { useState, useEffect } from 'react';
import { Layout, Menu, Avatar, Dropdown, Badge, Button, Modal, Form, Input, message, Typography } from 'antd';
import {
  DashboardOutlined,
  RocketOutlined,
  DollarOutlined,
  EyeOutlined,
  BulbOutlined,
  CheckCircleOutlined,
  TrophyOutlined,
  BuildOutlined,
  FileTextOutlined,
  BellOutlined,
  TeamOutlined,
  LogoutOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAppStore } from '../store';
import { authApi, eventApi } from '../api';

const { Header, Sider, Content } = Layout;
const { Title } = Typography;

const menuItems = [
  { key: '/', icon: <DashboardOutlined />, label: '控制中心' },
  { key: '/transport', icon: <RocketOutlined />, label: '运输部' },
  { key: '/finance', icon: <DollarOutlined />, label: '金融部' },
  { key: '/intelligence', icon: <EyeOutlined />, label: '情报部' },
  { key: '/culture', icon: <BulbOutlined />, label: '文化部' },
  { key: '/approvals', icon: <CheckCircleOutlined />, label: '审批中心' },
  { key: '/events', icon: <BellOutlined />, label: '事件通知' },
  { key: '/members', icon: <TeamOutlined />, label: '成员管理' },
  { key: '/towers', icon: <BuildOutlined />, label: '多维商业塔' },
  { key: '/reports', icon: <FileTextOutlined />, label: '产业报告' },
  { key: '/leaderboard', icon: <TrophyOutlined />, label: '全服排行榜' },
];

export default function MainLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAppStore(s => s.user);
  const company = useAppStore(s => s.company);
  const unreadCount = useAppStore(s => s.unreadCount);
  const setUser = useAppStore(s => s.setUser);
  const setToken = useAppStore(s => s.setToken);
  const setCompany = useAppStore(s => s.setCompany);
  const setDepartments = useAppStore(s => s.setDepartments);
  const setUnreadCount = useAppStore(s => s.setUnreadCount);
  const logout = useAppStore(s => s.logout);

  const [collapsed, setCollapsed] = useState(false);
  const [createModal, setCreateModal] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user?.company_id) {
      loadCompanyData();
    }
  }, [user?.company_id]);

  useEffect(() => {
    if (user?.company_id) {
      eventApi.getUnreadCount().then(r => setUnreadCount(r.count)).catch(() => {});
    }
  }, [user?.company_id, setUnreadCount]);

  const loadCompanyData = async () => {
    try {
      const data = await authApi.getMyCompany();
      setCompany(data.company);
      setDepartments(data.departments);
    } catch (e) {
      console.error('加载商会数据失败', e);
    }
  };

  const handleCreateCompany = async (values: any) => {
    setLoading(true);
    try {
      const comp = await authApi.createCompany(values.name);
      setCompany(comp);
      const updated = { ...user!, company_id: comp.id, role: 'president' as const };
      setUser(updated);
      localStorage.setItem('user', JSON.stringify(updated));
      message.success('商会创建成功！');
      setCreateModal(false);
      loadCompanyData();
    } catch (e: any) {
      message.error(e.response?.data?.error || '创建失败');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (user && !user.company_id) {
    return (
      <div className="cosmic-bg" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
        <div style={{ textAlign: 'center' }}>
          <Title level={2} className="glow-text" style={{ color: '#fff', marginBottom: 20 }}>
            🌌 你还没有加入任何商会
          </Title>
          <p style={{ color: 'rgba(255,255,255,0.7)', marginBottom: 30, fontSize: 16 }}>
            创建属于你的跨维度商业帝国，开启传奇之旅
          </p>
          <Button type="primary" size="large" icon={<PlusOutlined />} onClick={() => setCreateModal(true)}>
            创建商会
          </Button>

          <Modal
            title="创建商会"
            open={createModal}
            onCancel={() => setCreateModal(false)}
            footer={null}
          >
            <Form onFinish={handleCreateCompany} layout="vertical">
              <Form.Item name="name" label="商会名称" rules={[{ required: true, message: '请输入商会名称' }]}>
                <Input placeholder="为你的商业帝国起个响亮的名字" />
              </Form.Item>
              <Form.Item>
                <Button type="primary" htmlType="submit" loading={loading} block>
                  创建
                </Button>
              </Form.Item>
            </Form>
          </Modal>
        </div>
      </div>
    );
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        theme="dark"
        width={220}
        style={{
          background: 'linear-gradient(180deg, #0a0a20 0%, #151535 100%)',
          borderRight: '1px solid rgba(114, 46, 209, 0.2)',
        }}
      >
        <div style={{ padding: 20, textAlign: 'center', borderBottom: '1px solid rgba(114, 46, 209, 0.2)' }}>
          {!collapsed ? (
            <Title level={4} className="glow-text" style={{ color: '#fff', margin: 0 }}>🌌 商业帝国</Title>
          ) : (
            <span style={{ fontSize: 24 }}>🌌</span>
          )}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          onClick={({ key }) => navigate(key)}
          items={menuItems}
          style={{ border: 'none', background: 'transparent', marginTop: 10 }}
        />
      </Sider>

      <Layout>
        <Header
          style={{
            background: 'rgba(10, 10, 32, 0.8)',
            borderBottom: '1px solid rgba(114, 46, 209, 0.2)',
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backdropFilter: 'blur(10px)',
          }}
        >
          <div>
            {company && (
              <span style={{ color: '#fff', fontSize: 18, fontWeight: 'bold' }}>
                🏢 {company.name}
                <span style={{ marginLeft: 12, fontSize: 14, color: '#faad14' }}>Lv.{company.level}</span>
                <span style={{ marginLeft: 12, fontSize: 14, color: '#52c41a' }}>💰 {company.total_assets?.toLocaleString()}</span>
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Badge count={unreadCount} overflowCount={99}>
              <Button
                type="text"
                icon={<BellOutlined style={{ fontSize: 20, color: '#fff' }} />}
                onClick={() => navigate('/events')}
              />
            </Badge>

            <Dropdown
              menu={{
                items: [
                  { key: '1', label: `👤 ${user?.username}`, disabled: true },
                  { key: '2', label: `📋 角色: ${getRoleLabel(user?.role || 'member')}`, disabled: true },
                  { type: 'divider' as const },
                  { key: '3', label: '退出登录', icon: <LogoutOutlined />, onClick: handleLogout },
                ],
              }}
            >
              <Avatar style={{ background: 'linear-gradient(135deg, #722ed1, #13c2c2)', cursor: 'pointer' }}>
                {user?.username?.[0]?.toUpperCase()}
              </Avatar>
            </Dropdown>
          </div>
        </Header>

        <Content style={{ padding: 24, background: 'transparent' }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}

function getRoleLabel(role: string): string {
  const labels: Record<string, string> = {
    president: '🏛️ 会长',
    vice_president: '🏛️ 副会长',
    finance_officer: '💼 财务官',
    director: '📊 事业部主管',
    member: '👥 成员',
  };
  return labels[role] || role;
}
