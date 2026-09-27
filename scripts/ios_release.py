#!/usr/bin/env python3
"""Local Xcode archive and App Store Connect upload. No Expo/EAS account needed.

Requires Python cryptography, Xcode, CocoaPods and an external App Store key config.
Never prints private keys/JWTs; never submits App Review or adds external testers.
"""
import argparse
import base64
from datetime import datetime, timezone
import json
from pathlib import Path
import plistlib
import re
import subprocess
import time
import urllib.error
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
API = 'https://api.appstoreconnect.apple.com'
APP_ID = '6780548579'
BUNDLE = 'com.rush.loanglow'


def export_options(team):
    return {'method': 'app-store-connect', 'destination': 'upload',
            'signingStyle': 'automatic', 'teamID': team,
            'manageAppVersionAndBuildNumber': False, 'uploadSymbols': True}


def validate_identity(info, expected):
    actual = (info['CFBundleIdentifier'], info['CFBundleShortVersionString'], info['CFBundleVersion'])
    if actual != (expected['bundle'], expected['version'], expected['build']):
        raise ValueError(f'Archive identity mismatch: {actual}')


def token(config):
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import ec
    from cryptography.hazmat.primitives.asymmetric.utils import decode_dss_signature
    def b64(value):
        return base64.urlsafe_b64encode(value).rstrip(b'=')
    now = int(time.time())
    header = {'alg': 'ES256', 'kid': config['key_id'], 'typ': 'JWT'}
    payload = {'iss': config['issuer_id'], 'iat': now, 'exp': now + 300, 'aud': 'appstoreconnect-v1'}
    message = b64(json.dumps(header).encode()) + b'.' + b64(json.dumps(payload).encode())
    private = serialization.load_pem_private_key(Path(config['key_path']).read_bytes(), password=None)
    if not isinstance(private, ec.EllipticCurvePrivateKey) or not isinstance(private.curve, ec.SECP256R1):
        raise ValueError('Expected an App Store Connect P-256 private key')
    r, s = decode_dss_signature(private.sign(message, ec.ECDSA(hashes.SHA256())))
    return (message + b'.' + b64(r.to_bytes(32, 'big') + s.to_bytes(32, 'big'))).decode()


def api_get(config, path, params=None):
    url = API + path + ('?' + urllib.parse.urlencode(params) if params else '')
    request = urllib.request.Request(url, headers={'Authorization': 'Bearer ' + token(config)})
    try:
        with urllib.request.urlopen(request, timeout=45) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        raise RuntimeError(f'App Store Connect read failed: HTTP {error.code}') from None


def find_build(config, version, build):
    result = api_get(config, '/v1/builds', {'filter[app]': APP_ID, 'filter[version]': build,
                                          'include': 'preReleaseVersion', 'limit': '200'})
    versions = {row['id']: row['attributes'] for row in result.get('included', []) if row['type'] == 'preReleaseVersions'}
    for row in result['data']:
        reference = row.get('relationships', {}).get('preReleaseVersion', {}).get('data') or {}
        meta = versions.get(reference.get('id'), {})
        if meta.get('version') == version and meta.get('platform') == 'IOS':
            detail = api_get(config, f"/v1/builds/{row['id']}/buildBetaDetail")['data']['attributes']
            return {'id': row['id'], 'version': version, 'build': build,
                    'processingState': row['attributes']['processingState'],
                    'usesNonExemptEncryption': row['attributes'].get('usesNonExemptEncryption'),
                    'internalBuildState': detail.get('internalBuildState'),
                    'externalBuildState': detail.get('externalBuildState')}
    return None


def save(path, value):
    path.write_text(json.dumps(value, indent=2) + '\n')


def run_logged(command, log):
    with log.open('w') as output:
        result = subprocess.run(command, cwd=ROOT, stdout=output, stderr=subprocess.STDOUT)
    if result.returncode:
        raise RuntimeError(f'Command failed ({result.returncode}); inspect {log}. No automatic retry.')


