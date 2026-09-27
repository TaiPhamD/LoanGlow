import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { getTaxEstimate, taxDataInfo } from './tax-estimates';
import AdvancedLoanOptions from './AdvancedLoanOptions';
import { ArmPeriod, LoanType, monthlyPrincipalAndInterest, parseLoanYears } from './loan-options';
import {
  KeyboardAvoidingView,
  Linking,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';

const storageKey = 'loanglow:last-inputs:v1';

const defaultFormValues = {
  homePrice: '450000',
  downPayment: '90000',
  interestRate: '6.5',
  termYears: 30,
  loanType: 'fixed' as LoanType,
  armPeriod: 7 as ArmPeriod,
  scenarioRate: '',
  zip: '78704',
  manualTaxRate: '',
  useManualTax: false,
  insuranceMonthly: '175',
  hoaMonthly: '0',
};

function currency(value: number) {
  if (!Number.isFinite(value)) return '$0';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function numberInput(value: string) {
  const clean = value.replace(/[^0-9.]/g, '');
  const parsed = Number(clean);
  return Number.isFinite(parsed) ? parsed : 0;
}



function InputCard({ label, value, onChangeText, suffix, keyboardType = 'decimal-pad' }: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  suffix?: string;
  keyboardType?: 'decimal-pad' | 'number-pad';
}) {
  return (
    <View style={styles.inputCard}>
      <Text style={styles.inputLabel}>{label}</Text>
      <View style={styles.inputRow}>
        <TextInput
          accessibilityLabel={label}
          selectTextOnFocus
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType}
          placeholderTextColor="#64748B"
          style={[styles.input, keyboardType === 'number-pad' && value.length > 5 && styles.extendedZipInput]}
        />
        {suffix ? <Text style={styles.inputSuffix}>{suffix}</Text> : null}
      </View>
    </View>
  );
}

function BreakdownRow({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.breakdownRow}>
      <View style={styles.breakdownLabelWrap}>
        <View style={[styles.dot, { backgroundColor: color }]} />
        <Text style={styles.breakdownLabel}>{label}</Text>
      </View>
      <Text style={styles.breakdownValue}>{currency(value)}</Text>
    </View>
  );
}

