# DriftGuard Data Directory

This directory stores datasets used for baseline model training and stream replay.

## Included Datasets

1. **Credit Risk / Loan Default Dataset (`credit_default.csv`)**
   - **Task**: Binary classification (`default`: 0 = No, 1 = Yes)
   - **Feature Schema**:
     - `age` (Numerical): Applicant age in years [18 - 75]
     - `income` (Numerical): Annual income in USD [15,000 - 250,000]
     - `credit_score` (Numerical): FICO-equivalent credit score [300 - 850]
     - `debt_to_income` (Numerical): Ratio of monthly debt payments to gross monthly income [0.05 - 0.75]
     - `loan_amount` (Numerical): Requested loan amount [1,000 - 60,000]
     - `employment_years` (Numerical): Years with current employer [0 - 35]
     - `home_ownership` (Categorical): `RENT`, `MORTGAGE`, `OWN`, `OTHER`
     - `loan_purpose` (Categorical): `DEBT_CONSOLIDATION`, `CREDIT_CARD`, `HOME_IMPROVEMENT`, `SMALL_BUSINESS`, `MAJOR_PURCHASE`
   - **Source**: Deterministic educational credit modeling distribution with realistic covariate structures, based on consumer credit risk characteristics.

2. **Scikit-learn Breast Cancer Diagnostic Dataset (Alternative)**
   - Pre-packaged educational classification dataset with 30 continuous features for purely numerical benchmark experiments.
