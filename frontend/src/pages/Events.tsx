import { useEffect, useState } from 'react';
import { Card, List, Tag, Button, Space, Typography, Badge, Empty } from 'antd';
import dayjs from 'dayjs';
import { eventApi } from '../api';
import type { GameEvent } from '../types';
import { useAppStore } from '../store';

const { Title, Paragraph } = Typography;

const eventTypeMap: Record<string, { label: string; color: string; icon: string }> = {
  caravan_attack: { label: '商队遇袭', color: 'red', icon: '💥' },
  caravan_bonus: { label: '运输收益', color: 'green', icon: '🚀' },
  financial_tsunami: { label: '金融海啸', color: 'red', icon: '🌊' },
  inflation: { label: '通胀', color: 'orange', icon: '📈' },
  deflation: { label: '通缩', color: 'blue', icon: '📉' },
  spy_caught: { label: '间谍暴露', color: 'red', icon: '🚨' },
  spy_success: { label: '情报成功', color: 'green', icon: '🕵️' },
  counter_intelligence: { label: '反间计', color: 'purple', icon: '🔄' },
  subversion: { label: '策反成功', color: 'green', icon: '🤝' },
  festival_bonus: { label: '文化奖励', color: 'purple', icon: '🎨' },
  market_boom: { label: '市场繁荣', color: 'green', icon: '💰' },
};

export default function Events() {
  const [events, setEvents] = useState<GameEvent[]>([]);
  const setUnread = useAppStore(s => s.setUnreadCount);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const data = await eventApi.getEvents();
      setEvents(data);
    } catch (e) { console.error(e); }
  };

  const handleMarkRead = async (id: string) => {
    try {
      await eventApi.markRead(id);
      setEvents(prev => prev.map(e => e.id === id ? { ...e, read: true } : e));
      const r = await eventApi.getUnreadCount();
      setUnread(r.count);
    } catch (e) { console.error(e); }
  };

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Title level={3} style={{ color: '#fff', margin: 0 }} className="glow-text">🔔 事件通知</Title>
        <Paragraph style={{ color: 'rgba(255,255,255,0.6)', margin: '8px 0 0 0' }}>
          实时监控商会和全服的重大商业事件
        </Paragraph>
      </div>

      <Card className="stat-card">
        {events.length === 0 ? (
          <Empty description="暂无事件" />
        ) : (
          <List
            dataSource={events}
            renderItem={item => {
              const meta = eventTypeMap[item.type] || { label: item.type, color: 'default', icon: '📋' };
              return (
                <List.Item
                  style={{
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                    opacity: item.read ? 0.6 : 1,
                  }}
                  actions={[
                    !item.read && <Button size="small" type="link" onClick={() => handleMarkRead(item.id)}>标记已读</Button>,
                  ].filter(Boolean)}
                >
                  <List.Item.Meta
                    avatar={
                      <Badge dot={!item.read} color={meta.color}>
                        <div style={{ fontSize: 32 }}>{meta.icon}</div>
                      </Badge>
                    }
                    title={
                      <Space>
                        <span style={{ color: '#fff', fontSize: 16 }}>{item.title}</span>
                        <Tag color={meta.color}>{meta.label}</Tag>
                        <Tag color={item.impact >= 0 ? 'green' : 'red'}>
                          {item.impact >= 0 ? '+' : ''}{item.impact?.toFixed(0)} 💰
                        </Tag>
                      </Space>
                    }
                    description={
                      <Space direction="vertical">
                        <span style={{ color: 'rgba(255,255,255,0.7)' }}>{item.description}</span>
                        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>{dayjs(item.timestamp).fromNow()}</span>
                      </Space>
                    }
                  />
                </List.Item>
              );
            }}
          />
        )}
      </Card>
    </div>
  );
}
