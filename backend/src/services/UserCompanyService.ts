import { query, queryOne, run } from '../database';
import { generateId, now, hashPassword, comparePassword, generateToken } from '../utils';
import type { User, Company, Department, DepartmentType } from '../types';

export class UserService {
  async register(username: string, email: string, password: string): Promise<{ user: User; token: string } | null> {
    const existing = queryOne('SELECT id FROM users WHERE username = ? OR email = ?', [username, email]);
    if (existing) return null;

    const id = generateId();
    const timestamp = now();
    const passwordHash = await hashPassword(password);

    run(`
      INSERT INTO users (id, username, email, password_hash, company_id, role, created_at, last_login)
      VALUES (?, ?, ?, ?, NULL, 'member', ?, ?)
    `, [id, username, email, passwordHash, timestamp, timestamp]);

    const user = { id, username, email, password_hash: passwordHash, company_id: null, role: 'member' as const, created_at: timestamp, last_login: timestamp };
    const token = generateToken(user);

    return { user, token };
  }

  async login(username: string, password: string): Promise<{ user: User; token: string } | null> {
    const user = queryOne<User>('SELECT * FROM users WHERE username = ? OR email = ?', [username, username]);
    if (!user) return null;

    const valid = await comparePassword(password, user.password_hash);
    if (!valid) return null;

    run('UPDATE users SET last_login = ? WHERE id = ?', [now(), user.id]);

    const token = generateToken(user);
    return { user: { ...user, last_login: now() }, token };
  }

  getUserById(id: string): User | undefined {
    return queryOne<User>('SELECT * FROM users WHERE id = ?', [id]);
  }

  getCompanyMembers(companyId: string): User[] {
    return query<User>('SELECT id, username, email, role, company_id, created_at, last_login FROM users WHERE company_id = ?', [companyId]);
  }

  updateUserRole(userId: string, companyId: string, role: User['role']): boolean {
    const result = run('UPDATE users SET role = ? WHERE id = ? AND company_id = ?', [role, userId, companyId]);
    return result.changes > 0;
  }
}

export class CompanyService {
  createCompany(userId: string, name: string): Company | null {
    const existing = queryOne('SELECT id FROM companies WHERE name = ?', [name]);
    if (existing) return null;

    const user = queryOne<User>('SELECT * FROM users WHERE id = ?', [userId]);
    if (!user || user.company_id) return null;

    const id = generateId();
    const timestamp = now();

    run(`
      INSERT INTO companies (id, name, owner_id, total_assets, influence, level, created_at)
      VALUES (?, ?, ?, 10000, 0, 1, ?)
    `, [id, name, userId, timestamp]);

    run("UPDATE users SET company_id = ?, role = 'president' WHERE id = ?", [id, userId]);

    this.initDepartments(id);

    return { id, name, owner_id: userId, total_assets: 10000, influence: 0, level: 1, created_at: timestamp };
  }

  private initDepartments(companyId: string) {
    const depts: { type: DepartmentType; name: string }[] = [
      { type: 'transport', name: '运输部' },
      { type: 'finance', name: '金融部' },
      { type: 'intelligence', name: '情报部' },
      { type: 'culture', name: '文化部' },
    ];

    const timestamp = now();
    for (const dept of depts) {
      const id = generateId();
      run(`
        INSERT INTO departments (id, company_id, type, name, level, director_id, budget, weekly_income, created_at)
        VALUES (?, ?, ?, ?, 1, NULL, 1000, 0, ?)
      `, [id, companyId, dept.type, dept.name, timestamp]);
    }
  }

  joinCompany(userId: string, companyId: string): boolean {
    const user = queryOne<User>('SELECT * FROM users WHERE id = ?', [userId]);
    if (!user || user.company_id) return false;

    run("UPDATE users SET company_id = ?, role = 'member' WHERE id = ?", [companyId, userId]);
    return true;
  }

  getCompanyById(id: string): Company | undefined {
    return queryOne<Company>('SELECT * FROM companies WHERE id = ?', [id]);
  }

  getDepartments(companyId: string): Department[] {
    return query<Department>('SELECT * FROM departments WHERE company_id = ?', [companyId]);
  }

  getDepartmentByType(companyId: string, type: DepartmentType): Department | undefined {
    return queryOne<Department>('SELECT * FROM departments WHERE company_id = ? AND type = ?', [companyId, type]);
  }

  appointDirector(companyId: string, deptType: DepartmentType, directorId: string): boolean {
    const result = run(`
      UPDATE departments SET director_id = ? WHERE company_id = ? AND type = ?
    `, [directorId, companyId, deptType]);
    return result.changes > 0;
  }

  upgradeDepartment(companyId: string, deptType: DepartmentType): boolean {
    const dept = this.getDepartmentByType(companyId, deptType);
    if (!dept) return false;

    const cost = dept.level * 10000;
    const company = this.getCompanyById(companyId);
    if (!company || company.total_assets < cost) return false;

    run('UPDATE companies SET total_assets = total_assets - ? WHERE id = ?', [cost, companyId]);
    run('UPDATE departments SET level = level + 1 WHERE id = ?', [dept.id]);
    run('UPDATE companies SET influence = influence + ? WHERE id = ?', [dept.level * 10, companyId]);

    return true;
  }

  setDepartmentBudget(companyId: string, deptType: DepartmentType, budget: number): boolean {
    const result = run(`
      UPDATE departments SET budget = ? WHERE company_id = ? AND type = ?
    `, [budget, companyId, deptType]);
    return result.changes > 0;
  }
}

export const userService = new UserService();
export const companyService = new CompanyService();
