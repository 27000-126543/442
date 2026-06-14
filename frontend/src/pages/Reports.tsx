import { useEffect, useState } from 'react';
import { Card, Row, Col, Button, Statistic, Typography, Space, Tag, message } from 'antd';
import { FileTextOutlined, DownloadOutlined, RiseOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { reportApi } from '../api';
import { useAppStore } from '../store';

const { Title, Paragraph } = Typography;

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

export default function Reports() {
  const company = useAppStore(s => s.company);
  const departments = useAppStore(s => s.departments);

  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    reportApi.getSummary().then(s => setSummary(s)).finally(() => setLoading(false));
  };

  const handleExportPDF = async () => {
    try {
      await reportApi.downloadPDF();
      message.success('PDF报告已下载');
    } catch (e) {
      message.error('导出失败');
    }
  };

  const incomeCurveOption = summary ? {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis' },
    legend: { data: Object.values(deptNames), textStyle: { color: '#fff' } },
    grid: { left: 50, right: 20, top: 40, bottom: 30 },
    xAxis: {
      type: 'category',
      data: Array.from({ length: 7 }, (_, i) => `Day ${7 - i}`),
      axisLine: { lineStyle: { color: '#555' } },
      axisLabel: { color: '#aaa' },
    },
    yAxis: { type: 'value', axisLine: { lineStyle: { color: '#555' } }, axisLabel: { color: '#aaa' } },
    series: Object.keys(deptNames).map(dept => {
      const deptData = summary?.asset_distribution?.find((d: any) => d.department === dept);
      return {
        name: deptNames[dept],
        type: 'bar',
        stack: 'total',
        emphasis: { focus: 'series' },
        data: [deptData?.total || 0, 0, 0, 0, 0, 0, 0],
        itemStyle: { color: deptColors[dept] },
      };
    }),
  } : {};

  const pieOption = summary ? {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'item' },
    legend: { bottom: 0, textStyle: { color: '#fff' } },
    series: [{
      type: 'pie',
      radius: ['40%', '70%'],
      avoidLabelOverlap: false,
      itemStyle: { borderRadius: 10, borderColor: '#000', borderWidth: 2 },
      label: { show: true, color: '#fff' },
      data: summary?.asset_distribution?.map((d: any) => ({
        name: deptNames[d.department],
        value: Math.abs(d.total || 0),
        itemStyle: { color: deptColors[d.department] },
      })),
    }],
  } : {};

  const radarOption = summary ? {
    backgroundColor: 'transparent',
    tooltip: {},
    radar: {
      indicator: summary?.departments?.map((d: any) => ({ name: d.name, max: 20 })),
      axisName: { color: '#fff' },
    },
    series: [{
      type: 'radar',
      data: [{
        value: summary?.departments?.map((d: any) => d.level),
        name: '事业部能力',
        areaStyle: { color: 'rgba(114, 46, 209, 0.3)' },
        lineStyle: { color: '#722ed1' },
        itemStyle: { color: '#722ed1' },
      }],
    }],
  } : {};

  const heatmapOption = summary ? {
    backgroundColor: 'transparent',
    tooltip: { position: 'top' },
    grid: { height: '60%', top: '10%' },
    xAxis: {
      type: 'category',
      data: ['运输', '金融', '情报', '文化'],
      splitArea: { show: true },
      axisLabel: { color: '#aaa' },
    },
    yAxis: {
      type: 'category',
      data: ['收入', ''],
      splitArea: { show: true },
      axisLabel: { color: '#aaa' },
    },
    visualMap: {
      min: 0,
      max: Math.max(...(summary?.departments?.map((d: any) => d.weekly_income) || [1])),
      calculable: true,
      orient: 'horizontal',
      left: 'center',
      bottom: '5%',
      inRange: { color: ['#722ed1', '#13c2c2'] }
    },
    series: [{
      name: '收入',
      type: 'heatmap',
      data: summary?.departments?.map((d: any, i: number) => [i, 0, d.weekly_income]),
      label: { show: true, color: '#fff' },
      emphasis: {
        itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0, 0, 0, 0.5)' }
      },
    }],
  } : {};

  return (
    <div>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <Title level={3} style={{ color: '#fff', margin: 0 }} className="glow-text">📊 产业报告</Title>
          <Paragraph style={{ color: 'rgba(255,255,255,0.6)', margin: '8px 0 0 0' }}>
            收入曲线、资产分布热力图、事件频率分析
          </Paragraph>
        </div>
        <Space>
          <Button icon={<DownloadOutlined />} onClick={loadData} loading={loading}>刷新数据</Button>
          <Button type="primary" icon={<FileTextOutlined />} onClick={handleExportPDF}>导出PDF</Button>
        </Space>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={8}>
          <Card className="stat-card">
            <Statistic title={<span style={{ color: 'rgba(255,255,255,0.7)' }}>商会总资产</span>} value={summary?.company?.total_assets || 0} valueStyle={{ color: '#faad14', fontSize: 28 }} />
          </Card>
        </Col>
        <Col xs={8}>
          <Card className="stat-card">
            <Statistic title={<span style={{ color: 'rgba(255,255,255,0.7)' }}>影响力</span>} value={summary?.company?.influence || 0} valueStyle={{ color: '#722ed1', fontSize: 28 }} />
          </Card>
        </Col>
        <Col xs={8}>
          <Card className="stat-card">
            <Statistic title={<span style={{ color: 'rgba(255,255,255,0.7)' }}>商会等级</span>} value={summary?.company?.level || 1} valueStyle={{ color: '#13c2c2', fontSize: 28 }} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={14}>
          <Card className="stat-card" title={<span style={{ color: '#fff' }}>📈 收入分布柱状图</span>}>
            <ReactECharts option={incomeCurveOption} style={{ height: 300 }} theme="dark" />
          </Card>
        </Col>
        <Col xs={24} md={10}>
          <Card className="stat-card" title={<span style={{ color: '#fff' }}>🍩 资产分布饼图</span>}>
            <ReactECharts option={pieOption} style={{ height: 300 }} theme="dark" />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={12}>
          <Card className="stat-card" title={<span style={{ color: '#fff' }}>🎯 事业部能力雷达图</span>}>
            <ReactECharts option={radarOption} style={{ height: 300 }} theme="dark" />
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card className="stat-card" title={<span style={{ color: '#fff' }}>🔥 收入热力图</span>}>
            <ReactECharts option={heatmapOption} style={{ height: 300 }} theme="dark" />
          </Card>
        </Col>
      </Row>

      <Card className="stat-card" title={<span style={{ color: '#fff' }}>📋 事件频率统计</span>}>
        <Space wrap>
          {summary?.event_frequency?.length > 0 ? summary.event_frequency.map((e: any) => (
            <Tag key={e.type} color="purple" style={{ fontSize: 14, padding: '8px 16px' }}>
              {e.type}: {e.count} 次
            </Tag>
          )) : <span style={{ color: 'rgba(255,255,255,0.5)' }}>本周暂无事件</span>}
        </Space>
      </Card>
    </div>
  );
}
