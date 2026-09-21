#!/usr/bin/env python3
import datetime
import hashlib
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]
spec_path = ROOT / 'test/conformance/cases/stage3-date-time.spec.json'
spec = json.loads(spec_path.read_text())
manifest = json.loads((ROOT / 'reference/sqlite/manifest.json').read_text())
assert spec['source']['sourceId'] == manifest['sqliteSourceId']
assert spec['scope']['denominatorAssertions'] == 29 and spec['scope']['selectedCases'] == 40
assert len(spec['cases']) == 40 and len(spec['adaptations']) == 6
upstream = [c for c in spec['cases'] if 'upstreamAssertion' in c]
source_control = [c for c in spec['cases'] if c.get('credit') == 'source-control-assertion']
assert len(upstream) == 18 and len(source_control) == 11 and sum(c.get('credit') == 'zero-credit-companion' for c in spec['cases']) == 2
assert sum(c.get('credit') == 'zero-credit-source-boundary' for c in spec['cases']) == 9
assert spec['scope']['tsCredit'] == 29 and len({c['id'] for c in spec['cases']}) == 40
for case in spec['cases']:
    assert case['sql'].startswith('SELECT ')
    assert case['encodings'] == ['UTF-8', 'UTF-16le', 'UTF-16be'] and 'expectedTyped' in case
    if 'upstreamAssertion' in case:
        source = case['upstreamAssertion']
        path = ROOT / 'reference/sqlite/sqlite-src-3530400' / source['path']
        lines = path.read_text().splitlines(True)
        body = ''.join(lines[source['startLine'] - 1:source['endLine']])
        assert body.rstrip('\n') == source['body']
        assert hashlib.sha256(body.encode()).hexdigest() == source['bodySha256']

# These checks deliberately validate the deterministic seam vectors independently
# of the unsupported public runner. They prevent a self-inconsistent contract from
# becoming the implementation oracle before an injection harness exists.
adaptations = {item['id']: item for item in spec['adaptations']}
expected_sql = {
    'clock-stable-across-rows-aliases-yields': [
        "SELECT datetime('now'), current_timestamp, time('now'), current_time FROM users ORDER BY id"
    ],
    'clock-resamples-after-reset': [
        "SELECT unixepoch('now','subsec'), datetime('now','subsec')"
    ],
    'current-keyword-and-function-lowering': [
        'SELECT CURRENT_DATE, current_date(), CURRENT_TIME, current_time(), CURRENT_TIMESTAMP, current_timestamp()'
    ],
    'injected-localtime-and-utc-roundtrip': [
        "SELECT datetime('2000-01-01 00:00:00','localtime'), datetime('2000-01-01 02:00:00','utc')"
    ],
    'localtime-provider-failure-is-error': [
        "SELECT datetime('2000-01-01','localtime')"
    ],
    'ijd-boundary-public-contract': [case['sql'] for case in spec['cases'] if case.get('credit') == 'zero-credit-source-boundary'],
}
assert set(adaptations) == set(expected_sql)
for ident, adaptation in adaptations.items():
    assert adaptation['credit'] is False
    assert adaptation['currentDisposition'] == 'implemented-public-fetch'
    assert adaptation['sql'] == expected_sql[ident]
    assert isinstance(adaptation['setup'], dict) and adaptation['sequence']
    assert all(isinstance(step, str) and step for step in adaptation['sequence'])
    assert ('expected' in adaptation) != ('expectedCaseIds' in adaptation)


def typed(kind, value):
    return {'type': kind, 'value': value}


def utc_text(milliseconds, subsec=False):
    seconds, millis = divmod(milliseconds, 1000)
    value = datetime.datetime.fromtimestamp(seconds, datetime.timezone.utc)
    base = value.strftime('%Y-%m-%d %H:%M:%S')
    return f'{base}.{millis:03d}' if subsec else base


stable = adaptations['clock-stable-across-rows-aliases-yields']
assert stable['setup'] == {'clockUnixMilliseconds': ['946684800125', '978307200250'], 'forcedYieldAfterRows': 1}
assert stable['sequence'] == ['prepare: clock calls=0', 'step all rows with one forced yield', 'finalize']
assert stable['expected'] == {
    'clockCalls': 1,
    'rows': 'every row repeats TEXT 2000-01-01 00:00:00, TEXT 2000-01-01 00:00:00, TEXT 00:00:00, TEXT 00:00:00',
}

