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

export const FEE_RATE = 0.01;

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

  // ========== 资金流水 ==========

  recordFundFlow(params: {
    companyId: string;
    type: string;
    direction: 'in' | 'out';
    amount: number;
    orderId?: string;
    tradeId?: string;
    symbol?: string;
    description?: string;
  }) {
    const { companyId, type, direction, amount, orderId, tradeId, symbol, description } = params;
    const company = queryOne('SELECT * FROM companies WHERE id = ?', [companyId]) as any;
    const balanceAfter = company ? company.total_assets : 0;
    const id = generateId();
    const timestamp = now();
    run(`
      INSERT INTO fund_flows (id, company_id, type, direction, amount, balance_after, order_id, trade_id, symbol, description, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, companyId, type, direction, amount, balanceAfter, orderId || null, tradeId || null, symbol || null, description || null, timestamp]);
    return { id, balance_after: balanceAfter };
  }

  getFundFlows(companyId: string, symbol?: string, type?: string) {
    let sql = 'SELECT * FROM fund_flows WHERE company_id = ?';
    const params: any[] = [companyId];
    if (symbol) { sql += ' AND symbol = ?'; params.push(symbol); }
    if (type) { sql += ' AND type = ?'; params.push(type); }
    sql += ' ORDER BY created_at DESC LIMIT 200';
    return query(sql, params);
  }

  // ========== 订单/市场/交易 查询 ==========

  getOrderBook(symbol: string) {
    const buyOrders = query(
      "SELECT * FROM exchange_orders WHERE symbol = ? AND type = 'buy' AND status IN ('pending','partial') ORDER BY price DESC, created_at ASC LIMIT 20",
      [symbol]
    );
    const sellOrders = query(
      "SELECT * FROM exchange_orders WHERE symbol = ? AND type = 'sell' AND status IN ('pending','partial') ORDER BY price ASC, created_at ASC LIMIT 20",
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
      "SELECT * FROM exchange_orders WHERE symbol = ? AND type = 'buy' AND status IN ('pending','partial') ORDER BY price DESC",
      [symbol]
    );
    const sellOrders = query(
      "SELECT * FROM exchange_orders WHERE symbol = ? AND type = 'sell' AND status IN ('pending','partial') ORDER BY price ASC",
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

  getCompanyOrders(companyId: string, symbol?: string, status?: string) {
    let sql = 'SELECT * FROM exchange_orders WHERE company_id = ?';
    const params: any[] = [companyId];
    if (symbol) { sql += ' AND symbol = ?'; params.push(symbol); }
    if (status) { sql += ' AND status = ?'; params.push(status); }
    sql += ' ORDER BY created_at DESC';
    return query(sql, params);
  }

  getOrderDetail(orderId: string, companyId: string) {
    const order = queryOne('SELECT * FROM exchange_orders WHERE id = ? AND company_id = ?', [orderId, companyId]) as any;
    if (!order) return null;
    const batches = query(
      'SELECT * FROM exchange_trades WHERE buy_order_id = ? OR sell_order_id = ? ORDER BY timestamp ASC',
      [orderId, orderId]
    );
    const flows = query(
      'SELECT * FROM fund_flows WHERE order_id = ? ORDER BY created_at ASC',
      [orderId]
    );
    return { ...order, batches, flows };
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

  getTradeDetail(tradeId: string, companyId: string) {
    const trade = queryOne('SELECT * FROM exchange_trades WHERE id = ?', [tradeId]) as any;
    if (!trade) return null;
    if (trade.buyer_company_id !== companyId && trade.seller_company_id !== companyId) return null;
    const flows = query(
      'SELECT * FROM fund_flows WHERE trade_id = ? ORDER BY created_at ASC',
      [tradeId]
    );
    return { ...trade, flows };
  }

  // ========== 下单 ==========

  createBuyOrder(companyId: string, symbol: string, price: number, amount: number): any {
    const principal = price * amount;
    const expectedFee = principal * FEE_RATE;
    const totalNeeded = principal + expectedFee;

    const company = queryOne('SELECT * FROM companies WHERE id = ?', [companyId]) as any;
    if (!company || company.total_assets < totalNeeded) return null;

    run('UPDATE companies SET total_assets = total_assets - ? WHERE id = ?', [totalNeeded, companyId]);

    const orderId = generateId();
    const timestamp = now();
    run(`
      INSERT INTO exchange_orders
      (id, company_id, type, symbol, price, total_amount, filled_amount, status,
       frozen_principal, frozen_fee, remaining_principal, remaining_fee, created_at)
      VALUES (?, ?, 'buy', ?, ?, ?, 0, 'pending',
              ?, ?, ?, ?, ?)
    `, [orderId, companyId, symbol, price, amount, principal, expectedFee, principal, expectedFee, timestamp]);

    this.recordFundFlow({
      companyId,
      type: 'buy_freeze',
      direction: 'out',
      amount: totalNeeded,
      orderId,
      symbol,
      description: `买单冻结 货款${principal.toFixed(2)} + 手续费${expectedFee.toFixed(2)} = ${totalNeeded.toFixed(2)}`,
    });

    this.matchOrder(orderId, 'buy', symbol, price, amount, companyId);

    return queryOne('SELECT * FROM exchange_orders WHERE id = ?', [orderId]);
  }

  createSellOrder(companyId: string, symbol: string, price: number, amount: number): any {
    const assets = this.getCompanyAssets(companyId);
    if ((assets[symbol] || 0) < amount) return null;

    this.updateAsset(companyId, symbol, -amount);

    const principal = price * amount;
    const expectedFee = principal * FEE_RATE;

    const orderId = generateId();
    const timestamp = now();
    run(`
      INSERT INTO exchange_orders
      (id, company_id, type, symbol, price, total_amount, filled_amount, status,
       frozen_principal, frozen_fee, remaining_principal, remaining_fee, created_at)
      VALUES (?, ?, 'sell', ?, ?, ?, 0, 'pending',
              ?, ?, ?, ?, ?)
    `, [orderId, companyId, symbol, price, amount, principal, expectedFee, principal, expectedFee, timestamp]);

    this.recordFundFlow({
      companyId,
      type: 'sell_freeze_asset',
      direction: 'out',
      amount: 0,
      orderId,
      symbol,
      description: `卖单冻结资产 ${amount.toFixed(2)} ${symbol} (预计到账 ${(principal - expectedFee).toFixed(2)})`,
    });

    this.matchOrder(orderId, 'sell', symbol, price, amount, companyId);

    return queryOne('SELECT * FROM exchange_orders WHERE id = ?', [orderId]);
  }

  // ========== 撮合引擎 ==========

  private updateOrderStatusAfterMatch(orderId: string) {
    const o = queryOne('SELECT * FROM exchange_orders WHERE id = ?', [orderId]) as any;
    if (!o) return;
    if (o.filled_amount >= o.total_amount - 0.0001) {
      run("UPDATE exchange_orders SET status = 'filled', remaining_principal = 0, remaining_fee = 0 WHERE id = ?", [orderId]);
    } else if (o.filled_amount > 0) {
      run("UPDATE exchange_orders SET status = 'partial' WHERE id = ?", [orderId]);
    }
  }

  private matchOrder(orderId: string, type: string, symbol: string, price: number, amount: number, companyId: string) {
    let remaining = amount;
    const timestamp = now();

    const isBuy = type === 'buy';
    const counterType = isBuy ? 'sell' : 'buy';
    const counterOrders = query(
      `SELECT * FROM exchange_orders WHERE symbol = ? AND type = ? AND status IN ('pending','partial') 
       AND ${isBuy ? 'price <= ?' : 'price >= ?'} 
       ORDER BY ${isBuy ? 'price ASC' : 'price DESC'}, created_at ASC`,
      [symbol, counterType, price]
    );

    for (const counterOrder of counterOrders) {
      if (remaining <= 0.0001) break;
      const counterRemaining = counterOrder.total_amount - counterOrder.filled_amount;
      if (counterRemaining <= 0.0001) continue;

      const tradeAmount = Math.min(remaining, counterRemaining);
      const tradePrice = counterOrder.price;
      const tradeValue = tradePrice * tradeAmount;
      const fee = tradeValue * FEE_RATE;

      // 校验：买单剩余冻结手续费够不够扣这次成交的手续费
      if (isBuy) {
        const myOrder = queryOne('SELECT * FROM exchange_orders WHERE id = ?', [orderId]) as any;
        if (!myOrder || myOrder.remaining_fee < fee - 0.0001) break; // 手续费不够，停止撮合
      } else {
        // 对手方是买单，也要校验对手方剩余手续费
        const counterUpdated = queryOne('SELECT * FROM exchange_orders WHERE id = ?', [counterOrder.id]) as any;
        if (!counterUpdated || counterUpdated.remaining_fee < fee - 0.0001) continue; // 对手方手续费不够，跳过
      }

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

      // 更新成交数量
      run('UPDATE exchange_orders SET filled_amount = filled_amount + ? WHERE id = ?', [tradeAmount, orderId]);
      run('UPDATE exchange_orders SET filled_amount = filled_amount + ? WHERE id = ?', [tradeAmount, counterOrder.id]);

      // 扣减买方 remaining_principal / remaining_fee
      run(`
        UPDATE exchange_orders SET 
          remaining_principal = remaining_principal - ?,
          remaining_fee = remaining_fee - ?
        WHERE id = ?
      `, [tradeValue, fee, buyerOrderId]);

      // 扣减卖方 remaining_principal / remaining_fee（用于撤销时计算参考，实际不冻结）
      run(`
        UPDATE exchange_orders SET 
          remaining_principal = remaining_principal - ?,
          remaining_fee = remaining_fee - ?
        WHERE id = ?
      `, [tradeValue, fee, sellerOrderId]);

      // 价格差处理：买方挂单价格 > 成交价格 → 退还多冻结的部分
      if (isBuy && price > tradePrice) {
        const priceDiffAmount = (price - tradePrice) * tradeAmount;
        // 货款多冻结部分退还
        run("UPDATE companies SET total_assets = total_assets + ? WHERE id = ?", [priceDiffAmount, companyId]);
        this.recordFundFlow({
          companyId,
          type: 'buy_refund_price_diff',
          direction: 'in',
          amount: priceDiffAmount,
          orderId,
          tradeId,
          symbol,
          description: `买单价格差退还 (${price.toFixed(2)} - ${tradePrice.toFixed(2)}) × ${tradeAmount.toFixed(2)}`,
        });
      }

      // ===== 买方账户处理 =====
      // 1) 买方获得资产
      this.updateAsset(buyerCompanyId, symbol, tradeAmount);
      // 2) 买方手续费（从冻结手续费中扣，已在下单时冻结，无需再扣余额）
      // 买方流水：成交货款占用、成交手续费占用
      this.recordFundFlow({
        companyId: buyerCompanyId,
        type: 'buy_match_principal',
        direction: 'out',
        amount: tradeValue,
        orderId: buyerOrderId,
        tradeId,
        symbol,
        description: `买单成交货款 ${tradeAmount.toFixed(2)} × ${tradePrice.toFixed(2)} = ${tradeValue.toFixed(2)}`,
      });
      this.recordFundFlow({
        companyId: buyerCompanyId,
        type: 'buy_match_fee',
        direction: 'out',
        amount: fee,
        orderId: buyerOrderId,
        tradeId,
        symbol,
        description: `买单成交手续费 ${tradeValue.toFixed(2)} × 1% = ${fee.toFixed(2)}`,
      });

      // ===== 卖方账户处理 =====
      // 1) 卖方到账：货款 - 手续费
      const sellerReceive = tradeValue - fee;
      run("UPDATE companies SET total_assets = total_assets + ? WHERE id = ?", [sellerReceive, sellerCompanyId]);
      // 2) 记录卖方流水
      this.recordFundFlow({
        companyId: sellerCompanyId,
        type: 'sell_match_receive',
        direction: 'in',
        amount: sellerReceive,
        orderId: sellerOrderId,
        tradeId,
        symbol,
        description: `卖单成交到账 ${tradeAmount.toFixed(2)} × ${tradePrice.toFixed(2)} - 手续费${fee.toFixed(2)} = ${sellerReceive.toFixed(2)}`,
      });
      this.recordFundFlow({
        companyId: sellerCompanyId,
        type: 'sell_match_fee',
        direction: 'out',
        amount: fee,
        orderId: sellerOrderId,
        tradeId,
        symbol,
        description: `卖单成交手续费 ${tradeValue.toFixed(2)} × 1% = ${fee.toFixed(2)}`,
      });

      // 记录卖方收入（金融部业绩）
      this.recordIncome(sellerCompanyId, sellerReceive);

      // 更新双方订单状态
      this.updateOrderStatusAfterMatch(orderId);
      this.updateOrderStatusAfterMatch(counterOrder.id);

      remaining -= tradeAmount;
    }
  }

  // ========== 撤销订单 ==========

  cancelOrder(orderId: string, companyId: string): boolean {
    const order = queryOne('SELECT * FROM exchange_orders WHERE id = ? AND company_id = ?', [orderId, companyId]) as any;
    if (!order || (order.status !== 'pending' && order.status !== 'partial')) return false;

    if (order.type === 'buy') {
      // 买单：退还 remaining_principal + remaining_fee
      const refund = (order.remaining_principal || 0) + (order.remaining_fee || 0);
      if (refund > 0) {
        run('UPDATE companies SET total_assets = total_assets + ? WHERE id = ?', [refund, companyId]);
      }
      this.recordFundFlow({
        companyId,
        type: 'buy_cancel_refund',
        direction: 'in',
        amount: refund,
        orderId,
        symbol: order.symbol,
        description: `买单撤销退款 货款${(order.remaining_principal || 0).toFixed(2)} + 手续费${(order.remaining_fee || 0).toFixed(2)} = ${refund.toFixed(2)}`,
      });
    } else {
      // 卖单：退还 remaining_amount（剩余数量）对应资产
      const remaining = order.total_amount - order.filled_amount;
      if (remaining > 0.0001) {
        this.updateAsset(companyId, order.symbol, remaining);
      }
      this.recordFundFlow({
        companyId,
        type: 'sell_cancel_unfreeze',
        direction: 'in',
        amount: 0,
        orderId,
        symbol: order.symbol,
        description: `卖单撤销解冻资产 ${remaining.toFixed(2)} ${order.symbol}`,
      });
    }

    run("UPDATE exchange_orders SET status = 'cancelled', remaining_principal = 0, remaining_fee = 0 WHERE id = ?", [orderId]);
    return true;
  }

  // ========== 收入记录（金融部业绩） ==========

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
