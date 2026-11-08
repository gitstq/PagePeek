/*
 * PagePeek 单元测试 —— 使用 Node 内置 node:test，不需要安装任何测试框架。
 * 运行：npm test
 * 夹具 tests/fixture.db 由 scripts/make_fixture.py 生成，覆盖多页 B-tree、
 * 二级索引、溢出页、删除后的页内空洞、UTF-8 中文与全部基础列类型。
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const core = require('../src/sqlite.js');

const FIXTURE = path.join(__dirname, 'fixture.db');

function load() {
  return core.parse(fs.readFileSync(FIXTURE));
}

test('解析真实数据库：文件头字段正确', () => {
  const r = load();
  assert.equal(r.ok, true);
  assert.equal(r.header.pageSize, 4096);
  assert.equal(r.usablePageSize, 4096);
  assert.ok(r.pageCount > 50, '应识别为多页数据库');
  assert.equal(r.fileSize, fs.statSync(FIXTURE).size);
  assert.equal(r.header.journalMode, 'rollback');
  assert.equal(r.pages.length, Object.values(r.pageTypeCounts)
    .filter((_, i) => i < 4).reduce((a, b) => a + b, 0));
});

test('1 号页 cell 指针以页起始为基准，schema 名称完整可读', () => {
  const r = load();
  const names = r.schema.map((s) => s.name);
  assert.ok(names.includes('users'), 'users 表应出现在 schema 中');
  assert.ok(names.includes('blobs'));
  assert.ok(names.includes('meta'));
  assert.ok(names.includes('idx_users_email'));
  const users = r.schema.find((s) => s.name === 'users');
  assert.equal(users.type, 'table');
  assert.ok(users.rootPage > 1);
  assert.match(users.sql, /CREATE TABLE users/);
});

test('逐表统计：行数、B-tree 深度、溢出页', () => {
  const r = load();
  const byName = Object.fromEntries(r.tables.map((t) => [t.name, t]));
  assert.equal(byName.users.rowCount, 1029, '1200 行删除 id%7==0 后应剩 1029 行');
  assert.equal(byName.users.btreeDepth, 2);
  assert.equal(byName.blobs.rowCount, 5);
  assert.equal(byName.meta.rowCount, 2);
  assert.ok(byName.blobs.overflowPages > 0, '12000 字节 BLOB 必须触发溢出页');
  assert.ok(byName['idx_users_email'].rowCount > 0, '索引条目也应被计数');
  assert.ok(byName.users.avgRowBytes > 0);
});

test('健康诊断：评分与比率在合法区间，溢出页被报告', () => {
  const r = load();
  assert.ok(r.health.score >= 0 && r.health.score <= 100);
  assert.ok(r.health.averagePageUtilization > 0 && r.health.averagePageUtilization <= 1);
  assert.ok(r.health.overflowPages > 0);
  assert.ok(r.health.warnings.some((w) => w.code === 'OVERFLOW_PAGES'));
  assert.equal(r.health.errors.length, 0);
});

test('页概览：每个已识别页都有类型与利用率', () => {
  const r = load();
  for (const p of r.pages) {
    assert.ok(p.number >= 1);
    assert.ok(['leaf-table', 'interior-table', 'leaf-index', 'interior-index'].includes(p.type));
    assert.ok(p.utilization >= 0 && p.utilization <= 1);
    assert.ok(p.cellCount >= 0);
  }
});

test('decodeRecord 正确解码 NULL / 整数 / REAL / TEXT / BLOB / 0 / 1', () => {
  const f = Buffer.alloc(8);
  f.writeDoubleBE(3.5, 0);
  const body = [42, ...f, 0x68, 0x69, 1, 2, 3];
  // header: 长度 8（自身 1 字节 + 7 个 serial type 各 1 字节）
  const payload = Uint8Array.from([8, 0, 1, 7, 17, 18, 8, 9, ...body]);
  const cells = core.decodeRecord(payload, 1);
  assert.equal(cells.length, 7);
  assert.equal(cells[0].kind, 'null');
  assert.equal(cells[1].value, 42);
  assert.equal(cells[2].kind, 'real');
  assert.equal(cells[2].value, 3.5);
  assert.equal(cells[3].kind, 'text');
  assert.equal(cells[3].value, 'hi');
  assert.equal(cells[4].kind, 'blob');
  assert.equal(cells[5].value, 0);
  assert.equal(cells[6].value, 1);
});

test('serialLength 覆盖全部 serial type 分支', () => {
  assert.equal(core.serialLength(0), 0);
  assert.equal(core.serialLength(1), 1);
  assert.equal(core.serialLength(4), 4);
  assert.equal(core.serialLength(5), 6);
  assert.equal(core.serialLength(6), 8);
  assert.equal(core.serialLength(7), 8);
  assert.equal(core.serialLength(8), 0);
  assert.equal(core.serialLength(12), 0);
  assert.equal(core.serialLength(18), 3);
  assert.equal(core.serialLength(17), 2);
});

test('非法输入给出明确错误', () => {
  assert.throws(() => core.parse(new Uint8Array(10)), /文件过小/);
  // 长度足够但文件头不匹配：应报 magic 错误而不是"文件过小"
  assert.throws(() => core.parse(new Uint8Array(128)), /SQLite format 3/);
  assert.throws(() => core.parse('字符串'), /ArrayBuffer/);
});

test('被截断的数据库不崩溃，并在 health.errors 中留下记录', () => {
  const full = fs.readFileSync(FIXTURE);
  const r = core.parse(full.subarray(0, 4096 * 5));
  assert.equal(r.ok, true);
  assert.ok(r.health.errors.length > 0);
  assert.ok(r.health.warnings.some((w) => w.code === 'PARSE_ERRORS'));
});

test('跨 realm 传入的 TypedArray 同样可解析', () => {
  // 模拟 iframe / Web Worker / vm 场景：实例不属于当前 realm
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'src', 'sqlite.js'), 'utf8'), sandbox);
  const r = sandbox.PagePeekCore.parse(fs.readFileSync(FIXTURE));
  assert.equal(r.header.pageSize, 4096);
  assert.ok(r.tables.length >= 4);
});
