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
    const company = queryOne('SELECT * FROM companies WHERE id = ?', [companyId]) as any;
    if (!company || company.total_assets < totalCost) {
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

    if (type === 'buy') {
      const sellOrders = query(
        "SELECT * FROM exchange_orders WHERE symbol = ? AND type = 'sell' AND status = 'pending' AND price <= ? ORDER BY price ASC, created_at ASC",
        [symbol, price]
      );

      for (const sellOrder of sellOrders) {
        if (remaining <= 0.0001) break;
        const sellRemaining = sellOrder.total_amount - sellOrder.filled_amount;
        const tradeAmount = Math.min(remaining, sellRemaining);
        const tradePrice = sellOrder.price;
        const tradeValue = tradePrice * tradeAmount;

        const tradeId = generateId();
        run(`
          INSERT INTO exchange_trades (id, symbol, price, amount, buy_order_id, sell_order_id, buyer_company_id, seller_company_id, timestamp)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [tradeId, symbol, tradePrice, tradeAmount, orderId, sellOrder.id, companyId, sellOrder.company_id, timestamp]);

        run('UPDATE exchange_orders SET filled_amount = filled_amount + ? WHERE id = ?',
          [tradeAmount, orderId]);
        run('UPDATE exchange_orders SET filled_amount = filled_amount + ? WHERE id = ?',
          [tradeAmount, sellOrder.id]);

        const buyOrder = queryOne('SELECT * FROM exchange_orders WHERE id = ?', [orderId]) as any;
        if (buyOrder && buyOrder.filled_amount >= buyOrder.total_amount - 0.0001) {
          run("UPDATE exchange_orders SET status = 'filled' WHERE id = ?", [orderId]);
        }
        const sellUpdated = queryOne('SELECT * FROM exchange_orders WHERE id = ?', [sellOrder.id]) as any;
        if (sellUpdated && sellUpdated.filled_amount >= sellUpdated.total_amount - 0.0001) {
          run("UPDATE exchange_orders SET status = 'filled' WHERE id = ?", [sellOrder.id]);
        }

        const refund = (price - tradePrice) * tradeAmount;
        if (refund > 0) {
          run('UPDATE companies SET total_assets = total_assets + ? WHERE id = ?', [refund, companyId]);
        }

        this.updateAsset(sellOrder.company_id, symbol, 0);
        run('UPDATE companies SET total_assets = total_assets + ? WHERE id = ?', [tradeValue, sellOrder.company_id]);

        this.updateAsset(companyId, symbol, tradeAmount);

        const fee = tradeValue * 0.01;
        run('UPDATE companies SET total_assets = total_assets - ? WHERE id = ?', [fee, companyId]);
        this.recordIncome(sellOrder.company_id, tradeValue * 0.99);

        remaining -= tradeAmount;
      }

      if (remaining > 0.0001) {
        const lockedValue = price * remaining;
      } else {
        const buyOrder = queryOne('SELECT * FROM exchange_orders WHERE id = ?', [orderId]) as any;
        if (buyOrder && buyOrder.filled_amount < buyOrder.total_amount - 0.0001) {
          run("UPDATE exchange_orders SET status = 'partial' WHERE id = ?", [orderId]);
        }
      }
    } else {
      const buyOrders = query(
        "SELECT * FROM exchange_orders WHERE symbol = ? AND type = 'buy' AND status = 'pending' AND price >= ? ORDER BY price DESC, created_at ASC",
        [symbol, price]
      );

      for (const buyOrder of buyOrders) {
        if (remaining <= 0.0001) break;
        const buyRemaining = buyOrder.total_amount - buyOrder.filled_amount;
        const tradeAmount = Math.min(remaining, buyRemaining);
        const tradePrice = buyOrder.price;
        const tradeValue = tradePrice * tradeAmount;

        const tradeId = generateId();
        run(`
          INSERT INTO exchange_trades (id, symbol, price, amount, buy_order_id, sell_order_id, buyer_company_id, seller_company_id, timestamp)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [tradeId, symbol, tradePrice, tradeAmount, buyOrder.id, orderId, buyOrder.company_id, companyId, timestamp]);

        run('UPDATE exchange_orders SET filled_amount = filled_amount + ? WHERE id = ?',
          [tradeAmount, orderId]);
        run('UPDATE exchange_orders SET filled_amount = filled_amount + ? WHERE id = ?',
          [tradeAmount, buyOrder.id]);

        const sellOrderUpdated = queryOne('SELECT * FROM exchange_orders WHERE id = ?', [orderId]) as any;
        if (sellOrderUpdated && sellOrderUpdated.filled_amount >= sellOrderUpdated.total_amount - 0.0001) {
          run("UPDATE exchange_orders SET status = 'filled' WHERE id = ?", [orderId]);
        }
        const buyUpdated = queryOne('SELECT * FROM exchange_orders WHERE id = ?', [buyOrder.id]) as any;
        if (buyUpdated && buyUpdated.filled_amount >= buyUpdated.total_amount - 0.0001) {
          run("UPDATE exchange_orders SET status = 'filled' WHERE id = ?", [buyOrder.id]);
        }

        this.updateAsset(buyOrder.company_id, symbol, tradeAmount);

        const sellRevenue = price * tradeAmount;
        const priceDiff = (tradePrice - price) * tradeAmount;

        remaining -= tradeAmount;
      }
    }
  }

  cancelOrder(orderId: string, companyId: string): boolean {
    const order = queryOne('SELECT * FROM exchange_orders WHERE id = ? AND company_id = ?', [orderId, companyId]) as any;
    if (!order || order.status !== 'pending') return false;

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
