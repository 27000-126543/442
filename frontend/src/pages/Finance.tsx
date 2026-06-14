import { useEffect, useState } from 'react';
import {
  Row, Col, Card, Button, Table, Modal, Form, Input, InputNumber,
  Statistic, Tag, Space, message, Typography, Tabs, Progress
} from 'antd';
import { PlusOutlined, DollarOutlined, BankOutlined, RiseOutlined, FallOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { financeApi, authApi } from '../api';
import type { BankAccount, Bond, Loan, EconomicIndicator, Department } from '../types';
import { useAppStore } from '../store';
import dayjs from 'dayjs';

const { Title, Paragraph } = Typography;

export default function Finance() {
  const departments = useAppStore(s => s.departments);
  const company = useAppStore(s => s.company);
  const dept = departments.find((d: Department) => d.type === 'finance');
  const economy = useAppStore(s => s.economy);
  const setEconomy = useAppStore(s => s.setEconomy);

  const [account, setAccount] = useState<BankAccount | null>(null);
  const [bonds, setBonds] = useState<Bond[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [depositModal, setDepositModal] = useState(false);
  const [withdrawModal, setWithdrawModal] = useState(false);
  const [bondModal, setBondModal] = useState(false);
  const [loanModal, setLoanModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [upgradeLoading, setUpgradeLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!economy) {
      financeApi.getEconomy().then(e => setEconomy(e)).catch(() => {});
    }
  }, [economy, setEconomy]);

  const loadData = async () => {
    try {
      const [acc, bnds, lns] = await Promise.all([
        financeApi.getAccount(),
        financeApi.getBonds(),
        financeApi.getLoans(),
      ]);
      setAccount(acc);
      setBonds(bnds);
      setLoans(lns);
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpgrade = async () => {
    setUpgradeLoading(true);
    try {
      await authApi.upgradeDepartment('finance');
      message.success('金融部升级成功！');
      const data = await authApi.getMyCompany();
      useAppStore.getState().setDepartments(data.departments);
      useAppStore.getState().setCompany(data.company);
    } catch (e: any) {
      message.error(e.response?.data?.error || '升级失败');
    } finally {
      setUpgradeLoading(false);
    }
  };

  const handleDeposit = async (values: any) => {
    setLoading(true);
    try {
      await financeApi.deposit(values.amount);
      message.success('存款成功！');
      setDepositModal(false);
      loadData();
      const data = await authApi.getMyCompany();
      useAppStore.getState().setCompany(data.company);
    } catch (e: any) {
      message.error(e.response?.data?.error || '操作失败');
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async (values: any) => {
    setLoading(true);
    try {
      await financeApi.withdraw(values.amount);
      message.success('取款成功！');
      setWithdrawModal(false);
      loadData();
      const data = await authApi.getMyCompany();
      useAppStore.getState().setCompany(data.company);
    } catch (e: any) {
      message.error(e.response?.data?.error || '操作失败');
    } finally {
      setLoading(false);
    }
  };

  const handleBond = async (values: any) => {
    setLoading(true);
    try {
      await financeApi.issueBond(values);
      message.success('债券发行成功！');
      setBondModal(false);
      loadData();
      const data = await authApi.getMyCompany();
      useAppStore.getState().setCompany(data.company);
    } catch (e: any) {
      message.error(e.response?.data?.error || '操作失败');
    } finally {
      setLoading(false);
    }
  };

  const handleLoan = async (values: any) => {
    setLoading(true);
    try {
      await financeApi.issueLoan(values);
      message.success('贷款发放成功！');
      setLoanModal(false);
      loadData();
    } catch (e: any) {
      message.error(e.response?.data?.error || '操作失败');
    } finally {
      setLoading(false);
    }
  };

  const bondColumns = [
    { title: '面值', dataIndex: 'face_value', key: 'fv', render: (v: number) => <span style={{ color: '#faad14' }}>💰 {v.toLocaleString()}</span> },
    { title: '利率', dataIndex: 'interest_rate', key: 'rate', render: (v: number) => <Tag color="green">{(v * 100).toFixed(2)}%</Tag> },
    { title: '到期日', dataIndex: 'maturity_date', key: 'mat', render: (v: number) => dayjs(v).format('YYYY-MM-DD') },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'st',
      render: (s: string) => {
        const map: Record<string, any> = { active: { c: 'blue', t: '持有中' }, matured: { c: 'green', t: '已到期' }, defaulted: { c: 'red', t: '违约' } };
        return <Tag color={map[s]?.c}>{map[s]?.t}</Tag>;
      },
    },
  ];

  const loanColumns = [
    { title: '本金', dataIndex: 'principal', key: 'p', render: (v: number) => <span style={{ color: '#faad14' }}>💰 {v.toLocaleString()}</span> },
    { title: '剩余金额', dataIndex: 'remaining_amount', key: 'rem', render: (v: number) => <span>{v.toLocaleString()}</span> },
    { title: '利率', dataIndex: 'interest_rate', key: 'r', render: (v: number) => <Tag color="orange">{(v * 100).toFixed(2)}%</Tag> },
    { title: '到期', dataIndex: 'due_date', key: 'd', render: (v: number) => dayjs(v).format('MM-DD') },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'st',
      render: (s: string) => {
        const map: Record<string, any> = { active: 'blue', paid: 'green', defaulted: 'red' };
        return <Tag color={map[s]}>{s === 'active' ? '进行中' : s === 'paid' ? '已还清' : '违约'}</Tag>;
      },
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <Title level={3} style={{ color: '#fff', margin: 0 }} className="glow-text">
            💰 金融部
          </Title>
          <Paragraph style={{ color: 'rgba(255,255,255,0.6)', margin: '8px 0 0 0' }}>
            运营魔力银行与跨服交易所，掌握市场利率动态
          </Paragraph>
        </div>
        <Space>
          <Tag color="gold" style={{ fontSize: 16, padding: '4px 12px' }}>Lv.{dept?.level || 1}</Tag>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleUpgrade} loading={upgradeLoading}>
            升级 ({(dept?.level || 1) * 10000} 金币)
          </Button>
        </Space>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} md={6}>
          <Card className="stat-card">
            <Statistic title={<span style={{ color: 'rgba(255,255,255,0.7)' }}>市场指数</span>} value={economy?.market_index || 0} valueStyle={{ color: '#13c2c2' }} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card className="stat-card">
            <Statistic
              title={<span style={{ color: 'rgba(255,255,255,0.7)' }}>基础利率</span>}
              value={(economy?.global_interest_rate || 0) * 100}
              precision={2}
              suffix="%"
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card className="stat-card">
            <Statistic
              title={<span style={{ color: 'rgba(255,255,255,0.7)' }}>通胀率</span>}
              value={(economy?.inflation_rate || 0) * 100}
              precision={2}
              suffix="%"
              prefix={(economy?.inflation_rate || 0) > 0 ? <FallOutlined /> : <RiseOutlined />}
              valueStyle={{ color: (economy?.inflation_rate || 0) > 0 ? '#f5222d' : '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card className="stat-card">
            <Statistic title={<span style={{ color: 'rgba(255,255,255,0.7)' }}>交易量</span>} value={economy?.market_volume || 0} valueStyle={{ color: '#722ed1' }} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} md={10}>
          <Card
            className="stat-card"
            title={<span style={{ color: '#fff' }}><BankOutlined /> 魔力银行账户</span>}
            extra={
              <Space>
                <Button size="small" onClick={() => setDepositModal(true)}>存款</Button>
                <Button size="small" type="primary" onClick={() => setWithdrawModal(true)}>取款</Button>
              </Space>
            }
          >
            <Space direction="vertical" style={{ width: '100%' }}>
              <div>
                <div style={{ color: 'rgba(255,255,255,0.6)' }}>账户余额</div>
                <div style={{ color: '#faad14', fontSize: 32, fontWeight: 'bold' }}>
                  💰 {account?.balance?.toLocaleString() || 0}
                </div>
              </div>
              <div>
                <div style={{ color: 'rgba(255,255,255,0.6)', marginBottom: 4 }}>年化利率</div>
                <Progress percent={((account?.interest_rate || 0) * 1000)} strokeColor="#52c41a" showInfo={false} />
                <div style={{ color: '#52c41a', marginTop: 4 }}>{((account?.interest_rate || 0) * 100).toFixed(2)}%</div>
              </div>
              <div>
                <div style={{ color: 'rgba(255,255,255,0.6)' }}>可用现金</div>
                <div style={{ color: '#fff', fontSize: 18 }}>💰 {company?.total_assets?.toLocaleString()}</div>
              </div>
            </Space>
          </Card>
        </Col>

        <Col xs={24} md={14}>
          <Card
            className="stat-card"
            title={<span style={{ color: '#fff' }}><DollarOutlined /> 金融业务</span>}
          >
            <Tabs
              items={[
                {
                  key: 'bonds',
                  label: `债券 (${bonds.length})`,
                  children: (
                    <div>
                      <div style={{ marginBottom: 12 }}>
                        <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => setBondModal(true)}>发行债券</Button>
                      </div>
                      <Table dataSource={bonds} columns={bondColumns} rowKey="id" size="small" pagination={false} />
                    </div>
                  ),
                },
                {
                  key: 'loans',
                  label: `贷款 (${loans.length})`,
                  children: (
                    <div>
                      <div style={{ marginBottom: 12 }}>
                        <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => setLoanModal(true)}>发放贷款</Button>
                      </div>
                      <Table dataSource={loans} columns={loanColumns} rowKey="id" size="small" pagination={false} />
                    </div>
                  ),
                },
              ]}
            />
          </Card>
        </Col>
      </Row>

      <Modal title="存款" open={depositModal} onCancel={() => setDepositModal(false)} footer={null}>
        <Form onFinish={handleDeposit} layout="vertical">
          <Form.Item name="amount" label="存款金额" rules={[{ required: true }]}>
            <InputNumber min={1} max={company?.total_assets || 0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block>确认存款</Button>
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="取款" open={withdrawModal} onCancel={() => setWithdrawModal(false)} footer={null}>
        <Form onFinish={handleWithdraw} layout="vertical">
          <Form.Item name="amount" label="取款金额" rules={[{ required: true }]}>
            <InputNumber min={1} max={account?.balance || 0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block>确认取款</Button>
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="发行债券" open={bondModal} onCancel={() => setBondModal(false)} footer={null}>
        <Form onFinish={handleBond} layout="vertical">
          <Form.Item name="faceValue" label="债券面值" rules={[{ required: true }]}>
            <InputNumber min={1000} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="interestRate" label="年利率" rules={[{ required: true }]} initialValue={0.08}>
            <InputNumber min={0} max={0.5} step={0.01} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="durationDays" label="期限（天）" rules={[{ required: true }]} initialValue={30}>
            <InputNumber min={1} max={365} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block>发行</Button>
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="发放贷款" open={loanModal} onCancel={() => setLoanModal(false)} footer={null}>
        <Form onFinish={handleLoan} layout="vertical">
          <Form.Item name="borrowerCompanyId" label="借款商会ID" rules={[{ required: true }]}>
            <Input placeholder="输入对方商会ID" />
          </Form.Item>
          <Form.Item name="principal" label="贷款本金" rules={[{ required: true }]}>
            <InputNumber min={100} max={account?.balance || 0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="interestRate" label="利率" rules={[{ required: true }]} initialValue={0.1}>
            <InputNumber min={0} max={1} step={0.01} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="durationDays" label="期限（天）" rules={[{ required: true }]} initialValue={15}>
            <InputNumber min={1} max={365} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block>发放</Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
