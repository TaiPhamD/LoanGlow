import importlib.util
from pathlib import Path
import unittest

SCRIPT = Path(__file__).with_name('build_tax_data.py')


class EstimateTests(unittest.TestCase):
    def test_quality_gates_and_ratio(self):
        self.assertTrue(SCRIPT.exists(), 'Offline data builder is missing')
        spec = importlib.util.spec_from_file_location('builder', SCRIPT)
        assert spec is not None and spec.loader is not None
        builder = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(builder)
        self.assertEqual(builder.derive_rate(3000, 200, 300000, 10000, 1000), (1.0, 'ok'))
        self.assertEqual(builder.derive_rate(10001, -333333333, 300000, 10000, 1000), (None, 'censored'))
        self.assertEqual(builder.derive_rate(3000, 200, 2000001, -333333333, 1000), (None, 'censored'))
        self.assertEqual(builder.derive_rate(-666666666, -222222222, 300000, 10000, 1000), (None, 'missing'))
        self.assertEqual(builder.derive_rate(3000, 200, 0, 10000, 1000), (None, 'missing'))
        self.assertEqual(builder.derive_rate(3000, 200, 300000, 10000, 30), (None, 'sparse'))
        self.assertEqual(builder.derive_rate(3000, 2000, 300000, 10000, 1000), (None, 'uncertain'))
        self.assertEqual(builder.derive_rate(3000, 200, 300000, -1, 1000), (None, 'uncertain'))
        self.assertEqual(builder.derive_rate(9000, 200, 50000, 10000, 1000), (None, 'outlier'))


if __name__ == '__main__':
    unittest.main()