def verify_archive(directory, manifest):
    archive = directory / 'LoanGlow.xcarchive'
    info = plistlib.loads((archive / 'Info.plist').read_bytes())['ApplicationProperties']
    validate_identity(info, manifest)
    app = archive / 'Products/Applications/LoanGlow.app'
    validate_identity(plistlib.loads((app / 'Info.plist').read_bytes()), manifest)
    subprocess.run(['codesign', '--verify', '--deep', '--strict', str(app)], check=True, capture_output=True)
    return archive


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['check', 'archive', 'upload', 'status'])
    parser.add_argument('--config', type=Path, default=Path.home() / '.config/loanglow/app-store.json')
    parser.add_argument('--output', type=Path, help='Archive folder (required for upload/status)')
    parser.add_argument('--confirm-upload', action='store_true')
    parser.add_argument('--wait', action='store_true', help='Wait up to 15 minutes for Apple processing/readiness')
    args = parser.parse_args()
    config = json.loads(args.config.expanduser().read_text())
    if not re.fullmatch(r'[A-Z0-9]{10}', config['key_id']) or not re.fullmatch(r'[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}', config['issuer_id']):
        raise ValueError('Invalid App Store key/issuer identifier')
    key = Path(config['key_path']).expanduser().resolve(strict=True)
    if key.stat().st_mode & 0o077:
        raise ValueError('Private key must be owner-readable only')
    config['key_path'] = str(key)
    app = api_get(config, f'/v1/apps/{APP_ID}')['data']
    if app['attributes']['bundleId'] != BUNDLE:
        raise ValueError('App Store Connect app identity mismatch')
    expo = json.loads((ROOT / 'app.json').read_text())['expo']
    manifest = {'app_id': APP_ID, 'bundle': BUNDLE, 'version': expo['version'],
                'build': expo['ios']['buildNumber'], 'team': expo['ios']['appleTeamId']}
    if args.action == 'check':
        recent = api_get(config, '/v1/builds', {'filter[app]': APP_ID, 'sort': '-uploadedDate', 'limit': '5'})
        print(json.dumps({'app': app['attributes']['name'], **manifest,
                          'existingExactBuild': find_build(config, manifest['version'], manifest['build']),
                          'recentBuilds': [{'build': row['attributes']['version'], 'state': row['attributes']['processingState']} for row in recent['data']]}, indent=2))
        return
    if args.action in ('upload', 'status') and args.output is None:
        parser.error('upload/status requires --output pointing to an existing archive folder')
    directory = (args.output or ROOT / 'build/ios-release' / (manifest['version'] + '-' + manifest['build'])).resolve()
    if args.action == 'archive':
        if (directory / 'release.json').exists() or (directory / 'LoanGlow.xcarchive').exists():
            raise ValueError('Archive already exists. Use a new output folder; never overwrite release evidence.')
        if find_build(config, manifest['version'], manifest['build']):
            raise ValueError('This version/build already exists on Apple. Bump the build number first.')
        directory.mkdir(parents=True, exist_ok=True)
        # Build the JSI XCFramework outside Xcode's outer build phase. Xcode 27
        # can print an "error ... exit code 0" for a successful nested Swift
        # build; the outer script parser incorrectly treats that as a failure.
        # Keep the complete log and still require an actual zero exit status.
        run_logged(['env', 'PODS_ROOT=' + str(ROOT / 'ios/Pods'), 'PLATFORM_NAME=iphoneos',
                    '/bin/bash', str(ROOT / 'node_modules/expo-modules-jsi/apple/scripts/build-xcframework.sh')],
                   directory / 'jsi-build.log')
        command = ['xcodebuild', '-workspace', str(ROOT / 'ios/LoanGlow.xcworkspace'), '-scheme', 'LoanGlow',
                   '-configuration', 'Release', '-destination', 'generic/platform=iOS',
                   '-archivePath', str(directory / 'LoanGlow.xcarchive'), '-derivedDataPath', str(directory / 'DerivedData'),
                   '-allowProvisioningUpdates', '-authenticationKeyPath', config['key_path'],
                   '-authenticationKeyID', config['key_id'], '-authenticationKeyIssuerID', config['issuer_id'], 'archive']
        run_logged(command, directory / 'archive.log')
        verify_archive(directory, manifest)
        manifest['git_commit'] = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
        manifest['dirty_files'] = subprocess.check_output(['git', 'status', '--porcelain'], cwd=ROOT, text=True).splitlines()
        save(directory / 'release.json', manifest)
        (directory / 'ExportOptions.plist').write_bytes(plistlib.dumps(export_options(manifest['team'])))
        print(f'Signed archive verified (not uploaded): {directory}', flush=True)
        return
    manifest = json.loads((directory / 'release.json').read_text())
    if manifest['app_id'] != APP_ID or manifest['bundle'] != BUNDLE:
        raise ValueError('Release manifest belongs to another app')
    if args.action == 'upload':
        if not args.confirm_upload:
            parser.error('upload requires --confirm-upload')
        archive = verify_archive(directory, manifest)
        if find_build(config, manifest['version'], manifest['build']):
            raise ValueError('Build already exists on Apple; use status, not upload')
        with (directory / 'upload-attempt.json').open('x') as attempt:
            json.dump({'startedAt': datetime.now(timezone.utc).isoformat(), 'delivery': 'unconfirmed'}, attempt)
        # Regenerate from the verified manifest, never trust an edited options file.
        (directory / 'ExportOptions.plist').write_bytes(plistlib.dumps(export_options(manifest['team'])))
        run_logged(['xcodebuild', '-exportArchive', '-archivePath', str(archive),
                    '-exportOptionsPlist', str(directory / 'ExportOptions.plist'), '-exportPath', str(directory / 'export'),
                    '-allowProvisioningUpdates', '-authenticationKeyPath', config['key_path'],
                    '-authenticationKeyID', config['key_id'], '-authenticationKeyIssuerID', config['issuer_id']], directory / 'upload.log')
        print('Xcode upload completed; checking the exact build on Apple.', flush=True)
    for attempt in range(31 if args.wait else 1):
        observed = find_build(config, manifest['version'], manifest['build'])
        save(directory / 'processing.json', {'observed': observed})
        if observed:
            print(json.dumps(observed, indent=2), flush=True)
            if observed['processingState'] in ('FAILED', 'INVALID'):
                raise RuntimeError('Apple processing failed. Inspect the build; do not blindly re-upload.')
            if observed['processingState'] == 'VALID' and observed['internalBuildState'] in ('READY_FOR_BETA_TESTING', 'IN_BETA_TESTING'):
                return
        if not args.wait:
            print('Readiness not confirmed. Re-run status later; do not re-upload.')
            return
        if attempt < 30:
            time.sleep(30)
    raise RuntimeError('Apple readiness not confirmed within 15 minutes. Re-run status; do not re-upload.')


if __name__ == '__main__':
    try:
        main()
    except (ValueError, RuntimeError, OSError, subprocess.CalledProcessError) as error:
        raise SystemExit(str(error))
