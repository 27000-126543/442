import { query, queryOne, run } from '../database';
import { generateId, now, randomFloat, clamp, randomInt } from '../utils';
import { eventService } from './EventService';
import type { BankAccount, Bond, Loan, EconomicIndicator, DepartmentType } from '../types';

export class FinanceService {
  getOrCreateAccount(companyId: string): BankAccount {
    let account = queryOne('SELECT * FROM bank_accounts WHERE company_id = ?', [companyId]) as BankAccount | undefined;
    
    if (!account) {
      const id = generateId();
      const timestamp = now();
      run(`
        INSERT INTO bank_accounts (id, company_id, balance, interest_rate, created_at)
        VALUES (?, ?, 0, 0.05, ?)
      `, [id, companyId, timestamp]);
      account = { id, company_id: companyId, balance: 0, interest_rate: 0.05, created_at: timestamp };
    }
    
    return account;
  }

  deposit(companyId: string, amount: number): boolean {
    if (amount <= 0) return false;
    
    const company = queryOne('SELECT * FROM companies WHERE id = ?', [companyId]) as any;
    if (!company || company.total_assets < amount) return false;

    run('UPDATE companies SET total_assets = total_assets - ? WHERE id = ?', [amount, companyId]);
    run('UPDATE bank_accounts SET balance = balance + ? WHERE company_id = ?', [amount, companyId]);
    return true;
  }

  withdraw(companyId: string, amount: number): boolean {
    if (amount <= 0) return false;
    
    const account = this.getOrCreateAccount(companyId);
    if (account.balance < amount) return false;

    run('UPDATE bank_accounts SET balance = balance - ? WHERE company_id = ?', [amount, companyId]);
    run('UPDATE companies SET total_assets = total_assets + ? WHERE id = ?', [amount, companyId]);
    return true;
  }

  issueBond(companyId: string, faceValue: number, interestRate: number, durationDays: number): Bond | null {
    if (faceValue <= 0 || interestRate < 0) return null;

    const id = generateId();
    const timestamp = now();
    const maturityDate = timestamp + durationDays * 24 * 60 * 60 * 1000;

    run(`
      INSERT INTO bonds (id, company_id, face_value, interest_rate, maturity_date, issued_at, status)
      VALUES (?, ?, ?, ?, ?, ?, 'active')
    `, [id, companyId, faceValue, interestRate, maturityDate, timestamp]);

    run('UPDATE companies SET total_assets = total_assets + ? WHERE id = ?', [faceValue, companyId]);

    return { id, company_id: companyId, face_value: faceValue, interest_rate: interestRate, maturity_date: maturityDate, issued_at: timestamp, status: 'active' };
  }

  getCompanyBonds(companyId: string): Bond[] {
    return query('SELECT * FROM bonds WHERE company_id = ?', [companyId]) as Bond[];
  }

  issueLoan(lenderCompanyId: string, borrowerCompanyId: string, principal: number, interestRate: number, durationDays: number): Loan | null {
    if (principal <= 0 || interestRate < 0) return null;

    const lenderAccount = this.getOrCreateAccount(lenderCompanyId);
    if (lenderAccount.balance < principal) return null;

    const id = generateId();
    const timestamp = now();
    const dueDate = timestamp + durationDays * 24 * 60 * 60 * 1000;

    run('UPDATE bank_accounts SET balance = balance - ? WHERE company_id = ?', [principal, lenderCompanyId]);
    run('UPDATE companies SET total_assets = total_assets + ? WHERE id = ?', [principal, borrowerCompanyId]);

    run(`
      INSERT INTO loans (id, company_id, lender_company_id, principal, interest_rate, remaining_amount, due_date, created_at, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')
    `, [id, borrowerCompanyId, lenderCompanyId, principal, interestRate, principal * (1 + interestRate), dueDate, timestamp]);

    return {
      id, company_id: borrowerCompanyId, lender_company_id: lenderCompanyId,
      principal, interest_rate: interestRate, remaining_amount: principal * (1 + interestRate),
      due_date: dueDate, created_at: timestamp, status: 'active'
    };
  }

