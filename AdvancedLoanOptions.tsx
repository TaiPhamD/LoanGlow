import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Keyboard, LayoutAnimation, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { ArmPeriod, LoanType, parseLoanYears } from './loan-options';

type Props = {
  termYears: number;
  onTermChange: (years: number) => void;
  loanType: LoanType;
  onTypeChange: (type: LoanType) => void;
  armPeriod: ArmPeriod;
  onPeriodChange: (years: ArmPeriod) => void;
  scenarioRate: string;
  onScenarioRateChange: (rate: string) => void;
  interestRate: string;
  onInterestRateChange: (rate: string) => void;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
};

export default function AdvancedLoanOptions(props: Props) {
  const { termYears, onTermChange, loanType, onTypeChange, armPeriod, onPeriodChange, scenarioRate, onScenarioRateChange, interestRate, onInterestRateChange, expanded, onExpandedChange: setExpanded } = props;
  const [custom, setCustom] = useState(![15, 20, 30].includes(termYears));
  const [draft, setDraft] = useState(String(termYears));
  const [error, setError] = useState('');
  const [showScenario, setShowScenario] = useState(Boolean(scenarioRate));
  const fade = useRef(new Animated.Value(1)).current;
  const reduceMotion = useRef(true);
  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then(value => { if (active) reduceMotion.current = value; });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', value => { reduceMotion.current = value; });
    return () => { active = false; subscription.remove(); };
  }, []);
  useEffect(() => {
    setDraft(String(termYears));
    setCustom(![15, 20, 30].includes(termYears));
  }, [termYears]);
  useEffect(() => { if (scenarioRate) setShowScenario(true); }, [scenarioRate]);
  useEffect(() => {
    if (!expanded || reduceMotion.current) return;
    fade.setValue(0);
    const animation = Animated.timing(fade, { toValue: 1, duration: 180, useNativeDriver: Platform.OS !== 'web' });
    animation.start();
    return () => { animation.stop(); fade.setValue(1); };
  }, [expanded, fade]);

  const chooseType = (type: LoanType) => {
    if (type === 'arm' && termYears <= armPeriod) {
      setError(`Choose a term longer than ${armPeriod} years before selecting this ARM.`);
      return;
    }
    setError('');
    onTypeChange(type);
  };
  const apply = () => {
    const years = parseLoanYears(draft);
    if (years === null) { setError('Enter a whole number from 1 to 50 years. Current term is unchanged.'); return; }
    if (loanType === 'arm' && years <= armPeriod) {
      setError(`Choose a term longer than ${armPeriod} years for a ${armPeriod}/1 ARM. Current term is unchanged.`);
      return;
    }
    setError('');
    onTermChange(years);
  };

  const chip = (label: string, selected: boolean, onPress: () => void, accessibilityLabel = label, disabled = false) => (
    <TouchableOpacity key={label} accessibilityRole="button" accessibilityLabel={accessibilityLabel} accessibilityState={{ selected, disabled }} {...(Platform.OS === 'web' ? { 'aria-pressed': selected } : {})} disabled={disabled} onPress={onPress} style={[styles.chip, selected && styles.chipSelected, disabled && styles.disabled]}>
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </TouchableOpacity>
  );
  return (
    <View>
      {!expanded && <View style={styles.quickTerms}>
        {[15, 20, 30].map(years => chip(`${years} yr`, !custom && termYears === years, () => { setError(''); onTermChange(years); setCustom(false); }))}
      </View>}
      <View style={[styles.card, expanded && styles.cardExpanded]}>
        <TouchableOpacity testID="loan-mode-switch" accessibilityRole="button" accessibilityLabel={expanded ? 'Back to basic' : 'Advanced loan options'} aria-expanded={expanded} accessibilityState={{ expanded }} onPress={() => {
          Keyboard.dismiss();
          if (Platform.OS === 'ios' && !reduceMotion.current) {
            LayoutAnimation.configureNext({ ...LayoutAnimation.Presets.easeInEaseOut, duration: 180 });
          }
          setError('');
          setExpanded(!expanded);
        }} style={styles.header}>
          <View style={styles.heading}>
            <Text style={styles.title}>{expanded ? 'Advanced mode' : 'Advanced loan options'}</Text>
            <Text style={styles.subtitle}>{expanded ? 'Back to basic · Your advanced settings are saved' : 'Custom terms, ARM and rate scenarios'}</Text>
          </View>
          <Text style={styles.chevron}>{expanded ? '←' : '→'}</Text>
        </TouchableOpacity>
        {expanded && (
          <Animated.View testID="advanced-inputs" style={[styles.body, { opacity: fade }]}>
            <Text style={styles.label}>Repayment term</Text>
            <View style={styles.chips}>
              {[15, 20, 30].map(years => chip(`${years} yr`, !custom && termYears === years, () => { setError(''); onTermChange(years); setCustom(false); }))}
              {chip('Custom', custom, () => { setCustom(true); setDraft(String(termYears)); }, 'Custom term')}
            </View>
            <Text style={styles.label}>Loan type</Text>
            <View style={styles.chips}>
              {chip('Fixed rate', loanType === 'fixed', () => chooseType('fixed'))}
              {chip('Adjustable rate', loanType === 'arm', () => chooseType('arm'))}
            </View>
            {custom && (
              <View style={styles.customSection}>
                <Text style={styles.label}>Custom repayment term</Text>
                <View style={styles.inputRow}>
                  <View style={styles.inputBox}>
                    <TextInput accessibilityLabel="Custom loan years" keyboardType="number-pad" selectTextOnFocus value={draft} onChangeText={setDraft} onSubmitEditing={apply} style={styles.input} />
                    <Text style={styles.suffix}>years</Text>
                  </View>
                  <TouchableOpacity accessibilityRole="button" accessibilityLabel="Apply term" onPress={apply} style={styles.apply}><Text style={styles.applyText}>Apply</Text></TouchableOpacity>
                </View>
                <Text style={styles.helper}>1–50 whole years · Applies when you tap Apply</Text>
              </View>
            )}
            <View>
              <Text style={styles.label}>Interest rate</Text>
              <View style={styles.inputBox}>
                <TextInput accessibilityLabel="Interest rate" value={interestRate} onChangeText={onInterestRateChange} keyboardType="decimal-pad" selectTextOnFocus style={styles.input} />
                <Text style={styles.suffix}>%</Text>
              </View>
              {loanType === 'arm' ? <Text style={styles.helper}>Applies for the first {armPeriod} years.</Text> : null}
            </View>
            {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
            {loanType === 'arm' ? (
              <View style={styles.armSection}>
                <Text style={styles.label}>ARM structure</Text>
                <View style={styles.chips}>
                  {([5, 7, 10] as ArmPeriod[]).map(years => chip(`${years}/1`, armPeriod === years, () => { setError(''); onPeriodChange(years); }, `${years}/1 ARM`, termYears <= years))}
                </View>
                <View style={styles.timeline}>
                  <View style={styles.phase}><Text style={styles.phaseTitle}>FIRST {armPeriod} YEARS</Text><Text style={styles.phaseValue}>Fixed rate</Text></View>
                  <Text style={styles.arrow}>→</Text>
                  <View style={styles.phase}><Text style={styles.phaseTitle}>THEN EVERY YEAR</Text><Text style={styles.phaseValue}>Rate can change</Text></View>
                </View>
                <Text style={styles.helper}>Repaid over {termYears} years—not {armPeriod}. The initial payment assumes a fully amortizing loan. Future rates and payments can rise or fall.</Text>
                <TouchableOpacity accessibilityRole="button" accessibilityLabel="After-adjustment scenario" aria-expanded={showScenario} accessibilityState={{ expanded: showScenario }} onPress={() => setShowScenario(!showScenario)} style={styles.scenarioToggle}>
                  <Text style={styles.scenarioTitle}>After-adjustment scenario</Text><Text style={styles.chevron}>{showScenario ? '−' : '+'}</Text>
                </TouchableOpacity>
                {showScenario && (
                  <View style={styles.scenario}>
                    <Text style={styles.label}>Hypothetical adjusted rate</Text>
                    <View style={styles.inputBox}>
                      <TextInput accessibilityLabel="Hypothetical adjusted rate" value={scenarioRate} onChangeText={onScenarioRateChange} keyboardType="decimal-pad" selectTextOnFocus placeholder="Enter a rate" placeholderTextColor="#64748B" style={styles.input} />
                      <Text style={styles.suffix}>%</Text>
                    </View>
                    <Text style={styles.helper}>Enter 0–100%. Compare the result in your monthly payment summary.</Text>
                  </View>
                )}
              </View>
            ) : <Text style={styles.helper}>The interest rate stays fixed over the repayment term. Taxes and insurance can still change.</Text>}
          </Animated.View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  quickTerms: { flexDirection: 'row', gap: 4, marginTop: 8, padding: 5, borderRadius: 18, backgroundColor: '#0B1220', borderWidth: 1, borderColor: '#1E293B' },
  card: { marginTop: 10, borderRadius: 20, borderWidth: 1, borderColor: '#26324A', backgroundColor: '#0B1220', overflow: 'hidden' },
  cardExpanded: { borderColor: '#25516A' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  heading: { flex: 1 },
  title: { color: '#E2E8F0', fontSize: 15, fontWeight: '800' },
  subtitle: { color: '#94A3B8', fontSize: 12, marginTop: 4 },
  chevron: { color: '#67E8F9', fontSize: 23, fontWeight: '600' },
  body: { paddingHorizontal: 16, paddingBottom: 16, borderTopWidth: 1, borderTopColor: '#1E293B', paddingTop: 16, gap: 10 },
  label: { color: '#94A3B8', fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 7 },
  chips: { flexDirection: 'row', gap: 6 },
  chip: { flex: 1, minHeight: 44, borderRadius: 12, backgroundColor: '#131F32', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, paddingVertical: 10 },
  chipSelected: { backgroundColor: '#38BDF8' },
  chipText: { color: '#A7B6CD', fontSize: 13, fontWeight: '800' },
  chipTextSelected: { color: '#082F49' },
  disabled: { opacity: 0.35 },
  customSection: { marginTop: 6 },
  inputRow: { flexDirection: 'row', gap: 10 },
  inputBox: { flex: 1, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#334155', borderRadius: 13, paddingHorizontal: 12, paddingVertical: 9, minWidth: 0, minHeight: 48 },
  input: { flex: 1, minWidth: 0, color: '#F8FAFC', fontWeight: '800', fontSize: 20, padding: 0 },
  suffix: { color: '#94A3B8', fontSize: 13, fontWeight: '600' },
  apply: { justifyContent: 'center', paddingHorizontal: 18, backgroundColor: '#164E63', borderRadius: 13, minHeight: 48 },
  applyText: { color: '#CFFAFE', fontWeight: '800' },
  helper: { color: '#94A3B8', fontSize: 12, lineHeight: 19, marginTop: 5 },
  error: { color: '#FDA4AF', fontSize: 12, lineHeight: 18 },
  armSection: { marginTop: 6 },
  timeline: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14, padding: 12, backgroundColor: '#10283A', borderRadius: 14 },
  phase: { flex: 1 },
  phaseTitle: { color: '#7DD3FC', fontSize: 9, fontWeight: '800', letterSpacing: 0.4 },
  phaseValue: { color: '#E0F2FE', fontSize: 12, fontWeight: '700', marginTop: 5 },
  arrow: { color: '#38BDF8', fontSize: 19 },
  scenarioToggle: { marginTop: 14, borderTopWidth: 1, borderTopColor: '#26324A', paddingTop: 12, minHeight: 44, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 6 },
  scenarioTitle: { color: '#C4B5FD', fontSize: 13, fontWeight: '700', flex: 1 },
  scenario: { marginTop: 12 },

});
