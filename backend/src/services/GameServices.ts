import { query, queryOne, run } from '../database';
import { generateId, now, randomInt } from '../utils';
import type { LeaderboardEntry, CommercialTower, TowerContribution, IncomeRecord, DepartmentType } from '../types';

export class LeaderboardService {

  getTopCompanies(limit: number = 50, sortBy: 'assets' | 'influence' | 'level' = 'assets'): LeaderboardEntry[] {
    const sortColumn = sortBy === 'influence' ? 'influence' : sortBy === 'level' ? 'level' : 'total_assets';
    
    const companies = query(`
      SELECT c.*,
        (SELECT level FROM departments d WHERE d.company_id = c.id AND d.type = 'transport') as transport_level,
        (SELECT level FROM departments d WHERE d.company_id = c.id AND d.type = 'finance') as finance_level,
        (SELECT level FROM departments d WHERE d.company_id = c.id AND d.type = 'intelligence') as intelligence_level,
        (SELECT level FROM departments d WHERE d.company_id = c.id AND d.type = 'culture') as culture_level
      FROM companies c
      ORDER BY c.${sortColumn} DESC
      LIMIT ?
    `, [limit]) as any[];

    return companies.map((c, idx) => ({
      company_id: c.id,
      company_name: c.name,
      total_assets: c.total_assets,
      transport_level: c.transport_level || 0,
      finance_level: c.finance_level || 0,
      intelligence_level: c.intelligence_level || 0,
      culture_level: c.culture_level || 0,
      influence: c.influence,
      rank: idx + 1,
    }));
  }

  getCompanyRank(companyId: string): LeaderboardEntry | null {
    const all = this.getTopCompanies(99999);
    return all.find(e => e.company_id === companyId) || null;
  }
}

export class TowerService {

  createTower(companyIds: string[]): CommercialTower {
    const id = generateId();
    const timestamp = now();
    const companiesStr = JSON.stringify(companyIds);
    const required = companyIds.length * 100000;

    run(`
      INSERT INTO commercial_towers (id, company_ids, level, total_contribution, required_contribution, upgrade_status, created_at)
      VALUES (?, ?, 1, 0, ?, 'idle', ?)
    `, [id, companiesStr, required, timestamp]);

    return {
      id, company_ids: companiesStr, level: 1,
      total_contribution: 0, required_contribution: required,
      upgrade_status: 'idle', created_at: timestamp
    };
  }

  getAllTowers(): CommercialTower[] {
    return query('SELECT * FROM commercial_towers ORDER BY level DESC') as CommercialTower[];
  }

  getTowerById(id: string): CommercialTower | undefined {
    return queryOne('SELECT * FROM commercial_towers WHERE id = ?', [id]) as CommercialTower | undefined;
  }

  contribute(towerId: string, companyId: string, amount: number): TowerContribution | null {
    if (amount <= 0) return null;

    const tower = this.getTowerById(towerId);
    if (!tower) return null;

    const companyIds = JSON.parse(tower.company_ids) as string[];
    if (!companyIds.includes(companyId)) return null;

    const company = queryOne('SELECT * FROM companies WHERE id = ?', [companyId]) as any;
    if (!company || company.total_assets < amount) return null;

    const id = generateId();
    const timestamp = now();

    run('UPDATE companies SET total_assets = total_assets - ? WHERE id = ?', [amount, companyId]);

    const newTotal = tower.total_contribution + amount;
    let newStatus = tower.upgrade_status;
    if (newTotal >= tower.required_contribution && tower.upgrade_status === 'idle') {
      newStatus = 'awaiting_approval';
    }

    run(`
      UPDATE commercial_towers SET total_contribution = ?, upgrade_status = ? WHERE id = ?
    `, [newTotal, newStatus, towerId]);

    run(`
      INSERT INTO tower_contributions (id, tower_id, company_id, amount, contributed_at)
      VALUES (?, ?, ?, ?, ?)
    `, [id, towerId, companyId, amount, timestamp]);

    run('UPDATE companies SET influence = influence + ? WHERE id = ?', [Math.floor(amount / 100), companyId]);

    return { id, tower_id: towerId, company_id: companyId, amount, contributed_at: timestamp };
  }

  getTowerContributions(towerId: string): TowerContribution[] {
    return query('SELECT * FROM tower_contributions WHERE tower_id = ? ORDER BY contributed_at DESC', [towerId]) as TowerContribution[];
  }

