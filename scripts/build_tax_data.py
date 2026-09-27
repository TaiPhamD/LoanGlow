#!/usr/bin/env python3
"""Build bundled estimates from public ACS bulk tables and GeoNames postal data.

No API keys, paid services, or runtime network calls. Standard library only.
Raw downloads live outside the repository; --cache allows an offline rebuild.
"""
import argparse
from collections import Counter
import csv
from datetime import datetime, timezone
import hashlib
import io
import json
from pathlib import Path
import re
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parents[1]
YEAR = 2024
CENSUS = f'https://www2.census.gov/programs-surveys/acs/summary_file/{YEAR}/table-based-SF/data/5YRData/'
GEONAMES = 'https://download.geonames.org/export/zip/'
COUNTRIES = ('US', 'PR', 'VI', 'GU', 'AS', 'MP')
# Census state FIPS, not postal-prefix inference (ZIPs can cross state borders).
STATES = {pair.split(':')[0]: pair.split(':')[1] for pair in (
    '01:AL 02:AK 04:AZ 05:AR 06:CA 08:CO 09:CT 10:DE 11:DC 12:FL '
    '13:GA 15:HI 16:ID 17:IL 18:IN 19:IA 20:KS 21:KY 22:LA 23:ME '
    '24:MD 25:MA 26:MI 27:MN 28:MS 29:MO 30:MT 31:NE 32:NV 33:NH '
    '34:NJ 35:NM 36:NY 37:NC 38:ND 39:OH 40:OK 41:OR 42:PA 44:RI '
    '45:SC 46:SD 47:TN 48:TX 49:UT 50:VT 51:VA 53:WA 54:WV 55:WI 56:WY 72:PR'
).split()}


def derive_rate(tax, tax_moe, value, value_moe, owners):
    """Ratio of medians, NOT a median/mean of individual property tax rates.

    MOEs are published 90% margins for the inputs, not a ratio confidence interval.
    The owner count is an estimated population, NOT the survey sample size.
    """
    if tax == 10001 or value == 2000001 or tax_moe == -333333333 or value_moe == -333333333:
        return None, 'censored'
    if tax <= 0 or value <= 0 or owners < 0:
        return None, 'missing'
    if owners < 100:
        return None, 'sparse'
    if tax_moe < 0 or value_moe < 0 or tax_moe / tax > 0.5 or value_moe / value > 0.5:
        return None, 'uncertain'
    rate = tax / value * 100
    if not 0 < rate <= 5:
        return None, 'outlier'
    return round(rate, 4), 'ok'


def fetch(cache, name, url, offline):
    path = cache / name
    if not path.exists():
        if offline:
            raise RuntimeError(f'Missing cached source: {path}')
        print(f'Downloading {url}', flush=True)
        with urllib.request.urlopen(url, timeout=180) as response:
            content = response.read()
        temporary = path.with_suffix(path.suffix + '.part')
        temporary.write_bytes(content)
        temporary.replace(path)
    content = path.read_bytes()
    return content, {'url': url, 'sha256': hashlib.sha256(content).hexdigest(), 'bytes': len(content)}


def read_table(content, table):
    rows = {}
    for row in csv.DictReader(io.StringIO(content.decode('utf-8-sig')), delimiter='|'):
        geo = row['GEO_ID']
        if not (geo == '0100000US' or re.fullmatch(r'0400000US\d{2}|860Z200US\d{5}', geo)):
            continue
        columns = ['E002'] if table == 'b25003' else ['E001', 'M001']
        rows[geo] = [int(row[f'{table.upper()}_{column}']) for column in columns]
    if len(rows) < 33000:
        raise ValueError(f'{table}: incomplete download or unexpected geography format')
    return rows


def build(cache, offline=False):
    cache.mkdir(parents=True, exist_ok=True)
    sources = []
    tables = {}
    for table in ('b25103', 'b25077', 'b25003'):
        raw, source = fetch(cache, f'{table}.dat', f'{CENSUS}acsdt5y{YEAR}-{table}.dat', offline)
        sources.append(source)
        tables[table] = read_table(raw, table)
    if not (tables['b25103'].keys() == tables['b25077'].keys() == tables['b25003'].keys()):
        raise ValueError('ACS tables have mismatched geographic coverage')
    areas, states = {}, {}
    national = None
    for geo, tax in tables['b25103'].items():
        value = tables['b25077'][geo]
        result = derive_rate(tax[0], tax[1], value[0], value[1], tables['b25003'][geo][0])
        if geo.startswith('860Z200US'):
            areas[geo[-5:]] = result
        elif geo.startswith('0400000US'):
            if result[0] is None:
                raise ValueError(f'No usable state estimate: {geo}')
            states[STATES[geo[-2:]]] = result[0]
        else:
            national = result[0]
    if national is None or len(states) != 52:
        raise ValueError('Missing national/state/PR estimates')
    locations = {}
    for country in COUNTRIES:
        raw, source = fetch(cache, f'{country}.zip', f'{GEONAMES}{country}.zip', offline)
        sources.append(source)
        with zipfile.ZipFile(io.BytesIO(raw)) as archive:
            rows = csv.reader(io.StringIO(archive.read(f'{country}.txt').decode('utf-8')), delimiter='\t')
            for row in rows:
                postal, place = row[1], row[2]
                if not re.fullmatch(r'\d{5}', postal):
                    raise ValueError(f'Unexpected postal identifier {postal!r}')
                state = row[4] if country == 'US' else country
                # Multiple place names may share a ZIP. Retain the first source label.
                locations.setdefault(postal, [place, state])
    quality = dict(sorted(Counter(item[1] for item in areas.values()).items()))
    metadata = {
        'schemaVersion': 1,
        'acsYear': YEAR,
        'period': '2020–2024',
        'generatedAt': datetime.now(timezone.utc).isoformat(),
        'method': '100 × B25103_001 (median annual taxes) / B25077_001 (median home value)',
        'qualityRules': 'Reject missing/censored medians, fewer than 100 estimated owner-occupied homes, either input MOE >50%, or ratio >5%. Not a formal confidence interval.',
        'sources': sources,
        'coverage': {
            'postalCodes': len(locations),
            'zctas': len(areas),
            'usableLocalEstimates': quality.get('ok', 0),
            'quality': quality,
            'stateAndPREstimates': len(states),
            'postalCodesWithoutZcta': sum(zip_code not in areas for zip_code in locations),
            'zctasWithoutPostalLabel': sum(zip_code not in locations for zip_code in areas),
        },
    }
    return {'metadata': metadata, 'national': national, 'states': states,
            'areas': dict(sorted(areas.items())), 'locations': dict(sorted(locations.items()))}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cache', type=Path, default=Path.home() / '.cache' / 'loanglow-tax-2024')
    parser.add_argument('--offline', action='store_true', help='Use cached source files only')
    parser.add_argument('--output', type=Path, default=ROOT / 'data' / 'property-tax.json')
    args = parser.parse_args()
    data = build(args.cache, args.offline)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    temporary = args.output.with_suffix('.tmp')
    temporary.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')) + '\n')
    temporary.replace(args.output)
    print(json.dumps(data['metadata']['coverage'], indent=2))
    print(f'Written {args.output} ({args.output.stat().st_size:,} bytes)')


if __name__ == '__main__':
    main()
