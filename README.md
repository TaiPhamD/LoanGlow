# LoanGlow Support & Privacy

LoanGlow is a mortgage calculator for informational estimates only.

## Support

For help, questions, or feedback, contact the developer through the App Store listing.

## Privacy

LoanGlow does not collect, sell, or share personal data.

Calculator inputs may be saved locally on your device so the app can remember your previous values. This data stays on your device and is not sent to a server.

LoanGlow does not use accounts, ads, analytics, or tracking.

## Disclaimer

LoanGlow provides estimates only. Actual lender payments, property taxes, insurance, PMI, fees, escrow amounts, and closing costs may vary. Always verify numbers with a qualified lender, tax professional, or local authority before making financial decisions.

## Build from source

```bash
npm install
npx -p node@22 npm run web
```

Then open the Expo web URL.

Run checks:

```bash
npx -p node@22 npm run typecheck
npx -p node@22 npm run export:web
```

For iOS builds, use EAS Build with your own Expo and Apple credentials:

```bash
npx -p node@22 -p eas-cli eas build --platform ios --profile production
```
