/*
 * PagePeek Core — 零依赖 SQLite 数据库文件（页级）离线解析引擎
 * ---------------------------------------------------------------
 * 在同一个文件中同时支持两种宿主，且不含任何第三方依赖：
 *   - 浏览器：挂载到 window.PagePeekCore
 *   - Node.js：通过 module.exports 导出，供单元测试直接 require
 *
 * 实现依据：SQLite Database File Format（https://www.sqlite.org/fileformat2.html）
 * 本文件为独立自研实现，仅参考公开格式规范，未复制任何既有项目代码。
 *
 * 隐私约定：所有解析均在本地内存完成，不发起任何网络请求、不上传任何字节。
 */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module && module.exports) {
    module.exports = api;
  } else {
    root.PagePeekCore = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var MAGIC = 'SQLite format 3\u0000';

  /* ---------- 基础字节读取工具 ---------- */

  function asBytes(input) {
    if (input == null) throw new TypeError('PagePeek: 需要 ArrayBuffer 或 Uint8Array 作为输入');
    // 使用 ArrayBuffer.isView / 对象标签而非 instanceof，保证跨 realm
    // （iframe、vm、Web Worker 传递过来的视图）同样可用。
    if (typeof ArrayBuffer !== 'undefined' && ArrayBuffer.isView && ArrayBuffer.isView(input)) {
      return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
    }
    var tag = Object.prototype.toString.call(input);
    if (tag === '[object ArrayBuffer]' || tag === '[object SharedArrayBuffer]') {
      return new Uint8Array(input);
    }
    if (typeof input.length === 'number' && typeof input[0] === 'number') {
      return Uint8Array.from(input);
    }
    throw new TypeError('PagePeek: 需要 ArrayBuffer 或 Uint8Array 作为输入');
  }

  function u16(b, o) { return (b[o] << 8) | b[o + 1]; }
  function u32(b, o) {
    return (b[o] * 0x1000000) + ((b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]);
  }

  // SQLite varint：前 8 字节各贡献 7 位，第 9 字节贡献完整 8 位
  function varint(b, o) {
    var v = 0;
    for (var i = 0; i < 8; i++) {
      if (o + i >= b.length) throw new Error('PagePeek: varint 读取越界');
      var c = b[o + i];
      v = v * 128 + (c & 0x7f);
      if ((c & 0x80) === 0) return { value: v, size: i + 1 };
    }
    if (o + 8 >= b.length) throw new Error('PagePeek: varint 读取越界');
    v = v * 256 + b[o + 8];
    return { value: v, size: 9 };
  }

  // serial type -> 值占用的字节数；10/11 为 SQLite 保留值
  function serialLength(t) {
    if (t === 0 || t === 8 || t === 9) return 0;
    if (t >= 1 && t <= 4) return t;
    if (t === 5) return 6;
    if (t === 6 || t === 7) return 8;
    if (t === 10 || t === 11) return 0;
    if (t >= 12) return Math.floor((t - 12) / 2);
    return 0;
  }

  function decodeInt(b, o, n) {
    var v = 0;
    for (var i = 0; i < n; i++) v = v * 256 + b[o + i];
    if (n > 1 && b[o] >= 0x80) {
      var bits = n * 8;
      var limit = Math.pow(2, bits);
      if (v >= limit / 2) v -= limit;
    }
    return v;
  }

  function decodeFloat(b, o) {
    var dv = new DataView(b.buffer, b.byteOffset + o, 8);
    return dv.getFloat64(0, false);
  }

  var utf8Decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-8') : null;
  var utf16leDecoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-16le') : null;
  var utf16beDecoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-16be') : null;

  function decodeText(bytes, encoding) {
    if (encoding === 2 && utf16leDecoder) return utf16leDecoder.decode(bytes);
    if (encoding === 3 && utf16beDecoder) {
      // 部分运行时不支持 utf-16be，手动交换字节后按 LE 解码
      if (utf16beDecoder) return utf16beDecoder.decode(bytes);
      var swapped = new Uint8Array(bytes.length);
      for (var i = 0; i + 1 < bytes.length; i += 2) {
        swapped[i] = bytes[i + 1];
        swapped[i + 1] = bytes[i];
      }
      return utf16leDecoder ? utf16leDecoder.decode(swapped) : '';
    }
    if (utf8Decoder) return utf8Decoder.decode(bytes);
    var s = '';
    for (var j = 0; j < bytes.length; j++) s += String.fromCharCode(bytes[j]);
    return decodeURIComponent(escape(s));
  }

  // 将 record（表叶 cell 的 payload）解码为带类型的单元格数组
  function decodeRecord(payload, encoding) {
    var out = [];
    try {
      var hs = varint(payload, 0);
      var headerSize = hs.value;
      var types = [];
      var pos = hs.size;
      while (pos < headerSize && pos < payload.length) {
        var st = varint(payload, pos);
        types.push(st.value);
        pos += st.size;
      }
      var body = headerSize;
      for (var k = 0; k < types.length; k++) {
        var t = types[k];
        var len = serialLength(t);
        var slice = payload.subarray(body, Math.min(body + len, payload.length));
        var item = { type: t, kind: 'null', value: null, bytes: len };
        if (t === 0) item.kind = 'null';
        else if (t === 8) { item.kind = 'integer'; item.value = 0; }
        else if (t === 9) { item.kind = 'integer'; item.value = 1; }
        else if (t >= 1 && t <= 6) { item.kind = 'integer'; item.value = decodeInt(payload, body, len); }
        else if (t === 7) { item.kind = 'real'; item.value = decodeFloat(payload, body); }
        else if (t >= 12 && t % 2 === 0) { item.kind = 'blob'; item.value = '[BLOB ' + len + ' bytes]'; }
        else if (t >= 13 && t % 2 === 1) { item.kind = 'text'; item.value = decodeText(slice, encoding); }
        else { item.kind = 'reserved'; item.value = null; }
        out.push(item);
        body += len;
      }
    } catch (e) {
      out.push({ type: -1, kind: 'error', value: e.message, bytes: 0 });
    }
    return out;
  }

  /* ---------- 文件头 ---------- */

  function parseHeader(b) {
    if (b.length < 100) throw new Error('PagePeek: 文件过小，不是有效的 SQLite 数据库');
    var magic = '';
    for (var i = 0; i < 16; i++) magic += String.fromCharCode(b[i]);
    if (magic !== MAGIC) {
      throw new Error('PagePeek: 文件头不是 SQLite format 3（可能是 WAL、加密库或损坏文件）');
    }
    var ps = u16(b, 16);
    if (ps === 1) ps = 65536;
    if (ps < 512 || (ps & (ps - 1)) !== 0) {
      throw new Error('PagePeek: 非法的页大小 ' + ps);
    }
    return {
      pageSize: ps,
      writeVersion: b[18],
      readVersion: b[19],
      reservedBytes: b[20],
      maxEmbeddedPayloadFraction: b[21],
      minEmbeddedPayloadFraction: b[22],
      leafPayloadFraction: b[23],
      fileChangeCounter: u32(b, 24),
      pageCount: u32(b, 28),
      firstFreelistTrunkPage: u32(b, 32),
      freelistPageCount: u32(b, 36),
      schemaCookie: u32(b, 40),
      schemaFormat: u32(b, 44),
      defaultCacheSize: u32(b, 48),
      largestRootBtree: u32(b, 52),
      textEncoding: u32(b, 56),
      userVersion: u32(b, 60),
      incrementalVacuum: u32(b, 64),
      applicationId: u32(b, 68),
      versionValidFor: u32(b, 92),
      sqliteVersion: u32(b, 96),
      journalMode: b[18] === 2 ? 'WAL' : 'rollback'
    };
  }

  /* ---------- 页解析 ---------- */

  var PAGE_TYPES = {
    2: 'interior-index',
    5: 'interior-table',
    10: 'leaf-index',
    13: 'leaf-table'
  };

  function parse(input) {
    var b = asBytes(input);
    var h = parseHeader(b);
    var U = h.pageSize - h.reservedBytes;      // usableSize
    var pageCount = h.pageCount || Math.floor(b.length / h.pageSize);
    var errors = [];

    if (b.length < pageCount * h.pageSize) {
      errors.push('文件长度小于头部声明的页数，数据库可能被截断');
      pageCount = Math.max(1, Math.floor(b.length / h.pageSize));
    }

    function pageOffset(n) {
      return (n - 1) * h.pageSize;
    }

    function readPageHeader(n) {
      var off = pageOffset(n);
      if (off < 0 || off + h.pageSize > b.length) return null;
      // 1 号页前 100 字节是数据库文件头；b-tree 页头紧随其后。
      // 注意：cell pointer 与 cell content 的偏移量一律从「页起始」计算，
      // 因此 1 号页的偏移量同样包含这 100 字节，不能改用 b-tree 页头位置作基准。
      var headerOffset = n === 1 ? 100 : 0;
      var start = off + headerOffset;
      var type = b[start];
      if (!(type in PAGE_TYPES)) return null;
      var interior = type === 5 || type === 2;
      var headerSize = interior ? 12 : 8;
      var cellCount = u16(b, start + 3);
      var contentStart = u16(b, start + 5);
      if (contentStart === 0) contentStart = 65536;
      var fragmented = b[start + 7];
      var rightMost = interior ? u32(b, start + 8) : 0;
      var pointerStart = start + headerSize;
      var freeBytes = Math.max(0, contentStart - headerOffset - headerSize - cellCount * 2);
      var contentUsed = Math.max(0, U - contentStart);
      var pointers = [];
      for (var i = 0; i < cellCount; i++) {
        var p = u16(b, pointerStart + i * 2);
        if (p > 0 && p < h.pageSize) pointers.push(off + p);
      }
      return {
        number: n, type: type, typeName: PAGE_TYPES[type], interior: interior,
        cellCount: cellCount, fragmentedBytes: fragmented,
        freeBytes: freeBytes, contentUsed: contentUsed,
        utilization: Math.min(1, (contentUsed + headerOffset + headerSize + cellCount * 2) / U),
        rightMost: rightMost, pointers: pointers, start: start
      };
    }

    // 读取 table leaf cell 的完整 payload（含溢出页链）
    function readTableLeafPayload(cellOff) {
      var vp = varint(b, cellOff);
      var vr = varint(b, cellOff + vp.size);
      var payloadSize = vp.value;
      var rowid = vr.value;
      var payloadStart = cellOff + vp.size + vr.size;
      var maxLocal = U - 35;
      var minLocal = Math.floor(((U - 12) * 32) / 255) - 23;
      var local;
      if (payloadSize <= maxLocal) {
        local = payloadSize;
      } else {
        local = minLocal + ((payloadSize - minLocal) % (U - 4));
        if (local > maxLocal) local = minLocal;
      }
      var chunks = [b.subarray(payloadStart, Math.min(payloadStart + local, b.length))];
      var overflowPages = 0;
      if (payloadSize > local && payloadStart + local + 4 <= b.length) {
        var next = u32(b, payloadStart + local);
        var guard = 0;
        var seenOverflow = {};
        while (next !== 0 && guard < pageCount && !seenOverflow[next]) {
          seenOverflow[next] = true;
          var oo = pageOffset(next);
          if (oo < 0 || oo + 4 > b.length) break;
          chunks.push(b.subarray(oo + 4, Math.min(oo + U, b.length)));
          next = u32(b, oo);
          overflowPages++;
          guard++;
        }
      }
      var total = 0;
      for (var i = 0; i < chunks.length; i++) total += chunks[i].length;
      var payload = new Uint8Array(Math.min(total, Math.max(payloadSize, 0)));
      var at = 0;
      for (var j = 0; j < chunks.length && at < payload.length; j++) {
        var c = chunks[j];
        var n = Math.min(c.length, payload.length - at);
        payload.set(c.subarray(0, n), at);
        at += n;
      }
      return { rowid: rowid, payloadSize: payloadSize, payload: payload, overflowPages: overflowPages };
    }

    function readInteriorCell(cellOff) {
      return { leftChild: u32(b, cellOff) };
    }

    /* ---------- 全库页概览 ---------- */
    var pages = [];
    var typeCounts = { 'leaf-table': 0, 'interior-table': 0, 'leaf-index': 0, 'interior-index': 0, 'other': 0 };
    var sumUtil = 0, sumFrag = 0;
    for (var pn = 1; pn <= pageCount; pn++) {
      var ph = readPageHeader(pn);
      if (!ph) { typeCounts.other++; continue; }
      typeCounts[ph.typeName]++;
      sumUtil += ph.utilization;
      sumFrag += ph.fragmentedBytes;
      pages.push({
        number: ph.number, type: ph.typeName, cellCount: ph.cellCount,
        freeBytes: ph.freeBytes, fragmentedBytes: ph.fragmentedBytes,
        utilization: Number(ph.utilization.toFixed(4))
      });
    }

    /* ---------- schema（sqlite_schema 固定在 1 号页） ---------- */
    function readSchema() {
      var rows = [];
      function visit(pageNo, depth, seen) {
        if (depth > 32 || seen[pageNo]) return;
        seen[pageNo] = true;
        var ph = readPageHeader(pageNo);
        if (!ph) return;
        if (ph.type === 13) {
          for (var i = 0; i < ph.pointers.length; i++) {
            var cell = readTableLeafPayload(ph.pointers[i]);
            var rec = decodeRecord(cell.payload, h.textEncoding);
            rows.push({
              type: rec[0] ? String(rec[0].value) : '',
              name: rec[1] ? String(rec[1].value) : '',
              tableName: rec[2] ? String(rec[2].value) : '',
              rootPage: rec[3] ? Number(rec[3].value) : 0,
              sql: rec[4] ? String(rec[4].value) : ''
            });
          }
        } else if (ph.type === 5) {
          for (var j = 0; j < ph.pointers.length; j++) {
            visit(readInteriorCell(ph.pointers[j]).leftChild, depth + 1, seen);
          }
          if (ph.rightMost) visit(ph.rightMost, depth + 1, seen);
        }
      }
      visit(1, 1, {});
      return rows;
    }

    var schema = [];
    try { schema = readSchema(); } catch (e) { errors.push('schema 解析异常：' + e.message); }

    /* ---------- 逐表统计 ---------- */
    function inspectTable(rootPage) {
      var seen = {};
      var rowCount = 0, payloadBytes = 0, overflowPages = 0, maxDepth = 0, pageCountForTable = 0;
      var sampleRows = [];
      var stack = [[rootPage, 1]];
      var guard = 0;
      while (stack.length && guard < 200000) {
        guard++;
        var item = stack.pop();
        var pageNo = item[0], depth = item[1];
        if (!pageNo || seen[pageNo]) continue;
        seen[pageNo] = true;
        pageCountForTable++;
        maxDepth = Math.max(maxDepth, depth);
        var ph = readPageHeader(pageNo);
        if (!ph) continue;
        if (ph.type === 13) {
          for (var i = 0; i < ph.pointers.length; i++) {
            var cell;
            try { cell = readTableLeafPayload(ph.pointers[i]); } catch (e) { errors.push('页 ' + pageNo + ' cell 读取失败：' + e.message); continue; }
            rowCount++;
            payloadBytes += cell.payloadSize;
            overflowPages += cell.overflowPages;
            if (sampleRows.length < 3) {
              sampleRows.push(decodeRecord(cell.payload, h.textEncoding).map(function (c) {
                return { kind: c.kind, value: c.value };
              }));
            }
          }
        } else if (ph.type === 10) {
          // 索引叶页：每个 cell 即一个索引条目，无需展开 record
          rowCount += ph.pointers.length;
        } else if (ph.type === 5 || ph.type === 2) {
          for (var j = 0; j < ph.pointers.length; j++) {
            stack.push([readInteriorCell(ph.pointers[j]).leftChild, depth + 1]);
          }
          if (ph.rightMost) stack.push([ph.rightMost, depth + 1]);
        }
      }
      return {
        rowCount: rowCount, depth: maxDepth, pageCount: pageCountForTable,
        payloadBytes: payloadBytes, overflowPages: overflowPages,
        avgRowBytes: rowCount ? Number((payloadBytes / rowCount).toFixed(1)) : 0,
        sampleRows: sampleRows
      };
    }

    var tables = [];
    var objects = schema.filter(function (r) { return r.type === 'table' || r.type === 'index'; });
    for (var ti = 0; ti < objects.length; ti++) {
      var o = objects[ti];
      if (!o.rootPage || o.rootPage > pageCount) continue;
      var stat = inspectTable(o.rootPage);
      tables.push({
        type: o.type, name: o.name, tableName: o.tableName,
        rootPage: o.rootPage, sql: o.sql,
        rowCount: stat.rowCount, btreeDepth: stat.depth,
        pageCount: stat.pageCount, payloadBytes: stat.payloadBytes,
        overflowPages: stat.overflowPages, avgRowBytes: stat.avgRowBytes,
        sampleRows: stat.sampleRows
      });
    }
    tables.sort(function (a, b) { return b.rowCount - a.rowCount; });

    /* ---------- 空闲页链 ---------- */
    function readFreelist() {
      var list = [];
      var trunk = h.firstFreelistTrunkPage;
      var guard = 0;
      var seen = {};
      while (trunk && guard < pageCount && !seen[trunk]) {
        seen[trunk] = true;
        var off = pageOffset(trunk);
        if (off < 0 || off + 8 > b.length) break;
        var nLeaf = u32(b, off + 4);
        list.push(trunk);
        for (var i = 0; i < nLeaf && (8 + i * 4 + 4) <= h.pageSize; i++) {
          list.push(u32(b, off + 8 + i * 4));
        }
        trunk = u32(b, off);
        guard++;
      }
      return list;
    }

    var freelist = [];
    try { freelist = readFreelist(); } catch (e) { errors.push('空闲页链解析异常：' + e.message); }

    /* ---------- 健康诊断 ---------- */
    var btreePageCount = typeCounts['leaf-table'] + typeCounts['interior-table'] +
                         typeCounts['leaf-index'] + typeCounts['interior-index'];
    var avgUtil = btreePageCount ? sumUtil / btreePageCount : 0;
    var freeRatio = pageCount ? h.freelistPageCount / pageCount : 0;
    var totalOverflow = tables.reduce(function (s, t) { return s + t.overflowPages; }, 0);
    var warnings = [];

    function warn(level, code, zh, en) { warnings.push({ level: level, code: code, zh: zh, en: en }); }

    if (freeRatio > 0.2) warn('warning', 'FREELIST_HIGH',
      '空闲页占比 ' + (freeRatio * 100).toFixed(1) + '%，执行 VACUUM 可回收空间并缩小文件。',
      'Freelist is ' + (freeRatio * 100).toFixed(1) + '% of the file; run VACUUM to reclaim space.');
    if (avgUtil > 0 && avgUtil < 0.6) warn('warning', 'LOW_PAGE_UTILIZATION',
      'B-tree 页平均利用率仅 ' + (avgUtil * 100).toFixed(1) + '%，存在明显的页内空洞。',
      'Average B-tree page utilization is only ' + (avgUtil * 100).toFixed(1) + '%.');
    if (sumFrag > 0) warn('info', 'FRAGMENTED_FREE_BYTES',
      '检测到 ' + sumFrag + ' 字节零散空闲碎片（分散在页内，无法被新 cell 直接使用）。',
      sumFrag + ' bytes of fragmented free space detected inside pages.');
    if (totalOverflow > 0) warn('info', 'OVERFLOW_PAGES',
      '存在 ' + totalOverflow + ' 个溢出页，说明有较大的行或 BLOB；频繁读取会有额外 I/O。',
      totalOverflow + ' overflow pages found, caused by large rows or BLOBs.');
    if (h.journalMode === 'WAL') warn('info', 'WAL_MODE',
      '数据库处于 WAL 模式；独立分析 .db 文件时可能缺少尚未 checkpoint 的最新数据。',
      'Database is in WAL mode; data not yet checkpointed may be missing from the main file.');
    if (h.textEncoding !== 1) warn('warning', 'NON_UTF8',
      '文本编码不是 UTF-8（编码编号 ' + h.textEncoding + '），跨工具交换前请确认编码。',
      'Text encoding is not UTF-8 (code ' + h.textEncoding + ').');
    if (h.pageSize !== 4096) warn('info', 'PAGE_SIZE',
      '页大小为 ' + h.pageSize + ' 字节（非默认 4096），迁移到新设备时建议保持一致。',
      'Page size is ' + h.pageSize + ' bytes instead of the common 4096.');
    if (h.schemaFormat < 4) warn('info', 'SCHEMA_FORMAT',
      'schema format 为 ' + h.schemaFormat + '，属于较旧的格式版本。',
      'Schema format ' + h.schemaFormat + ' is a legacy version.');
    if (errors.length) warn('error', 'PARSE_ERRORS',
      '解析过程中出现 ' + errors.length + ' 个异常，结果可能不完整。',
      errors.length + ' parse errors occurred; results may be incomplete.');

    var penalties = warnings.reduce(function (s, w) {
      return s + (w.level === 'error' ? 25 : w.level === 'warning' ? 8 : 2);
    }, 0);
    var score = Math.max(0, Math.min(100, 100 - penalties - Math.round(freeRatio * 30) - Math.round((1 - avgUtil) * 20)));

    return {
      ok: true,
      fileSize: b.length,
      header: h,
      pageCount: pageCount,
      usablePageSize: U,
      pageTypeCounts: typeCounts,
      pages: pages,
      schema: schema,
      tables: tables,
      freelist: freelist,
      health: {
        score: score,
        averagePageUtilization: Number(avgUtil.toFixed(4)),
        freePageRatio: Number(freeRatio.toFixed(4)),
        fragmentedFreeBytes: sumFrag,
        overflowPages: totalOverflow,
        warnings: warnings,
        errors: errors
      }
    };
  }

  return {
    parse: parse,
    decodeRecord: decodeRecord,
    serialLength: serialLength,
    version: '1.0.0'
  };
});
