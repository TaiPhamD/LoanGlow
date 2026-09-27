const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const data = require('./data/property-tax.json');

// Transpile the real estimator without requiring an additional test runtime.
const filename = fs.existsSync(path.join(__dirname, 'tax-estimates.ts')) ? 'tax-estimates.ts' : 'App.tsx';
const source = fs.readFileSync(path.join(__dirname, filename), 'utf8') + '\nexports.getTaxEstimate = getTaxEstimate;';
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const sandbox = { exports: {}, require: name => {
  if (name === 'react-native') return { StyleSheet: { create: x => x }, Platform: { OS: 'web' } };
  if (name === 'expo-status-bar' || name === '@react-native-async-storage/async-storage') return {};
  return require(name);
}};
vm.runInNewContext(js, sandbox);
const { getTaxEstimate } = sandbox.exports;
const estimate = zip => getTaxEstimate(zip, '', false);

// Capped medians must fall back to the correct state, NOT the old CT prefix.
assert.equal(estimate('07030').rate, data.states.NJ, 'New Jersey must not resolve to Connecticut');
assert.equal(estimate('06390').rate, data.states.NY, 'Fishers Island is NY, not CT');
assert.equal(estimate('78704').source, 'State fallback', 'Capped Austin tax median must not become a local rate');
assert.equal(estimate('90210').source, 'State fallback');
assert.equal(estimate('97229').source, 'ZIP-area estimate');
assert.equal(estimate('97229').rate, data.areas['97229'][0]);
assert.equal(estimate('97229-1234').rate, estimate('97229').rate);
assert.equal(estimate('972291234').rate, estimate('97229').rate);
assert.equal(estimate(' 97229 ').rate, estimate('97229').rate);
for (const invalid of ['', '070', '9722', '972290', 'abc97229', '97229-12', '97229x1234', '12.34']) {
  assert.equal(estimate(invalid).source, 'National fallback', `Must reject malformed/incomplete ZIP: ${invalid}`);
  assert.match(estimate(invalid).label, /Enter a valid/);
}
assert.match(estimate('00000').label, /not in offline directory/);
assert.equal(estimate('00501').source, 'State fallback');
assert.match(estimate('00501').label, /NY/);
assert.equal(estimate('00901').source, 'ZIP-area estimate');
for (const zip of ['00802', '96799', '96910', '96950', '09012']) {
  assert.equal(estimate(zip).source, 'National fallback');
  assert.doesNotMatch(estimate(zip).label, /HI estimated|CT estimated/);
}
assert.equal(getTaxEstimate('00000', '0', true).rate, 0);
assert.equal(getTaxEstimate('00000', '0', true).source, 'Manual override');
assert.equal(getTaxEstimate('97229', '6.25', true).rate, 6.25, 'Do not silently clamp a user rate to 5%');
for (const invalid of ['', '-1', 'abc', 'Infinity', '101', '1.2.3']) {
  const result = getTaxEstimate('97229', invalid, true);
  assert.notEqual(result.source, 'Manual override');
  assert.match(result.note, /valid manual rate/);
}
const quality = {};
for (const [zip, [rate, status]] of Object.entries(data.areas)) {
  assert.match(zip, /^\d{5}$/);
  quality[status] = (quality[status] || 0) + 1;
  const result = estimate(zip);
  assert.ok(Number.isFinite(result.rate) && result.rate > 0 && result.rate <= 5);
  if (status === 'ok') {
    assert.equal(result.source, 'ZIP-area estimate');
    assert.equal(result.rate, rate);
  } else {
    assert.equal(rate, null);
    assert.notEqual(result.source, 'ZIP-area estimate');
  }
}
assert.deepEqual(quality, data.metadata.coverage.quality);
assert.equal(Object.keys(data.areas).length, data.metadata.coverage.zctas);
assert.equal(Object.keys(data.locations).length, data.metadata.coverage.postalCodes);
for (const zip of Object.keys(data.locations)) {
  const result = estimate(zip);
  assert.ok(Number.isFinite(result.rate));
  assert.doesNotMatch(result.label, /not in offline directory/);
}
console.log(`PASS: ZIP parsing, state exceptions, territories, quality gates, overrides; ${Object.keys(data.locations).length} postal codes / ${Object.keys(data.areas).length} ZCTAs checked`);