  repayLoan(companyId: string, loanId: string, amount: number): boolean {
    const loan = queryOne('SELECT * FROM loans WHERE id = ? AND company_id = ?', [loanId, companyId]) as Loan | undefined;
    if (!loan || loan.status !== 'active') return false;

    const company = queryOne('SELECT * FROM companies WHERE id = ?', [companyId]) as any;
    const actualPayment = Math.min(amount, loan.remaining_amount);
    
    if (company.total_assets < actualPayment) return false;

    const newRemaining = loan.remaining_amount - actualPayment;
    const isPaid = newRemaining <= 0;

    run('UPDATE companies SET total_assets = total_assets - ? WHERE id = ?', [actualPayment, companyId]);
    run('UPDATE bank_accounts SET balance = balance + ? WHERE company_id = ?', [actualPayment, loan.lender_company_id]);
    run('UPDATE loans SET remaining_amount = ?, status = ? WHERE id = ?', [
      Math.max(0, newRemaining), isPaid ? 'paid' : 'active', loanId
    ]);

    return true;
  }

  getCompanyLoans(companyId: string): Loan[] {
    return query('SELECT * FROM loans WHERE company_id = ? OR lender_company_id = ?', [companyId, companyId]) as Loan[];
  }

  getCurrentEconomicIndicators(): EconomicIndicator {
    const latest = queryOne('SELECT * FROM economic_indicators ORDER BY timestamp DESC LIMIT 1', []) as EconomicIndicator | undefined;
    if (latest) return latest;
    return this.recordEconomicSnapshot();
  }

  recordEconomicSnapshot(): EconomicIndicator {
    const id = generateId();
    const timestamp = now();
    const prev = queryOne('SELECT * FROM economic_indicators ORDER BY timestamp DESC LIMIT 1', []) as EconomicIndicator | undefined;
    
    const rate = clamp((prev?.global_interest_rate || 0.05) + randomFloat(-0.01, 0.01), 0.01, 0.2);
    const inflation = clamp((prev?.inflation_rate || 0) + randomFloat(-0.02, 0.02), -0.1, 0.2);
    const volume = (prev?.market_volume || 1000000) * randomFloat(0.9, 1.1);
    const index = clamp((prev?.market_index || 1000) + randomInt(-50, 50), 500, 5000);

    run(`
      INSERT INTO economic_indicators (id, timestamp, global_interest_rate, inflation_rate, market_volume, market_index)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [id, timestamp, rate, inflation, volume, index]);

    return { id, timestamp, global_interest_rate: rate, inflation_rate: inflation, market_volume: volume, market_index: index };
  }

  tickFinance(): void {
    const indicators = this.recordEconomicSnapshot();
    run('UPDATE bank_accounts SET interest_rate = ?', [indicators.global_interest_rate]);

    if (Math.random() < 0.02) {
      if (indicators.inflation_rate > 0.1) {
        eventService.createEvent(
          'inflation',
          '通胀警报！',
          `当前通胀率已达 ${(indicators.inflation_rate * 100).toFixed(2)}%，所有商会资产实际价值正在缩水。`,
          -indicators.inflation_rate * 1000
        );
      } else if (indicators.inflation_rate < -0.05) {
        eventService.createEvent(
          'deflation',
          '通缩发生！',
          `通缩率 ${(Math.abs(indicators.inflation_rate) * 100).toFixed(2)}%，货币购买力上升。`,
          Math.abs(indicators.inflation_rate) * 500
        );
      }
    }

    if (Math.random() < 0.005) {
      const severity = randomFloat(0.05, 0.25);
      eventService.createEvent(
        'financial_tsunami',
        '金融海啸来袭！',
        `跨维度金融市场剧烈动荡，所有商会资产预计缩水 ${(severity * 100).toFixed(2)}%。`,
        -severity * 5000
      );
      run('UPDATE companies SET total_assets = total_assets * ?', [1 - severity]);
    }

    const accounts = query('SELECT * FROM bank_accounts', []) as BankAccount[];
    for (const acc of accounts) {
      const dailyInterest = acc.balance * indicators.global_interest_rate / 365;
      run('UPDATE bank_accounts SET balance = balance + ? WHERE id = ?', [dailyInterest, acc.id]);
      this.recordIncome(acc.company_id, dailyInterest);
    }
  }

  private recordIncome(companyId: string, amount: number) {
    if (Math.abs(amount) < 0.01) return;
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

export const financeService = new FinanceService();
