/*
 * 构建脚本：把解析引擎内联进 index.html，产出可独立分发的单文件 dist/PagePeek.html。
 * 零依赖，仅使用 Node 内置模块。生成的 HTML 可直接双击打开，无需服务器、无需联网。
 */
import { readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const corePath = join(root, 'src', 'sqlite.js');
const htmlPath = join(root, 'index.html');
const outDir = join(root, 'dist');
const outPath = join(outDir, 'PagePeek.html');

const core = readFileSync(corePath, 'utf8');
const html = readFileSync(htmlPath, 'utf8');
const marker = '<script src="./src/sqlite.js"></script>';

if (!html.includes(marker)) {
  throw new Error('构建失败：index.html 中未找到内联标记 ' + marker);
}

// 防止源码里出现字面量 </script> 提前闭合脚本标签
const safeCore = core.replace(/<\/script/gi, '<\\/script');
const bundled = html.replace(marker, '<script>\n' + safeCore + '\n</script>');

if (bundled.includes(marker)) {
  throw new Error('构建失败：内联替换未生效');
}
if (/<script[^>]+src=/.test(bundled)) {
  throw new Error('构建失败：产物仍包含外部脚本引用，不满足单文件离线要求');
}
if (!bundled.includes('PagePeekCore')) {
  throw new Error('构建失败：产物中缺少 PagePeekCore');
}

mkdirSync(outDir, { recursive: true });
writeFileSync(outPath, bundled, 'utf8');

const size = statSync(outPath).size;
console.log('✓ 构建完成: dist/PagePeek.html (' + (size / 1024).toFixed(1) + ' KB)');
console.log('  单文件、零外部依赖、可直接双击打开');
