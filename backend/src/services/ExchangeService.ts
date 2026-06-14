import { query, queryOne, run } from '../database';
import { generateId, now, clamp } from '../utils';
import { eventService } from './EventService';
import type { DepartmentType } from '../types';

export const EXCHANGE_SYMBOLS = [
  { symbol: 'mana_core', name: '魔力晶核', basePrice: 100, icon: '💎' },
  { symbol: 'ship_parts', name: '星舰零件', basePrice: 250, icon: '🚀' },
  { symbol: 'ancient_relic', name: '古代遗物', basePrice: 500, icon: '🏺' },
  { symbol: 'intel_file', name: '情报密档', basePrice: 1000, icon: '📜' },
];

export class ExchangeService {

  getSymbols() {
    return EXCHANGE_SYMBOLS;
  }

  getCompanyAssets(companyId: string) {
    const assets = query('SELECT * FROM company_assets WHERE company_id = ?', [companyId]);
    const result: Record<string, number> = {};
    for (const sym of EXCHANGE_SYMBOLS) {
      const found = assets.find((a: any) => a.symbol === sym.symbol);
      result[sym.symbol] = found ? found.balance : 0;
    }
    return result;
  }

  private ensureAsset(companyId: string, symbol: string) {
    const existing = queryOne('SELECT * FROM company_assets WHERE company_id = ? AND symbol = ?', [companyId, symbol]);
    if (!existing) {
      run('INSERT INTO company_assets (id, company_id, symbol, balance) VALUES (?, ?, ?, 0)',
        [generateId(), companyId, symbol]);
    }
  }

  private updateAsset(companyId: string, symbol: string, delta: number) {
    this.ensureAsset(companyId, symbol);
    run('UPDATE company_assets SET balance = balance + ? WHERE company_id = ? AND symbol = ?',
      [delta, companyId, symbol]);
  }

  getOrderBook(symbol: string) {
    const buyOrders = query(
      "SELECT * FROM exchange_orders WHERE symbol = ? AND type = 'buy' AND status = 'pending' ORDER BY price DESC, created_at ASC LIMIT 20",
      [symbol]
    );
    const sellOrders = query(
      "SELECT * FROM exchange_orders WHERE symbol = ? AND type = 'sell' AND status = 'pending' ORDER BY price ASC, created_at ASC LIMIT 20",
      [symbol]
    );
    return { buyOrders, sellOrders };
  }

  getMarketData(symbol: string) {
    const trades = query(
      'SELECT * FROM exchange_trades WHERE symbol = ? ORDER BY timestamp DESC LIMIT 1',
      [symbol]
    );
    const lastPrice = trades.length > 0 ? trades[0].price : EXCHANGE_SYMBOLS.find(s => s.symbol === symbol)?.basePrice || 100;
    
    const buyOrders = query(
      "SELECT * FROM exchange_orders WHERE symbol = ? AND type = 'buy' AND status = 'pending' ORDER BY price DESC",
      [symbol]
    );
    const sellOrders = query(
      "SELECT * FROM exchange_orders WHERE symbol = ? AND type = 'sell' AND status = 'pending' ORDER BY price ASC",
      [symbol]
    );
    const bidPrice = buyOrders.length > 0 ? buyOrders[0].price : lastPrice * 0.95;
    const askPrice = sellOrders.length > 0 ? sellOrders[0].price : lastPrice * 1.05;

    const dayStart = now() - 24 * 60 * 60 * 1000;
    const dayTrades = query(
      'SELECT * FROM exchange_trades WHERE symbol = ? AND timestamp >= ?',
      [symbol, dayStart]
    );
    const volume = dayTrades.reduce((sum: number, t: any) => sum + t.amount, 0);
    const high24h = dayTrades.length > 0 ? Math.max(...dayTrades.map((t: any) => t.price)) : lastPrice;
    const low24h = dayTrades.length > 0 ? Math.min(...dayTrades.map((t: any) => t.price)) : lastPrice;

    return {
      symbol,
      lastPrice,
      bidPrice,
      askPrice,
      volume,
      high24h,
      low24h,
      change24h: 0,
    };
  }

