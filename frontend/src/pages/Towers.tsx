import { useEffect, useState } from 'react';
import { Card, Table, Progress, Button, Tag, Space, Modal, Form, InputNumber, Typography, message, List } from 'antd';
import { BuildOutlined, PlusOutlined, RiseOutlined, TeamOutlined } from '@ant-design/icons';
import { towerApi } from '../api';
import type { CommercialTower, TowerContribution } from '../types';
import dayjs from 'dayjs';

const { Title, Paragraph } = Typography;

export default function Towers() {
  const [towers, setTowers] = useState<CommercialTower[]>([]);
  const [contribModal, setContribModal] = useState(false);
  const [selectedTower, setSelectedTower] = useState<CommercialTower | null>(null);
  const [contributions, setContributions] = useState<TowerContribution[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const data = await towerApi.getAll();
      setTowers(data);
    } catch (e) { console.error(e); }
  };

  const handleContribute = async (values: any) => {
    if (!selectedTower) return;
    setLoading(true);
    try {
      await towerApi.contribute(selectedTower.id, values.amount);
      message.success('贡献成功！影响力已增加');
      setContribModal(false);
      loadData();
    } catch (e: any) {
      message.error(e.response?.data?.error || '操作失败');
    } finally { setLoading(false); }
  };

  const handleUpgrade = async (id: string) => {
    try {
      await towerApi.upgrade(id);
      message.success('商业塔升级成功！');
      loadData();
    } catch (e: any) {
      message.error(e.response?.data?.error || '升级失败');
    }
  };

  const handleViewContrib = async (tower: CommercialTower) => {
    try {
      const data = await towerApi.getContributions(tower.id) as any;
      setContributions(data);
      setSelectedTower(tower);
    } catch (e) { console.error(e); }
  };

  const columns = [
    {
      title: '商业塔',
      key: 'info',
      render: (_: any, r: CommercialTower) => {
        const ids: string[] = JSON.parse(r.company_ids);
        return (
          <Space>
            <div style={{ fontSize: 36 }}>🏢</div>
            <div>
              <div style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>
                多维商业塔 Lv.{r.level}
              </div>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>
                <TeamOutlined /> 联合商会: {ids.length} 家
              </div>
            </div>
          </Space>
        );
      },
    },
    {
      title: '升级进度',
      key: 'progress',
      render: (_: any, r: CommercialTower) => (
        <div style={{ width: 200 }}>
          <Progress
            percent={Math.round((r.total_contribution / r.required_contribution) * 100)}
            strokeColor={{ from: '#722ed1', to: '#13c2c2' }}
          />
          <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>
            {r.total_contribution.toLocaleString()} / {r.required_contribution.toLocaleString()}
          </div>
        </div>
      ),
    },
    {
      title: '升级状态',
      dataIndex: 'upgrade_status',
      key: 'status',
      render: (s: string) => {
        const map: Record<string, any> = {
          idle: { c: 'default', t: '建设中' },
          awaiting_approval: { c: 'orange', t: '待审批' },
          upgrading: { c: 'processing', t: '升级中' },
        };
        return <Tag color={map[s]?.c}>{map[s]?.t}</Tag>;
      },
    },
    {
      title: '操作',
      key: 'ops',
      render: (_: any, r: CommercialTower) => (
        <Space>
          <Button size="small" onClick={() => handleViewContrib(r)}>贡献明细</Button>
          <Button size="small" type="primary" icon={<PlusOutlined />} onClick={() => { setSelectedTower(r); setContribModal(true); }}>
            贡献
          </Button>
          {r.total_contribution >= r.required_contribution && (
            <Button size="small" type="primary" icon={<RiseOutlined />} onClick={() => handleUpgrade(r.id)}>升级</Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Title level={3} style={{ color: '#fff', margin: 0 }} className="glow-text">🏢 多维商业塔</Title>
        <Paragraph style={{ color: 'rgba(255,255,255,0.6)', margin: '8px 0 0 0' }}>
          联合商会共同建造，全员贡献后经三级审批升级
        </Paragraph>
      </div>

      <Card
        className="stat-card"
        title={<span style={{ color: '#fff' }}><BuildOutlined /> 商业塔列表</span>}
        extra={<Button type="primary" icon={<PlusOutlined />} onClick={async () => { await towerApi.create([]); loadData(); }}>创建商业塔</Button>}
      >
        <Table dataSource={towers} columns={columns} rowKey="id" pagination={false} expandable={{
          expandedRowRender: record => (
            <List
              size="small"
              dataSource={JSON.parse(record.company_ids) as string[]}
              renderItem={item => (
                <List.Item>
                  <Tag color="purple">{item}</Tag>
                </List.Item>
              )}
            />
          ),
          rowExpandable: () => true,
        }} />
      </Card>

      <Modal title="贡献金币" open={contribModal} onCancel={() => setContribModal(false)} footer={null}>
        <Form onFinish={handleContribute} layout="vertical">
          <Form.Item name="amount" label="贡献金额" rules={[{ required: true }]}>
            <InputNumber min={100} style={{ width: '100%' }} placeholder="输入贡献金币数量" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block>确认贡献</Button>
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="贡献明细" open={!!selectedTower && contributions.length > 0} onCancel={() => { setSelectedTower(null); setContributions([]); }} footer={null} width={600}>
        <List
          dataSource={contributions}
          renderItem={item => (
            <List.Item>
              <Space>
                <Tag color="purple">{item.company_id.slice(0, 8)}</Tag>
                <span style={{ color: '#faad14' }}>💰 {item.amount.toLocaleString()}</span>
                <span style={{ color: 'rgba(255,255,255,0.5)' }}>{dayjs(item.contributed_at).format('MM-DD HH:mm')}</span>
              </Space>
            </List.Item>
          )}
        />
      </Modal>
    </div>
  );
}
