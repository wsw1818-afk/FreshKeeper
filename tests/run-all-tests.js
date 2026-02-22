/**
 * FreshKeeper 전체 테스트 실행 스크립트
 * Unit 테스트와 E2E 테스트를 순차적으로 실행하고 통합 리포트를 생성합니다.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function runCommand(command, description) {
    log(`\n${'='.repeat(60)}`, 'cyan');
    log(`📝 ${description}`, 'cyan');
    log(`${'='.repeat(60)}\n`, 'cyan');

    try {
        const result = execSync(command, {
            encoding: 'utf-8',
            stdio: 'pipe',
            cwd: path.join(__dirname, '..')
        });
        log(result, 'green');
        return { success: true, output: result };
    } catch (error) {
        log(error.stdout || error.message, 'red');
        return { success: false, output: error.stdout || error.message, error };
    }
}

// 테스트 결과 저장
const results = {
    timestamp: new Date().toISOString(),
    unit: null,
    e2e: null,
};

log(`${'='.repeat(60)}`, 'blue');
log('🧪 FreshKeeper 전체 테스트 시작', 'blue');
log(`${'='.repeat(60)}`, 'blue');
log(`시작 시간: ${new Date().toLocaleString('ko-KR')}\n`);

// Phase 1: Unit 테스트 (Jest)
log('Phase 1: Unit/Integration 테스트 실행 중...', 'yellow');
const unitResult = runCommand(
    'npm run test:unit',
    'Unit/Integration 테스트 (Jest)'
);
results.unit = {
    success: unitResult.success,
    timestamp: new Date().toISOString(),
};

// Phase 2: E2E 테스트 (Playwright) - Expo 서버가 필요
log('\nPhase 2: E2E 테스트 실행 중...', 'yellow');
log('⚠️  주의: E2E 테스트는 Expo 웹 서버가 실행 중이어야 합니다.', 'yellow');
log('   먼저 "npm run web"을 실행하세요.\n', 'yellow');

const e2eResult = runCommand(
    'npx playwright test --workers=2 --reporter=list',
    'E2E 테스트 (Playwright)'
);
results.e2e = {
    success: e2eResult.success,
    timestamp: new Date().toISOString(),
};

// 리포트 생성
log(`\n${'='.repeat(60)}`, 'blue');
log('📊 테스트 결과 요약', 'blue');
log(`${'='.repeat(60)}\n`, 'blue');

const unitStatus = results.unit.success ? '✅ 통과' : '❌ 실패';
const e2eStatus = results.e2e.success ? '✅ 통과' : '❌ 실패';

log(`Unit/Integration 테스트: ${unitStatus}`, results.unit.success ? 'green' : 'red');
log(`E2E 테스트: ${e2eStatus}`, results.e2e.success ? 'green' : 'red');

const allPassed = results.unit.success && results.e2e.success;
log(`\n총 결과: ${allPassed ? '✅ 모든 테스트 통과' : '❌ 일부 테스트 실패'}`, allPassed ? 'green' : 'red');
log(`완료 시간: ${new Date().toLocaleString('ko-KR')}`);

// 결과를 JSON 파일로 저장
const reportPath = path.join(__dirname, 'coverage', 'test-report.json');
if (!fs.existsSync(path.dirname(reportPath))) {
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
}
fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
log(`\n📄 상세 리포트 저장됨: ${reportPath}`, 'cyan');

process.exit(allPassed ? 0 : 1);