  getAllMarkets() {
    return EXCHANGE_SYMBOLS.map(s => this.getMarketData(s.symbol));
  }

  getCompanyOrders(companyId: string, symbol?: string) {
    if (symbol) {
      return query(
        'SELECT * FROM exchange_orders WHERE company_id = ? AND symbol = ? ORDER BY created_at DESC',
        [companyId, symbol]
      );
    }
    return query(
      'SELECT * FROM exchange_orders WHERE company_id = ? ORDER BY created_at DESC',
      [companyId]
    );
  }

  getCompanyTrades(companyId: string, symbol?: string) {
    if (symbol) {
      return query(
        'SELECT * FROM exchange_trades WHERE (buyer_company_id = ? OR seller_company_id = ?) AND symbol = ? ORDER BY timestamp DESC',
        [companyId, companyId, symbol]
      );
    }
    return query(
      'SELECT * FROM exchange_trades WHERE buyer_company_id = ? OR seller_company_id = ? ORDER BY timestamp DESC',
      [companyId, companyId]
    );
  }

  createBuyOrder(companyId: string, symbol: string, price: number, amount: number): any {
    const totalCost = price * amount;
    const fee = totalCost * 0.01;
    const totalNeeded = totalCost + fee;
    const company = queryOne('SELECT * FROM companies WHERE id = ?', [companyId]) as any;
    if (!company || company.total_assets < totalNeeded) {
      return null;
    }

    run('UPDATE companies SET total_assets = total_assets - ? WHERE id = ?', [totalCost, companyId]);

    const orderId = generateId();
    const timestamp = now();
    run(`
      INSERT INTO exchange_orders (id, company_id, type, symbol, price, total_amount, filled_amount, status, created_at)
      VALUES (?, ?, 'buy', ?, ?, ?, 0, 'pending', ?)
    `, [orderId, companyId, symbol, price, amount, timestamp]);

    const result = this.matchOrder(orderId, 'buy', symbol, price, amount, companyId);

    return queryOne('SELECT * FROM exchange_orders WHERE id = ?', [orderId]);
  }

  createSellOrder(companyId: string, symbol: string, price: number, amount: number): any {
    const assets = this.getCompanyAssets(companyId);
    if ((assets[symbol] || 0) < amount) {
      return null;
    }

    this.updateAsset(companyId, symbol, -amount);

    const orderId = generateId();
    const timestamp = now();
    run(`
      INSERT INTO exchange_orders (id, company_id, type, symbol, price, total_amount, filled_amount, status, created_at)
      VALUES (?, ?, 'sell', ?, ?, ?, 0, 'pending', ?)
    `, [orderId, companyId, symbol, price, amount, timestamp]);

    this.matchOrder(orderId, 'sell', symbol, price, amount, companyId);

    return queryOne('SELECT * FROM exchange_orders WHERE id = ?', [orderId]);
  }

