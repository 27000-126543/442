const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjNiMTY1NDQ1LWFiMjYtNDg2Ny1iYTI0LTc0ZGY5NWMwMmZmNCIsInVzZXJuYW1lIjoidGVzdHVzZXIiLCJjb21wYW55X2lkIjpudWxsLCJyb2xlIjoibWVtYmVyIiwiaWF0IjoxNzgxNDM0MDE0LCJleHAiOjE3ODIwMzg4MTR9.zpdbThiSYN-5GOriFoGFSJzzbXZTUsWt9gs_yjEo2EU';
const BASE = 'http://localhost:3001/api';

async function test(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Authorization': 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let data = {};
  try { data = JSON.parse(text); } catch(e) {}
  console.log(method + ' ' + path + ' -> ' + res.status + (data.error ? ' ERROR: ' + data.error : ''));
  return data;
}

async function run() {
  console.log('=== 运输部 ===');
  await test('GET', '/game/transport/portals');
  console.log('\n=== 金融部 ===');
  await test('POST', '/game/finance/deposit', {amount:1000});
  await test('GET', '/game/finance/account');
  await test('GET', '/game/finance/economy');
  console.log('\n=== 情报部 ===');
  await test('GET', '/game/intelligence/spies');
  console.log('\n=== 文化部 ===');
  await test('GET', '/game/culture/festivals');
  console.log('\n=== 审批流 ===');
  await test('POST', '/game/approvals', {title:'升级运输部', description:'将运输部升级到2级', requiredLevel:1, payload:{departmentType:'transport'}});
  await test('GET', '/game/approvals');
  console.log('\n=== 事件 ===');
  await test('GET', '/game/events');
  console.log('\n=== 产业报告 ===');
  await test('GET', '/game/reports/summary');
  console.log('\n=== 排行榜 ===');
  await test('GET', '/game/leaderboard');
  console.log('\n=== 多维商业塔 ===');
  await test('GET', '/game/towers');
  console.log('\n✅ 所有API测试完成！');
}
run().catch(e => console.error(e));
