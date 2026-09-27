# LoanGlow Support & Privacy

LoanGlow is a mortgage calculator for informational estimates only.

## Support

For help, questions, or feedback create a github issue.

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

## Advanced loan options

The expandable loan panel keeps 15/20/30-year shortcuts and supports custom whole
terms from 1–50 years. Custom edits take effect only after Apply; invalid edits
leave the current calculation unchanged. Fixed-rate is the default, including
when restoring older saved inputs. Loan type, repayment term, ARM period, and
scenario rate stay on-device with the existing calculator inputs.

For adjustable loans, choose 5/1, 7/1, or 10/1 independently of the repayment term.
The repayment term must extend beyond the initial fixed-rate period. The summary
explicitly labels the initial monthly payment and keeps the ARM badge visible
when Advanced is collapsed. The interest field is a nominal interest rate, not
an APR including lender fees.

The optional first-adjustment scenario amortizes the original loan through the
initial fixed period, then calculates principal and interest on the remaining
balance over the remaining term at a user-entered hypothetical rate. It is not
a rate forecast, lender offer, maximum payment, or a simulation of later resets.
It excludes escrow, PMI, HOA, prepayments, and lender-specific index/margin/caps.
ARM context: https://www.consumerfinance.gov/documents/5984/cfpb_charm_booklet.pdf

Run `npm run verify:loans` for calculation/validation checks and, with the web
preview running, `npm run verify:loans-ui` for interaction and persistence checks.
Set `TEST_URL` to exercise the exported production web build instead.

## Offline ZIP and property-tax estimates

Every input selects its value on focus for quick replacement. ZIP lookup accepts
five digits, ZIP+4, or nine digits, preserves leading zeros, and does not turn
partial or malformed input into a plausible location.

The app bundles `data/property-tax.json`; no tax service, account, API key, or
runtime internet connection is needed for calculations. The web page still needs
an initial load (this is not an offline-installable PWA).

The bundled snapshot contains 41,706 postal-directory entries and 33,772 Census
ZIP Code Tabulation Areas (ZCTAs). Of these, 24,019 pass the local-estimate quality
checks. Missing/unreliable local data falls back to the state/PR estimate where
available, otherwise to an explicitly labeled U.S. planning placeholder. This is
not a guarantee of every current USPS assignment or every property's tax rate.

Source data: U.S. Census Bureau ACS 2020–2024 five-year detailed tables B25103
(median annual real estate taxes paid), B25077 (median owner-occupied home value),
and B25003 (estimated owner-occupied housing count). The calculation is
`100 × median taxes / median value`. This is a ratio of two survey medians, NOT an
average of individually sampled property rates, a statutory levy, or a forecast
of taxes after purchase. State and national fallback ratios use the same method.

Quality gates exclude missing/suppressed or capped medians (including $10,000+
tax and $2,000,000+ value categories), areas with fewer than 100 estimated
owner-occupied homes, either input's margin of error above 50% of its estimate or
unavailable, and ratios above 5%. The home count is a population estimate, not the
survey sample size. These are conservative app heuristics, not a formal confidence
interval. Local estimates are always labeled approximate. ZIPs cross tax districts;
exemptions, assessment rules, special levies, and reassessment after sale can make
an individual property's bill substantially different. Use an assessor's estimate
or a manual rate when available. Manual rates accept 0% and are not silently capped
at the previous 5% limit.

Postal place/state labels are adapted from GeoNames US, PR, VI, GU, AS, and MP
postal files, licensed CC BY 4.0. GeoNames is not an authoritative USPS registry;
new, retired, unique, PO Box, and military ZIPs may lack residential data. Multiple
place names can share a ZIP; the builder retains the first directory label.
Puerto Rico has ACS estimates; other territories and military addresses without
applicable data are not assigned a nearby state's rate.

Sources and attribution:

- Census bulk files: https://www2.census.gov/programs-surveys/acs/summary_file/2024/table-based-SF/
- Census ACS documentation: https://www.census.gov/programs-surveys/acs/data/summary-file.html
- GeoNames: https://www.geonames.org/ and https://download.geonames.org/export/zip/
- GeoNames license: https://creativecommons.org/licenses/by/4.0/

Rebuild with Python 3 (standard library only):

```bash
npm run data:tax
# Reuse the downloaded raw sources with networking disabled:
npm run data:tax -- --offline
# Use a fresh cache directory to refresh the public source downloads:
npm run data:tax -- --cache /path/to/new-cache
```

Default cache: `~/.cache/loanglow-tax-2024`. The builder downloads public bulk
files rather than the Census API (which now requires a key). Metadata records
the survey period, formula, coverage, quality rules, source URLs, SHA-256 hashes,
and generation time. Rebuilding identical source files reproduces the data apart
from generation time. Output is replaced only after the build validates.

Additional checks:

```bash
npm run verify:tax  # builder quality gates and every bundled ZIP/ZCTA
# With npm run web running at localhost:8081:
npm run verify:inputs
npm run verify:tax-ui  # disables browser networking during lookup
npm run verify:persistence
npm run verify:responsive
```

## Local iOS / TestFlight builds

The native project is checked in at `ios/LoanGlow.xcworkspace`. Build and sign on
macOS with Xcode; EAS Build, EAS Submit and an Expo account are not used. Expo SDK
libraries remain part of the React Native app and compile locally. Do not run
`expo prebuild --clean` over this checked-in project: it would discard native
signing, version settings and the Xcode 27 CocoaPods compatibility hook.

Prerequisites: Xcode, Node 22+, CocoaPods, Python 3 with `cryptography`, and valid
Apple signing identities. Install dependencies with `npm ci` and
`pod install --project-directory=ios`; use `npm run ios` for a local development
build, or open the workspace in Xcode. Release archives bundle JavaScript/data
and do not require Metro or a development server.

Local configuration lives at `~/.config/loanglow/app-store.json`, outside git.
Its fields are `key_path`, `key_id`, and `issuer_id`; `key_path` points to your
existing App Store Connect `.p8` file. Keep that file owner-readable only.
Alternatively pass `--config /path/to/existing/app-store.json` to each command.
Never put keys, tokens, signing profiles or credential files in the repository.

Keep version/build settings aligned in `app.json`, `package.json`, the npm lockfile,
and the Xcode target's `MARKETING_VERSION` / `CURRENT_PROJECT_VERSION` settings.
The app's Info.plist references the Xcode settings. `ios:check` reads the actual
Apple app/build history before an archive; the archive's signed identity must
match the requested version/build. No build-number auto-increment occurs at upload.

```bash
npm run typecheck
npm run verify:tax
npm run verify:ios-release
npm run ios:check
npm run ios:archive -- --output build/ios-release/RELEASE_NAME
# Explicit, separate upload of that exact verified signed archive:
npm run ios:upload -- --output build/ios-release/RELEASE_NAME --confirm-upload --wait
# Resume verification without sending the binary again:
npm run ios:status -- --output build/ios-release/RELEASE_NAME --wait
```

Archives, export settings, manifests, upload-attempt markers and full build logs
stay under ignored `build/`. A failed or interrupted upload must not be blindly
retried: inspect the exact version/build on Apple first. The script refuses a
second upload attempt from the same archive directory. It reports Apple processing
and internal beta states separately; it does not submit App Review, add external
testers, change distribution territories, or release publicly.

The Xcode 27 workflow raises legacy pod deployment targets to the app's minimum
iOS 16.4 and prebuilds ExpoModulesJSI outside the outer archive phase to avoid
Xcode treating a successful nested compiler's diagnostic as an archive failure.
Expo SDK stays on the 56 release line with its upstream Swift compatibility fix.
