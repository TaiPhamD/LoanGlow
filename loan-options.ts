export type LoanType = 'fixed' | 'arm';
export type ArmPeriod = 5 | 7 | 10;

export function parseLoanYears(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d{1,2}$/.test(trimmed)) return null;
  const years = Number(trimmed);
  return years >= 1 && years <= 50 ? years : null;
}

export function monthlyPrincipalAndInterest(loanAmount: number, annualRatePercent: number, years: number): number {
  const months = years * 12;
  const monthlyRate = annualRatePercent / 1200;
  if (loanAmount <= 0 || months <= 0) return 0;
  if (monthlyRate === 0) return loanAmount / months;
  return loanAmount * monthlyRate / (1 - Math.pow(1 + monthlyRate, -months));
}

// A single hypothetical first reset, not a forecast of subsequent annual resets.
export function armScenario(loan: number, initialRate: number, years: number, fixedYears: ArmPeriod, rateText: string) {
  if (years <= fixedYears || !/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(rateText.trim())) return null;
  const adjustedRate = Number(rateText);
  if (!Number.isFinite(adjustedRate) || adjustedRate < 0 || adjustedRate > 100) return null;
  const initialPayment = monthlyPrincipalAndInterest(loan, initialRate, years);
  let balance = loan;
  for (let month = 0; month < fixedYears * 12; month += 1) {
    balance = Math.max(0, balance * (1 + initialRate / 1200) - initialPayment);
  }
  return { balance, payment: monthlyPrincipalAndInterest(balance, adjustedRate, years - fixedYears), month: fixedYears * 12 + 1 };
}
