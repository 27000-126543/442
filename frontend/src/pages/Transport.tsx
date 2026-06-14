import { useEffect, useState } from 'react';
import { Row, Col, Card, Button, Table, Modal, Form, Input, InputNumber, Progress, Tag, Space, message, Typography } from 'antd';
import { PlusOutlined, RocketOutlined, GatewayOutlined } from '@ant-design/icons';
import { transportApi, authApi } from '../api';
import type { Portal, Caravan, Department } from '../types';
import { useAppStore } from '../store';

const { Title, Paragraph } = Typography;

export default function Transport() {
  const departments = useAppStore(s => s.departments);
  const dept = departments.find((d: Department) => d.type === 'transport');

  const [portals, setPortals] = useState<Portal[]>([]);
  const [caravans, setCaravans] = useState<Caravan[]>([]);
  const [portalModal, setPortalModal] = useState(false);
  const [caravanModal, setCaravanModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [upgradeLoading, setUpgradeLoading] = useState(false);

  useEffect(() => {
    loadData();
    const timer = setInterval(loadData, 5000);
    return () => clearInterval(timer);
  }, []);

  const loadData = async () => {
    try {
      const [p, c] = await Promise.all([transportApi.getPortals(), transportApi.getCaravans()]);
      setPortals(p);
      setCaravans(c);
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreatePortal = async (values: any) => {
    setLoading(true);
    try {
      await transportApi.createPortal(values);
      message.success('传送门创建成功！');
      setPortalModal(false);
      loadData();
    } catch (e: any) {
      message.error(e.response?.data?.error || '创建失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCaravan = async (values: any) => {
    setLoading(true);
    try {
      await transportApi.createCaravan(values);
      message.success('商队已出发！');
      setCaravanModal(false);
      loadData();
    } catch (e: any) {
      message.error(e.response?.data?.error || '创建失败');
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async () => {
    setUpgradeLoading(true);
    try {
      await authApi.upgradeDepartment('transport');
      message.success('运输部升级成功！');
      const data = await authApi.getMyCompany();
      useAppStore.getState().setDepartments(data.departments);
      useAppStore.getState().setCompany(data.company);
    } catch (e: any) {
      message.error(e.response?.data?.error || '升级失败');
    } finally {
      setUpgradeLoading(false);
    }
  };

  const caravanColumns = [
    { title: '商队名称', dataIndex: 'name', key: 'name', render: (t: string) => <span style={{ color: '#fff' }}>🚀 {t}</span> },
    { title: '货物价值', dataIndex: 'goods_value', key: 'goods_value', render: (v: number) => <span style={{ color: '#faad14' }}>💰 {v.toLocaleString()}</span> },
    { title: '护卫战力', dataIndex: 'guard_power', key: 'guard_power', render: (v: number) => <Tag color="blue">⚔️ {v}</Tag> },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (s: string) => {
        const map: Record<string, any> = {
          idle: { color: 'default', text: '待命中' },
          traveling: { color: 'processing', text: '运输中' },
          attacked: { color: 'error', text: '遭遇袭击' },
        };
        return <Tag color={map[s]?.color || 'default'}>{map[s]?.text || s}</Tag>;
      },
    },
    {
      title: '进度',
      dataIndex: 'progress',
      key: 'progress',
      render: (p: number) => (
        <Progress percent={Math.round(p)} size="small" strokeColor="#13c2c2" showInfo style={{ width: 120 }} />
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <Title level={3} style={{ color: '#fff', margin: 0 }} className="glow-text">
            🚀 运输部
          </Title>
          <Paragraph style={{ color: 'rgba(255,255,255,0.6)', margin: '8px 0 0 0' }}>
            管理传送门网络与星际商队，控制运输风险最大化收益
          </Paragraph>
        </div>
        <Space>
          <Tag color="cyan" style={{ fontSize: 16, padding: '4px 12px' }}>
            Lv.{dept?.level || 1}
          </Tag>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleUpgrade} loading={upgradeLoading}>
            升级 ({(dept?.level || 1) * 10000} 金币)
          </Button>
        </Space>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} md={12}>
          <Card
            className="stat-card"
            title={<span style={{ color: '#fff' }}><GatewayOutlined /> 传送门网络</span>}
            extra={
              <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => setPortalModal(true)}>
                新建传送门
              </Button>
            }
          >
            <Table
              dataSource={portals}
              rowKey="id"
              size="small"
              pagination={false}
              columns={[
                { title: '名称', dataIndex: 'name', key: 'name', render: (t: string) => <span style={{ color: '#fff' }}>{t}</span> },
                { title: '路线', key: 'route', render: (_: any, r: Portal) => <span style={{ color: '#13c2c2' }}>{r.source_dimension} → {r.target_dimension}</span> },
                { title: '风险', dataIndex: 'risk_level', key: 'risk', render: (v: number) => <Tag color={v > 6 ? 'red' : v > 3 ? 'orange' : 'green'}>风险 Lv.{v}</Tag> },
              ]}
            />
          </Card>
        </Col>

        <Col xs={24} md={12}>
          <Card
            className="stat-card"
            title={<span style={{ color: '#fff' }}><RocketOutlined /> 星际商队</span>}
            extra={
              <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => setCaravanModal(true)} disabled={portals.length === 0}>
                派遣商队
              </Button>
            }
          >
            <Table
              dataSource={caravans}
              rowKey="id"
              size="small"
              pagination={false}
              columns={caravanColumns}
            />
          </Card>
        </Col>
      </Row>

      <Modal title="新建传送门" open={portalModal} onCancel={() => setPortalModal(false)} footer={null}>
        <Form onFinish={handleCreatePortal} layout="vertical">
          <Form.Item name="name" label="传送门名称" rules={[{ required: true }]}>
            <Input placeholder="例如：地球↔火星通道" />
          </Form.Item>
          <Form.Item name="source" label="源维度" rules={[{ required: true }]}>
            <Input placeholder="例如：地球宇宙" />
          </Form.Item>
          <Form.Item name="target" label="目标维度" rules={[{ required: true }]}>
            <Input placeholder="例如：魔法大陆" />
          </Form.Item>
          <Form.Item name="riskLevel" label="风险等级 (1-10)" initialValue={3}>
            <InputNumber min={1} max={10} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block>创建</Button>
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="派遣星际商队" open={caravanModal} onCancel={() => setCaravanModal(false)} footer={null}>
        <Form onFinish={handleCreateCaravan} layout="vertical">
          <Form.Item name="name" label="商队名称" rules={[{ required: true }]}>
            <Input placeholder="例如：先锋商队-A" />
          </Form.Item>
          <Form.Item name="portalId" label="选择传送门" rules={[{ required: true }]}>
            <select style={{ width: '100%', height: 32, borderRadius: 6, background: '#1f1f3a', color: '#fff', border: '1px solid #43436a', padding: '0 8px' }}>
              {portals.map(p => (
                <option key={p.id} value={p.id}>{p.name} (风险Lv.{p.risk_level})</option>
              ))}
            </select>
          </Form.Item>
          <Form.Item name="goodsValue" label="货物价值" rules={[{ required: true }]}>
            <InputNumber min={100} style={{ width: '100%' }} placeholder="投入货物价值金币" />
          </Form.Item>
          <Form.Item name="guardPower" label="护卫战力" rules={[{ required: true }]} initialValue={50}>
            <InputNumber min={10} max={100} style={{ width: '100%' }} placeholder="10-100" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block>派遣出发</Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
