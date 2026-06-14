import { useEffect, useState } from 'react';
import {
  Row, Col, Card, Button, Table, Modal, Form, Input, InputNumber,
  Statistic, Tag, Space, message, Typography, Tabs, Progress, Select, List
} from 'antd';
import { PlusOutlined, DollarOutlined, BankOutlined, RiseOutlined, FallOutlined, SwapOutlined, HistoryOutlined, ShoppingCartOutlined } from '@ant-design/icons';
import { financeApi, exchangeApi, authApi } from '../api';
import type {
  BankAccount, Bond, Loan, EconomicIndicator, Department,
  ExchangeOrder, ExchangeTrade, MarketData
} from '../types';
import { useAppStore } from '../store';
import dayjs from 'dayjs';

const { Title, Paragraph } = Typography;
const { Option } = Select;

const SYMBOLS = [
  { symbol: 'mana_core', name: '魔力晶核', icon: '💎', basePrice: 100 },
  { symbol: 'ship_parts', name: '星舰零件', icon: '🚀', basePrice: 250 },
  { symbol: 'ancient_relic', name: '古代遗物', icon: '🏺', basePrice: 500 },
  { symbol: 'intel_file', name: '情报密档', icon: '📜', basePrice: 1000 },
];

const getSymbolInfo = (symbol: string) => SYMBOLS.find(s => s.symbol === symbol) || { name: symbol, icon: '📦', basePrice: 100 };

