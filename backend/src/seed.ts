import { initDatabase, query, run } from './database';
import { hashPassword, generateId, now } from './utils';
import { userService, companyService } from './services/UserCompanyService';
import { transportService } from './services/TransportService';
import { financeService } from './services/FinanceService';
import { intelligenceService } from './services/IntelligenceService';
import { cultureService } from './services/CultureService';

async function seed() {
  console.log('开始初始化测试数据...');
  await initDatabase();

  const tables = ['users', 'companies', 'departments', 'portals', 'caravans', 'bank_accounts', 'bonds', 'loans', 'spies', 'artworks', 'festivals', 'income_records', 'game_events'];
  for (const t of tables) {
    run(`DELETE FROM ${t}`);
  }

  console.log('创建测试用户和商会...');

  const names = ['星宇商会', '暮光贸易', '银河商盟', '时空财团', '虚空实业', '曙光集团', '星辰物流', '奥术金融'];
  const owners: { username: string; password: string; company: string }[] = [
    { username: 'admin', password: 'admin123', company: names[0] },
    { username: 'user1', password: 'user123', company: names[1] },
    { username: 'user2', password: 'user123', company: names[2] },
    { username: 'user3', password: 'user123', company: names[3] },
  ];

  for (const o of owners) {
    const reg = await userService.register(o.username, `${o.username}@test.com`, o.password);
    if (reg) {
      companyService.createCompany(reg.user.id, o.company);
      const company = companyService.getCompanyById(reg.user.company_id!);
      if (company) {
        const bonus = Math.floor(Math.random() * 50000) + 20000;
        run('UPDATE companies SET total_assets = total_assets + ?, influence = ? WHERE id = ?', [bonus, Math.floor(Math.random() * 500) + 100, company.id]);
      }
    }
  }

  const companies = query<any>('SELECT * FROM companies');
  
  console.log('创建传送门和商队...');
  const dimensions = ['地球宇宙', '魔法大陆', '机械纪元', '仙侠世界', '赛博空间', '神域维度'];
  for (const c of companies) {
    for (let i = 0; i < 3; i++) {
      const src = dimensions[Math.floor(Math.random() * dimensions.length)];
      let tgt = dimensions[Math.floor(Math.random() * dimensions.length)];
      while (tgt === src) tgt = dimensions[Math.floor(Math.random() * dimensions.length)];
      transportService.createPortal(c.id, `${src}↔${tgt}通道`, src, tgt, Math.floor(Math.random() * 8) + 1);
    }

    const portals = transportService.getCompanyPortals(c.id);
    if (portals.length > 0) {
      for (let i = 0; i < 2; i++) {
        const portal = portals[Math.floor(Math.random() * portals.length)];
        transportService.createCaravan(c.id, `商队-${String.fromCharCode(65 + i)}${c.id.slice(0, 4)}`, portal.id, Math.floor(Math.random() * 5000) + 500, Math.floor(Math.random() * 80) + 20);
      }
    }

    financeService.deposit(c.id, Math.floor(Math.random() * 30000) + 5000);
    financeService.issueBond(c.id, 10000, 0.08, 30);

    for (let i = 0; i < 2; i++) {
      intelligenceService.createSpy(c.id, `间谍-${String.fromCharCode(65 + i)}`, Math.floor(Math.random() * 50) + 40, Math.floor(Math.random() * 50) + 40);
    }

    for (let i = 0; i < 3; i++) {
      const cats: any = ['music', 'dance', 'food', 'art'];
      cultureService.submitArtwork(c.id, c.owner_id, `作品${i + 1}-${c.name}`, `来自${c.name}的精彩作品`, cats[Math.floor(Math.random() * cats.length)], null);
    }

    for (let i = 0; i < 10; i++) {
      const ts = now() - Math.floor(Math.random() * 7 * 24 * 3600 * 1000);
      const amt = Math.floor(Math.random() * 5000) - 1000;
      const depts: any = ['transport', 'finance', 'intelligence', 'culture'];
      run(`
        INSERT INTO income_records (id, company_id, department, amount, timestamp)
        VALUES (?, ?, ?, ?, ?)
      `, [generateId(), c.id, depts[Math.floor(Math.random() * depts.length)], amt, ts]);
    }
  }

  console.log('创建艺术节...');
  cultureService.createFestival('首届跨宇宙音乐节', 'music', 7);
  cultureService.createFestival('银河美食节', 'food', 5);

  console.log('创建跨维度商业塔...');
  if (companies.length >= 2) {
    const towerCompanies = companies.slice(0, 3).map(c => c.id);
    run(`
      INSERT INTO commercial_towers (id, company_ids, level, total_contribution, required_contribution, upgrade_status, created_at)
      VALUES (?, ?, 2, 150000, 500000, 'idle', ?)
    `, [generateId(), JSON.stringify(towerCompanies), now()]);
  }

  console.log('记录经济指标...');
  for (let i = 0; i < 20; i++) {
    const ts = now() - i * 60 * 60 * 1000;
    run(`
      INSERT INTO economic_indicators (id, timestamp, global_interest_rate, inflation_rate, market_volume, market_index)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [generateId(), ts, 0.03 + Math.random() * 0.05, Math.random() * 0.1 - 0.03, 1000000 + Math.random() * 500000, 950 + Math.floor(Math.random() * 100)]);
  }

  console.log('✅ 测试数据初始化完成！');
  console.log('\n测试账号:');
  for (const o of owners) {
    console.log(`  用户名: ${o.username}  密码: ${o.password}  商会: ${o.company}`);
  }
}

seed().catch(console.error);
