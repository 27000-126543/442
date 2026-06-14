import { useEffect, useState } from 'react';
import {
  Row, Col, Card, Button, Table, Modal, Form, Input, Select,
  Tag, Space, message, Typography, Progress, Rate, Avatar
} from 'antd';
import { PlusOutlined, BulbOutlined, LikeOutlined, ShareAltOutlined, TrophyOutlined } from '@ant-design/icons';
import { cultureApi, authApi } from '../api';
import type { Artwork, Festival, Department } from '../types';
import { useAppStore } from '../store';
import dayjs from 'dayjs';

const { Title, Paragraph } = Typography;
const { Option } = Select;

const categoryMap: Record<string, string> = {
  music: '🎵 音乐',
  dance: '💃 舞蹈',
  food: '🍜 美食',
  art: '🎨 艺术',
  mixed: '🎭 综合',
};

export default function Culture() {
  const departments = useAppStore(s => s.departments);
  const dept = departments.find((d: Department) => d.type === 'culture');

  const [festivals, setFestivals] = useState<Festival[]>([]);
  const [myArtworks, setMyArtworks] = useState<Artwork[]>([]);
  const [allArtworks, setAllArtworks] = useState<Artwork[]>([]);
  const [artworkModal, setArtworkModal] = useState(false);
  const [festivalModal, setFestivalModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [upgradeLoading, setUpgradeLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [f, m, a] = await Promise.all([
        cultureApi.getActiveFestivals(),
        cultureApi.getMyArtworks(),
        cultureApi.getAllArtworks(),
      ]);
      setFestivals(f);
      setMyArtworks(m);
      setAllArtworks(a);
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpgrade = async () => {
    setUpgradeLoading(true);
    try {
      await authApi.upgradeDepartment('culture');
      message.success('文化部升级成功！');
      const data = await authApi.getMyCompany();
      useAppStore.getState().setDepartments(data.departments);
      useAppStore.getState().setCompany(data.company);
    } catch (e: any) {
      message.error(e.response?.data?.error || '升级失败');
    } finally {
      setUpgradeLoading(false);
    }
  };

  const handleSubmitArtwork = async (values: any) => {
    setLoading(true);
    try {
      await cultureApi.submitArtwork(values);
      message.success('作品已提交！');
      setArtworkModal(false);
      loadData();
    } catch (e: any) {
      message.error(e.response?.data?.error || '操作失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateFestival = async (values: any) => {
    setLoading(true);
    try {
      await cultureApi.createFestival(values);
      message.success('艺术节已创建！');
      setFestivalModal(false);
      loadData();
    } catch (e: any) {
      message.error(e.response?.data?.error || '操作失败');
    } finally {
      setLoading(false);
    }
  };

  const handleVote = async (artwork: Artwork) => {
    try {
      await cultureApi.voteArtwork(artwork.id);
      message.success('投票成功！');
      loadData();
    } catch (e: any) {
      message.error(e.response?.data?.error || '投票失败');
    }
  };

  const handleShare = async (artwork: Artwork) => {
    try {
      await cultureApi.shareArtwork(artwork.id);
      message.success('转发成功！可能会获得额外金币奖励');
      loadData();
    } catch (e: any) {
      message.error(e.response?.data?.error || '转发失败');
    }
  };

  const artworkColumns = (showOps: boolean) => [
    {
      title: '作品',
      key: 'art',
      render: (_: any, r: Artwork) => (
        <Space>
          <Avatar style={{ background: 'linear-gradient(135deg, #722ed1, #13c2c2)' }}>{r.category[0].toUpperCase()}</Avatar>
          <div>
            <div style={{ color: '#fff', fontWeight: 'bold' }}>{r.title}</div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>{r.description?.slice(0, 30)}...</div>
          </div>
        </Space>
      ),
    },
    { title: '类别', dataIndex: 'category', key: 'cat', render: (c: string) => <Tag color="purple">{categoryMap[c] || c}</Tag> },
    {
      title: '创意评分',
      dataIndex: 'creativity_score',
      key: 'score',
      render: (v: number) => (
        <div>
          <Rate disabled allowHalf value={v / 20} />
          <div style={{ color: '#faad14', fontSize: 12 }}>{v.toFixed(0)}</div>
        </div>
      ),
    },
    { title: '观众投票', dataIndex: 'audience_votes', key: 'votes', render: (v: number) => <Tag color="blue"><LikeOutlined /> {v}</Tag> },
    {
      title: '综合得分',
      dataIndex: 'total_score',
      key: 'total',
      render: (v: number) => (
        <div>
          <Progress percent={v} size="small" strokeColor={{ from: '#722ed1', to: '#13c2c2' }} showInfo={false} style={{ width: 100 }} />
          <div style={{ color: '#13c2c2', fontWeight: 'bold' }}>{v.toFixed(1)}</div>
        </div>
      ),
    },
    { title: '转发量', dataIndex: 'share_count', key: 'share', render: (v: number) => <Tag color="green"><ShareAltOutlined /> {v}</Tag> },
    {
      title: '提交时间',
      dataIndex: 'submitted_at',
      key: 'time',
      render: (t: number) => <span style={{ color: 'rgba(255,255,255,0.5)' }}>{dayjs(t).fromNow()}</span>,
    },
    ...(showOps ? [{
      title: '操作',
      key: 'ops',
      render: (_: any, r: Artwork) => (
        <Space>
          <Button size="small" icon={<LikeOutlined />} onClick={() => handleVote(r)}>投票</Button>
          <Button size="small" icon={<ShareAltOutlined />} type="primary" onClick={() => handleShare(r)}>转发</Button>
        </Space>
      ),
    }] : []),
  ];

  return (
    <div>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <Title level={3} style={{ color: '#fff', margin: 0 }} className="glow-text">
            🎨 文化部
          </Title>
          <Paragraph style={{ color: 'rgba(255,255,255,0.6)', margin: '8px 0 0 0' }}>
            举办跨宇宙艺术节，提交作品获得评分与全服转发奖励
          </Paragraph>
        </div>
        <Space>
          <Tag color="purple" style={{ fontSize: 16, padding: '4px 12px' }}>Lv.{dept?.level || 1}</Tag>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleUpgrade} loading={upgradeLoading}>
            升级 ({(dept?.level || 1) * 10000} 金币)
          </Button>
        </Space>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {festivals.map(f => (
          <Col xs={24} md={8} key={f.id}>
            <Card
              className="stat-card"
              title={<span style={{ color: '#fff' }}><TrophyOutlined /> {f.name}</span>}
              extra={<Tag color="green">进行中</Tag>}
            >
              <Space direction="vertical" style={{ width: '100%' }}>
                <Tag color="purple">{categoryMap[f.category]}</Tag>
                <div style={{ color: 'rgba(255,255,255,0.7)' }}>参赛商会: <b style={{ color: '#faad14' }}>{f.total_participants}</b></div>
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>
                  {dayjs(f.start_time).format('MM-DD')} ~ {dayjs(f.end_time).format('MM-DD')}
                </div>
              </Space>
            </Card>
          </Col>
        ))}
        <Col xs={24} md={8}>
          <Card
            className="stat-card"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 140 }}
            styles={{ body: { textAlign: 'center' } }}
          >
            <Button type="dashed" icon={<PlusOutlined />} onClick={() => setFestivalModal(true)}>
              举办新艺术节
            </Button>
          </Card>
        </Col>
      </Row>

      <Card
        className="stat-card"
        title={<span style={{ color: '#fff' }}><BulbOutlined /> 我提交的作品</span>}
        extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => setArtworkModal(true)}>提交作品</Button>}
        style={{ marginBottom: 16 }}
      >
        {myArtworks.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.5)' }}>
            还没有提交作品，快去创作吧！
          </div>
        ) : (
          <Table dataSource={myArtworks} columns={artworkColumns(true)} rowKey="id" size="small" pagination={false} />
        )}
      </Card>

      <Card
        className="stat-card"
        title={<span style={{ color: '#fff' }}>🏆 全服热门作品榜</span>}
      >
        <Table dataSource={allArtworks} columns={artworkColumns(true)} rowKey="id" size="small" pagination={{ pageSize: 10 }} />
      </Card>

      <Modal title="提交作品" open={artworkModal} onCancel={() => setArtworkModal(false)} footer={null}>
        <Form onFinish={handleSubmitArtwork} layout="vertical">
          <Form.Item name="title" label="作品标题" rules={[{ required: true }]}>
            <Input placeholder="给你的作品起个响亮的名字" />
          </Form.Item>
          <Form.Item name="description" label="作品描述" rules={[{ required: true }]}>
            <Input.TextArea rows={3} placeholder="描述你的创作灵感" />
          </Form.Item>
          <Form.Item name="category" label="作品类别" rules={[{ required: true }]}>
            <Select placeholder="选择类别">
              <Option value="music">🎵 音乐</Option>
              <Option value="dance">💃 舞蹈</Option>
              <Option value="food">🍜 美食</Option>
              <Option value="art">🎨 艺术</Option>
            </Select>
          </Form.Item>
          <Form.Item name="festivalId" label="参赛艺术节（可选）">
            <Select placeholder="选择要参加的艺术节" allowClear>
              {festivals.map(f => (
                <Option key={f.id} value={f.id}>{f.name}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block>提交</Button>
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="举办艺术节" open={festivalModal} onCancel={() => setFestivalModal(false)} footer={null}>
        <Form onFinish={handleCreateFestival} layout="vertical">
          <Form.Item name="name" label="艺术节名称" rules={[{ required: true }]}>
            <Input placeholder="例如：银河音乐节" />
          </Form.Item>
          <Form.Item name="category" label="类别" rules={[{ required: true }]} initialValue="mixed">
            <Select>
              <Option value="music">🎵 音乐</Option>
              <Option value="dance">💃 舞蹈</Option>
              <Option value="food">🍜 美食</Option>
              <Option value="art">🎨 艺术</Option>
              <Option value="mixed">🎭 综合</Option>
            </Select>
          </Form.Item>
          <Form.Item name="durationDays" label="持续天数" initialValue={7}>
            <InputNumber min={1} max={30} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block>举办</Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
