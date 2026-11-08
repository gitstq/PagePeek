#!/usr/bin/env python3
"""生成 tests/fixture.db：用 Python 标准库 sqlite3 构造一个可复现的多页测试库。

覆盖场景：多页 B-tree、二级索引、大 BLOB 溢出页、删除产生的空闲空间、中文文本、REAL/NULL/BLOB 类型。
用法：python3 scripts/make_fixture.py
"""
import os
import random
import sqlite3

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'tests', 'fixture.db')


def main():
    if os.path.exists(OUT):
        os.remove(OUT)
    con = sqlite3.connect(OUT)
    con.execute('PRAGMA page_size=4096')
    con.execute('CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL, '
                'email TEXT, score REAL, note TEXT, avatar BLOB)')
    con.execute('CREATE INDEX idx_users_email ON users(email)')
    rnd = random.Random(42)  # 固定种子，保证字节级可复现
    for i in range(1, 1201):
        con.execute('INSERT INTO users VALUES (?,?,?,?,?,?)',
                    (i, 'user_%04d' % i, 'u%04d@example.com' % i,
                     rnd.random() * 100, '备注内容 ' * rnd.randint(1, 20),
                     bytes([i % 256]) * rnd.randint(0, 60)))
    con.execute('CREATE TABLE blobs (id INTEGER PRIMARY KEY, payload BLOB)')
    for i in range(1, 6):
        con.execute('INSERT INTO blobs VALUES (?,?)', (i, bytes([i % 251]) * 12000))
    con.execute('CREATE TABLE meta (k TEXT, v TEXT)')
    con.executemany('INSERT INTO meta VALUES (?,?)',
                    [('schema_version', '3'), ('created_by', 'PagePeek fixture')])
    con.commit()
    con.execute('DELETE FROM users WHERE id % 7 = 0')  # 制造页内空洞
    con.commit()
    con.close()
    print('✓ 已生成 %s (%d bytes)' % (os.path.abspath(OUT), os.path.getsize(OUT)))


if __name__ == '__main__':
    main()
