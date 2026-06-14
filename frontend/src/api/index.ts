import api from './client';
import type {
  User, Company, Department, Portal, Caravan, BankAccount, Bond, Loan,
  Spy, Artwork, Festival, ApprovalFlow, GameEvent, CommercialTower,
  EconomicIndicator, LeaderboardEntry, IncomeRecord,
  ExchangeOrder, ExchangeTrade, MarketData, OrderBook
} from '../types';

export const authApi = {
  register: (data: { username: string; email: string; password: string }) =>
    api.post<{ token: string; user: User }>('/auth/register', data).then(r => r.data),
  login: (data: { username: string; password: string }) =>
    api.post<{ token: string; user: User }>('/auth/login', data).then(r => r.data),
  me: () => api.get<User>('/auth/me').then(r => r.data),
  createCompany: (name: string) =>
    api.post<Company>('/auth/companies', { name }).then(r => r.data),
  joinCompany: (id: string) =>
    api.post(`/auth/companies/${id}/join`).then(r => r.data),
  getCompany: (id: string) =>
    api.get<Company>(`/auth/companies/${id}`).then(r => r.data),
  getMyCompany: () =>
    api.get<{ company: Company; departments: Department[]; members: User[] }>('/auth/my/company').then(r => r.data),
  getMembers: () =>
    api.get<User[]>('/auth/my/company/members').then(r => r.data),
  updateMemberRole: (userId: string, role: string) =>
    api.put(`/auth/members/${userId}/role`, { role }).then(r => r.data),
  appointDirector: (deptType: string, directorId: string) =>
    api.put(`/auth/departments/${deptType}/director`, { directorId }).then(r => r.data),
  upgradeDepartment: (deptType: string) =>
    api.post(`/auth/departments/${deptType}/upgrade`).then(r => r.data),
  setDepartmentBudget: (deptType: string, budget: number) =>
    api.put(`/auth/departments/${deptType}/budget`, { budget }).then(r => r.data),
};

export const transportApi = {
  getPortals: () => api.get<Portal[]>('/game/transport/portals').then(r => r.data),
  createPortal: (data: { name: string; source: string; target: string; riskLevel?: number }) =>
    api.post<Portal>('/game/transport/portals', data).then(r => r.data),
  getCaravans: () => api.get<Caravan[]>('/game/transport/caravans').then(r => r.data),
  createCaravan: (data: { name: string; portalId: string; goodsValue: number; guardPower: number }) =>
    api.post<Caravan>('/game/transport/caravans', data).then(r => r.data),
};

export const financeApi = {
  getAccount: () => api.get<BankAccount>('/game/finance/account').then(r => r.data),
  deposit: (amount: number) => api.post('/game/finance/deposit', { amount }).then(r => r.data),
  withdraw: (amount: number) => api.post('/game/finance/withdraw', { amount }).then(r => r.data),
  getBonds: () => api.get<Bond[]>('/game/finance/bonds').then(r => r.data),
  issueBond: (data: { faceValue: number; interestRate: number; durationDays: number }) =>
    api.post<Bond>('/game/finance/bonds', data).then(r => r.data),
  getLoans: () => api.get<Loan[]>('/game/finance/loans').then(r => r.data),
  issueLoan: (data: { borrowerCompanyId: string; principal: number; interestRate: number; durationDays: number }) =>
    api.post<Loan>('/game/finance/loans', data).then(r => r.data),
  repayLoan: (id: string, amount: number) =>
    api.post(`/game/finance/loans/${id}/repay`, { amount }).then(r => r.data),
  getEconomy: () => api.get<EconomicIndicator>('/game/finance/economy').then(r => r.data),
};

export const exchangeApi = {
  getMarkets: () => api.get<MarketData[]>('/game/exchange/markets').then(r => r.data),
  getAssets: () => api.get<Record<string, number>>('/game/exchange/assets').then(r => r.data),
  getOrderBook: (symbol: string) => api.get<OrderBook>('/game/exchange/orderbook', { params: { symbol } }).then(r => r.data),
  getOrders: (symbol?: string) => api.get<ExchangeOrder[]>('/game/exchange/orders', { params: { symbol } }).then(r => r.data),
  createBuyOrder: (data: { symbol: string; price: number; amount: number }) =>
    api.post<ExchangeOrder>('/game/exchange/orders/buy', data).then(r => r.data),
  createSellOrder: (data: { symbol: string; price: number; amount: number }) =>
    api.post<ExchangeOrder>('/game/exchange/orders/sell', data).then(r => r.data),
  cancelOrder: (id: string) => api.post(`/game/exchange/orders/${id}/cancel`).then(r => r.data),
  getTrades: (symbol?: string) => api.get<ExchangeTrade[]>('/game/exchange/trades', { params: { symbol } }).then(r => r.data),
};

