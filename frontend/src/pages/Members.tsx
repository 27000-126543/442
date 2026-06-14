import { useEffect, useState } from 'react';
import { Card, Table, Tag, Button, Select, Modal, Form, message, Typography, Space, Avatar } from 'antd';
import { UserOutlined, CrownOutlined, TeamOutlined } from '@ant-design/icons';
import { authApi } from '../api';
import type { User } from '../types';
import { useAppStore } from '../store';

const { Title, Paragraph } = Typography;
const { Option } = Select;

const roleMap: Record<string, { label: string; color: string; icon: string }> = {
  president: { label: '会长', color: 'gold', icon: '👑' },
  vice_president: { label: '副会长', color: 'orange', icon: '🥈' },
  finance_officer: { label: '财务官', color: 'green', icon: '💰' },
  director: { label: '事业部主管', color: 'blue', icon: '📊' },
  member: { label: '成员', color: 'default', icon: '👤' },
};

export default function Members() {
  const user = useAppStore(s => s.user);
  const company = useAppStore(s => s.company);
  const [members, setMembers] = useState<User[]>([]);
  const [editModal, setEditModal] = useState(false);
  const [selected, setSelected] = useState<User | null>(null);

  const isPresident = user?.role === 'president';
  const isHighLevel = ['president', 'vice_president'].includes(user?.role || '');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const data = await authApi.getMembers();
      setMembers(data);
    } catch (e) { console.error(e); }
  };

  const handleUpdateRole = async (values: any) => {
    if (!selected) return;
    try {
      await authApi.updateMemberRole(selected.id, values.role);
      message.success('角色已更新');
      setEditModal(false);
      setSelected(null);
      loadData();
    } catch (e: any) {
      message.error(e.response?.data?.error || '操作失败');
    }
  };

  const columns = [
    {
      title: '成员',
      key: 'user',
      render: (_: any, r: User) => (
        <Space>
          <Avatar style={{ background: 'linear-gradient(135deg, #722ed1, #13c2c2)' }} icon={<UserOutlined />} />
          <div>
            <div style={{ color: '#fff', fontWeight: 'bold' }}>{r.username}</div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>{r.email}</div>
          </div>
        </Space>
      ),
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      render: (r: string) => {
        const meta = roleMap[r] || roleMap.member;
        return <Tag color={meta.color}>{meta.icon} {meta.label}</Tag>;
      },
    },
    { title: '加入商会', dataIndex: 'created_at', key: 'join', render: (t: number) => new Date(t).toLocaleDateString() },
    { title: '最后登录', dataIndex: 'last_login', key: 'last', render: (t: number) => new Date(t).toLocaleDateString() },
    ...(isHighLevel ? [{
      title: '操作',
      key: 'ops',
      render: (_: any, r: User) => (
        isPresident && r.id !== user?.id ? (
          <Button size="small" onClick={() => { setSelected(r); setEditModal(true); }}>调整角色</Button>
        ) : null
      ),
    }] : []),
  ];

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Title level={3} style={{ color: '#fff', margin: 0 }} className="glow-text">👥 成员管理</Title>
        <Paragraph style={{ color: 'rgba(255,255,255,0.6)', margin: '8px 0 0 0' }}>
          商会共 {members.length} 名成员，管理团队角色和权限
        </Paragraph>
      </div>

      <Space style={{ marginBottom: 16 }}>
        <Tag icon={<CrownOutlined />} color="gold">会长: {members.filter(m => m.role === 'president').length}</Tag>
        <Tag color="orange">副会长: {members.filter(m => m.role === 'vice_president').length}</Tag>
        <Tag color="green">财务官: {members.filter(m => m.role === 'finance_officer').length}</Tag>
        <Tag color="blue">主管: {members.filter(m => m.role === 'director').length}</Tag>
        <Tag>成员: {members.filter(m => m.role === 'member').length}</Tag>
      </Space>

      <Card className="stat-card">
        <Table dataSource={members} columns={columns} rowKey="id" />
      </Card>

      <Modal title={`调整角色 - ${selected?.username}`} open={editModal} onCancel={() => { setEditModal(false); setSelected(null); }} footer={null}>
        <Form onFinish={handleUpdateRole} layout="vertical">
          <Form.Item name="role" label="新角色" initialValue={selected?.role} rules={[{ required: true }]}>
            <Select>
              <Option value="member">👤 成员</Option>
              <Option value="director">📊 事业部主管</Option>
              <Option value="finance_officer">💰 财务官</Option>
              <Option value="vice_president">🥈 副会长</Option>
            </Select>
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block>确认</Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
