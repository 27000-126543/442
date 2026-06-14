import { Router, Request, Response } from 'express';
import { authMiddleware, requireCompany } from '../middleware';
import { transportService } from '../services/TransportService';
import { financeService } from '../services/FinanceService';
import { intelligenceService } from '../services/IntelligenceService';
import { cultureService } from '../services/CultureService';
import { eventService } from '../services/EventService';
import { approvalService } from '../services/ApprovalService';
import { exchangeService } from '../services/ExchangeService';
import { leaderboardService, towerService, reportService } from '../services/GameServices';

const router = Router();
router.use(authMiddleware, requireCompany);

// ===== 运输部 =====
router.get('/transport/portals', (req: Request, res: Response) => {
  res.json(transportService.getCompanyPortals(req.user!.company_id!));
});

router.post('/transport/portals', (req: Request, res: Response) => {
  const { name, source, target, riskLevel } = req.body;
  if (!name || !source || !target) return res.status(400).json({ error: '参数缺失' });
  res.json(transportService.createPortal(req.user!.company_id!, name, source, target, riskLevel || 1));
});

router.get('/transport/caravans', (req: Request, res: Response) => {
  res.json(transportService.getCompanyCaravans(req.user!.company_id!));
});

router.post('/transport/caravans', (req: Request, res: Response) => {
  const { name, portalId, goodsValue, guardPower } = req.body;
  if (!name || !portalId || !goodsValue || !guardPower) return res.status(400).json({ error: '参数缺失' });
  res.json(transportService.createCaravan(req.user!.company_id!, name, portalId, goodsValue, guardPower));
});

// ===== 金融部 =====
router.get('/finance/account', (req: Request, res: Response) => {
  res.json(financeService.getOrCreateAccount(req.user!.company_id!));
});

router.post('/finance/deposit', (req: Request, res: Response) => {
  const success = financeService.deposit(req.user!.company_id!, req.body.amount);
  res.json({ success });
});

router.post('/finance/withdraw', (req: Request, res: Response) => {
  const success = financeService.withdraw(req.user!.company_id!, req.body.amount);
  res.json({ success });
});

router.get('/finance/bonds', (req: Request, res: Response) => {
  res.json(financeService.getCompanyBonds(req.user!.company_id!));
});

router.post('/finance/bonds', (req: Request, res: Response) => {
  const { faceValue, interestRate, durationDays } = req.body;
  const bond = financeService.issueBond(req.user!.company_id!, faceValue, interestRate, durationDays);
  if (!bond) return res.status(400).json({ error: '发行债券失败' });
  res.json(bond);
});

router.get('/finance/loans', (req: Request, res: Response) => {
  res.json(financeService.getCompanyLoans(req.user!.company_id!));
});

router.post('/finance/loans', (req: Request, res: Response) => {
  const { borrowerCompanyId, principal, interestRate, durationDays } = req.body;
  const loan = financeService.issueLoan(req.user!.company_id!, borrowerCompanyId, principal, interestRate, durationDays);
  if (!loan) return res.status(400).json({ error: '发放贷款失败' });
  res.json(loan);
});

router.post('/finance/loans/:id/repay', (req: Request, res: Response) => {
  const success = financeService.repayLoan(req.user!.company_id!, req.params.id, req.body.amount);
  res.json({ success });
});

router.get('/finance/economy', (req: Request, res: Response) => {
  res.json(financeService.getCurrentEconomicIndicators());
});

// ===== 跨服交易所 =====
router.get('/exchange/markets', (req: Request, res: Response) => {
  res.json(exchangeService.getAllMarkets());
});

router.get('/exchange/assets', (req: Request, res: Response) => {
  res.json(exchangeService.getCompanyAssets(req.user!.company_id!));
});

router.get('/exchange/orderbook', (req: Request, res: Response) => {
  const symbol = req.query.symbol as string;
  if (!symbol) return res.status(400).json({ error: '缺少交易品种' });
  res.json(exchangeService.getOrderBook(symbol));
});

router.get('/exchange/orders', (req: Request, res: Response) => {
  const symbol = req.query.symbol as string | undefined;
  const status = req.query.status as string | undefined;
  res.json(exchangeService.getCompanyOrders(req.user!.company_id!, symbol, status));
});

router.get('/exchange/orders/:id', (req: Request, res: Response) => {
  const detail = exchangeService.getOrderDetail(req.params.id, req.user!.company_id!);
  if (!detail) return res.status(404).json({ error: '订单不存在' });
  res.json(detail);
});

