import importlib.util
from pathlib import Path
import plistlib
import unittest

ROOT = Path(__file__).resolve().parents[1]


class ReleaseTests(unittest.TestCase):
    def test_local_release_contract(self):
        script = ROOT / 'scripts/ios_release.py'
        self.assertTrue(script.exists(), 'Local native release workflow is missing')
        spec = importlib.util.spec_from_file_location('ios_release', script)
        assert spec and spec.loader
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        options = module.export_options('TEAM123456')
        self.assertEqual(options['method'], 'app-store-connect')
        self.assertEqual(options['destination'], 'upload')
        self.assertFalse(options['manageAppVersionAndBuildNumber'])
        self.assertEqual(options['teamID'], 'TEAM123456')
        self.assertNotIn('testFlightInternalTestingOnly', options)
        info = {'CFBundleIdentifier': 'com.rush.loanglow', 'CFBundleShortVersionString': '1.1.0', 'CFBundleVersion': '7'}
        module.validate_identity(info, {'bundle': 'com.rush.loanglow', 'version': '1.1.0', 'build': '7'})
        with self.assertRaises(ValueError):
            module.validate_identity(info, {'bundle': 'com.rush.other', 'version': '1.1.0', 'build': '7'})
        with self.assertRaises(ValueError):
            module.validate_identity(info, {'bundle': 'com.rush.loanglow', 'version': '1.1.0', 'build': '8'})
        plist = plistlib.loads((ROOT / 'ios/LoanGlow/Info.plist').read_bytes())
        self.assertEqual(plist['CFBundleShortVersionString'], '$(MARKETING_VERSION)')
        self.assertEqual(plist['CFBundleVersion'], '$(CURRENT_PROJECT_VERSION)')
        self.assertFalse(plist['ITSAppUsesNonExemptEncryption'])
        self.assertIn('UIApplicationSceneManifest', plist, 'Native app must adopt the UIScene lifecycle')
        scene = plist['UIApplicationSceneManifest']
        self.assertFalse(scene['UIApplicationSupportsMultipleScenes'])
        self.assertEqual(scene['UISceneConfigurations']['UIWindowSceneSessionRoleApplication'][0]['UISceneDelegateClassName'], '$(PRODUCT_MODULE_NAME).SceneDelegate')


if __name__ == '__main__':
    unittest.main()