  private matchOrder(orderId: string, type: string, symbol: string, price: number, amount: number, companyId: string) {
    let remaining = amount;
    const timestamp = now();
    const FEE_RATE = 0.01;

    const isBuy = type === 'buy';
    const counterType = isBuy ? 'sell' : 'buy';
    const counterOrders = query(
      `SELECT * FROM exchange_orders WHERE symbol = ? AND type = ? AND status = 'pending' 
       AND ${isBuy ? 'price <= ?' : 'price >= ?'} 
       ORDER BY ${isBuy ? 'price ASC' : 'price DESC'}, created_at ASC`,
      [symbol, counterType, price]
    );

    for (const counterOrder of counterOrders) {
      if (remaining <= 0.0001) break;
      const counterRemaining = counterOrder.total_amount - counterOrder.filled_amount;
      const tradeAmount = Math.min(remaining, counterRemaining);
      const tradePrice = counterOrder.price;
      const tradeValue = tradePrice * tradeAmount;
      const fee = tradeValue * FEE_RATE;

      const tradeId = generateId();
      const buyerCompanyId = isBuy ? companyId : counterOrder.company_id;
      const sellerCompanyId = isBuy ? counterOrder.company_id : companyId;
      const buyerOrderId = isBuy ? orderId : counterOrder.id;
      const sellerOrderId = isBuy ? counterOrder.id : orderId;

      run(`
        INSERT INTO exchange_trades 
        (id, symbol, price, amount, buy_order_id, sell_order_id, buyer_company_id, seller_company_id, fee, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [tradeId, symbol, tradePrice, tradeAmount, buyerOrderId, sellerOrderId, buyerCompanyId, sellerCompanyId, fee, timestamp]);

      run('UPDATE exchange_orders SET filled_amount = filled_amount + ? WHERE id = ?', [tradeAmount, orderId]);
      run('UPDATE exchange_orders SET filled_amount = filled_amount + ? WHERE id = ?', [tradeAmount, counterOrder.id]);

      const myOrder = queryOne('SELECT * FROM exchange_orders WHERE id = ?', [orderId]) as any;
      if (myOrder && myOrder.filled_amount >= myOrder.total_amount - 0.0001) {
        run("UPDATE exchange_orders SET status = 'filled' WHERE id = ?", [orderId]);
      } else if (myOrder && myOrder.filled_amount > 0) {
        run("UPDATE exchange_orders SET status = 'partial' WHERE id = ?", [orderId]);
      }
      const counterUpdated = queryOne('SELECT * FROM exchange_orders WHERE id = ?', [counterOrder.id]) as any;
      if (counterUpdated && counterUpdated.filled_amount >= counterUpdated.total_amount - 0.0001) {
        run("UPDATE exchange_orders SET status = 'filled' WHERE id = ?", [counterOrder.id]);
      } else if (counterUpdated && counterUpdated.filled_amount > 0) {
        run("UPDATE exchange_orders SET status = 'partial' WHERE id = ?", [counterOrder.id]);
      }

      if (isBuy) {
        const refund = (price - tradePrice) * tradeAmount;
        if (refund > 0) {
          run("UPDATE companies SET total_assets = total_assets + ? WHERE id = ?", [refund, companyId]);
        }
        this.updateAsset(companyId, symbol, tradeAmount);
        run("UPDATE companies SET total_assets = total_assets - ? WHERE id = ?", [fee, companyId]);
        run("UPDATE companies SET total_assets = total_assets + ? WHERE id = ?", [tradeValue - fee, counterOrder.company_id]);
        this.recordIncome(counterOrder.company_id, tradeValue - fee);
      } else {
        this.updateAsset(counterOrder.company_id, symbol, tradeAmount);
        run("UPDATE companies SET total_assets = total_assets + ? WHERE id = ?", [tradeValue - fee, companyId]);
        run("UPDATE companies SET total_assets = total_assets - ? WHERE id = ?", [fee, counterOrder.company_id]);
        this.recordIncome(companyId, tradeValue - fee);
      }

      remaining -= tradeAmount;
    }

    if (remaining > 0.0001) {
      if (isBuy) {
        const myOrder = queryOne('SELECT * FROM exchange_orders WHERE id = ?', [orderId]) as any;
        if (myOrder && myOrder.filled_amount > 0 && myOrder.filled_amount < myOrder.total_amount - 0.0001) {
          run("UPDATE exchange_orders SET status = 'partial' WHERE id = ?", [orderId]);
        }
      }
    }
  }

  cancelOrder(orderId: string, companyId: string): boolean {
    const order = queryOne('SELECT * FROM exchange_orders WHERE id = ? AND company_id = ?', [orderId, companyId]) as any;
    if (!order || (order.status !== 'pending' && order.status !== 'partial')) return false;

    const remaining = order.total_amount - order.filled_amount;

    if (order.type === 'buy') {
      const refund = order.price * remaining;
      run('UPDATE companies SET total_assets = total_assets + ? WHERE id = ?', [refund, companyId]);
    } else {
      this.updateAsset(companyId, order.symbol, remaining);
    }

    run("UPDATE exchange_orders SET status = 'cancelled' WHERE id = ?", [orderId]);
    return true;
  }

  private recordIncome(companyId: string, amount: number) {
    const id = generateId();
    const timestamp = now();
    const dept: DepartmentType = 'finance';
    
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

export const exchangeService = new ExchangeService();