export const intelligenceApi = {
  getSpies: () => api.get<Spy[]>('/game/intelligence/spies').then(r => r.data),
  createSpy: (data: { name: string; skill?: number; stealth?: number }) =>
    api.post<Spy>('/game/intelligence/spies', data).then(r => r.data),
  deploySpy: (id: string, data: { targetCompanyId: string; mission: string }) =>
    api.post<Spy>(`/game/intelligence/spies/${id}/deploy`, data).then(r => r.data),
  recallSpy: (id: string) => api.post<Spy>(`/game/intelligence/spies/${id}/recall`).then(r => r.data),
};

export const cultureApi = {
  getFestivals: () => api.get<Festival[]>('/game/culture/festivals').then(r => r.data),
  getAllFestivals: () => api.get<Festival[]>('/game/culture/festivals/all').then(r => r.data),
  createFestival: (data: { name: string; category: string; durationDays?: number }) =>
    api.post<Festival>('/game/culture/festivals', data).then(r => r.data),
  getMyArtworks: () => api.get<Artwork[]>('/game/culture/artworks').then(r => r.data),
  getAllArtworks: () => api.get<Artwork[]>('/game/culture/artworks/all').then(r => r.data),
  submitArtwork: (data: { title: string; description: string; category: string; festivalId?: string }) =>
    api.post<Artwork>('/game/culture/artworks', data).then(r => r.data),
  voteArtwork: (id: string) => api.post<Artwork>(`/game/culture/artworks/${id}/vote`).then(r => r.data),
  shareArtwork: (id: string) => api.post<Artwork>(`/game/culture/artworks/${id}/share`).then(r => r.data),
};

export const eventApi = {
  getEvents: () => api.get<GameEvent[]>('/game/events').then(r => r.data),
  markRead: (id: string) => api.post(`/game/events/${id}/read`).then(r => r.data),
  getUnreadCount: () => api.get<{ count: number }>('/game/events/unread/count').then(r => r.data),
};

export const approvalApi = {
  getApprovals: (status?: string) =>
    api.get<ApprovalFlow[]>('/game/approvals', { params: { status } }).then(r => r.data),
  createApproval: (data: { title: string; description: string; requiredLevel: 1 | 2 | 3; payload: any; departmentId?: string }) =>
    api.post<ApprovalFlow>('/game/approvals', data).then(r => r.data),
  approve: (id: string) => api.post<ApprovalFlow>(`/game/approvals/${id}/approve`).then(r => r.data),
  reject: (id: string) => api.post<ApprovalFlow>(`/game/approvals/${id}/reject`).then(r => r.data),
};

export const leaderboardApi = {
  getTop: (limit = 50, sortBy = 'assets') =>
    api.get<LeaderboardEntry[]>('/game/leaderboard', { params: { limit, sortBy } }).then(r => r.data),
  getMyRank: () => api.get<LeaderboardEntry>('/game/leaderboard/my').then(r => r.data),
};

export const towerApi = {
  getAll: () => api.get<CommercialTower[]>('/game/towers').then(r => r.data),
  create: (companyIds: string[]) => api.post<CommercialTower>('/game/towers', { companyIds }).then(r => r.data),
  contribute: (id: string, amount: number) => api.post(`/game/towers/${id}/contribute`, { amount }).then(r => r.data),
  getContributions: (id: string) => api.get(`/game/towers/${id}/contributions`).then(r => r.data),
  requestUpgrade: (id: string) => api.post(`/game/towers/${id}/request-upgrade`).then(r => r.data),
  upgrade: (id: string) => api.post(`/game/towers/${id}/upgrade`).then(r => r.data),
};

export const reportApi = {
  getSummary: () => api.get('/game/reports/summary').then(r => r.data),
  getIncome: (days = 7) =>
    api.get<IncomeRecord[]>('/game/reports/income', { params: { days } }).then(r => r.data),
  downloadPDF: () =>
    api.get('/game/reports/pdf', { responseType: 'blob' }).then(r => {
      const url = window.URL.createObjectURL(new Blob([r.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `weekly-report-${Date.now()}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    }),
};
