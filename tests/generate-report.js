/**
 * 테스트 결과를 HTML 리포트로 생성하는 스크립트
 * 사용법: npm run test:report
 * 결과: tests/coverage/test-report.html (브라우저에서 열기)
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPORT_DIR = path.join(__dirname, 'coverage');
const REPORT_PATH = path.join(REPORT_DIR, 'test-report.html');

// Jest JSON 결과 생성
const JSON_RESULT_PATH = path.join(REPORT_DIR, 'test-results.json');

try {
  // Jest를 JSON reporter로 실행
  execSync(
    `npx jest --config jest.config.ts --json --outputFile="${JSON_RESULT_PATH}" --coverage 2>&1`,
    { cwd: path.join(__dirname, '..'), encoding: 'utf8', stdio: 'pipe' }
  );
} catch (e) {
  // Jest가 테스트 실패로 exit code 1을 반환해도 JSON은 생성됨
  if (!fs.existsSync(JSON_RESULT_PATH)) {
    console.error('테스트 실행 실패:', e.message);
    process.exit(1);
  }
}

const results = JSON.parse(fs.readFileSync(JSON_RESULT_PATH, 'utf8'));

// HTML 리포트 생성
const now = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
const totalTests = results.numTotalTests;
const passedTests = results.numPassedTests;
const failedTests = results.numFailedTests;
const allPassed = failedTests === 0;
const passRate = totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0;

let testSuiteRows = '';
for (const suite of results.testResults) {
  const suiteName = path.basename(suite.name || suite.testFilePath || 'unknown');
  const suiteStatus = suite.status === 'passed' ? '✅' : '❌';
  const duration = ((suite.endTime - suite.startTime) / 1000).toFixed(2);

  // Jest 30+ 은 assertionResults, 이전 버전은 testResults
  const assertions = suite.assertionResults || suite.testResults || [];

  let testRows = '';
  for (const test of assertions) {
    const icon = test.status === 'passed' ? '✅' : test.status === 'failed' ? '❌' : '⏭️';
    const failMsg = test.failureMessages?.length
      ? `<pre class="error">${escapeHtml(test.failureMessages.join('\n')).slice(0, 500)}</pre>`
      : '';
    testRows += `
      <tr class="${test.status}">
        <td>${icon}</td>
        <td>${escapeHtml((test.ancestorTitles || []).join(' > '))}</td>
        <td>${escapeHtml(test.title || test.fullName || '')}</td>
        <td>${test.duration ?? 0}ms</td>
      </tr>
      ${failMsg ? `<tr><td colspan="4">${failMsg}</td></tr>` : ''}`;
  }

  testSuiteRows += `
    <div class="suite">
      <h3>${suiteStatus} ${escapeHtml(suiteName)} <span class="duration">(${duration}s)</span></h3>
      <table>
        <thead><tr><th>상태</th><th>그룹</th><th>테스트명</th><th>시간</th></tr></thead>
        <tbody>${testRows}</tbody>
      </table>
    </div>`;
}

const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FreshKeeper 테스트 리포트</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5; padding: 24px; }
    .header { text-align: center; margin-bottom: 32px; }
    .header h1 { font-size: 28px; color: #1a1a1a; margin-bottom: 8px; }
    .header .time { color: #666; font-size: 14px; }
    .summary { display: flex; gap: 16px; justify-content: center; margin-bottom: 32px; flex-wrap: wrap; }
    .card { background: #fff; border-radius: 12px; padding: 20px 32px; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,.08); min-width: 120px; }
    .card .number { font-size: 36px; font-weight: 800; }
    .card .label { font-size: 13px; color: #666; margin-top: 4px; }
    .card.pass .number { color: #4CAF50; }
    .card.fail .number { color: #F44336; }
    .card.total .number { color: #2196F3; }
    .card.rate .number { color: ${allPassed ? '#4CAF50' : '#FF9800'}; }
    .status-banner { text-align: center; padding: 16px; border-radius: 12px; margin-bottom: 24px; font-size: 18px; font-weight: 700; }
    .status-banner.pass { background: #E8F5E9; color: #2E7D32; }
    .status-banner.fail { background: #FFEBEE; color: #C62828; }
    .suite { background: #fff; border-radius: 12px; margin-bottom: 16px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,.05); }
    .suite h3 { font-size: 16px; margin-bottom: 12px; }
    .suite .duration { color: #999; font-weight: 400; font-size: 13px; }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; padding: 8px 12px; border-bottom: 2px solid #eee; font-size: 13px; color: #666; }
    td { padding: 8px 12px; border-bottom: 1px solid #f0f0f0; font-size: 13px; }
    tr.passed td { color: #333; }
    tr.failed td { color: #C62828; background: #FFF5F5; }
    .error { background: #FFF0F0; padding: 8px; border-radius: 6px; font-size: 11px; color: #C62828; max-height: 200px; overflow: auto; margin: 4px 0; white-space: pre-wrap; word-break: break-all; }
    .footer { text-align: center; margin-top: 32px; color: #999; font-size: 12px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>🧪 FreshKeeper 테스트 리포트</h1>
    <p class="time">생성: ${now}</p>
  </div>

  <div class="status-banner ${allPassed ? 'pass' : 'fail'}">
    ${allPassed ? '✅ 모든 테스트 통과! 앱 적용 가능합니다.' : '❌ 실패한 테스트가 있습니다. 수정 후 재실행하세요.'}
  </div>

  <div class="summary">
    <div class="card total"><div class="number">${totalTests}</div><div class="label">전체</div></div>
    <div class="card pass"><div class="number">${passedTests}</div><div class="label">성공</div></div>
    <div class="card fail"><div class="number">${failedTests}</div><div class="label">실패</div></div>
    <div class="card rate"><div class="number">${passRate}%</div><div class="label">통과율</div></div>
  </div>

  ${testSuiteRows}

  <div class="footer">
    <p>커버리지 상세: <a href="index.html">coverage/index.html</a></p>
    <p>FreshKeeper v1.0.0 | Jest 자동화 테스트</p>
  </div>
</body>
</html>`;

if (!fs.existsSync(REPORT_DIR)) {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
}
fs.writeFileSync(REPORT_PATH, html, 'utf8');
console.log(`\n📊 테스트 리포트 생성 완료: ${REPORT_PATH}`);
console.log(`   브라우저에서 열기: start ${REPORT_PATH}`);

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
