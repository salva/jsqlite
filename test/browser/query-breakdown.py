"""Opt-in sequential decomposition of the slow Chinook alpha query."""
import json
import os
from pathlib import Path
import sqlite3
import statistics
import subprocess
import time

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(os.environ['JSQLITE_BREAKDOWN_DIR']).resolve()
OUT.mkdir(parents=True, exist_ok=True)
join = '''FROM Album AS a JOIN Track AS t ON t.AlbumId = a.AlbumId
WHERE a.AlbumId BETWEEN 1 AND 20'''
group = join + '\nGROUP BY a.AlbumId, a.Title'
aggregates = '''SELECT a.Title AS album, COUNT(*) AS tracks,
ROUND(SUM(t.Milliseconds) / 60000.0, 1) AS total_minutes,
ROUND(AVG(t.UnitPrice), 2) AS average_price,
SUM(CASE WHEN t.Milliseconds > 300000 THEN 1 ELSE 0 END) AS tracks_over_5_minutes
'''
queries = [
    ('01_album_filter', 'SELECT AlbumId, Title FROM Album WHERE AlbumId BETWEEN 1 AND 20'),
    ('02_track_filter_count', 'SELECT COUNT(*) FROM Track WHERE AlbumId BETWEEN 1 AND 20'),
    ('03_join_first_ten', 'SELECT a.AlbumId, t.TrackId ' + join + '\nLIMIT 10'),
    ('04_join_count', 'SELECT COUNT(*) ' + join),
    ('05_track_group_without_join', 'SELECT AlbumId, COUNT(*) FROM Track WHERE AlbumId BETWEEN 1 AND 20 GROUP BY AlbumId'),
    ('06_join_group_count', 'SELECT a.Title, COUNT(*) ' + group),
    ('07_join_group_duration', 'SELECT a.Title, ROUND(SUM(t.Milliseconds) / 60000.0, 1) AS total_minutes ' + group),
    ('08_join_group_average', 'SELECT a.Title, ROUND(AVG(t.UnitPrice), 2) AS average_price ' + group),
    ('09_join_group_case', 'SELECT a.Title, SUM(CASE WHEN t.Milliseconds > 300000 THEN 1 ELSE 0 END) AS long_tracks ' + group),
    ('10_all_aggregates', aggregates + group),
    ('11_add_having', aggregates + group + '\nHAVING COUNT(*) >= 5'),
    ('12_add_order', aggregates + group + '\nHAVING COUNT(*) >= 5 ORDER BY total_minutes DESC, album'),
    ('13_original_limit', aggregates + group + '\nHAVING COUNT(*) >= 5 ORDER BY total_minutes DESC, album LIMIT 10'),
]
db = sqlite3.connect((ROOT / 'examples/browser/chinook.sqlite').as_uri() + '?mode=ro&immutable=1', uri=True)
summary = {'nativeVersion': sqlite3.sqlite_version, 'startedAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'note': 'Sequential fresh-browser runs. Native warm SQL timings include Python binding overhead. Different projections/plans mean differences are diagnostic, not strictly additive.', 'results': []}
try:
    for name, sql in queries:
        expected = db.execute(sql).fetchall()
        native_times = []
        for _ in range(30):
            start = time.perf_counter_ns()
            db.execute(sql).fetchall()
            native_times.append((time.perf_counter_ns() - start) / 1e6)
        print(f'RUN {name}: native median {statistics.median(native_times):.3f} ms; {len(expected)} rows', flush=True)
        report = OUT / (name + '.json')
        env = dict(os.environ, JSQLITE_BENCH_SQL=sql, JSQLITE_BENCH_REPORT=str(report))
        result = subprocess.run(['node', 'test/browser/long-query.mjs'], cwd=ROOT, env=env)
        actual = json.loads(report.read_text())
        entry = {'name': name, 'sql': sql, 'nativeMedianMs': statistics.median(native_times), 'nativeRows': len(expected), 'outcome': actual['outcome'], 'timings': actual.get('timings'), 'exitCode': result.returncode, 'report': str(report)}
        if actual['outcome'] == 'completed':
            cells = [[int(cell['value']) if cell['type'] == 'integer' else cell['value'] for cell in row] for row in actual['rows']]
            reference = [list(row) for row in expected]
            # Preserve duplicates; only disregard row order where SQL doesn't
            # promise ordering. The limited join is checked as one actual sample,
            # not universal unordered LIMIT equivalence.
            if 'ORDER BY' in sql:
                equal = cells == reference
                comparison = 'ordered'
            else:
                equal = sorted(map(repr, cells)) == sorted(map(repr, reference))
                comparison = 'multiset; unordered LIMIT is a sampled comparison only'
            entry.update(jsRows=len(cells), matchesNative=equal, comparison=comparison)
        summary['results'].append(entry)
        (OUT / 'summary.json').write_text(json.dumps(summary, indent=2) + '\n')
        print('RESULT ' + json.dumps(entry), flush=True)
finally:
    db.close()
print(f'Breakdown saved in {OUT / "summary.json"}', flush=True)
