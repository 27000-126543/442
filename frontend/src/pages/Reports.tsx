import { useEffect, useState, useRef } from 'react';
import { Card, Row, Col, Button, Statistic, Typography, Space, Tag, message } from 'antd';
import { FileTextOutlined, DownloadOutlined, RiseOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { reportApi } from '../api';
import { useAppStore } from '../store';
import jsPDF from 'jspdf';
import dayjs from 'dayjs';

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
  const [exporting, setExporting] = useState(false);

  const trendChartRef = useRef<any>(null);
  const pieChartRef = useRef<any>(null);
  const radarChartRef = useRef<any>(null);
  const heatmapChartRef = useRef<any>(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    reportApi.getSummary().then(s => setSummary(s)).finally(() => setLoading(false));
  };

  const handleExportPDF = async () => {
    if (!summary) return;
    setExporting(true);
    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();
      let y = 20;

      doc.setFontSize(20);
      doc.text('跨维度商业帝国 - 产业周报', pageWidth / 2, y, { align: 'center' });
      y += 10;

      doc.setFontSize(10);
      doc.text(`商会: ${summary.company?.name || ''}`, 20, y);
      doc.text(`生成时间: ${dayjs(summary.generated_at).format('YYYY-MM-DD HH:mm')}`, 20, y + 6);
      y += 18;

      doc.setFontSize(14);
      doc.text('一、商会概览', 20, y);
      y += 8;
      doc.setFontSize(10);
      doc.text(`总资产: ${(summary.company?.total_assets || 0).toLocaleString()} 金币`, 25, y);
      doc.text(`商会等级: Lv.${summary.company?.level || 1}`, 25, y + 6);
      doc.text(`跨维度影响力: ${summary.company?.influence || 0}`, 25, y + 12);
      y += 22;

      if (trendChartRef.current) {
        const imgData = trendChartRef.current.getEchartsInstance().getDataURL({
          type: 'png', pixelRatio: 2, backgroundColor: '#1a1a2e'
        });
        doc.setFontSize(12);
        doc.text('二、近7天收入趋势', 20, y);
        y += 6;
        const imgWidth = pageWidth - 40;
        const imgHeight = imgWidth * 0.4;
        doc.addImage(imgData, 'PNG', 20, y, imgWidth, imgHeight);
        y += imgHeight + 12;
      }

      if (y > 250) { doc.addPage(); y = 20; }

      if (pieChartRef.current || radarChartRef.current) {
        doc.setFontSize(12);
        doc.text('三、资产与能力分布', 20, y);
        y += 6;

        const halfWidth = (pageWidth - 50) / 2;
        const chartHeight = halfWidth * 0.8;

        if (pieChartRef.current) {
          const imgData = pieChartRef.current.getEchartsInstance().getDataURL({
            type: 'png', pixelRatio: 2, backgroundColor: '#1a1a2e'
          });
          doc.addImage(imgData, 'PNG', 20, y, halfWidth, chartHeight);
        }

        if (radarChartRef.current) {
          const imgData = radarChartRef.current.getEchartsInstance().getDataURL({
            type: 'png', pixelRatio: 2, backgroundColor: '#1a1a2e'
          });
          doc.addImage(imgData, 'PNG', 30 + halfWidth, y, halfWidth, chartHeight);
        }
        y += chartHeight + 12;
      }

      if (y > 250) { doc.addPage(); y = 20; }

      doc.setFontSize(12);
      doc.text('四、事业部详情', 20, y);
      y += 8;
      doc.setFontSize(10);
      for (const d of summary.departments || []) {
        doc.text(`• ${d.name} (Lv.${d.level}): 周收入 ${(d.weekly_income || 0).toLocaleString()} 金币`, 25, y);
        y += 6;
      }
      y += 6;

      doc.setFontSize(12);
      doc.text('五、本周事件统计', 20, y);
      y += 8;
      doc.setFontSize(10);
      if (summary.event_frequency?.length > 0) {
        for (const e of summary.event_frequency) {
          doc.text(`• ${e.type}: ${e.count} 次`, 25, y);
          y += 6;
        }
      } else {
        doc.text('本周暂无事件', 25, y);
        y += 6;
      }

      doc.save(`产业周报-${dayjs().format('YYYYMMDD')}.pdf`);
      message.success('PDF报告已下载');
    } catch (e) {
      console.error(e);
      message.error('导出失败');
    } finally { setExporting(false); }
  };

  const incomeCurveOption = summary ? (() => {
    const dailyData = summary?.daily_income || [];
    const dates = Array.from(new Set(dailyData.map((d: any) => d.date))).sort();
    const depts = Object.keys(deptNames);

    return {
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis' },
      legend: { data: Object.values(deptNames), textStyle: { color: '#fff' } },
      grid: { left: 60, right: 20, top: 40, bottom: 30 },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: dates.map(d => d.slice(5)),
        axisLine: { lineStyle: { color: '#555' } },
        axisLabel: { color: '#aaa' },
      },
      yAxis: {
        type: 'value',
        axisLine: { lineStyle: { color: '#555' } },
        axisLabel: { color: '#aaa' },
        splitLine: { lineStyle: { color: '#333' } },
      },
      series: depts.map(dept => {
        const data = dates.map(date => {
          const item = dailyData.find((d: any) => d.date === date && d.department === dept);
          return item ? item.amount : 0;
        });
        return {
          name: deptNames[dept],
          type: 'line',
          smooth: true,
          symbol: 'circle',
          symbolSize: 6,
          data,
          itemStyle: { color: deptColors[dept] },
          lineStyle: { color: deptColors[dept], width: 2 },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: deptColors[dept] + '40' },
                { offset: 1, color: deptColors[dept] + '00' },
              ],
            },
          },
        };
      }),
    };
  })() : {};

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
          <Button type="primary" icon={<FileTextOutlined />} onClick={handleExportPDF} loading={exporting}>导出PDF</Button>
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
          <Card className="stat-card" title={<span style={{ color: '#fff' }}>📈 近7天收入趋势</span>}>
            <ReactECharts ref={trendChartRef} option={incomeCurveOption} style={{ height: 300 }} theme="dark" />
          </Card>
        </Col>
        <Col xs={24} md={10}>
          <Card className="stat-card" title={<span style={{ color: '#fff' }}>🍩 资产分布饼图</span>}>
            <ReactECharts ref={pieChartRef} option={pieOption} style={{ height: 300 }} theme="dark" />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={12}>
          <Card className="stat-card" title={<span style={{ color: '#fff' }}>🎯 事业部能力雷达图</span>}>
            <ReactECharts ref={radarChartRef} option={radarOption} style={{ height: 300 }} theme="dark" />
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card className="stat-card" title={<span style={{ color: '#fff' }}>🔥 收入热力图</span>}>
            <ReactECharts ref={heatmapChartRef} option={heatmapOption} style={{ height: 300 }} theme="dark" />
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
