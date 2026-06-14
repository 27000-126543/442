const axios = require('axios');

const API = 'http://localhost:3002/api';
const api = axios.create({ baseURL: API, timeout: 10000 });

async function login(username, password) {
  try {
    const res = await api.post('/auth/login', { username, password });
    return { token: res.data.token, user: res.data.user };
  } catch (e) {
    return null;
  }
}

async function register(username, email, password) {
  const res = await api.post('/auth/register', { username, email, password });
  return { token: res.data.token, user: res.data.user };
}

async function authAxios(token) {
  return axios.create({
    baseURL: API,
    timeout: 10000,
    headers: { Authorization: `Bearer ${token}` },
  });
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  console.log('========= 🧪 开始测试 =========\n');

  // ========= 准备账户 =========
  console.log('【步骤1】准备测试账户...');
  let accA = await login('test_president', '123456');
  if (!accA) accA = await register('test_president', 'president@test.com', '123456');
  let accB = await login('test_vice', '123456');
  if (!accB) accB = await register('test_vice', 'vice@test.com', '123456');
  let accC = await login('test_finance', '123456');
  if (!accC) accC = await register('test_finance', 'finance@test.com', '123456');
  let accD = await login('test_beta', '123456');
  if (!accD) accD = await register('test_beta', 'beta@test.com', '123456');
  console.log(`  ✓ 4个账户就绪`);

  const Ax = await authAxios(accA.token);
  const Bx = await authAxios(accB.token);
  const Cx = await authAxios(accC.token);
  const Dx = await authAxios(accD.token);

  let meA = (await Ax.get('/auth/me')).data;
  let meB = (await Bx.get('/auth/me')).data;
  let meC = (await Cx.get('/auth/me')).data;
  let meD = (await Dx.get('/auth/me')).data;

  // 确保A有公司
  if (!meA.company_id) { await Ax.post('/auth/companies', { name: '商会Alpha' }); meA = (await Ax.get('/auth/me')).data; }
  const alphaCompanyId = meA.company_id;
  // 确保D有自己的公司
  if (!meD.company_id) { await Dx.post('/auth/companies', { name: '商会Beta' }); meD = (await Dx.get('/auth/me')).data; }
  const betaCompanyId = meD.company_id;

  // B和C加入Alpha
  if (meB.company_id !== alphaCompanyId) { await Bx.post(`/auth/companies/${alphaCompanyId}/join`); meB = (await Bx.get('/auth/me')).data; }
  if (meC.company_id !== alphaCompanyId) { await Cx.post(`/auth/companies/${alphaCompanyId}/join`); meC = (await Cx.get('/auth/me')).data; }

  // 设置角色
  await Ax.put(`/auth/members/${meB.id}/role`, { role: 'vice_president' });
  await Ax.put(`/auth/members/${meC.id}/role`, { role: 'finance_officer' });
  meB = (await Bx.get('/auth/me')).data;
  meC = (await Cx.get('/auth/me')).data;
  console.log(`  ✓ 组织架构就绪: B=${meB.role} C=${meC.role} 都在Alpha`);

  // 给双方注入测试资源
  await Ax.post('/game/debug/grant-gold', { amount: 100000 });
  await Dx.post('/game/debug/grant-gold', { amount: 100000 });
  await Ax.post('/game/debug/grant-asset', { symbol: 'mana_core', amount: 100 });
  await Dx.post('/game/debug/grant-asset', { symbol: 'mana_core', amount: 100 });
  console.log('  ✓ 注入初始金币和资产');

  // ========= 需求2：绕过审批升级失败 =========
  console.log('\n【需求2测试】升塔入口收紧...');
  let testTower;
  try {
    testTower = (await Ax.post('/game/towers', { name: '审批测试塔' + Date.now(), dimension: '测试维度' })).data;
  } catch (e) {
    let towers = (await Ax.get('/game/towers')).data;
    testTower = towers[0];
  }
  const lvBefore = testTower.level;

  let upgradeRejected = false;
  try {
    await Ax.post(`/game/towers/${testTower.id}/upgrade`);
  } catch (e) {
    upgradeRejected = true;
    console.log(`  ✓ 直接升级被拒绝: ${e.response?.data?.error}`);
  }
  if (!upgradeRejected) console.log('  ✗ 直接升级没有被拒绝！');

  towers = (await Ax.get('/game/towers')).data;
  const lvAfterDirect = towers.find(t => t.id === testTower.id)?.level ?? lvBefore;
  console.log(`  ✓ 等级未变: ${lvBefore}→${lvAfterDirect}  ${lvBefore === lvAfterDirect ? '✓' : '✗'}`);

  // ========= 需求1：三级审批 =========
  console.log('\n【需求1测试】三级审批分别确认...');

  // 清理已有pending审批
  for (const a of (await Ax.get('/game/approvals')).data) {
    if (a.status === 'pending') { try { await Ax.post(`/game/approvals/${a.id}/reject`); } catch(e){} }
  }

  // 给塔贡献满
  towers = (await Ax.get('/game/towers')).data;
  testTower = towers.find(t => t.id === testTower.id);
  const needed = (testTower.required_contribution || 1000) - (testTower.total_contribution || 0);
  if (needed > 0) {
    try {
      await Ax.post(`/game/towers/${testTower.id}/contribute`, { amount: needed + 500 });
    } catch (e) {
      console.log(`  ! 贡献失败: ${e.response?.data?.error}, tower.company_ids=${testTower.company_ids}`);
    }
  }

  towers = (await Ax.get('/game/towers')).data;
  testTower = towers.find(t => t.id === testTower.id);
  console.log(`  塔: Lv.${testTower.level}  贡献=${testTower.total_contribution}/${testTower.required_contribution}`);

  // 发起升级申请
  let approval;
  try {
    const resp = (await Ax.post(`/game/towers/${testTower.id}/request-upgrade`)).data;
    approval = resp.approval || resp;
  } catch (e) {
    const list = (await Ax.get('/game/approvals')).data;
    approval = list.find(a => a.status === 'pending' && a.type === 'tower_upgrade');
  }
  if (!approval) { console.log('  ✗ 无法创建升级审批'); return; }
  approval = (await Ax.get(`/game/approvals/${approval.id}`)).data;
  console.log(`  审批初始: L1=${!!approval.approved_level_1} L2=${!!approval.approved_level_2} L3=${!!approval.approved_level_3} status=${approval.status}`);

  // L1: 财务官
  approval = (await Cx.post(`/game/approvals/${approval.id}/approve`)).data;
  console.log(`  财务官后: L1=${!!approval.approved_level_1} L2=${!!approval.approved_level_2} L3=${!!approval.approved_level_3} status=${approval.status}`);
  towers = (await Ax.get('/game/towers')).data;
  console.log(`    塔等级: ${towers.find(t=>t.id===testTower.id).level} (保持Lv.${lvBefore}? ${towers.find(t=>t.id===testTower.id).level===lvBefore?'✓':'✗'})`);

  // L2: 副会长
  if (approval.status === 'pending') {
    approval = (await Bx.post(`/game/approvals/${approval.id}/approve`)).data;
    console.log(`  副会长后: L1=${!!approval.approved_level_1} L2=${!!approval.approved_level_2} L3=${!!approval.approved_level_3} status=${approval.status}`);
    towers = (await Ax.get('/game/towers')).data;
    console.log(`    塔等级: ${towers.find(t=>t.id===testTower.id).level} (保持Lv.${lvBefore}? ${towers.find(t=>t.id===testTower.id).level===lvBefore?'✓':'✗'})`);
  }

  // L3: 会长
  if (approval.status === 'pending') {
    approval = (await Ax.post(`/game/approvals/${approval.id}/approve`)).data;
    console.log(`  会长后:   L1=${!!approval.approved_level_1} L2=${!!approval.approved_level_2} L3=${!!approval.approved_level_3} status=${approval.status}`);
    towers = (await Ax.get('/game/towers')).data;
    const lvFinal = towers.find(t=>t.id===testTower.id).level;
    console.log(`    塔等级: ${lvFinal} (升到Lv.${lvBefore+1}? ${lvFinal===lvBefore+1?'✓':'✗'})`);
  }

  // ========= 需求3：交易所成交 =========
  console.log('\n【需求3测试】跨服交易所成交...');
  const SYMBOL = 'mana_core';

  // 清理旧订单
  for (const o of (await Ax.get('/game/exchange/orders')).data) {
    if (o.status === 'pending' || o.status === 'partial') try { await Ax.post(`/game/exchange/orders/${o.id}/cancel`); } catch(e){}
  }
  for (const o of (await Dx.get('/game/exchange/orders')).data) {
    if (o.status === 'pending' || o.status === 'partial') try { await Dx.post(`/game/exchange/orders/${o.id}/cancel`); } catch(e){}
  }

  const beforeA = (await Ax.get('/auth/my/company')).data;
  const beforeD = (await Dx.get('/auth/my/company')).data;
  const beforeAAssets = (await Ax.get('/game/exchange/assets')).data;
  const beforeDAssets = (await Dx.get('/game/exchange/assets')).data;

  const AMOUNT = 5;
  const PRICE = 100;
  const VALUE = AMOUNT * PRICE;
  const FEE = VALUE * 0.01;

  console.log(`  Beta卖${AMOUNT}个×${PRICE}金币=成交额${VALUE}, 手续费${FEE}`);
  console.log(`  Alpha买${AMOUNT}个`);
  console.log(`  预期: Alpha金币-${VALUE+FEE} 资产+${AMOUNT}`);
  console.log(`  预期: Beta金币+${VALUE-FEE}  资产-${AMOUNT}`);

  const sellOrder = (await Dx.post('/game/exchange/orders/sell', { symbol: SYMBOL, price: PRICE, amount: AMOUNT })).data;
  const buyOrder = (await Ax.post('/game/exchange/orders/buy', { symbol: SYMBOL, price: PRICE, amount: AMOUNT })).data;
  await sleep(300);

  const afterA = (await Ax.get('/auth/my/company')).data;
  const afterD = (await Dx.get('/auth/my/company')).data;
  const afterAAssets = (await Ax.get('/game/exchange/assets')).data;
  const afterDAssets = (await Dx.get('/game/exchange/assets')).data;

  const aGold = afterA.company.total_assets - beforeA.company.total_assets;
  const aAsset = (afterAAssets[SYMBOL] || 0) - (beforeAAssets[SYMBOL] || 0);
  const dGold = afterD.company.total_assets - beforeD.company.total_assets;
  const dAsset = (afterDAssets[SYMBOL] || 0) - (beforeDAssets[SYMBOL] || 0);

  const finalBuy = (await Ax.get('/game/exchange/orders')).data.find(o => o.id === buyOrder.id);
  const finalSell = (await Dx.get('/game/exchange/orders')).data.find(o => o.id === sellOrder.id);
  const trades = (await Ax.get('/game/exchange/trades')).data;
  const trade = trades.find(t => t.buy_order_id === buyOrder.id || t.sell_order_id === buyOrder.id);

  console.log(`\n  实际结果:`);
  console.log(`    Alpha金币: ${aGold.toFixed(2)}  (预期 ${-(VALUE+FEE)})  ${Math.abs(aGold - (-(VALUE+FEE))) < 0.01 ? '✓' : '✗'}`);
  console.log(`    Alpha资产: ${aAsset.toFixed(2)}  (预期 +${AMOUNT})  ${Math.abs(aAsset - AMOUNT) < 0.01 ? '✓' : '✗'}`);
  console.log(`    Beta金币:  ${dGold.toFixed(2)}  (预期 +${VALUE-FEE})  ${Math.abs(dGold - (VALUE-FEE)) < 0.01 ? '✓' : '✗'}`);
  console.log(`    Beta资产:  ${dAsset.toFixed(2)}  (预期 -${AMOUNT})  ${Math.abs(dAsset - (-AMOUNT)) < 0.01 ? '✓' : '✗'}`);
  console.log(`    买单状态: ${finalBuy?.status} (filled? ${finalBuy?.status==='filled'?'✓':'✗'})`);
  console.log(`    卖单状态: ${finalSell?.status} (filled? ${finalSell?.status==='filled'?'✓':'✗'})`);
  console.log(`    手续费记录: fee=${trade?.fee} (预期 ${FEE})  ${trade && Math.abs(trade.fee-FEE) < 0.01 ? '✓' : '✗'}`);

  // ========= 需求4：全服订单簿 =========
  console.log('\n【需求4测试】全服订单簿...');

  // 清理
  for (const o of (await Ax.get('/game/exchange/orders')).data) {
    if (o.status === 'pending' || o.status === 'partial') try { await Ax.post(`/game/exchange/orders/${o.id}/cancel`); } catch(e){}
  }
  for (const o of (await Dx.get('/game/exchange/orders')).data) {
    if (o.status === 'pending' || o.status === 'partial') try { await Dx.post(`/game/exchange/orders/${o.id}/cancel`); } catch(e){}
  }

  await Dx.post('/game/exchange/orders/sell', { symbol: SYMBOL, price: 200, amount: 5 });
  await Dx.post('/game/exchange/orders/sell', { symbol: SYMBOL, price: 210, amount: 3 });
  await Ax.post('/game/exchange/orders/buy', { symbol: SYMBOL, price: 150, amount: 7 });
  await Ax.post('/game/exchange/orders/buy', { symbol: SYMBOL, price: 140, amount: 2 });

  const ob = (await Ax.get('/game/exchange/orderbook', { params: { symbol: SYMBOL } })).data;
  console.log(`  订单簿: 卖盘${ob.sellOrders.length}条  买盘${ob.buyOrders.length}条`);

  const betaSell = ob.sellOrders.filter(o => o.company_id === betaCompanyId).length;
  const alphaBuy = ob.buyOrders.filter(o => o.company_id === alphaCompanyId).length;
  console.log(`  卖盘含Beta的单: ${betaSell}/2  ${betaSell===2?'✓':'✗'}`);
  console.log(`  买盘含Alpha的单: ${alphaBuy}/2  ${alphaBuy===2?'✓':'✗'}`);
  const sellSorted = ob.sellOrders.length>=2 && ob.sellOrders[0].price < ob.sellOrders[1].price;
  const buySorted = ob.buyOrders.length>=2 && ob.buyOrders[0].price > ob.buyOrders[1].price;
  console.log(`  卖单按价格升序: ${sellSorted?'✓':'✗'}`);
  console.log(`  买单按价格降序: ${buySorted?'✓':'✗'}`);
  const includesOtherCompany = ob.sellOrders.some(o => o.company_id !== alphaCompanyId);
  console.log(`  包含其他商会挂单: ${includesOtherCompany?'✓':'✗'}`);

  console.log('\n========= ✅ 测试完成 =========');
}

main().catch(e => { console.error('\n❌ 测试失败:', e.response?.data || e.message || e); process.exit(1); });
