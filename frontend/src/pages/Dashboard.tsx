import { useEffect, useState } from 'react';
import { Row, Col, Card, Statistic, Progress, Typography, Space, Tag, List, Empty } from 'antd';
import {
  RocketOutlined,
  DollarOutlined,
  EyeOutlined,
  BulbOutlined,
  RiseOutlined,
  ThunderboltOutlined,
  FireOutlined,
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import dayjs from 'dayjs';
import { useAppStore } from '../store';
import { eventApi, reportApi, financeApi } from '../api';
import type { GameEvent, IncomeRecord } from '../types';

const { Title, Paragraph } = Typography;

const deptIcons: Record<string, any> = {
  transport: <RocketOutlined style={{ color: '#13c2c2' }} />,
  finance: <DollarOutlined style={{ color: '#faad14' }} />,
  intelligence: <EyeOutlined style={{ color: '#f5222d' }} />,
  culture: <BulbOutlined style={{ color: '#722ed1' }} />,
};

const deptNames: Record<string, string> = {
  transport: '运输部',
  finance: '金融部',
  intelligence: '情报部',
  culture: '文化部',
};

const deptColors: Record<string, string> = {
  transport: '#13c2c2',
  finance: '#faad14',
  intelligence: '#f5222d',
  culture: '#722ed1',
};

export default function Dashboard() {
  const company = useAppStore(s => s.company);
  const departments = useAppStore(s => s.departments);
  const economy = useAppStore(s => s.economy);

  const [events, setEvents] = useState<GameEvent[]>([]);
  const [incomeData, setIncomeData] = useState<IncomeRecord[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!economy) {
      financeApi.getEconomy().then(e => useAppStore.getState().setEconomy(e)).catch(() => {});
    }
  }, [economy]);

  const loadData = async () => {
    try {
      const [evts, inc] = await Promise.all([eventApi.getEvents(), reportApi.getIncome(7)]);
      setEvents(evts.filter(e => !e.read).slice(0, 10));
      setIncomeData(inc);
    } catch (e) {
      console.error(e);
    }
  };

  const incomeChartOption = {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis' },
    legend: {
      data: ['运输部', '金融部', '情报部', '文化部'],
      textStyle: { color: '#fff' },
    },
    grid: { left: 50, right: 20, top: 40, bottom: 30 },
    xAxis: {
      type: 'time',
      axisLine: { lineStyle: { color: '#555' } },
      axisLabel: { color: '#aaa' },
    },
    yAxis: {
      type: 'value',
      axisLine: { lineStyle: { color: '#555' } },
      axisLabel: { color: '#aaa' },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
    },
    series: ['transport', 'finance', 'intelligence', 'culture'].map((dept, i) => {
      const colors = ['#13c2c2', '#faad14', '#f5222d', '#722ed1'];
      const data = incomeData.filter(r => r.department === dept).map(r => [r.timestamp, r.amount]);
      return {
        name: deptNames[dept],
        type: 'line',
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 2, color: colors[i] },
        areaStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [{ offset: 0, color: colors[i] + '60' }, { offset: 1, color: colors[i] + '00' }],
          },
        },
        data,
      };
    }),
  };

  const radarOption = {
    backgroundColor: 'transparent',
    tooltip: {},
    radar: {
      indicator: departments.map(d => ({ name: d.name, max: Math.max(...departments.map(x => x.level)) + 5 })),
      axisName: { color: '#fff' },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
      splitArea: { areaStyle: { color: ['rgba(114,46,209,0.05)', 'rgba(19,194,194,0.05)'] } },
    },
    series: [{
      type: 'radar',
      data: [{
        value: departments.map(d => d.level),
        name: '事业部等级',
        areaStyle: { color: 'rgba(114, 46, 209, 0.3)' },
        lineStyle: { color: '#722ed1' },
        itemStyle: { color: '#722ed1' },
      }],
    }],
  };

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Title level={3} style={{ color: '#fff', margin: 0 }} className="glow-text">
          🎮 控制中心
        </Title>
        <Paragraph style={{ color: 'rgba(255,255,255,0.6)', margin: '8px 0 0 0' }}>
          实时监控你的跨维度商业帝国
        </Paragraph>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} md={6}>
          <Card className="stat-card" styles={{ body: { padding: 20 } }}>
            <Statistic
              title={<span style={{ color: 'rgba(255,255,255,0.7)' }}>商会总资产</span>}
              value={company?.total_assets || 0}
              precision={0}
              prefix={<DollarOutlined style={{ color: '#faad14' }} />}
              valueStyle={{ color: '#faad14', fontSize: 24 }}
            />
            <Tag color="gold" style={{ marginTop: 8 }}>Lv.{company?.level || 1}</Tag>
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card className="stat-card" styles={{ body: { padding: 20 } }}>
            <Statistic
              title={<span style={{ color: 'rgba(255,255,255,0.7)' }}>跨维度影响力</span>}
              value={company?.influence || 0}
              prefix={<ThunderboltOutlined style={{ color: '#722ed1' }} />}
              valueStyle={{ color: '#722ed1', fontSize: 24 }}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card className="stat-card" styles={{ body: { padding: 20 } }}>
            <Statistic
              title={<span style={{ color: 'rgba(255,255,255,0.7)' }}>全服市场指数</span>}
              value={economy?.market_index || 1000}
              precision={0}
              prefix={<RiseOutlined style={{ color: '#13c2c2' }} />}
              valueStyle={{ color: '#13c2c2', fontSize: 24 }}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card className="stat-card" styles={{ body: { padding: 20 } }}>
            <Statistic
              title={<span style={{ color: 'rgba(255,255,255,0.7)' }}>通胀率</span>}
              value={(economy?.inflation_rate || 0) * 100}
              precision={2}
              suffix="%"
              prefix={(economy?.inflation_rate || 0) > 0 ? <FireOutlined style={{ color: '#f5222d' }} /> : <RiseOutlined style={{ color: '#52c41a' }} />}
              valueStyle={{ color: (economy?.inflation_rate || 0) > 0 ? '#f5222d' : '#52c41a', fontSize: 24 }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {departments.map(dept => (
          <Col xs={12} md={6} key={dept.id}>
            <Card
              className="stat-card"
              styles={{ body: { padding: 20 } }}
              title={
                <Space>
                  {deptIcons[dept.type]}
                  <span style={{ color: '#fff' }}>{dept.name}</span>
                </Space>
              }
              extra={<Tag color={deptColors[dept.type]}>Lv.{dept.level}</Tag>}
            >
              <Space direction="vertical" style={{ width: '100%' }}>
                <div>
                  <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>本周收入</div>
                  <div style={{ color: deptColors[dept.type], fontSize: 20, fontWeight: 'bold' }}>
                    {dept.weekly_income?.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginBottom: 4 }}>预算使用</div>
                  <Progress
                    percent={Math.min(100, dept.budget > 0 ? (dept.weekly_income / dept.budget) * 100 : 0)}
                    strokeColor={deptColors[dept.type]}
                    showInfo={false}
                    size="small"
                  />
                </div>
              </Space>
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={16}>
          <Card
            className="stat-card"
            title={<span style={{ color: '#fff' }}>📈 近7日收入曲线</span>}
            styles={{ body: { padding: 20 } }}
          >
            <ReactECharts option={incomeChartOption} style={{ height: 300 }} theme="dark" />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card
            className="stat-card"
            title={<span style={{ color: '#fff' }}>🎯 事业部能力雷达</span>}
            styles={{ body: { padding: 20 } }}
          >
            <ReactECharts option={radarOption} style={{ height: 300 }} theme="dark" />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} md={24}>
          <Card
            className="stat-card"
            title={<span style={{ color: '#fff' }}>🔔 最新事件</span>}
            styles={{ body: { padding: 12 } }}
          >
            {events.length === 0 ? (
              <Empty description="暂无新事件" />
            ) : (
              <List
                dataSource={events}
                renderItem={item => (
                  <List.Item style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <List.Item.Meta
                      avatar={
                        <Tag color={item.impact >= 0 ? 'green' : 'red'}>
                          {item.impact >= 0 ? '+' : ''}{item.impact?.toFixed(0)}
                        </Tag>
                      }
                      title={<span style={{ color: '#fff' }}>{item.title}</span>}
                      description={
                        <Space>
                          <span style={{ color: 'rgba(255,255,255,0.6)' }}>{item.description}</span>
                          <Tag>{dayjs(item.timestamp).fromNow()}</Tag>
                        </Space>
                      }
                    />
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}
