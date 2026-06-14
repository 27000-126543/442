import { useEffect, useState } from 'react';
import {
  Row, Col, Card, Button, Table, Modal, Form, Input, InputNumber,
  Tag, Space, message, Typography, Progress, Popconfirm
} from 'antd';
import { PlusOutlined, EyeOutlined, UserOutlined, SendOutlined } from '@ant-design/icons';
import { intelligenceApi, authApi } from '../api';
import type { Spy, Department } from '../types';
import { useAppStore } from '../store';

const { Title, Paragraph } = Typography;

export default function Intelligence() {
  const departments = useAppStore(s => s.departments);
  const dept = departments.find((d: Department) => d.type === 'intelligence');

  const [spies, setSpies] = useState<Spy[]>([]);
  const [spyModal, setSpyModal] = useState(false);
  const [deployModal, setDeployModal] = useState(false);
  const [selectedSpy, setSelectedSpy] = useState<Spy | null>(null);
  const [loading, setLoading] = useState(false);
  const [upgradeLoading, setUpgradeLoading] = useState(false);

  useEffect(() => {
    loadData();
    const timer = setInterval(loadData, 5000);
    return () => clearInterval(timer);
  }, []);

  const loadData = async () => {
    try {
      const data = await intelligenceApi.getSpies();
      setSpies(data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpgrade = async () => {
    setUpgradeLoading(true);
    try {
      await authApi.upgradeDepartment('intelligence');
      message.success('情报部升级成功！');
      const data = await authApi.getMyCompany();
      useAppStore.getState().setDepartments(data.departments);
      useAppStore.getState().setCompany(data.company);
    } catch (e: any) {
      message.error(e.response?.data?.error || '升级失败');
    } finally {
      setUpgradeLoading(false);
    }
  };

  const handleCreateSpy = async (values: any) => {
    setLoading(true);
    try {
      await intelligenceApi.createSpy(values);
      message.success('间谍已招募！');
      setSpyModal(false);
      loadData();
    } catch (e: any) {
      message.error(e.response?.data?.error || '操作失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDeploy = async (values: any) => {
    if (!selectedSpy) return;
    setLoading(true);
    try {
      await intelligenceApi.deploySpy(selectedSpy.id, values);
      message.success('间谍已部署潜入！');
      setDeployModal(false);
      setSelectedSpy(null);
      loadData();
    } catch (e: any) {
      message.error(e.response?.data?.error || '操作失败');
    } finally {
      setLoading(false);
    }
  };

  const handleRecall = async (spy: Spy) => {
    try {
      await intelligenceApi.recallSpy(spy.id);
      message.success('间谍已召回');
      loadData();
    } catch (e: any) {
      message.error(e.response?.data?.error || '召回失败');
    }
  };

  const columns = [
    {
      title: '间谍',
      key: 'spy',
      render: (_: any, r: Spy) => (
        <Space>
          <span style={{ background: 'linear-gradient(135deg, #722ed1, #f5222d)', borderRadius: '50%', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 'bold' }}>
            {r.name[0]}
          </span>
          <div>
            <div style={{ color: '#fff', fontWeight: 'bold' }}>{r.name}</div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>ID: {r.id.slice(0, 8)}</div>
          </div>
        </Space>
      ),
    },
    {
      title: '技能',
      dataIndex: 'skill',
      key: 'skill',
      render: (v: number) => (
        <div>
          <Progress percent={v} size="small" strokeColor="#13c2c2" showInfo={false} style={{ width: 80 }} />
          <div style={{ color: '#13c2c2', fontSize: 12 }}>{v}</div>
        </div>
      ),
    },
    {
      title: '隐匿',
      dataIndex: 'stealth',
      key: 'stealth',
      render: (v: number) => (
        <div>
          <Progress percent={v} size="small" strokeColor="#722ed1" showInfo={false} style={{ width: 80 }} />
          <div style={{ color: '#722ed1', fontSize: 12 }}>{v}</div>
        </div>
      ),
    },
    {
      title: '暴露风险',
      dataIndex: 'exposure_risk',
      key: 'risk',
      render: (v: number) => {
        const pct = Math.round(v * 100);
        return (
          <div>
            <Progress percent={pct} size="small" strokeColor={pct > 70 ? '#f5222d' : pct > 40 ? '#faad14' : '#52c41a'} showInfo={false} style={{ width: 80 }} />
            <div style={{ color: pct > 70 ? '#f5222d' : pct > 40 ? '#faad14' : '#52c41a', fontSize: 12 }}>{pct}%</div>
          </div>
        );
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (s: string, r: Spy) => {
        const map: Record<string, any> = {
          idle: { c: 'default', t: '待命' },
          infiltrating: { c: 'processing', t: `潜入中 → ${r.target_company_id?.slice(0, 6)}` },
          exposed: { c: 'error', t: '已暴露' },
          captured: { c: 'red', t: '被俘' },
        };
        return <Tag color={map[s]?.c}>{map[s]?.t || s}</Tag>;
      },
    },
    {
      title: '任务',
      dataIndex: 'mission',
      key: 'mission',
      render: (m: string | null) => <span style={{ color: 'rgba(255,255,255,0.7)' }}>{m || '-'}</span>,
    },
    {
      title: '操作',
      key: 'ops',
      render: (_: any, r: Spy) => (
        <Space>
          {r.status === 'idle' && (
            <Button size="small" icon={<SendOutlined />} type="primary" onClick={() => { setSelectedSpy(r); setDeployModal(true); }}>
              部署
            </Button>
          )}
          {r.status === 'infiltrating' && (
            <Popconfirm title="确认召回此间谍？" onConfirm={() => handleRecall(r)}>
              <Button size="small">召回</Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <Title level={3} style={{ color: '#fff', margin: 0 }} className="glow-text">
            🕵️ 情报部
          </Title>
          <Paragraph style={{ color: 'rgba(255,255,255,0.6)', margin: '8px 0 0 0' }}>
            派遣间谍潜入敌对势力，监控暴露风险，执行策反与反间
          </Paragraph>
        </div>
        <Space>
          <Tag color="red" style={{ fontSize: 16, padding: '4px 12px' }}>Lv.{dept?.level || 1}</Tag>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleUpgrade} loading={upgradeLoading}>
            升级 ({(dept?.level || 1) * 10000} 金币)
          </Button>
        </Space>
      </div>

      <Card
        className="stat-card"
        title={<span style={{ color: '#fff' }}><EyeOutlined /> 间谍名单</span>}
        extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => setSpyModal(true)}>招募间谍</Button>}
      >
        <Table dataSource={spies} columns={columns} rowKey="id" pagination={false} />
      </Card>

      <Modal title="招募间谍" open={spyModal} onCancel={() => setSpyModal(false)} footer={null}>
        <Form onFinish={handleCreateSpy} layout="vertical">
          <Form.Item name="name" label="间谍代号" rules={[{ required: true }]}>
            <Input placeholder="给间谍起个代号" />
          </Form.Item>
          <Form.Item name="skill" label="技能值" initialValue={50}>
            <InputNumber min={1} max={100} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="stealth" label="隐匿值" initialValue={50}>
            <InputNumber min={1} max={100} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block>招募</Button>
          </Form.Item>
        </Form>
      </Modal>

      <Modal title={`部署间谍 - ${selectedSpy?.name}`} open={deployModal} onCancel={() => { setDeployModal(false); setSelectedSpy(null); }} footer={null}>
        <Form onFinish={handleDeploy} layout="vertical">
          <Form.Item name="targetCompanyId" label="目标商会ID" rules={[{ required: true }]}>
            <Input placeholder="输入敌方商会ID" />
          </Form.Item>
          <Form.Item name="mission" label="任务描述" rules={[{ required: true }]}>
            <Input.TextArea placeholder="描述间谍的任务目标" rows={3} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block>派遣潜入</Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
