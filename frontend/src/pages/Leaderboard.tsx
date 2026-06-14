import { useEffect, useState } from 'react';
import { Card, Table, Tag, Button, Space, Typography, Radio, Avatar, Row, Col, Statistic } from 'antd';
import { TrophyOutlined, CrownOutlined, RiseOutlined, RocketOutlined, DollarOutlined, EyeOutlined, BulbOutlined } from '@ant-design/icons';
import { leaderboardApi } from '../api';
import type { LeaderboardEntry } from '../types';
import { useAppStore } from '../store';

const { Title, Paragraph } = Typography;

const rankIcon = (rank: number) => {
  if (rank === 1) return <span style={{ fontSize: 28 }}>🥇</span>;
  if (rank === 2) return <span style={{ fontSize: 28 }}>🥈</span>;
  if (rank === 3) return <span style={{ fontSize: 28 }}>🥉</span>;
  return <Tag color={rank <= 10 ? 'gold' : 'default'} style={{ fontSize: 16, padding: '4px 12px' }}>#{rank}</Tag>;
};

export default function Leaderboard() {
  const user = useAppStore(s => s.user);
  const [sortBy, setSortBy] = useState<'assets' | 'influence' | 'level'>('assets');
  const [data, setData] = useState<LeaderboardEntry[]>([]);
  const [myRank, setMyRank] = useState<LeaderboardEntry | null>(null);

  useEffect(() => { loadData(); }, [sortBy]);

  useEffect(() => {
    if (user?.company_id) {
      leaderboardApi.getMyRank().then(r => setMyRank(r)).catch(() => {});
    }
  }, [user?.company_id, data]);

  const loadData = async () => {
    try {
      const list = await leaderboardApi.getTop(100, sortBy);
      setData(list);
    } catch (e) { console.error(e); }
  };

  const columns = [
    {
      title: '排名',
      dataIndex: 'rank',
      key: 'rank',
      width: 80,
      render: (r: number) => rankIcon(r),
    },
    {
      title: '商会',
      key: 'company',
      render: (_: any, r: LeaderboardEntry) => (
        <Space>
          <Avatar
            style={{
              background: r.rank === 1
                ? 'linear-gradient(135deg, #f5222d, #faad14)'
                : r.rank === 2
                  ? 'linear-gradient(135deg, #8c8c8c, #bfbfbf)'
                  : r.rank === 3
                    ? 'linear-gradient(135deg, #d46b08, #fa8c16)'
                    : 'linear-gradient(135deg, #722ed1, #13c2c2)'
            }}
          >
            {r.company_name[0]}
          </Avatar>
          <div>
            <div style={{ color: '#fff', fontWeight: 'bold', fontSize: 15 }}>{r.company_name}</div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>ID: {r.company_id.slice(0, 8)}</div>
          </div>
          {r.company_id === myRank?.company_id && <Tag color="cyan">我</Tag>}
        </Space>
      ),
    },
    {
      title: <Space><DollarOutlined /> 总资产</Space>,
      dataIndex: 'total_assets',
      key: 'assets',
      sorter: (a, b) => a.total_assets - b.total_assets,
      defaultSortOrder: 'descend' as const,
      render: (v: number) => <span style={{ color: '#faad14', fontWeight: 'bold' }}>💰 {v.toLocaleString()}</span>,
    },
    {
      title: <Space><RocketOutlined /> 运输</Space>,
      dataIndex: 'transport_level',
      key: 't',
      align: 'center' as const,
      render: (v: number) => <Tag color="cyan">Lv.{v}</Tag>,
    },
    {
      title: <Space><DollarOutlined /> 金融</Space>,
      dataIndex: 'finance_level',
      key: 'f',
      align: 'center' as const,
      render: (v: number) => <Tag color="gold">Lv.{v}</Tag>,
    },
    {
      title: <Space><EyeOutlined /> 情报</Space>,
      dataIndex: 'intelligence_level',
      key: 'i',
      align: 'center' as const,
      render: (v: number) => <Tag color="red">Lv.{v}</Tag>,
    },
    {
      title: <Space><BulbOutlined /> 文化</Space>,
      dataIndex: 'culture_level',
      key: 'c',
      align: 'center' as const,
      render: (v: number) => <Tag color="purple">Lv.{v}</Tag>,
    },
    {
      title: <Space><RiseOutlined /> 影响力</Space>,
      dataIndex: 'influence',
      key: 'inf',
      sorter: (a, b) => a.influence - b.influence,
      render: (v: number) => <span style={{ color: '#722ed1', fontWeight: 'bold' }}>⚡ {v.toLocaleString()}</span>,
    },
  ];

  const top3 = data.slice(0, 3);

  return (
    <div>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <Title level={3} style={{ color: '#fff', margin: 0 }} className="glow-text">
            🏆 全服排行榜
          </Title>
          <Paragraph style={{ color: 'rgba(255,255,255,0.6)', margin: '8px 0 0 0' }}>
            跨维度商业帝国顶级商会榜单
          </Paragraph>
        </div>
        <Space>
          <Radio.Group value={sortBy} onChange={e => setSortBy(e.target.value)}>
            <Radio.Button value="assets">按总资产</Radio.Button>
            <Radio.Button value="influence">按影响力</Radio.Button>
            <Radio.Button value="level">按等级</Radio.Button>
          </Radio.Group>
          <Button icon={<RiseOutlined />} onClick={loadData}>刷新</Button>
        </Space>
      </div>

      {myRank && (
        <Card
          className="stat-card"
          style={{ marginBottom: 24, border: '2px solid #13c2c2' }}
          title={<span style={{ color: '#13c2c2' }}>⭐ 我的商会排名</span>}
        >
          <Row gutter={16}>
            <Col xs={8}>
              <Statistic
                title={<span style={{ color: 'rgba(255,255,255,0.7)' }}>全服排名</span>}
                value={myRank.rank}
                prefix={<CrownOutlined style={{ color: '#faad14' }} />}
                suffix={`/ ${data.length}`}
                valueStyle={{ color: '#faad14', fontSize: 28 }}
              />
            </Col>
            <Col xs={8}>
              <Statistic
                title={<span style={{ color: 'rgba(255,255,255,0.7)' }}>总资产</span>}
                value={myRank.total_assets}
                precision={0}
                valueStyle={{ color: '#13c2c2', fontSize: 28 }}
              />
            </Col>
            <Col xs={8}>
              <Statistic
                title={<span style={{ color: 'rgba(255,255,255,0.7)' }}>跨维度影响力</span>}
                value={myRank.influence}
                valueStyle={{ color: '#722ed1', fontSize: 28 }}
              />
            </Col>
          </Row>
        </Card>
      )}

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {top3.map((r, i) => (
          <Col xs={24} md={8} key={r.company_id}>
            <Card
              className="stat-card"
              style={{
                textAlign: 'center',
                transform: i === 0 ? 'scale(1.05)' : 'none',
                border: i === 0 ? '2px solid #faad14' : i === 1 ? '2px solid #8c8c8c' : '2px solid #d46b08',
              }}
            >
              <div style={{ fontSize: 64, marginBottom: 8 }}>
                {i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}
              </div>
              <Avatar
                size={64}
                style={{
                  background: i === 0
                    ? 'linear-gradient(135deg, #f5222d, #faad14)'
                    : i === 1
                      ? 'linear-gradient(135deg, #8c8c8c, #bfbfbf)'
                      : 'linear-gradient(135deg, #d46b08, #fa8c16)',
                  fontSize: 24,
                  fontWeight: 'bold',
                }}
              >
                {r.company_name[0]}
              </Avatar>
              <Title level={4} style={{ color: '#fff', marginTop: 12, marginBottom: 4 }}>{r.company_name}</Title>
              <div style={{ color: '#faad14', fontSize: 24, fontWeight: 'bold' }}>
                💰 {r.total_assets.toLocaleString()}
              </div>
              <Space style={{ marginTop: 12 }}>
                <Tag color="cyan">运 Lv.{r.transport_level}</Tag>
                <Tag color="gold">金 Lv.{r.finance_level}</Tag>
                <Tag color="red">情 Lv.{r.intelligence_level}</Tag>
                <Tag color="purple">文 Lv.{r.culture_level}</Tag>
              </Space>
            </Card>
          </Col>
        ))}
      </Row>

      <Card className="stat-card" title={<span style={{ color: '#fff' }}><TrophyOutlined /> 完整榜单</span>}>
        <Table
          dataSource={data}
          columns={columns}
          rowKey="company_id"
          pagination={{ pageSize: 20, showSizeChanger: false }}
          rowClassName={(r) => r.company_id === myRank?.company_id ? 'ant-table-row-selected' : ''}
        />
      </Card>
    </div>
  );
}
