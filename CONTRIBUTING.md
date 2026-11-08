# 贡献指南 / Contributing

感谢你愿意改进 PagePeek！本项目保持**零运行时依赖**，任何新增第三方依赖的 PR 都会被拒绝。

## 开发环境

- Node.js >= 18（仅用于测试与构建；浏览器端不需要 Node）
- Python 3.8+（仅在需要重新生成测试夹具时用到）
- 无需 `npm install`，仓库不含 `node_modules`

```bash
npm test        # 运行单元测试
npm run build   # 生成 dist/PagePeek.html
npm run verify  # 测试 + 构建
npm run serve   # 本地预览 http://localhost:8080
```

也可以直接双击 `index.html` 或 `dist/PagePeek.html`，无需任何服务器。

## 提交规范

遵循 Angular / Conventional Commits：

| 前缀 | 用途 |
| --- | --- |
| `feat:` | 新功能 |
| `fix:` | 缺陷修复 |
| `docs:` | 文档更新 |
| `refactor:` | 重构（不改变行为） |
| `test:` | 测试增删 |
| `chore:` | 构建、CI、杂项 |

示例：`feat: 支持 UTF-16 数据库的 schema 解码`

## PR 要求

1. `npm run verify` 全部通过；
2. 新增解析规则必须附带覆盖该规则的单元测试，夹具可用 `python3 scripts/make_fixture.py` 重建；
3. 若修改 `src/sqlite.js`，请同时确认 `npm run build` 产出的单文件仍可离线打开；
4. 更新 README 时，简体中文、繁体中文、English 三个版本需同步；
5. 不上传真实业务数据库、不添加任何网络请求代码。

## Issue 反馈

请提供：数据库页大小、`PRAGMA journal_mode`、PagePeek 版本、浏览器/Node 版本、以及**可复现的最小 `.db` 文件**（可脱敏后上传）。不要粘贴含敏感数据的原始字节。

> 安全第一：本项目定位为离线诊断工具，永不接受引入遥测、远程上报或 CDN 资源的改动。
