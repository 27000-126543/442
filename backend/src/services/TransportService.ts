import { query, queryOne, run } from '../database';
import { generateId, now, randomFloat, randomInt, clamp } from '../utils';
import { eventService } from './EventService';
import type { Portal, Caravan, DepartmentType } from '../types';

export class TransportService {
  createPortal(companyId: string, name: string, source: string, target: string, riskLevel: number = 1): Portal {
    const id = generateId();
    const timestamp = now();
    
    run(`
      INSERT INTO portals (id, company_id, name, source_dimension, target_dimension, risk_level, capacity, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 100, 'active', ?)
    `, [id, companyId, name, source, target, clamp(riskLevel, 1, 10), timestamp]);

    return { id, company_id: companyId, name, source_dimension: source, target_dimension: target, risk_level: clamp(riskLevel, 1, 10), capacity: 100, status: 'active', created_at: timestamp };
  }

  getCompanyPortals(companyId: string): Portal[] {
    return query('SELECT * FROM portals WHERE company_id = ?', [companyId]) as Portal[];
  }

  createCaravan(companyId: string, name: string, portalId: string, goodsValue: number, guardPower: number): Caravan {
    const id = generateId();
    const timestamp = now();
    const totalDistance = randomInt(50, 200);
    const estimatedArrival = timestamp + (totalDistance / 0.5) * 3000;

    run(`
      INSERT INTO caravans (id, company_id, name, portal_id, goods_value, guard_power, status, current_position, total_distance, progress, estimated_arrival, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'traveling', 0, ?, 0, ?, ?)
    `, [id, companyId, name, portalId, goodsValue, guardPower, totalDistance, estimatedArrival, timestamp]);

    return {
      id, company_id: companyId, name, portal_id: portalId, goods_value: goodsValue, guard_power: guardPower,
      status: 'traveling', current_position: 0, total_distance: totalDistance, progress: 0, estimated_arrival: estimatedArrival, created_at: timestamp
    };
  }

  getCompanyCaravans(companyId: string): Caravan[] {
    return query('SELECT * FROM caravans WHERE company_id = ?', [companyId]) as Caravan[];
  }

  calculateTransportProfit(goodsValue: number, riskLevel: number, guardPower: number): { profit: number; attacked: boolean } {
    const riskFactor = riskLevel / 10;
    const guardFactor = guardPower / 100;
    const attackProbability = clamp(0.1 * riskFactor - 0.05 * guardFactor, 0.01, 0.5);
    const attacked = Math.random() < attackProbability;
    
    if (attacked) {
      const lossRatio = clamp(0.3 + riskFactor * 0.1 - guardFactor * 0.2, 0.05, 0.8);
      return { profit: -goodsValue * lossRatio, attacked: true };
    }
    
    const baseProfitRate = 0.2 + riskFactor * 0.15;
    const bonusRate = clamp(guardFactor * 0.1, 0, 0.15);
    return { profit: goodsValue * (baseProfitRate + bonusRate), attacked: false };
  }

  tickCaravans(): Caravan[] {
    const activeCaravans = query("SELECT * FROM caravans WHERE status = 'traveling'") as Caravan[];
    const updated: Caravan[] = [];

    for (const caravan of activeCaravans) {
      const newProgress = Math.min(caravan.progress + randomFloat(1, 3), 100);
      const newPosition = (newProgress / 100) * caravan.total_distance;

      if (newProgress >= 100) {
        const portal = queryOne('SELECT * FROM portals WHERE id = ?', [caravan.portal_id]) as Portal;
        const result = this.calculateTransportProfit(caravan.goods_value, portal?.risk_level || 5, caravan.guard_power);
        
        if (result.attacked) {
          eventService.createEvent(
            'caravan_attack',
            `商队「${caravan.name}」遭遇袭击！`,
            `商队在途中遭到星际海盗袭击，损失了 ${Math.abs(result.profit).toFixed(0)} 金币的货物。`,
            result.profit,
            caravan.company_id
          );
        } else {
          eventService.createEvent(
            'caravan_bonus',
            `商队「${caravan.name}」顺利抵达！`,
            `商队安全完成运输，获得 ${result.profit.toFixed(0)} 金币的利润。`,
            result.profit,
            caravan.company_id
          );
        }

        run(`
          UPDATE caravans SET status = 'idle', progress = 100, current_position = ?
          WHERE id = ?
        `, [caravan.total_distance, caravan.id]);

        run(`
          UPDATE companies SET total_assets = total_assets + ?
          WHERE id = ?
        `, [result.profit, caravan.company_id]);

        this.recordIncome(caravan.company_id, result.profit);
        updated.push({ ...caravan, status: 'idle', progress: 100, current_position: caravan.total_distance });
      } else {
        run(`
          UPDATE caravans SET progress = ?, current_position = ?
          WHERE id = ?
        `, [newProgress, newPosition, caravan.id]);
        updated.push({ ...caravan, progress: newProgress, current_position: newPosition });
      }
    }

    return updated;
  }

  private recordIncome(companyId: string, amount: number) {
    const id = generateId();
    const timestamp = now();
    const dept: DepartmentType = 'transport';
    
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

export const transportService = new TransportService();