export default function App() {
  const [homePrice, setHomePrice] = useState(defaultFormValues.homePrice);
  const [downPayment, setDownPayment] = useState(defaultFormValues.downPayment);
  const [interestRate, setInterestRate] = useState(defaultFormValues.interestRate);
  const [termYears, setTermYears] = useState(defaultFormValues.termYears);
  const [loanType, setLoanType] = useState<LoanType>(defaultFormValues.loanType);
  const [armPeriod, setArmPeriod] = useState<ArmPeriod>(defaultFormValues.armPeriod);
  const [scenarioRate, setScenarioRate] = useState(defaultFormValues.scenarioRate);
  const [zip, setZip] = useState(defaultFormValues.zip);
  const [manualTaxRate, setManualTaxRate] = useState(defaultFormValues.manualTaxRate);
  const [useManualTax, setUseManualTax] = useState(defaultFormValues.useManualTax);
  const [insuranceMonthly, setInsuranceMonthly] = useState(defaultFormValues.insuranceMonthly);
  const [hoaMonthly, setHoaMonthly] = useState(defaultFormValues.hoaMonthly);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [showTaxDetails, setShowTaxDetails] = useState(false);
  const hasLoadedSavedState = useRef(false);

  useEffect(() => {
    let isMounted = true;
    AsyncStorage.getItem(storageKey)
      .then((saved) => {
        if (!isMounted || !saved) return;
        const parsed = JSON.parse(saved) as Partial<typeof defaultFormValues>;
        if (typeof parsed.homePrice === 'string') setHomePrice(parsed.homePrice);
        if (typeof parsed.downPayment === 'string') setDownPayment(parsed.downPayment);
        if (typeof parsed.interestRate === 'string') setInterestRate(parsed.interestRate);
        const savedTerm = parseLoanYears(String(parsed.termYears)) ?? defaultFormValues.termYears;
        const savedPeriod = [5, 7, 10].includes(Number(parsed.armPeriod)) ? Number(parsed.armPeriod) as ArmPeriod : defaultFormValues.armPeriod;
        setTermYears(savedTerm);
        setArmPeriod(savedPeriod);
        setLoanType(parsed.loanType === 'arm' && savedTerm > savedPeriod ? 'arm' : 'fixed');
        if (typeof parsed.scenarioRate === 'string') setScenarioRate(parsed.scenarioRate);
        if (typeof parsed.zip === 'string') setZip(parsed.zip);
        if (typeof parsed.manualTaxRate === 'string') setManualTaxRate(parsed.manualTaxRate);
        if (typeof parsed.useManualTax === 'boolean') setUseManualTax(parsed.useManualTax);
        if (typeof parsed.insuranceMonthly === 'string') setInsuranceMonthly(parsed.insuranceMonthly);
        if (typeof parsed.hoaMonthly === 'string') setHoaMonthly(parsed.hoaMonthly);
      })
      .catch(() => {
        // Ignore storage read errors; calculator defaults are still usable.
      })
      .finally(() => {
        if (isMounted) hasLoadedSavedState.current = true;
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!hasLoadedSavedState.current) return;
    const timeout = setTimeout(() => {
      AsyncStorage.setItem(storageKey, JSON.stringify({
        homePrice,
        downPayment,
        interestRate,
        termYears,
        loanType,
        armPeriod,
        scenarioRate,
        zip,
        manualTaxRate,
        useManualTax,
        insuranceMonthly,
        hoaMonthly,
      })).catch(() => {
        // Ignore storage write errors; the live calculator should keep working.
      });
    }, 250);

    return () => clearTimeout(timeout);
  }, [homePrice, downPayment, interestRate, termYears, loanType, armPeriod, scenarioRate, zip, manualTaxRate, useManualTax, insuranceMonthly, hoaMonthly]);

  const results = useMemo(() => {
    const price = numberInput(homePrice);
    const down = Math.min(numberInput(downPayment), price);
    const loan = Math.max(price - down, 0);
    const rate = numberInput(interestRate);
    const insurance = numberInput(insuranceMonthly);
    const hoa = numberInput(hoaMonthly);
    const taxEstimate = getTaxEstimate(zip, manualTaxRate, useManualTax);
    const principalInterest = monthlyPrincipalAndInterest(loan, rate, termYears);
    const annualTax = price * (taxEstimate.rate / 100);
    const monthlyTax = annualTax / 12;
    const downPercent = price > 0 ? (down / price) * 100 : 0;
    const pmi = downPercent < 20 ? (loan * 0.006) / 12 : 0;
    const totalMonthly = principalInterest + monthlyTax + insurance + hoa + pmi;
    return { price, down, loan, rate, insurance, hoa, taxEstimate, principalInterest, annualTax, monthlyTax, pmi, totalMonthly, downPercent };
  }, [homePrice, downPayment, interestRate, termYears, zip, manualTaxRate, useManualTax, insuranceMonthly, hoaMonthly]);

  const piShare = results.totalMonthly > 0 ? `${Math.round((results.principalInterest / results.totalMonthly) * 100)}%` : '0%';
  const taxShare = results.totalMonthly > 0 ? `${Math.round((results.monthlyTax / results.totalMonthly) * 100)}%` : '0%';
  const { width, height } = useWindowDimensions();
  const isWideLayout = width >= 820 || (width > height && width >= 700);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboardView}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.heroGlow} />
          <View style={styles.header}>
            <Text style={styles.title}>LoanGlow</Text>
            <Text style={styles.subtitle}>Loan mortgage calculator with smart, editable property tax previews. Estimates only.</Text>
          </View>

          <View style={[styles.mainLayout, isWideLayout && styles.mainLayoutWide]}>
            <View style={[styles.leftPane, isWideLayout && styles.leftPaneWide]}>
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Loan details</Text>
                <View style={styles.gridCompact}>
                  <InputCard label="Home price" value={homePrice} onChangeText={setHomePrice} suffix="$" />
                  <InputCard label="Down payment" value={downPayment} onChangeText={setDownPayment} suffix="$" />
                  <InputCard label={loanType === 'arm' ? 'Initial interest rate' : 'Interest rate'} value={interestRate} onChangeText={setInterestRate} suffix="%" />
                  <InputCard label="ZIP code" value={zip} onChangeText={setZip} keyboardType="number-pad" />
                  <InputCard label="Insurance" value={insuranceMonthly} onChangeText={setInsuranceMonthly} suffix="$ / mo" />
                  <InputCard label="HOA" value={hoaMonthly} onChangeText={setHoaMonthly} suffix="$ / mo" />
                </View>
                <AdvancedLoanOptions termYears={termYears} onTermChange={setTermYears} loanType={loanType} onTypeChange={setLoanType} armPeriod={armPeriod} onPeriodChange={setArmPeriod} scenarioRate={scenarioRate} onScenarioRateChange={setScenarioRate} loan={results.loan} initialRate={results.rate} />
              </View>
            </View>

            <View style={[styles.rightPane, isWideLayout && styles.rightPaneWide]}>
              <View style={[styles.summaryCard, isWideLayout && styles.summaryCardWide]}>
                <Text style={styles.summaryLabel}>{loanType === 'arm' ? 'Initial estimated monthly payment' : 'Estimated monthly payment'}</Text>
                <Text style={[styles.summaryAmount, isWideLayout && styles.summaryAmountWide]}>{currency(results.totalMonthly)}</Text>
                <View style={styles.pillRow}>
                  <View style={styles.pill}><Text style={styles.pillText}>{currency(results.loan)} loan</Text></View>
                  <View style={styles.pill}><Text style={styles.pillText}>{results.rate.toFixed(2)}% {loanType === 'arm' ? 'initial rate' : 'interest'}</Text></View>
                  <View style={styles.pill}><Text style={styles.pillText}>{termYears} years</Text></View>
                </View>
                {loanType === 'arm' ? (
                  <View style={styles.armNotice}>
                    <Text style={styles.armNoticeTitle}>{armPeriod}/1 ARM · {termYears}-year term</Text>
                    <Text style={styles.armNoticeText}>Initial rate fixed for {armPeriod} years, then adjusts annually. Future payments may change; taxes and insurance can change at any time.</Text>
                  </View>
                ) : null}
                <View style={styles.barTrack}>
                  <View style={[styles.barSegment, styles.barPi, { flex: results.principalInterest || 1 }]} />
                  <View style={[styles.barSegment, styles.barTax, { flex: results.monthlyTax || 1 }]} />
                  <View style={[styles.barSegment, styles.barOther, { flex: results.insurance + results.hoa + results.pmi || 1 }]} />
                </View>
                <Text style={styles.shareText}>Payment mix: {piShare} principal/interest · {taxShare} tax</Text>
              </View>

              <TouchableOpacity onPress={() => setShowBreakdown(!showBreakdown)} style={styles.accordionHeader}>
                <View>
                  <Text style={styles.accordionTitle}>Monthly breakdown</Text>
                  <Text style={styles.accordionSubtitle}>Principal, tax, insurance, PMI, HOA</Text>
                </View>
                <Text style={styles.accordionAmount}>{showBreakdown ? '−' : '+'}</Text>
              </TouchableOpacity>
              {showBreakdown ? (
                <View style={styles.breakdownCard}>
                  <BreakdownRow label="Principal + interest" value={results.principalInterest} color="#38BDF8" />
                  <BreakdownRow label="Property tax" value={results.monthlyTax} color="#A78BFA" />
                  <BreakdownRow label="Home insurance" value={results.insurance} color="#34D399" />
                  <BreakdownRow label="PMI estimate" value={results.pmi} color="#FBBF24" />
                  <BreakdownRow label="HOA" value={results.hoa} color="#FB7185" />
                  <View style={styles.totalLine} />
                  <BreakdownRow label="Total monthly" value={results.totalMonthly} color="#FFFFFF" />
                </View>
              ) : null}

              <TouchableOpacity onPress={() => setShowTaxDetails(!showTaxDetails)} style={styles.accordionHeader}>
                <View style={styles.accordionTextWrap}>
                  <Text style={styles.accordionTitle}>Property tax details</Text>
                  <Text style={styles.accordionSubtitle}>{results.taxEstimate.rate.toFixed(2)}% · {results.taxEstimate.label}</Text>
                  <Text style={styles.accordionSubtitle}>{results.taxEstimate.source}</Text>
                </View>
                <View style={styles.accordionRight}>
                  <Text style={styles.miniTax}>{currency(results.monthlyTax)}/mo</Text>
                  <Text style={styles.accordionAmount}>{showTaxDetails ? '−' : '+'}</Text>
                </View>
              </TouchableOpacity>
              {showTaxDetails ? (
                <View style={styles.taxCard}>
                  <View style={styles.sectionHeadingRow}>
                    <Text style={styles.taxSource}>{results.taxEstimate.source}</Text>
                    <View style={[styles.confidenceBadge, results.taxEstimate.confidence === 'Low' && styles.confidenceLow]}>
                      <Text style={styles.confidenceText}>{results.taxEstimate.confidence}</Text>
                    </View>
                  </View>
                  <Text style={styles.taxRate}>{results.taxEstimate.rate.toFixed(2)}%</Text>
                  <Text style={styles.taxLabel}>{results.taxEstimate.label}</Text>
                  <Text style={styles.disclaimer}>{results.taxEstimate.note}</Text>
                  <View style={styles.taxNumbers}>
                    <View>
                      <Text style={styles.miniLabel}>Annual tax</Text>
                      <Text style={styles.miniValue}>{currency(results.annualTax)}</Text>
                    </View>
                    <View>
                      <Text style={styles.miniLabel}>Monthly escrow</Text>
                      <Text style={styles.miniValue}>{currency(results.monthlyTax)}</Text>
                    </View>
                  </View>
                  <TouchableOpacity onPress={() => setUseManualTax(!useManualTax)} style={[styles.manualButton, useManualTax && styles.manualButtonActive]}>
                    <Text style={[styles.manualButtonText, useManualTax && styles.manualButtonTextActive]}>
                      {useManualTax ? 'Using manual tax rate' : 'Use manual tax rate'}
                    </Text>
                  </TouchableOpacity>
                  {useManualTax ? (
                    <InputCard label="Manual annual tax rate" value={manualTaxRate} onChangeText={setManualTaxRate} suffix="%" />
                  ) : null}
                  <Text style={styles.disclaimer}>Offline data: U.S. Census ACS {taxDataInfo.period}. ZIP areas are not tax districts. This ratio of survey medians is a planning estimate, not a quoted tax rate. Exemptions, reassessments and local levies can change your actual bill. Verify with the assessor or enter your own rate.</Text>
                  <Text style={styles.disclaimer}>{taxDataInfo.coverage.usableLocalEstimates.toLocaleString()} usable local estimates · {taxDataInfo.coverage.postalCodes.toLocaleString()} postal codes in directory. Missing or unreliable local data uses a labeled fallback.</Text>
                  <Text accessibilityRole="link" onPress={() => Linking.openURL('https://www.census.gov/programs-surveys/acs/data/summary-file.html')} style={styles.sourceLink}>Source: U.S. Census Bureau ACS</Text>
                  <Text accessibilityRole="link" onPress={() => Linking.openURL('https://www.geonames.org/')} style={styles.sourceLink}>Postal directory: GeoNames · CC BY 4.0</Text>
                </View>
              ) : null}
            </View>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  armNotice: { borderTopWidth: 1, borderTopColor: '#263B53', marginTop: 14, paddingTop: 12 },
  armNoticeTitle: { color: '#7DD3FC', fontSize: 13, fontWeight: '800' },
  armNoticeText: { color: '#94A3B8', fontSize: 12, lineHeight: 18, marginTop: 4 },
  extendedZipInput: { fontSize: 16 },
  sourceLink: { color: '#67E8F9', fontSize: 12, marginTop: 10, textDecorationLine: 'underline' },
  safeArea: { flex: 1, backgroundColor: '#020617' },
  keyboardView: { flex: 1 },
  container: { padding: 16, paddingBottom: 32, maxWidth: 980, width: '100%', alignSelf: 'center' },
  heroGlow: { position: 'absolute', top: -120, right: -80, width: 280, height: 280, borderRadius: 140, backgroundColor: '#2563EB', opacity: 0.28 },
  header: { marginTop: 12, marginBottom: 10 },
  kicker: { color: '#67E8F9', fontSize: 11, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  title: { color: '#F8FAFC', fontSize: 38, fontWeight: '900', letterSpacing: -1.3, marginTop: 4 },
  subtitle: { color: '#CBD5E1', fontSize: 14, lineHeight: 20, marginTop: 4, maxWidth: 620 },
  mainLayout: { gap: 0 },
  mainLayoutWide: { flexDirection: 'row', gap: 22, alignItems: 'flex-start' },
  leftPane: { width: '100%' },
  rightPane: { width: '100%' },
  leftPaneWide: { flex: 1, maxWidth: 520 },
  rightPaneWide: { flex: 1, maxWidth: 580, paddingTop: 14 },
  summaryCard: { backgroundColor: '#0F172A', borderWidth: 1, borderColor: '#1E293B', borderRadius: 24, padding: 18, marginTop: 14, boxShadow: '0px 14px 26px rgba(56, 189, 248, 0.24)' as never, elevation: 8 },
  summaryCardWide: { marginTop: 0, padding: 22 },
  summaryLabel: { color: '#94A3B8', fontSize: 15, fontWeight: '700' },
  summaryAmount: { color: '#FFFFFF', fontSize: 46, fontWeight: '900', letterSpacing: -2, marginTop: 2 },
  summaryAmountWide: { fontSize: 58 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  pill: { backgroundColor: '#172554', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: '#1D4ED8' },
  pillText: { color: '#BFDBFE', fontWeight: '800', fontSize: 13 },
  barTrack: { height: 11, flexDirection: 'row', overflow: 'hidden', borderRadius: 999, backgroundColor: '#1E293B', marginTop: 14 },
  barSegment: { height: 13 },
  barPi: { backgroundColor: '#38BDF8' },
  barTax: { backgroundColor: '#A78BFA' },
  barOther: { backgroundColor: '#34D399' },
  shareText: { color: '#94A3B8', fontSize: 13, marginTop: 10, fontWeight: '700' },
  section: { marginTop: 14 },
  sectionHeadingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  sectionTitle: { color: '#E2E8F0', fontSize: 20, fontWeight: '900', marginBottom: 10 },
  grid: { gap: 12 },
  gridCompact: { gap: 8, flexDirection: 'row', flexWrap: 'wrap' },
  inputCard: { backgroundColor: '#0B1220', borderWidth: 1, borderColor: '#1E293B', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 0, flexBasis: '48%', flexGrow: 1, minWidth: 150 },
  inputLabel: { color: '#94A3B8', fontSize: 11, fontWeight: '800', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.4 },
  inputRow: { flexDirection: 'row', alignItems: 'center' },
  input: { flex: 1, minWidth: 0, color: '#F8FAFC', fontSize: 21, fontWeight: '900', paddingVertical: Platform.OS === 'web' ? 4 : 2, outlineStyle: 'none' as never },
  inputSuffix: { color: '#64748B', fontSize: 14, fontWeight: '900', marginLeft: 8, flexShrink: 0 },
  termSwitch: { flexDirection: 'row', gap: 8, marginTop: 8, backgroundColor: '#0B1220', borderRadius: 18, padding: 5, borderWidth: 1, borderColor: '#1E293B' },
  termButton: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 13 },
  termButtonActive: { backgroundColor: '#38BDF8' },
  termText: { color: '#94A3B8', fontWeight: '900' },
  termTextActive: { color: '#082F49' },
  confidenceBadge: { backgroundColor: '#064E3B', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, marginBottom: 0 },
  confidenceLow: { backgroundColor: '#713F12' },
  confidenceText: { color: '#ECFEFF', fontWeight: '900', fontSize: 12 },
  taxCard: { backgroundColor: '#10172A', borderWidth: 1, borderColor: '#26324A', borderRadius: 28, padding: 20 },
  taxSource: { color: '#A78BFA', fontSize: 13, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.6 },
  taxRate: { color: '#FFFFFF', fontSize: 44, fontWeight: '900', marginTop: 4 },
  taxLabel: { color: '#CBD5E1', fontSize: 16, fontWeight: '700' },
  taxNumbers: { flexDirection: 'row', justifyContent: 'space-between', gap: 16, marginTop: 18, marginBottom: 16 },
  miniLabel: { color: '#64748B', fontWeight: '800', marginBottom: 4 },
  miniValue: { color: '#F8FAFC', fontSize: 22, fontWeight: '900' },
  manualButton: { borderWidth: 1, borderColor: '#334155', borderRadius: 16, paddingVertical: 13, alignItems: 'center', marginBottom: 12 },
  manualButtonActive: { backgroundColor: '#E0F2FE', borderColor: '#38BDF8' },
  manualButtonText: { color: '#CBD5E1', fontWeight: '900' },
  manualButtonTextActive: { color: '#075985' },
  disclaimer: { color: '#94A3B8', lineHeight: 20, marginTop: 12, fontSize: 13 },
  accordionHeader: { marginTop: 10, backgroundColor: '#0B1220', borderWidth: 1, borderColor: '#1E293B', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 13, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  accordionTextWrap: { flex: 1, minWidth: 0 },
  accordionTitle: { color: '#E2E8F0', fontSize: 17, fontWeight: '900' },
  accordionSubtitle: { color: '#94A3B8', fontSize: 12, fontWeight: '700', marginTop: 2 },
  accordionAmount: { color: '#67E8F9', fontSize: 28, fontWeight: '900', lineHeight: 30 },
  accordionRight: { alignItems: 'flex-end', flexDirection: 'row', gap: 10 },
  miniTax: { color: '#DBEAFE', fontSize: 13, fontWeight: '900', marginTop: 7 },
  breakdownCard: { backgroundColor: '#0B1220', borderWidth: 1, borderColor: '#1E293B', borderRadius: 20, padding: 16, gap: 12, marginTop: 8 },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  breakdownLabelWrap: { flexDirection: 'row', alignItems: 'center', gap: 9, flex: 1 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  breakdownLabel: { color: '#CBD5E1', fontSize: 15, fontWeight: '800' },
  breakdownValue: { color: '#F8FAFC', fontSize: 16, fontWeight: '900' },
  totalLine: { height: 1, backgroundColor: '#1E293B', marginVertical: 2 },
  insightCard: { backgroundColor: '#172554', borderWidth: 1, borderColor: '#1D4ED8', borderRadius: 26, padding: 20, marginTop: 24 },
  insightCardCompact: { backgroundColor: '#172554', borderWidth: 1, borderColor: '#1D4ED8', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10, marginTop: 10 },
  insightTitle: { color: '#DBEAFE', fontSize: 20, fontWeight: '900', marginBottom: 8 },
  insightText: { color: '#BFDBFE', fontSize: 15, lineHeight: 24 },
  insightStrong: { color: '#FFFFFF', fontWeight: '900' },
  insightFootnote: { color: '#93C5FD', fontSize: 13, lineHeight: 20, marginTop: 12 },
});
