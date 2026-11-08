<div align="center">

# 🔍 PagePeek

**看得见数据库里面长什么样 —— 零依赖、纯离线的 SQLite 文件内省器**

[简体中文](#zh-cn) · [繁體中文](#zh-tw) · [English](#en)

![zero deps](https://img.shields.io/badge/dependencies-0-brightgreen) ![license](https://img.shields.io/badge/license-MIT-blue) ![offline](https://img.shields.io/badge/network-none-orange) ![tests](https://img.shields.io/badge/tests-10%20passing-success)

</div>

---

<a id="zh-cn"></a>

## 🇨🇳 简体中文

> 语言切换：[简体中文](#zh-cn) ｜ [繁體中文](#zh-tw) ｜ [English](#en)

### 🎉 项目介绍

你有没有遇到过这样的时刻：手里只有一个 `.db` 文件，不知道它有多少表、哪张表撑得最大、为什么文件莫名其妙有几百 MB，或者它到底能不能安全删掉？通常的答案是要么装一个数据库客户端，要么敲一串 `PRAGMA`——可如果文件来自别人的设备、生产环境的备份，或者你根本不想把数据传到任何地方呢？

**PagePeek 就是为了这一刻而生的。** 它是一个完全运行在浏览器里的 SQLite 文件内省器：直接读取文件的原始字节，按 SQLite 官方定义的页格式逐层还原，把**页级布局、B-tree 结构、Schema 定义、行级统计和健康度诊断**摆在你面前。整个过程不联网、不上传、不写服务器，关掉标签页什么都不剩。

它解决的痛点很具体：

- 🔒 **数据敏感**，不允许上传到在线数据库查看器或 SaaS 诊断平台
- 🧳 **环境受限**，出差、客户现场、断网机器上没有也不允许安装任何软件
- 🔬 **需要下钻到页**，普通客户端只给表和数据，不给「为什么这个文件这么大」
- 🤖 **给 AI Agent / 脚本用**，需要一个可直接 `require()` 的程序化解析接口

**自研差异化亮点**：解析引擎 100% 独立实现，仅依据公开的 [SQLite Database File Format](https://www.sqlite.org/fileformat2.html) 规范，未复制任何既有项目代码。相比需要编译或安装客户端的传统工具，PagePeek 是**一个 HTML 文件即完整产品**；相比只做表结构展示的工具，它下钻到 B-tree 页、溢出页链、空闲页链和页内碎片，并给出可导出的健康评分。

**灵感来源**：GitHub 上长期受到关注的 SQLite 内省与诊断类工具（如 DB Browser for SQLite、sqlite-utils）所回应的真实需求——让开发者无需沉重工具链就能理解数据库文件内部状态。PagePeek 只借鉴这一产品逻辑，实现路径与交付形态完全不同。

### ✨ 核心特性

- 🧩 **零依赖**：运行时不引入任何 npm 包、CDN、字体或远程资源，`dist/PagePeek.html` 一个文件就是全部
- 🔐 **离线优先 / 隐私优先**：`FileReader` 在本地内存解析，**代码里没有任何网络请求**，可断网、可在 `file://` 下双击运行
- 📄 **页级结构还原**：识别 leaf/interior table 与 index 四类 B-tree 页，逐页统计 cell 数、空闲字节、碎片字节与利用率
- 🌳 **B-tree 遍历**：从 `sqlite_schema` 出发递归遍历各表根页，统计**真实行数、树深度、占用页数、平均行大小**
- 💧 **溢出页链解析**：自动跟随 overflow chain，定位大 BLOB / 超长文本带来的额外 I/O
- 🩺 **健康诊断**：空闲页占比、页利用率、碎片、WAL 提示、非 UTF-8 编码提醒等，输出 0–100 评分与分级建议
- 📊 **可视化概览**：健康分环、页类型分布条、逐页热力网格（悬停看页号与利用率）、表清单、Schema 折叠查看
- 🌏 **三语界面**：简体中文 / 繁體中文 / English 即时切换，文案为人工撰写的母语表达，非机器翻译
- 📤 **可导出报告**：一键导出完整 JSON，便于接入 CI、归档或交给 AI Agent 做二次分析
- 🧪 **可测试、可集成**：解析引擎为 UMD 模块，浏览器挂 `window.PagePeekCore`，Node 中可直接 `require()`

### 🚀 快速开始

**环境要求**：任意现代浏览器（Chrome / Edge / Firefox / Safari，支持 `FileReader` 与 CSS `conic-gradient`）。**零安装、零构建、零后端**。仅当你要跑单元测试或重新构建单文件时，才需要 Node.js ≥ 18。

方式一 · 最快（推荐，30 秒）：

```bash
# 直接双击打开即可，无需任何命令
open dist/PagePeek.html          # macOS
xdg-open dist/PagePeek.html      # Linux
start dist\PagePeek.html         # Windows
```

方式二 · 从源码运行：

```bash
git clone https://github.com/gitstq/PagePeek.git
cd PagePeek
npm test          # 10 项单元测试，无需 npm install
npm run build     # 生成 dist/PagePeek.html
npm run serve     # 可选：本地预览 http://localhost:8080
```

方式三 · 作为 Node 库集成（零依赖）：

```bash
npm install github:gitstq/PagePeek
# 或直接从仓库把 src/sqlite.js 拷进你的项目
```

```js
const fs = require('node:fs');
const core = require('pagepeek');          // 或 require('./src/sqlite.js')

const report = core.parse(fs.readFileSync('./app.db'));
console.log(report.header.pageSize);                  // 4096
console.log(report.pageCount);                       // 总页数
console.log(report.tables.map(t => [t.name, t.rowCount]));
console.log(report.health.score, report.health.warnings);
```

> ✅ 打开页面后，把 `.db` / `.sqlite` / `.sqlite3` 文件拖进虚线框（或点击选择）即可，支持数百 MB 级文件。

### 📖 详细使用指南

**界面导览**

| 区域 | 你能看到什么 |
| --- | --- |
| 顶部卡片 | 文件大小、总页数、页大小、对象数、空闲页、溢出页、平均利用率、日志模式 |
| 🩺 健康诊断 | 0–100 评分环 + 分级（`error` / `warning` / `info`）建议，附诊断码便于检索 |
| 📊 页类型分布 | 四类 B-tree 页与「其他页」（溢出页、空闲页）的占比条 |
| 逐页热力网格 | 每个小方块 = 一个页，颜色对应类型、透明度对应利用率，悬停显示明细 |
| 🗂️ 表与索引 | 名称、类型、真实行数、B-tree 深度、占用页、溢出页、平均行大小 |
| 📜 Schema | 折叠查看每张表的原始 `CREATE` 语句与根页号 |

> 📷 *演示截图 / 动图占位：仓库 `docs/` 目录预留，欢迎在 PR 中补充真实截图。*

**JSON 报告结构**（点击「导出 JSON 报告」获得）：

```json
{
  "fileSize": 385024,
  "header": { "pageSize": 4096, "journalMode": "rollback", "textEncoding": 1 },
  "pageCount": 94,
  "pageTypeCounts": { "leaf-table": 73, "interior-table": 2 },
  "pages": [{ "number": 1, "type": "leaf-table", "utilization": 0.91 }],
  "schema": [{ "name": "users", "rootPage": 2, "sql": "CREATE TABLE ..." }],
  "tables": [{ "name": "users", "rowCount": 1029, "btreeDepth": 2 }],
  "health": { "score": 96, "overflowPages": 10, "warnings": [] }
}
```

**典型场景**

- 🧹 **文件为什么这么大**：看空闲页占比与页利用率，若出现 `FREELIST_HIGH`，执行 `VACUUM;` 后重新分析对比
- 🐢 **查询变慢**：检查 `OVERFLOW_PAGES`，大 BLOB 会引入额外 I/O，考虑拆表或外置存储
- 🔁 **迁移前体检**：确认 `textEncoding` 为 UTF-8、`pageSize` 与目标环境一致、WAL 已 checkpoint
- 🤖 **接进自动化**：CI 里用 Node API 解析产物库，断言 `health.score >= 80` 作为质量门禁

**常见问题**

| 现象 | 原因与处理 |
| --- | --- |
| 提示「文件头不是 SQLite format 3」 | 选中的是 WAL/SHM 文件、加密库或非 SQLite 文件；请选主 `.db` 文件 |
| 提示 WAL 模式，行数偏少 | 最新事务尚未 checkpoint，先执行 `PRAGMA wal_checkpoint(TRUNCATE);` |
| 中文显示为乱码 | 该库使用 UTF-16 编码，界面会给出 `NON_UTF8` 提醒 |
| 「其他页」数量偏多 | 这些通常是溢出页与空闲页，不是损坏，可结合溢出页计数判断 |
| 超大文件卡顿 | 解析在内存完成，建议先拆分或在本机 Chrome 中打开 |

### 💡 设计思路与迭代规划

**设计理念**：把「数据库文件」当成一种**可离线解读的二进制文档**，而不是必须连接的服务。因此不依赖 SQLite 动态库、不执行 SQL、不改动原文件，只做只读的字节级解释。

**技术选型**：

- **纯 JavaScript + 浏览器 File API**：零安装、跨平台、天然隔离，用户数据不出本机
- **UMD 单文件引擎**：同一份 `src/sqlite.js` 同时供浏览器、Node 测试与第三方集成，避免逻辑分叉
- **构建脚本内联而非打包器**：`scripts/build.mjs` 仅做字符串内联，不引入 bundler，产物可读、可审计
- **自研 varint / record / B-tree 解析**：严格按格式规范实现，含溢出链与跨 realm 类型判断的边界处理

**后续迭代**：支持索引页 record 内容展开、`WITHOUT ROWID` 表、auto-vacuum 指针页分析、页级 diff 对比（两次快照）、以及可选的 SARIF 输出以便接入代码扫描。

**社区贡献方向**：更多真实数据库格式的兼容性样本、大端/UTF-16 库测试夹具、更多语言界面文案、性能基准。

### 📦 打包与部署指南

本项目属于**零构建 Web 工具类项目**：源码即产物，没有二进制可执行文件，因此按分类规则**不创建 GitHub Release、不上传平台安装包**；安装与集成步骤已在「快速开始」与「详细使用指南」完整给出。

| 目标 | 做法 |
| --- | --- |
| 单文件交付 | `npm run build` → `dist/PagePeek.html`，可直接双击、邮件发送、放进 U 盘 |
| 静态托管 | 把 `dist/PagePeek.html` 放到任意静态服务器 / GitHub Pages / 对象存储即可 |
| 源码开发 | `npm run serve` 启动零依赖本地服务器，修改 `index.html` 与 `src/sqlite.js` 后刷新 |
| 作为库 | `require('pagepeek')` 或复制 `src/sqlite.js`；无 peer dependencies |

**兼容环境**：Chrome 90+ / Edge 90+ / Firefox 88+ / Safari 15+；Node.js 18 / 20 / 22（CI 已覆盖）。**依赖版本**：运行时 0 个依赖；开发仅用 Node 内置模块。**注意事项**：只读解析，不会修复损坏的数据库；请勿用于替代备份与专业恢复工具。

### 🤝 贡献指南

欢迎任何改进，但请守住两条底线：**不新增运行时依赖**、**不引入任何网络请求**。

- 提交信息遵循 Angular 规范：`feat:` / `fix:` / `docs:` / `refactor:` / `test:` / `chore:`
- 提交 PR 前执行 `npm run verify`（测试 + 构建）并确保通过
- 新增解析规则必须附单元测试；夹具可用 `python3 scripts/make_fixture.py` 重建
- 更新 README 时三个语言版本需同步
- Issue 请附页大小、日志模式、浏览器/Node 版本与可复现的最小 `.db`（务必脱敏）

详见 [CONTRIBUTING.md](CONTRIBUTING.md)。

### 📄 开源协议说明

采用 **MIT License**，可自由使用、复制、修改、商用与再分发，只需保留版权声明。软件按「原样」提供，不附带任何明示或暗示担保。完整条款见 [LICENSE](LICENSE)。

---

<a id="zh-tw"></a>

## 🇹🇼 繁體中文

> 語言切換：[简体中文](#zh-cn) ｜ [繁體中文](#zh-tw) ｜ [English](#en)

### 🎉 專案介紹

手上只有一個 `.db` 檔案，卻不知道裡頭有幾張表、哪張表最胖、檔案為什麼莫名其妙胖到幾百 MB，甚至不確定能不能安心刪掉——這種情境你大概碰過。直覺做法是裝一套資料庫客戶端，或敲一串 `PRAGMA`；但如果檔案來自客戶機器、正式環境備份，或是你根本不想讓資料離開本機呢？

**PagePeek 就是為這一刻做的。** 它是完全跑在瀏覽器裡的 SQLite 檔案內省器：直接讀取原始位元組，依照 SQLite 官方頁格式逐層還原，把**頁級佈局、B-tree 結構、Schema 定義、列級統計與健康度診斷**一次攤開。全程不連網、不上傳、不寫入伺服器，關掉分頁就什麼都不留。

它處理的痛點很明確：

- 🔒 **資料敏感**，不能丟給線上資料庫檢視器或 SaaS 診斷平台
- 🧳 **環境受限**，出差、客戶現場、離線機器上不方便也不能裝軟體
- 🔬 **需要往下鑽到頁**，一般客戶端只給表格與資料，不解釋「檔案為什麼這麼大」
- 🤖 **要給 AI Agent / 腳本用**，需要能直接 `require()` 的程式化介面

**自研差異化亮點**：解析引擎 100% 獨立撰寫，只依據公開的 [SQLite Database File Format](https://www.sqlite.org/fileformat2.html) 規格，未複製任何既有專案程式碼。相較於需要編譯或安裝客戶端的工具，PagePeek 是**一個 HTML 檔就是完整產品**；相較於只展示表結構的工具，它深入 B-tree 頁、溢位頁鏈、空閒頁鏈與頁內碎片，並產出可匯出的健康評分。

**靈感來源**：GitHub 上長期受到關注的 SQLite 內省與診斷工具（如 DB Browser for SQLite、sqlite-utils）所回應的需求——讓開發者不必扛著沉重工具鏈也能看懂資料庫檔案。PagePeek 只借鏡這層產品邏輯，實作方式與交付型態完全不同。

### ✨ 核心特性

- 🧩 **零依賴**：執行時不引入任何 npm 套件、CDN、字型或遠端資源，`dist/PagePeek.html` 一個檔就是全部
- 🔐 **離線優先 / 隱私優先**：`FileReader` 在本機記憶體解析，**程式碼中沒有任何網路請求**，可斷網、可直接在 `file://` 下雙擊開啟
- 📄 **頁級結構還原**：辨識 leaf/interior table 與 index 四類 B-tree 頁，逐頁統計 cell 數、空閒位元組、碎片與利用率
- 🌳 **B-tree 走訪**：從 `sqlite_schema` 出發遞迴走訪各表根頁，算出**真實筆數、樹深、佔用頁數、平均列大小**
- 💧 **溢位頁鏈解析**：自動跟隨 overflow chain，找出大 BLOB / 超長文字造成的額外 I/O
- 🩺 **健康診斷**：空閒頁比例、頁利用率、碎片、WAL 提示、非 UTF-8 編碼提醒等，輸出 0–100 評分與分級建議
- 📊 **視覺化總覽**：健康分環、頁類型分佈條、逐頁熱力網格（懸停看頁號與利用率）、表清單、Schema 摺疊檢視
- 🌏 **三語介面**：简体中文 / 繁體中文 / English 即時切換，文案為人工撰寫的母語表達，非機器翻譯
- 📤 **可匯出報告**：一鍵匯出完整 JSON，方便接進 CI、歸檔或交給 AI Agent 做二次分析
- 🧪 **可測試、可整合**：解析引擎為 UMD 模組，瀏覽器掛 `window.PagePeekCore`，Node 中可直接 `require()`

### 🚀 快速開始

**環境需求**：任一現代瀏覽器（Chrome / Edge / Firefox / Safari，支援 `FileReader` 與 CSS `conic-gradient`）。**免安裝、免建置、免後端**。只有要跑單元測試或重新產生單檔時才需要 Node.js ≥ 18。

方式一 · 最快（推薦，30 秒）：

```bash
# 直接雙擊開啟即可，不需要下任何指令
open dist/PagePeek.html          # macOS
xdg-open dist/PagePeek.html      # Linux
start dist\PagePeek.html         # Windows
```

方式二 · 從原始碼執行：

```bash
git clone https://github.com/gitstq/PagePeek.git
cd PagePeek
npm test          # 10 項單元測試，不需要 npm install
npm run build     # 產生 dist/PagePeek.html
npm run serve     # 選用：本機預覽 http://localhost:8080
```

方式三 · 當成 Node 套件整合（零依賴）：

```bash
npm install github:gitstq/PagePeek
# 或直接把倉庫裡的 src/sqlite.js 複製進你的專案
```

```js
const fs = require('node:fs');
const core = require('pagepeek');          // 或 require('./src/sqlite.js')

const report = core.parse(fs.readFileSync('./app.db'));
console.log(report.header.pageSize);                  // 4096
console.log(report.pageCount);                       // 總頁數
console.log(report.tables.map(t => [t.name, t.rowCount]));
console.log(report.health.score, report.health.warnings);
```

> ✅ 開啟頁面後，把 `.db` / `.sqlite` / `.sqlite3` 檔案拖進虛線框（或點擊選擇）即可，可處理數百 MB 等級檔案。

### 📖 詳細使用指南

**介面導覽**

| 區塊 | 你會看到什麼 |
| --- | --- |
| 頂部卡片 | 檔案大小、總頁數、頁大小、物件數、空閒頁、溢位頁、平均利用率、日誌模式 |
| 🩺 健康診斷 | 0–100 評分環 + 分級（`error` / `warning` / `info`）建議，附診斷碼方便查找 |
| 📊 頁類型分佈 | 四類 B-tree 頁與「其他頁」（溢位頁、空閒頁）的佔比條 |
| 逐頁熱力網格 | 每個小方塊 = 一個頁，顏色對應類型、透明度對應利用率，懸停顯示明細 |
| 🗂️ 資料表與索引 | 名稱、類型、真實筆數、B-tree 深度、佔用頁、溢位頁、平均列大小 |
| 📜 Schema | 摺疊查看每張表的原始 `CREATE` 陳述式與根頁號 |

> 📷 *展示截圖 / 動圖預留：倉庫 `docs/` 目錄保留給社群補上實際畫面。*

**JSON 報告結構**（按「匯出 JSON 報告」取得）：

```json
{
  "fileSize": 385024,
  "header": { "pageSize": 4096, "journalMode": "rollback", "textEncoding": 1 },
  "pageCount": 94,
  "pageTypeCounts": { "leaf-table": 73, "interior-table": 2 },
  "pages": [{ "number": 1, "type": "leaf-table", "utilization": 0.91 }],
  "schema": [{ "name": "users", "rootPage": 2, "sql": "CREATE TABLE ..." }],
  "tables": [{ "name": "users", "rowCount": 1029, "btreeDepth": 2 }],
  "health": { "score": 96, "overflowPages": 10, "warnings": [] }
}
```

**常見情境**

- 🧹 **檔案為什麼這麼大**：看空閒頁比例與頁利用率，出現 `FREELIST_HIGH` 就執行 `VACUUM;` 後再分析比對
- 🐢 **查詢變慢**：檢查 `OVERFLOW_PAGES`，大 BLOB 會帶來額外 I/O，可考慮拆表或外置儲存
- 🔁 **搬遷前健檢**：確認 `textEncoding` 為 UTF-8、`pageSize` 與目標環境一致、WAL 已 checkpoint
- 🤖 **接進自動化**：在 CI 用 Node API 解析產出庫，把 `health.score >= 80` 當成品質關卡

**常見問題**

| 現象 | 原因與處理 |
| --- | --- |
| 提示「檔案頭不是 SQLite format 3」 | 選到 WAL/SHM、加密庫或非 SQLite 檔案；請改選主 `.db` 檔 |
| 提示 WAL 模式且筆數偏少 | 最新交易尚未 checkpoint，先執行 `PRAGMA wal_checkpoint(TRUNCATE);` |
| 中文顯示亂碼 | 該庫使用 UTF-16 編碼，介面會給出 `NON_UTF8` 提醒 |
| 「其他頁」偏多 | 通常是溢位頁與空閒頁，並非損壞，請搭配溢位頁計數判斷 |
| 超大檔案卡頓 | 解析全在記憶體完成，建議先拆分或改用本機 Chrome 開啟 |

### 💡 設計思路與迭代規劃

**設計理念**：把「資料庫檔案」視為一份**可離線解讀的二進位文件**，而不是必須連線的服務。因此不依賴 SQLite 動態庫、不執行 SQL、不更動原檔，只做唯讀的位元組級解釋。

**技術選型**：

- **純 JavaScript + 瀏覽器 File API**：免安裝、跨平台、天然隔離，資料不離開本機
- **UMD 單檔引擎**：同一份 `src/sqlite.js` 同時服務瀏覽器、Node 測試與第三方整合，避免邏輯分叉
- **以內聯腳本取代打包器**：`scripts/build.mjs` 只做字串內聯，不引入 bundler，產物可讀、可稽核
- **自研 varint / record / B-tree 解析**：依格式規格實作，含溢位鏈與跨 realm 型別判斷的邊界處理

**後續迭代**：索引頁 record 展開、`WITHOUT ROWID` 表、auto-vacuum 指標頁分析、頁級 diff（兩次快照比對），以及選用的 SARIF 輸出以串接程式碼掃描。

**社群貢獻方向**：更多真實資料庫格式相容性樣本、大端 / UTF-16 測試夾具、更多語系介面文案、效能基準。

### 📦 打包與部署指南

本專案屬於**零建置 Web 工具類專案**：原始碼即產物，沒有二進位執行檔，因此依分類規則**不建立 GitHub Release、不上傳平台安裝包**；安裝與整合步驟已完整寫在「快速開始」與「詳細使用指南」。

| 目標 | 做法 |
| --- | --- |
| 單檔交付 | `npm run build` → `dist/PagePeek.html`，可雙擊、可郵寄、可放進隨身碟 |
| 靜態託管 | 把 `dist/PagePeek.html` 放到任一靜態伺服器 / GitHub Pages / 物件儲存即可 |
| 原始碼開發 | `npm run serve` 啟動零依賴本機伺服器，改完 `index.html` 與 `src/sqlite.js` 重新整理 |
| 當成套件 | `require('pagepeek')` 或複製 `src/sqlite.js`；無 peer dependencies |

**相容環境**：Chrome 90+ / Edge 90+ / Firefox 88+ / Safari 15+；Node.js 18 / 20 / 22（CI 已覆蓋）。**依賴版本**：執行期 0 個依賴；開發僅用 Node 內建模組。**注意事項**：唯讀解析，不會修復損壞的資料庫；請勿拿來取代備份與專業救援工具。

### 🤝 貢獻指南

歡迎任何改進，但請守住兩條底線：**不新增執行期依賴**、**不引入任何網路請求**。

- 提交訊息遵循 Angular 規範：`feat:` / `fix:` / `docs:` / `refactor:` / `test:` / `chore:`
- 送 PR 前執行 `npm run verify`（測試 + 建置）並確認通過
- 新增解析規則必須附單元測試；夾具可用 `python3 scripts/make_fixture.py` 重建
- 更新 README 時三個語系版本需同步
- Issue 請附頁大小、日誌模式、瀏覽器/Node 版本與可重現的最小 `.db`（務必去識別化）

詳見 [CONTRIBUTING.md](CONTRIBUTING.md)。

### 📄 開源協議說明

採用 **MIT License**，可自由使用、複製、修改、商用與再散布，只需保留版權聲明。軟體按「現況」提供，不附任何明示或暗示擔保。完整條款見 [LICENSE](LICENSE)。

---

<a id="en"></a>

## 🇬🇧 English

> Language: [简体中文](#zh-cn) ｜ [繁體中文](#zh-tw) ｜ [English](#en)

### 🎉 About

You have a `.db` file and no idea how many tables it holds, which one is bloated, why it grew to a few hundred megabytes, or whether it is safe to delete. The usual answer is to install a database client or fire off a handful of `PRAGMA` statements — unless the file came from a customer's machine, a production backup, or anywhere your data must not leave.

**PagePeek is built for exactly that moment.** It is a SQLite file inspector that runs entirely in your browser: it reads raw bytes, walks the on-disk format defined by SQLite, and lays out the **page-level structure, B-tree topology, schema, row statistics and a health assessment**. Nothing is uploaded, nothing is stored on a server, and nothing survives closing the tab.

The pain points, concretely:

- 🔒 **Sensitive data** that must never reach an online viewer or a SaaS diagnostics platform
- 🧳 **Locked-down environments** — a customer site, an air-gapped machine, a laptop with no install rights
- 🔬 **Need to go below the table** — ordinary clients show rows, not *why the file is this large*
- 🤖 **Agent and script workflows** that need a plain `require()`-able parser, not a GUI

**What makes it different**: the parsing engine is written from scratch against the public [SQLite Database File Format](https://www.sqlite.org/fileformat2.html) specification; no code was copied from an existing project. Where conventional tools need a compiler or a desktop install, PagePeek is **one HTML file that is the whole product**. Where a schema viewer stops at table names, PagePeek descends into B-tree pages, overflow chains, freelist trunks and fragmented free bytes, then hands you an exportable health score.

**Inspiration**: the long-standing community need addressed by tools such as DB Browser for SQLite and sqlite-utils — understanding a database file without dragging along a heavyweight toolchain. Only that product idea is borrowed; the implementation and delivery model are entirely our own.

### ✨ Features

- 🧩 **Zero dependencies** — no npm packages, no CDN, no web fonts, no remote assets. `dist/PagePeek.html` is the entire runtime.
- 🔐 **Offline and private by design** — parsing happens in local memory via `FileReader`; **there is no network call anywhere in the codebase**. Works offline and straight from `file://`.
- 📄 **Page-level reconstruction** — identifies all four B-tree page types and reports cell counts, free bytes, fragmented bytes and utilization per page.
- 🌳 **B-tree traversal** — starts at `sqlite_schema`, recurses through each root page, and computes **actual row counts, tree depth, pages used and average row size**.
- 💧 **Overflow chain following** — detects the extra I/O introduced by large BLOBs and long text values.
- 🩺 **Health diagnostics** — freelist ratio, page utilization, fragmentation, WAL caveats, non-UTF-8 warnings and more, distilled into a 0–100 score with severity-ranked findings.
- 📊 **Visual overview** — score ring, page-type distribution bar, per-page heat grid (hover for page number and utilization), table list, collapsible schema.
- 🌏 **Three hand-written locales** — 简体中文 / 繁體中文 / English, switched instantly. These are native copy, not machine translation.
- 📤 **Exportable report** — one click produces complete JSON for CI archiving or downstream AI analysis.
- 🧪 **Testable and embeddable** — the engine ships as UMD: `window.PagePeekCore` in the browser, `require()` in Node.

### 🚀 Quick Start

**Requirements**: any modern browser (Chrome / Edge / Firefox / Safari with `FileReader` and CSS `conic-gradient`). **No install, no build step, no backend.** Node.js ≥ 18 is only needed to run the tests or rebuild the single file.

Option 1 — fastest (30 seconds):

```bash
# Just double-click the file; no command is actually required
open dist/PagePeek.html          # macOS
xdg-open dist/PagePeek.html      # Linux
start dist\PagePeek.html         # Windows
```

Option 2 — from source:

```bash
git clone https://github.com/gitstq/PagePeek.git
cd PagePeek
npm test          # 10 unit tests, no npm install needed
npm run build     # produces dist/PagePeek.html
npm run serve     # optional preview at http://localhost:8080
```

Option 3 — as a Node library (still zero dependencies):

```bash
npm install github:gitstq/PagePeek
# or simply copy src/sqlite.js into your project
```

```js
const fs = require('node:fs');
const core = require('pagepeek');          // or require('./src/sqlite.js')

const report = core.parse(fs.readFileSync('./app.db'));
console.log(report.header.pageSize);                  // 4096
console.log(report.pageCount);                       // total pages
console.log(report.tables.map(t => [t.name, t.rowCount]));
console.log(report.health.score, report.health.warnings);
```

> ✅ Open the page and drop a `.db` / `.sqlite` / `.sqlite3` file onto the dashed area (or click to browse). Files in the hundreds of MB are fine.

### 📖 Usage Guide

**What you are looking at**

| Section | What it shows |
| --- | --- |
| Top cards | File size, page count, page size, object count, free pages, overflow pages, average utilization, journal mode |
| 🩺 Health | 0–100 score ring plus severity-ranked findings (`error` / `warning` / `info`) with stable diagnostic codes |
| 📊 Page types | Proportion of the four B-tree page kinds plus "other" (overflow and free pages) |
| Heat grid | One square per page, colored by type and shaded by utilization; hover for details |
| 🗂️ Tables & indexes | Name, kind, real row count, B-tree depth, pages, overflow pages, average row size |
| 📜 Schema | Collapsible raw `CREATE` statements and root page numbers |

> 📷 *Screenshot / demo GIF placeholder: a `docs/` folder is reserved; community contributions of real captures are welcome.*

**JSON report shape** (click "Export JSON report"):

```json
{
  "fileSize": 385024,
  "header": { "pageSize": 4096, "journalMode": "rollback", "textEncoding": 1 },
  "pageCount": 94,
  "pageTypeCounts": { "leaf-table": 73, "interior-table": 2 },
  "pages": [{ "number": 1, "type": "leaf-table", "utilization": 0.91 }],
  "schema": [{ "name": "users", "rootPage": 2, "sql": "CREATE TABLE ..." }],
  "tables": [{ "name": "users", "rowCount": 1029, "btreeDepth": 2 }],
  "health": { "score": 96, "overflowPages": 10, "warnings": [] }
}
```

**Typical workflows**

- 🧹 *Why is this file huge?* Check the free-page ratio and utilization; on `FREELIST_HIGH`, run `VACUUM;` and compare a second report.
- 🐢 *Queries got slower.* Look at `OVERFLOW_PAGES` — large BLOBs cost extra I/O; consider splitting the table or externalizing payloads.
- 🔁 *Pre-migration check.* Confirm UTF-8 encoding, a matching `pageSize`, and that WAL has been checkpointed.
- 🤖 *CI quality gate.* Parse a generated database with the Node API and assert `health.score >= 80`.

**Troubleshooting**

| Symptom | Cause and fix |
| --- | --- |
| "File header is not SQLite format 3" | You picked a WAL/SHM file, an encrypted database, or a non-SQLite file. Select the main `.db`. |
| WAL mode noted, row count looks low | Recent transactions are not checkpointed yet; run `PRAGMA wal_checkpoint(TRUNCATE);` first. |
| Garbled non-ASCII text | The database uses UTF-16; the UI raises `NON_UTF8`. |
| Many "other" pages | Usually overflow and free pages, not corruption — read it together with the overflow count. |
| Sluggish on a very large file | Parsing is in-memory; split the file or use a desktop Chrome build. |

### 💡 Design & Roadmap

**Design principle**: treat a database file as an **offline-readable binary document**, not a service you must connect to. Consequently we never link against `libsqlite3`, never execute SQL, never mutate the source file — read-only byte interpretation only.

**Why these choices**:

- **Plain JavaScript + the File API** — zero install, cross-platform, naturally sandboxed, data stays on the device.
- **UMD engine** — one `src/sqlite.js` serves the browser, the Node test suite and third-party integrations, with no logic fork.
- **Inline build instead of a bundler** — `scripts/build.mjs` only performs string inlining; the artifact stays readable and auditable.
- **Hand-rolled varint / record / B-tree readers** — implemented to the format spec, including overflow chains and cross-realm type guards.

**Next up**: index record expansion, `WITHOUT ROWID` tables, auto-vacuum pointer-map analysis, page-level snapshots and diffs, and optional SARIF output for code-scanning pipelines.

**Where contributions help most**: real-world compatibility fixtures, big-endian / UTF-16 samples, additional UI locales, and performance benchmarks.

### 📦 Build & Deployment

This is a **zero-build web utility**: source *is* the artifact and there is no native binary. Per the release classification rules, **no GitHub Release and no platform installers are published**; installation and integration are fully covered in Quick Start and the Usage Guide above.

| Goal | How |
| --- | --- |
| Single-file delivery | `npm run build` → `dist/PagePeek.html`; double-click it, email it, or carry it on a USB stick |
| Static hosting | Drop `dist/PagePeek.html` onto any static server, GitHub Pages, or object storage |
| Local development | `npm run serve` starts a dependency-free server; edit `index.html` and `src/sqlite.js`, then refresh |
| Library use | `require('pagepeek')` or copy `src/sqlite.js`; no peer dependencies |

**Compatibility**: Chrome 90+ / Edge 90+ / Firefox 88+ / Safari 15+; Node.js 18 / 20 / 22 (covered in CI). **Dependency versions**: zero runtime dependencies; development uses Node built-ins only. **Caveats**: read-only analysis — it will not repair a corrupt database and is no substitute for backups or professional recovery tooling.

### 🤝 Contributing

Improvements are welcome, with two non-negotiables: **no new runtime dependencies** and **no network requests of any kind**.

- Use Angular-style commits: `feat:` / `fix:` / `docs:` / `refactor:` / `test:` / `chore:`
- Run `npm run verify` (tests + build) before opening a PR
- Every new parsing rule needs a unit test; regenerate the fixture with `python3 scripts/make_fixture.py`
- Keep all three README locales in sync
- For issues, include page size, journal mode, browser/Node version and a minimal reproducible `.db` (redacted)

See [CONTRIBUTING.md](CONTRIBUTING.md) for details.

### 📄 License

Released under the **MIT License** — use, copy, modify, publish and distribute freely, commercially or otherwise, as long as the copyright notice is retained. Provided "as is", without warranty of any kind. Full text in [LICENSE](LICENSE).