  upgradeTower(towerId: string): CommercialTower | null {
    const tower = this.getTowerById(towerId);
    if (!tower) return null;
    if (tower.total_contribution < tower.required_contribution) return null;

    const newLevel = tower.level + 1;
    const companyIds = JSON.parse(tower.company_ids) as string[];
    const newRequired = companyIds.length * 100000 * newLevel;

    run(`
      UPDATE commercial_towers 
      SET level = ?, total_contribution = 0, required_contribution = ?, upgrade_status = 'idle'
      WHERE id = ?
    `, [newLevel, newRequired, towerId]);

    const bonus = 10000 * tower.level;
    for (const cid of companyIds) {
      run('UPDATE companies SET influence = influence + ?, total_assets = total_assets + ? WHERE id = ?', [500 * tower.level, bonus, cid]);
    }

    return this.getTowerById(towerId) || null;
  }
}

export class ReportService {

  getIncomeData(companyId: string, days: number = 7): { timestamp: number; department: DepartmentType; amount: number }[] {
    const since = now() - days * 24 * 60 * 60 * 1000;
    return query(`
      SELECT timestamp, department, amount FROM income_records
      WHERE company_id = ? AND timestamp >= ?
      ORDER BY timestamp ASC
    `, [companyId, since]) as IncomeRecord[];
  }

  getDepartmentIncome(companyId: string): { department: DepartmentType; total: number }[] {
    return query(`
      SELECT department, SUM(amount) as total
      FROM income_records
      WHERE company_id = ?
      GROUP BY department
    `, [companyId]) as { department: DepartmentType; total: number }[];
  }

  getWeeklySummary(companyId: string) {
    const incomeData = this.getIncomeData(companyId, 7);
    const deptIncome = this.getDepartmentIncome(companyId);
    const events = query(`
      SELECT type, COUNT(*) as count FROM game_events
      WHERE (company_id IS NULL OR company_id = ?) AND timestamp >= ?
      GROUP BY type
    `, [companyId, now() - 7 * 24 * 60 * 60 * 1000]) as { type: string; count: number }[];

    const company = queryOne('SELECT * FROM companies WHERE id = ?', [companyId]) as any;
    const departments = query('SELECT * FROM departments WHERE company_id = ?', [companyId]) as any[];

    return {
      company: {
        name: company?.name,
        total_assets: company?.total_assets,
        level: company?.level,
        influence: company?.influence,
      },
      income_curve: incomeData,
      asset_distribution: deptIncome,
      event_frequency: events,
      departments: departments.map((d: any) => ({
        type: d.type,
        name: d.name,
        level: d.level,
        weekly_income: d.weekly_income,
        budget: d.budget,
      })),
      generated_at: now(),
    };
  }

  generatePDFReport(companyId: string): Buffer {
    const summary = this.getWeeklySummary(companyId);
    const PDFDocument = require('pdfkit');
    const chunks: Buffer[] = [];
    const doc = new PDFDocument();

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));

    doc.fontSize(24).text('跨维度商业帝国 - 产业周报', { align: 'center' });
    doc.moveDown();
    doc.fontSize(16).text(`商会: ${summary.company.name}`);
    doc.fontSize(12).text(`生成时间: ${new Date(summary.generated_at).toLocaleString()}`);
    doc.moveDown();

    doc.fontSize(14).text('=== 商会概览 ===');
    doc.fontSize(12).text(`总资产: ${summary.company.total_assets.toFixed(0)} 金币`);
    doc.text(`商会等级: Lv.${summary.company.level}`);
    doc.text(`跨维度影响力: ${summary.company.influence}`);
    doc.moveDown();

    doc.fontSize(14).text('=== 事业部收入分布 ===');
    for (const d of summary.departments) {
      doc.fontSize(12).text(`${d.name} (Lv.${d.level}): ${d.weekly_income.toFixed(0)} 金币 / 预算: ${d.budget}`);
    }
    doc.moveDown();

    doc.fontSize(14).text('=== 本周事件频率 ===');
    for (const e of summary.event_frequency) {
      doc.fontSize(12).text(`${e.type}: ${e.count} 次`);
    }

    doc.end();

    return Buffer.concat(chunks);
  }
}

export const leaderboardService = new LeaderboardService();
export const towerService = new TowerService();
export const reportService = new ReportService();
