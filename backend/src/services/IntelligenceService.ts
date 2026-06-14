import { query, queryOne, run } from '../database';
import { generateId, now, randomFloat, randomInt, clamp } from '../utils';
import { eventService } from './EventService';
import type { Spy, DepartmentType } from '../types';

export class IntelligenceService {

  createSpy(companyId: string, name: string, skill: number = 50, stealth: number = 50): Spy {
    const id = generateId();
    const timestamp = now();

    run(`
      INSERT INTO spies (id, company_id, name, skill, stealth, exposure_risk, target_company_id, status, mission, created_at)
      VALUES (?, ?, ?, ?, ?, 0, NULL, 'idle', NULL, ?)
    `, [id, companyId, name, clamp(skill, 1, 100), clamp(stealth, 1, 100), timestamp]);

    return {
      id, company_id: companyId, name, skill: clamp(skill, 1, 100), stealth: clamp(stealth, 1, 100),
      exposure_risk: 0, target_company_id: null, status: 'idle', mission: null, created_at: timestamp
    };
  }

  getCompanySpies(companyId: string): Spy[] {
    return query('SELECT * FROM spies WHERE company_id = ?', [companyId]) as Spy[];
  }

  deploySpy(spyId: string, companyId: string, targetCompanyId: string, mission: string): Spy | null {
    const spy = queryOne('SELECT * FROM spies WHERE id = ? AND company_id = ?', [spyId, companyId]) as Spy | undefined;
    if (!spy || spy.status !== 'idle') return null;

    run(`
      UPDATE spies SET target_company_id = ?, mission = ?, status = 'infiltrating', exposure_risk = 0.1
      WHERE id = ?
    `, [targetCompanyId, mission, spyId]);

    eventService.createEvent(
      'spy_success',
      `间谍「${spy.name}」已潜入目标商会`,
      `间谍开始执行任务：${mission}`,
      50,
      companyId
    );

    return { ...spy, target_company_id: targetCompanyId, mission, status: 'infiltrating', exposure_risk: 0.1 };
  }

  recallSpy(spyId: string, companyId: string): Spy | null {
    const spy = queryOne('SELECT * FROM spies WHERE id = ? AND company_id = ?', [spyId, companyId]) as Spy | undefined;
    if (!spy) return null;

    run(`
      UPDATE spies SET status = 'idle', target_company_id = NULL, mission = NULL, exposure_risk = 0
      WHERE id = ?
    `, [spyId]);

    return { ...spy, status: 'idle', target_company_id: null, mission: null, exposure_risk: 0 };
  }

  calculateSuccessRate(spy: Spy, difficulty: number = 50): number {
    const skillFactor = spy.skill / 100;
    const stealthFactor = spy.stealth / 100;
    const exposureFactor = 1 - spy.exposure_risk;
    const difficultyFactor = 1 - (difficulty / 100);
    
    return clamp(0.2 * skillFactor + 0.3 * stealthFactor + 0.2 * exposureFactor + 0.3 * difficultyFactor, 0.05, 0.95);
  }

  tickSpies(): Spy[] {
    const activeSpies = query("SELECT * FROM spies WHERE status = 'infiltrating'", []) as Spy[];
    const updated: Spy[] = [];

    for (const spy of activeSpies) {
      const newExposure = clamp(spy.exposure_risk + randomFloat(0.01, 0.05), 0, 1);
      const successRate = this.calculateSuccessRate(spy);
      const roll = Math.random();

      if (newExposure > 0.8 && roll < 0.3) {
        run(`
          UPDATE spies SET status = 'exposed', exposure_risk = 1
          WHERE id = ?
        `, [spy.id]);

        eventService.createEvent(
          'spy_caught',
          `间谍「${spy.name}」暴露了！`,
          `间谍身份被敌方识破，已被驱逐出境。`,
          -500,
          spy.company_id
        );

        if (Math.random() < 0.3 && spy.target_company_id) {
          eventService.createEvent(
            'counter_intelligence',
            `成功实施反间计！`,
            `利用被策反的间谍传递虚假情报，让敌方做出错误决策。`,
            1000,
            spy.target_company_id
          );
        }

        updated.push({ ...spy, status: 'exposed', exposure_risk: 1 });
      } else if (roll < successRate * 0.1) {
        const reward = randomInt(100, 2000);
        run('UPDATE companies SET total_assets = total_assets + ? WHERE id = ?', [reward, spy.company_id]);
        
        eventService.createEvent(
          'spy_success',
          `间谍「${spy.name}」获取重要情报！`,
          `成功窃取价值 ${reward} 金币的商业机密。`,
          reward,
          spy.company_id
        );

        this.recordIncome(spy.company_id, reward);
        run('UPDATE spies SET exposure_risk = ? WHERE id = ?', [clamp(newExposure + 0.1, 0, 1), spy.id]);
        updated.push({ ...spy, exposure_risk: clamp(newExposure + 0.1, 0, 1) });
      } else if (roll < successRate * 0.1 + 0.02 && spy.target_company_id) {
        eventService.createEvent(
          'subversion',
          `成功策反敌方高层！`,
          `间谍成功对敌方高层进行了策反，未来的情报获取将更加顺利。`,
          500,
          spy.company_id
        );
        run('UPDATE spies SET exposure_risk = ? WHERE id = ?', [newExposure, spy.id]);
        updated.push({ ...spy, exposure_risk: newExposure });
      } else {
        run('UPDATE spies SET exposure_risk = ? WHERE id = ?', [newExposure, spy.id]);
        updated.push({ ...spy, exposure_risk: newExposure });
      }
    }

    return updated;
  }

  private recordIncome(companyId: string, amount: number) {
    const id = generateId();
    const timestamp = now();
    const dept: DepartmentType = 'intelligence';
    
    run(`
      INSERT INTO income_records (id, company_id, department, amount, timestamp)
      VALUES (?, ?, ?, ?, ?)
    `, [id, companyId, dept, amount, timestamp]);

    run(`
      UPDATE departments SET weekly_income = weekly_income + ?
      WHERE company_id = ? AND type = ?
    `, [amount, companyId, dept]);
  }
}

export const intelligenceService = new IntelligenceService();