reset = adaptations['clock-resamples-after-reset']
assert reset['sequence'] == ['prepare: clock calls=0', 'execute to done', 'reset', 'execute to done']
clock_values = [int(value) for value in reset['setup']['clockUnixMilliseconds']]
assert reset['expected']['clockCallsAfterExecutions'] == [1, 2]
expected_executions = []
for milliseconds in clock_values:
    # Python's correctly-rounded binary64 conversion and hex() give a transparent
    # exact encoding check for SQLite's REAL result; integer division supplies the
    # independently formatted UTC timestamp from the same injected millisecond.
    expected_executions.append([
        typed('real', float(milliseconds / 1000).hex()),
        typed('text', utc_text(milliseconds, subsec=True)),
    ])
assert reset['expected']['rowsByExecution'] == expected_executions

keywords = adaptations['current-keyword-and-function-lowering']
assert keywords['setup'] == {'clockUnixMilliseconds': ['946684800000']}
assert keywords['sequence'] == ['prepare: clock calls=0', 'execute one row']
assert keywords['expected'] == {
    'clockCalls': 1,
    'row': [
        typed('text', '2000-01-01'), typed('text', '2000-01-01'),
        typed('text', '00:00:00'), typed('text', '00:00:00'),
        typed('text', '2000-01-01 00:00:00'), typed('text', '2000-01-01 00:00:00'),
    ],
}

roundtrip = adaptations['injected-localtime-and-utc-roundtrip']
expected_script = [
    {'inputUnixSecond': '946684800', 'return': '2000-01-01 02:00:00'},
    {'inputUnixSecond': '946692000', 'return': '2000-01-01 04:00:00'},
    {'inputUnixSecond': '946684800', 'return': '2000-01-01 02:00:00'},
]
assert roundtrip['setup'] == {'localFieldsScript': expected_script}
assert roundtrip['sequence'] == ['prepare', 'execute one row']
assert roundtrip['expected'] == {
    'localCalls': len(expected_script),
    'row': [typed('text', '2000-01-01 02:00:00'), typed('text', '2000-01-01 00:00:00')],
}

failure = adaptations['localtime-provider-failure-is-error']
assert failure['setup'] == {'localFieldsScript': [{'inputUnixSecond': '946684800', 'return': None}]}
assert failure['sequence'] == ['prepare succeeds', 'step fails', 'reset/finalize cleanup']
assert failure['expected'] == {
    'localCalls': 1,
    'error': {'phase': 'step', 'primaryCode': 1, 'message': 'local time unavailable'},
}

boundary = adaptations['ijd-boundary-public-contract']
boundary_cases = [case for case in spec['cases'] if case.get('credit') == 'zero-credit-source-boundary']
assert boundary['setup'] == {}
assert boundary['sequence'] == ['prepare and execute each independently']
assert boundary['expectedCaseIds'] == [case['id'] for case in boundary_cases]

native = json.loads((ROOT / 'test/conformance/cases/stage3-date-time.native.json').read_text())
assert native['kind'] == 'native-reference-only-no-ts-credit'
assert native['source']['sourceId'] == spec['source']['sourceId']
assert native['source']['specSha256'] == hashlib.sha256(spec_path.read_bytes()).hexdigest()
assert native['counts'] == {'denominatorAssertions': 29, 'selectedCases': 40, 'observations': 120, 'tsCredit': 0}
expected = {(case['id'], encoding): (case['sql'], case['expectedTyped']) for case in spec['cases'] for encoding in case['encodings']}
actual = {(item['id'], item['encoding']): (item['sql'], item.get('row', [None])[0]) for item in native['observations']}
assert actual == expected
print('date/time manifest: 18 exact upstream assertions, 11 exact date.c source-control assertions, 2 zero-credit result companions, 9 zero-credit boundaries, 6 statically validated seam contracts, 120 oracle observations, TS credit 29/29')