export default function Finance() {
  const departments = useAppStore(s => s.departments);
  const company = useAppStore(s => s.company);
  const dept = departments.find((d: Department) => d.type === 'finance');
  const economy = useAppStore(s => s.economy);
  const setEconomy = useAppStore(s => s.setEconomy);

  const [account, setAccount] = useState<BankAccount | null>(null);
  const [bonds, setBonds] = useState<Bond[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);

  const [markets, setMarkets] = useState<MarketData[]>([]);
  const [assets, setAssets] = useState<Record<string, number>>({});
  const [orders, setOrders] = useState<ExchangeOrder[]>([]);
  const [trades, setTrades] = useState<ExchangeTrade[]>([]);
  const [orderBook, setOrderBook] = useState<{ buyOrders: ExchangeOrder[]; sellOrders: ExchangeOrder[] }>({ buyOrders: [], sellOrders: [] });
  const [activeSymbol, setActiveSymbol] = useState<string>('mana_core');
  const [orderType, setOrderType] = useState<'buy' | 'sell'>('buy');

  const [depositModal, setDepositModal] = useState(false);
  const [withdrawModal, setWithdrawModal] = useState(false);
  const [bondModal, setBondModal] = useState(false);
  const [loanModal, setLoanModal] = useState(false);
  const [orderModal, setOrderModal] = useState(false);

  const [loading, setLoading] = useState(false);
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [orderLoading, setOrderLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('exchange');

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!economy) {
      financeApi.getEconomy().then(e => setEconomy(e)).catch(() => {});
    }
  }, [economy, setEconomy]);

  useEffect(() => {
    if (activeTab === 'exchange') {
      loadExchangeData();
    }
  }, [activeTab, activeSymbol]);

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

  const loadExchangeData = async () => {
    try {
      const [m, a, o, t, ob] = await Promise.all([
        exchangeApi.getMarkets(),
        exchangeApi.getAssets(),
        exchangeApi.getOrders(activeSymbol),
        exchangeApi.getTrades(activeSymbol),
        exchangeApi.getOrderBook(activeSymbol),
      ]);
      setMarkets(m);
      setAssets(a);
      setOrders(o);
      setTrades(t);
      setOrderBook(ob);
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

  const handleSubmitOrder = async (values: any) => {
    setOrderLoading(true);
    try {
      if (orderType === 'buy') {
        await exchangeApi.createBuyOrder({ symbol: activeSymbol, price: values.price, amount: values.amount });
        message.success('买单已提交！');
      } else {
        await exchangeApi.createSellOrder({ symbol: activeSymbol, price: values.price, amount: values.amount });
        message.success('卖单已提交！');
      }
      setOrderModal(false);
      loadExchangeData();
      const data = await authApi.getMyCompany();
      useAppStore.getState().setCompany(data.company);
    } catch (e: any) {
      message.error(e.response?.data?.error || '操作失败');
    } finally {
      setOrderLoading(false);
    }
  };

  const handleCancelOrder = async (id: string) => {
    try {
      await exchangeApi.cancelOrder(id);
      message.success('订单已撤销');
      loadExchangeData();
      const data = await authApi.getMyCompany();
      useAppStore.getState().setCompany(data.company);
    } catch (e: any) {
      message.error(e.response?.data?.error || '撤销失败');
    }
  };

  const currentMarket = markets.find(m => m.symbol === activeSymbol);
  const symbolInfo = getSymbolInfo(activeSymbol);

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

  const orderColumns = [
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (t: string) => <Tag color={t === 'buy' ? 'green' : 'red'}>{t === 'buy' ? '买入' : '卖出'}</Tag>,
    },
    { title: '价格', dataIndex: 'price', key: 'price', render: (v: number) => `💰 ${v.toFixed(2)}` },
    { title: '数量', dataIndex: 'total_amount', key: 'total', render: (v: number) => v.toFixed(2) },
    {
      title: '成交',
      key: 'filled',
      render: (_: any, r: ExchangeOrder) => (
        <div>
          <Progress
            percent={Math.round((r.filled_amount / r.total_amount) * 100)}
            size="small"
            strokeColor="#13c2c2"
            showInfo={false}
            style={{ width: 80 }}
          />
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>{r.filled_amount.toFixed(2)}</span>
        </div>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (s: string) => {
        const map: Record<string, any> = {
          pending: { c: 'blue', t: '挂单中' },
          partial: { c: 'orange', t: '部分成交' },
          filled: { c: 'green', t: '已成交' },
          cancelled: { c: 'default', t: '已撤销' },
        };
        return <Tag color={map[s]?.c}>{map[s]?.t}</Tag>;
      },
    },
    { title: '时间', dataIndex: 'created_at', key: 'time', render: (t: number) => dayjs(t).format('MM-DD HH:mm') },
    {
      title: '操作',
      key: 'ops',
      render: (_: any, r: ExchangeOrder) => (
        r.status === 'pending' || r.status === 'partial' ? (
          <Button size="small" danger onClick={() => handleCancelOrder(r.id)}>撤销</Button>
        ) : null
      ),
    },
  ];

  const tradeColumns = [
    {
      title: '方向',
      key: 'side',
      render: (_: any, r: ExchangeTrade) => {
        const isBuy = r.buyer_company_id === company?.id;
        return <Tag color={isBuy ? 'green' : 'red'}>{isBuy ? '买入' : '卖出'}</Tag>;
      },
    },
    { title: '价格', dataIndex: 'price', key: 'price', render: (v: number) => `💰 ${v.toFixed(2)}` },
    { title: '数量', dataIndex: 'amount', key: 'amount', render: (v: number) => v.toFixed(2) },
    {
      title: '成交额',
      key: 'total',
      render: (_: any, r: ExchangeTrade) => `💰 ${(r.price * r.amount).toFixed(2)}`,
    },
    {
      title: '手续费',
      key: 'fee',
      dataIndex: 'fee',
      render: (v: number) => <span style={{ color: '#faad14' }}>💰 {(v || 0).toFixed(2)}</span>,
    },
    {
      title: '我的款项',
      key: 'myCash',
      render: (_: any, r: ExchangeTrade) => {
        const isBuy = r.buyer_company_id === company?.id;
        const tradeValue = r.price * r.amount;
        const fee = r.fee || 0;
        if (isBuy) {
          return <span style={{ color: '#f5222d' }}>-💰 {(tradeValue + fee).toFixed(2)}</span>;
        } else {
          return <span style={{ color: '#52c41a' }}>+💰 {(tradeValue - fee).toFixed(2)}</span>;
        }
      },
    },
    { title: '时间', dataIndex: 'timestamp', key: 'time', render: (t: number) => dayjs(t).format('MM-DD HH:mm:ss') },
  ];

  const exchangeTabItems = [
    {
      key: 'market',
      label: '交易市场',
      children: (
        <Row gutter={[16, 16]}>
          <Col xs={24} md={6}>
            <Card className="stat-card" title={<span style={{ color: '#fff' }}>交易品种</span>} style={{ marginBottom: 16 }}>
              <List
                dataSource={markets}
                renderItem={(item: MarketData) => {
                  const info = getSymbolInfo(item.symbol);
                  const isActive = item.symbol === activeSymbol;
                  return (
                    <List.Item
                      style={{
                        cursor: 'pointer',
                        padding: '12px 8px',
                        borderRadius: 8,
                        background: isActive ? 'rgba(114, 46, 209, 0.2)' : 'transparent',
                        border: isActive ? '1px solid #722ed1' : '1px solid transparent',
                      }}
                      onClick={() => setActiveSymbol(item.symbol)}
                    >
                      <Space>
                        <span style={{ fontSize: 24 }}>{info.icon}</span>
                        <div>
                          <div style={{ color: '#fff', fontWeight: 'bold' }}>{info.name}</div>
                          <div style={{ color: '#faad14', fontSize: 14 }}>💰 {item.lastPrice?.toFixed(2)}</div>
                        </div>
                      </Space>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{
                          color: (item.volume || 0) >= 0 ? '#52c41a' : '#f5222d',
                          fontSize: 12,
                        }}>
                          24H量: {(item.volume || 0).toFixed(0)}
                        </div>
                      </div>
                    </List.Item>
                  );
                }}
              />
            </Card>
          </Col>

          <Col xs={24} md={10}>
            <Card
              className="stat-card"
              title={
                <Space>
                  <span style={{ fontSize: 28 }}>{symbolInfo.icon}</span>
                  <span style={{ color: '#fff' }}>{symbolInfo.name} 行情</span>
                </Space>
              }
              extra={
                <Button type="primary" icon={<ShoppingCartOutlined />} onClick={() => setOrderModal(true)}>
                  下单交易
                </Button>
              }
              style={{ marginBottom: 16 }}
            >
              <Row gutter={[16, 16]}>
                <Col xs={12}>
                  <Statistic
                    title={<span style={{ color: 'rgba(255,255,255,0.7)' }}>最新价</span>}
                    value={currentMarket?.lastPrice || 0}
                    precision={2}
                    valueStyle={{ color: '#faad14' }}
                  />
                </Col>
                <Col xs={12}>
                  <Statistic
                    title={<span style={{ color: 'rgba(255,255,255,0.7)' }}>24H成交量</span>}
                    value={currentMarket?.volume || 0}
                    valueStyle={{ color: '#13c2c2' }}
                  />
                </Col>
                <Col xs={12}>
                  <Statistic
                    title={<span style={{ color: 'rgba(255,255,255,0.7)' }}>买一价</span>}
                    value={currentMarket?.bidPrice || 0}
                    precision={2}
                    valueStyle={{ color: '#52c41a' }}
                  />
                </Col>
                <Col xs={12}>
                  <Statistic
                    title={<span style={{ color: 'rgba(255,255,255,0.7)' }}>卖一价</span>}
                    value={currentMarket?.askPrice || 0}
                    precision={2}
                    valueStyle={{ color: '#f5222d' }}
                  />
                </Col>
              </Row>
            </Card>

            <Card className="stat-card" title={<span style={{ color: '#fff' }}>📊 我的持仓</span>}>
              <Row gutter={[16, 16]}>
                {SYMBOLS.map(sym => (
                  <Col xs={12} key={sym.symbol}>
                    <div style={{ padding: 12, background: 'rgba(255,255,255,0.05)', borderRadius: 8 }}>
                      <Space>
                        <span style={{ fontSize: 20 }}>{sym.icon}</span>
                        <div>
                          <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>{sym.name}</div>
                          <div style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>
                            {(assets[sym.symbol] || 0).toFixed(2)}
                          </div>
                        </div>
                      </Space>
                    </div>
                  </Col>
                ))}
              </Row>
            </Card>
          </Col>

          <Col xs={24} md={8}>
            <Card className="stat-card" title={<span style={{ color: '#fff' }}>📖 全服订单簿</span>}>
              <Tabs size="small" items={[
                {
                  key: 'sell',
                  label: '卖盘',
                  children: (
                    <List size="small">
                      {orderBook.sellOrders.slice(0, 10).map((o: ExchangeOrder) => (
                        <List.Item key={o.id} style={{ padding: '4px 0' }}>
                          <span style={{ color: '#f5222d' }}>💰 {o.price.toFixed(2)}</span>
                          <span style={{ color: 'rgba(255,255,255,0.6)' }}>{(o.total_amount - o.filled_amount).toFixed(2)}</span>
                        </List.Item>
                      ))}
                      {orderBook.sellOrders.length === 0 && (
                        <div style={{ textAlign: 'center', padding: 20, color: 'rgba(255,255,255,0.4)' }}>暂无卖盘</div>
                      )}
                    </List>
                  ),
                },
                {
                  key: 'buy',
                  label: '买盘',
                  children: (
                    <List size="small">
                      {orderBook.buyOrders.slice(0, 10).map((o: ExchangeOrder) => (
                        <List.Item key={o.id} style={{ padding: '4px 0' }}>
                          <span style={{ color: '#52c41a' }}>💰 {o.price.toFixed(2)}</span>
                          <span style={{ color: 'rgba(255,255,255,0.6)' }}>{(o.total_amount - o.filled_amount).toFixed(2)}</span>
                        </List.Item>
                      ))}
                      {orderBook.buyOrders.length === 0 && (
                        <div style={{ textAlign: 'center', padding: 20, color: 'rgba(255,255,255,0.4)' }}>暂无买盘</div>
                      )}
                    </List>
                  ),
                },
              ]} />
            </Card>
          </Col>
        </Row>
      ),
    },
    {
      key: 'orders',
      label: '我的订单',
      children: (
        <Table dataSource={orders} columns={orderColumns} rowKey="id" size="small" pagination={{ pageSize: 10 }} />
      ),
    },
    {
      key: 'trades',
      label: '成交记录',
      children: (
        <Table dataSource={trades} columns={tradeColumns} rowKey="id" size="small" pagination={{ pageSize: 10 }} />
      ),
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
            title={<span style={{ color: '#fff' }}><SwapOutlined /> 金融业务</span>}
          >
            <Tabs
              activeKey={activeTab}
              onChange={setActiveTab}
              items={[
                {
                  key: 'exchange',
                  label: '🏛️ 跨服交易所',
                  children: <Tabs type="card" size="small" items={exchangeTabItems} />,
                },
                {
                  key: 'bonds',
                  label: `📜 债券 (${bonds.length})`,
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
                  label: `💸 贷款 (${loans.length})`,
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

      <Modal title={`${symbolInfo.icon} ${symbolInfo.name} - ${orderType === 'buy' ? '买入' : '卖出'}`} open={orderModal} onCancel={() => setOrderModal(false)} footer={null}>
        <Tabs activeKey={orderType} onChange={k => setOrderType(k as 'buy' | 'sell')} items={[
          { key: 'buy', label: '买入' },
          { key: 'sell', label: '卖出' },
        ]} />
        <Form onFinish={handleSubmitOrder} layout="vertical">
          <Form.Item label="交易品种">
            <Select value={activeSymbol} onChange={setActiveSymbol} style={{ width: '100%' }}>
              {SYMBOLS.map(sym => (
                <Option key={sym.symbol} value={sym.symbol}>{sym.icon} {sym.name}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="price" label="价格（金币）" rules={[{ required: true }]} initialValue={currentMarket?.lastPrice || symbolInfo.basePrice}>
            <InputNumber min={0.01} step={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="amount" label="数量" rules={[{ required: true }]} initialValue={1}>
            <InputNumber min={0.01} step={1} style={{ width: '100%' }} />
          </Form.Item>
          <div style={{ padding: 12, background: 'rgba(255,255,255,0.05)', borderRadius: 8, marginBottom: 16 }}>
            <Row>
              <Col span={12}><span style={{ color: 'rgba(255,255,255,0.6)' }}>预计总额:</span></Col>
              <Col span={12} style={{ textAlign: 'right', color: '#faad14', fontWeight: 'bold' }}>💰 --</Col>
            </Row>
            <Row>
              <Col span={12}><span style={{ color: 'rgba(255,255,255,0.6)' }}>可用余额:</span></Col>
              <Col span={12} style={{ textAlign: 'right', color: '#fff' }}>💰 {company?.total_assets?.toLocaleString() || 0}</Col>
            </Row>
            {orderType === 'sell' && (
              <Row>
                <Col span={12}><span style={{ color: 'rgba(255,255,255,0.6)' }}>持仓数量:</span></Col>
                <Col span={12} style={{ textAlign: 'right', color: '#13c2c2' }}>{(assets[activeSymbol] || 0).toFixed(2)}</Col>
              </Row>
            )}
          </div>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={orderLoading} block danger={orderType === 'sell'}>
              {orderType === 'buy' ? '确认买入' : '确认卖出'}
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