router.post('/exchange/orders/buy', (req: Request, res: Response) => {
  const { symbol, price, amount } = req.body;
  if (!symbol || !price || !amount) return res.status(400).json({ error: '参数缺失' });
  const order = exchangeService.createBuyOrder(req.user!.company_id!, symbol, price, amount);
  if (!order) return res.status(400).json({ error: '金币不足（需包含1%手续费）或创建失败' });
  res.json(order);
});

router.post('/exchange/orders/sell', (req: Request, res: Response) => {
  const { symbol, price, amount } = req.body;
  if (!symbol || !price || !amount) return res.status(400).json({ error: '参数缺失' });
  const order = exchangeService.createSellOrder(req.user!.company_id!, symbol, price, amount);
  if (!order) return res.status(400).json({ error: '持仓不足或创建失败' });
  res.json(order);
});

router.post('/exchange/orders/:id/cancel', (req: Request, res: Response) => {
  const success = exchangeService.cancelOrder(req.params.id, req.user!.company_id!);
  if (!success) return res.status(400).json({ error: '订单不存在或已完成，无法撤销' });
  res.json({ success: true });
});

router.get('/exchange/trades', (req: Request, res: Response) => {
  const symbol = req.query.symbol as string | undefined;
  res.json(exchangeService.getCompanyTrades(req.user!.company_id!, symbol));
});

router.get('/exchange/trades/:id', (req: Request, res: Response) => {
  const detail = exchangeService.getTradeDetail(req.params.id, req.user!.company_id!);
  if (!detail) return res.status(404).json({ error: '成交记录不存在' });
  res.json(detail);
});

router.get('/exchange/flows', (req: Request, res: Response) => {
  const symbol = req.query.symbol as string | undefined;
  const type = req.query.type as string | undefined;
  res.json(exchangeService.getFundFlows(req.user!.company_id!, symbol, type));
});

// ===== 情报部 =====
router.get('/intelligence/spies', (req: Request, res: Response) => {
  res.json(intelligenceService.getCompanySpies(req.user!.company_id!));
});

router.post('/intelligence/spies', (req: Request, res: Response) => {
  const { name, skill, stealth } = req.body;
  if (!name) return res.status(400).json({ error: '请输入间谍名称' });
  res.json(intelligenceService.createSpy(req.user!.company_id!, name, skill || 50, stealth || 50));
});

router.post('/intelligence/spies/:id/deploy', (req: Request, res: Response) => {
  const { targetCompanyId, mission } = req.body;
  const spy = intelligenceService.deploySpy(req.params.id, req.user!.company_id!, targetCompanyId, mission);
  if (!spy) return res.status(400).json({ error: '部署失败' });
  res.json(spy);
});

router.post('/intelligence/spies/:id/recall', (req: Request, res: Response) => {
  const spy = intelligenceService.recallSpy(req.params.id, req.user!.company_id!);
  if (!spy) return res.status(400).json({ error: '召回失败' });
  res.json(spy);
});

// ===== 文化部 =====
router.get('/culture/festivals', (req: Request, res: Response) => {
  res.json(cultureService.getActiveFestivals());
});

router.get('/culture/festivals/all', (req: Request, res: Response) => {
  res.json(cultureService.getAllFestivals());
});

router.post('/culture/festivals', (req: Request, res: Response) => {
  const { name, category, durationDays } = req.body;
  res.json(cultureService.createFestival(name, category, durationDays || 7));
});

router.get('/culture/artworks', (req: Request, res: Response) => {
  res.json(cultureService.getCompanyArtworks(req.user!.company_id!));
});

router.get('/culture/artworks/all', (req: Request, res: Response) => {
  res.json(cultureService.getAllArtworks(50));
});

router.post('/culture/artworks', (req: Request, res: Response) => {
  const { title, description, category, festivalId } = req.body;
  if (!title || !category) return res.status(400).json({ error: '参数缺失' });
  res.json(cultureService.submitArtwork(req.user!.company_id!, req.user!.id, title, description, category, festivalId));
});

router.post('/culture/artworks/:id/vote', (req: Request, res: Response) => {
  const artwork = cultureService.voteArtwork(req.params.id, req.user!.company_id!);
  if (!artwork) return res.status(400).json({ error: '投票失败' });
  res.json(artwork);
});

