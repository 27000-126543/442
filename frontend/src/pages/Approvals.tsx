import { useEffect, useState } from 'react';
import { Card, Table, Tag, Button, Modal, Form, Input, InputNumber, Space, Typography, message, Descriptions, Popconfirm } from 'antd';
import { PlusOutlined, CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { approvalApi } from '../api';
import type { ApprovalFlow } from '../types';
import dayjs from 'dayjs';
import { useAppStore } from '../store';

const { Title, Paragraph } = Typography;

const levelMap: Record<number, string> = { 1: '一级（主管）', 2: '二级（副会长）', 3: '三级（会长/财务官）' };

export default function Approvals() {
  const user = useAppStore(s => s.user);
  const [approvals, setApprovals] = useState<ApprovalFlow[]>([]);
  const [modal, setModal] = useState(false);
  const [detailModal, setDetailModal] = useState(false);
  const [selected, setSelected] = useState<ApprovalFlow | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const data = await approvalApi.getApprovals();
      setApprovals(data);
    } catch (e) { console.error(e); }
  };

  const handleCreate = async (values: any) => {
    setLoading(true);
    try {
      await approvalApi.createApproval(values);
      message.success('审批已提交');
      setModal(false);
      loadData();
    } catch (e: any) {
      message.error(e.response?.data?.error || '操作失败');
    } finally { setLoading(false); }
  };

  const handleApprove = async (id: string) => {
    try {
      await approvalApi.approve(id);
      message.success('已通过');
      loadData();
    } catch (e: any) { message.error(e.response?.data?.error || '操作失败'); }
  };

  const handleReject = async (id: string) => {
    try {
      await approvalApi.reject(id);
      message.success('已拒绝');
      loadData();
    } catch (e: any) { message.error(e.response?.data?.error || '操作失败'); }
  };

  const columns = [
    { title: '标题', dataIndex: 'title', key: 'title', render: (t: string) => <span style={{ color: '#fff', fontWeight: 'bold' }}>{t}</span> },
    { title: '描述', dataIndex: 'description', key: 'desc', render: (d: string) => <span style={{ color: 'rgba(255,255,255,0.7)' }}>{d?.slice(0, 30)}...</span> },
    { title: '审批等级', dataIndex: 'required_level', key: 'lvl', render: (l: number) => <Tag color={l === 3 ? 'red' : l === 2 ? 'orange' : 'blue'}>{levelMap[l]}</Tag> },
    {
      title: '进度',
      key: 'progress',
      render: (_: any, r: ApprovalFlow) => {
        const needed = r.required_level;
        const got = (r.approved_level_1 ? 1 : 0) + (r.approved_level_2 ? 1 : 0) + (r.approved_level_3 ? 1 : 0);
        return (
          <Space>
            {[1, 2, 3].slice(0, needed).map(l => (
              <Tag key={l} color={
                (l === 1 && r.approved_level_1) || (l === 2 && r.approved_level_2) || (l === 3 && r.approved_level_3)
                  ? 'green' : 'default'
              }>
                L{l}
              </Tag>
            ))}
            <span style={{ color: 'rgba(255,255,255,0.5)' }}>{got}/{needed}</span>
          </Space>
        );
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (s: string) => {
        const map: Record<string, any> = { pending: 'processing', approved: 'success', rejected: 'error' };
        const text: Record<string, string> = { pending: '待审批', approved: '已通过', rejected: '已拒绝' };
        return <Tag color={map[s]}>{text[s]}</Tag>;
      },
    },
    { title: '提交时间', dataIndex: 'created_at', key: 'time', render: (t: number) => dayjs(t).format('MM-DD HH:mm') },
    {
      title: '操作',
      key: 'ops',
      render: (_: any, r: ApprovalFlow) => (
        <Space>
          <Button size="small" onClick={() => { setSelected(r); setDetailModal(true); }}>详情</Button>
          {r.status === 'pending' && (
            <>
              <Button size="small" type="primary" icon={<CheckOutlined />} onClick={() => handleApprove(r.id)}>通过</Button>
              <Popconfirm title="确认拒绝？" onConfirm={() => handleReject(r.id)}>
                <Button size="small" danger icon={<CloseOutlined />}>拒绝</Button>
              </Popconfirm>
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <Title level={3} style={{ color: '#fff', margin: 0 }} className="glow-text">✅ 审批中心</Title>
          <Paragraph style={{ color: 'rgba(255,255,255,0.6)', margin: '8px 0 0 0' }}>三级审批权限体系 — 主管、副会长、会长/财务官逐级审批</Paragraph>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModal(true)}>发起审批</Button>
      </div>

      <Card className="stat-card">
        <Table dataSource={approvals} columns={columns} rowKey="id" />
      </Card>

      <Modal title="发起审批" open={modal} onCancel={() => setModal(false)} footer={null}>
        <Form onFinish={handleCreate} layout="vertical">
          <Form.Item name="title" label="审批标题" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="description" label="描述"><Input.TextArea rows={2} /></Form.Item>
          <Form.Item name="requiredLevel" label="需要审批等级" initialValue={1} rules={[{ required: true }]}>
            <InputNumber min={1} max={3} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="payload" label="附加数据(JSON)"><Input.TextArea rows={3} /></Form.Item>
          <Form.Item><Button type="primary" htmlType="submit" loading={loading} block>提交</Button></Form.Item>
        </Form>
      </Modal>

      <Modal title="审批详情" open={detailModal} onCancel={() => setDetailModal(false)} footer={null} width={600}>
        {selected && (
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="标题">{selected.title}</Descriptions.Item>
            <Descriptions.Item label="描述">{selected.description || '-'}</Descriptions.Item>
            <Descriptions.Item label="所需等级">{levelMap[selected.required_level]}</Descriptions.Item>
            <Descriptions.Item label="一级审批">
              {selected.approved_level_1 ? <Tag color="green">已通过</Tag> : <Tag>待审批</Tag>}
            </Descriptions.Item>
            <Descriptions.Item label="二级审批">
              {selected.required_level >= 2 ? (selected.approved_level_2 ? <Tag color="green">已通过</Tag> : <Tag>待审批</Tag>) : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="三级审批">
              {selected.required_level >= 3 ? (selected.approved_level_3 ? <Tag color="green">已通过</Tag> : <Tag>待审批</Tag>) : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="状态">
              {selected.status === 'approved' ? <Tag color="green">已通过</Tag> : selected.status === 'rejected' ? <Tag color="red">已拒绝</Tag> : <Tag color="blue">进行中</Tag>}
            </Descriptions.Item>
            <Descriptions.Item label="创建时间">{dayjs(selected.created_at).format('YYYY-MM-DD HH:mm:ss')}</Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
}