router.post('/culture/artworks/:id/share', (req: Request, res: Response) => {
  const artwork = cultureService.shareArtwork(req.params.id);
  if (!artwork) return res.status(400).json({ error: '转发失败' });
  res.json(artwork);
});

// ===== 事件 =====
router.get('/events', (req: Request, res: Response) => {
  res.json(eventService.getCompanyEvents(req.user!.company_id!));
});

router.post('/events/:id/read', (req: Request, res: Response) => {
  const success = eventService.markAsRead(req.params.id, req.user!.company_id!);
  res.json({ success });
});

router.get('/events/unread/count', (req: Request, res: Response) => {
  res.json({ count: eventService.getUnreadCount(req.user!.company_id!) });
});

// ===== 审批流 =====
router.get('/approvals', (req: Request, res: Response) => {
  res.json(approvalService.getCompanyApprovals(req.user!.company_id!, req.query.status as string));
});

router.get('/approvals/:id', (req: Request, res: Response) => {
  const approval = approvalService.getApprovalById(req.params.id);
  if (!approval) return res.status(404).json({ error: '审批不存在' });
  res.json(approval);
});

router.post('/approvals', (req: Request, res: Response) => {
  const { title, description, requiredLevel, payload, departmentId } = req.body;
  res.json(approvalService.createApproval(req.user!.company_id!, title, description, requiredLevel, payload, departmentId));
});

router.post('/approvals/:id/approve', (req: Request, res: Response) => {
  const result = approvalService.approve(req.params.id, req.user!.id, req.user!.role as any);
  if (!result) return res.status(400).json({ error: '审批失败' });
  
  if (result.status === 'approved') {
    try {
      const payload = JSON.parse(result.payload || '{}');
      if (payload.type === 'tower_upgrade' && payload.towerId) {
        towerService.executeUpgrade(payload.towerId);
      }
    } catch (e) {
      console.error('审批后处理失败', e);
    }
  }
  
  res.json(result);
});

router.post('/approvals/:id/reject', (req: Request, res: Response) => {
  const result = approvalService.reject(req.params.id, req.user!.id, req.user!.role as any);
  if (!result) return res.status(400).json({ error: '拒绝失败' });
  res.json(result);
});

// ===== 排行榜 =====
router.get('/leaderboard', (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 50;
  const sortBy = (req.query.sortBy as string) || 'assets';
  res.json(leaderboardService.getTopCompanies(limit, sortBy as any));
});

router.get('/leaderboard/my', (req: Request, res: Response) => {
  res.json(leaderboardService.getCompanyRank(req.user!.company_id!));
});

// ===== 多维商业塔 =====
router.get('/towers', (req: Request, res: Response) => {
  res.json(towerService.getAllTowers());
});

router.post('/towers', (req: Request, res: Response) => {
  const { companyIds } = req.body;
  res.json(towerService.createTower(companyIds || [req.user!.company_id!]));
});

router.post('/towers/:id/contribute', (req: Request, res: Response) => {
  const result = towerService.contribute(req.params.id, req.user!.company_id!, req.body.amount);
  if (!result) return res.status(400).json({ error: '贡献失败' });
  res.json(result);
});

router.post('/towers/:id/request-upgrade', (req: Request, res: Response) => {
  const result = towerService.requestUpgrade(req.params.id, req.user!.company_id!);
  if (!result) return res.status(400).json({ error: '申请升级失败，可能贡献未达标或已在审批中' });
  res.json(result);
});

router.get('/towers/:id/contributions', (req: Request, res: Response) => {
  res.json(towerService.getTowerContributions(req.params.id));
});

router.post('/towers/:id/upgrade', (req: Request, res: Response) => {
  const result = towerService.upgradeTower(req.params.id, req.user!.company_id!);
  if (!result) return res.status(400).json({ error: '升级失败：请走审批流程申请升级' });
  res.json(result);
});

// ===== 产业报告 =====
router.get('/reports/summary', (req: Request, res: Response) => {
  res.json(reportService.getWeeklySummary(req.user!.company_id!));
});

router.get('/reports/income', (req: Request, res: Response) => {
  const days = parseInt(req.query.days as string) || 7;
  res.json(reportService.getIncomeData(req.user!.company_id!, days));
});

router.get('/reports/pdf', (req: Request, res: Response) => {
  const pdfBuffer = reportService.generatePDFReport(req.user!.company_id!);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="weekly-report-${Date.now()}.pdf"`);
  res.send(pdfBuffer);
});

export default router;
