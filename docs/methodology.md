# DriftGuard Scientific & Statistical Methodology

## 1. Problem Formulation: Distribution Shift in Production ML

In real-world machine learning deployments, the assumption that production inference data is independent and identically distributed ($i.i.d.$) relative to training data is frequently violated.

Distribution shift can be formalized through the joint probability distribution of input covariates $X$ and ground-truth targets $Y$:

$$P(X, Y) = P(X) \cdot P(Y | X) = P(Y) \cdot P(X | Y)$$

DriftGuard classifies and handles three distinct shift phenomena:
1. **Covariate Shift (Feature Drift)**: $P(X)$ changes while $P(Y|X)$ remains constant.
2. **Concept Drift**: $P(Y|X)$ changes (the conditional relationship between features and target changes).
3. **Prior Probability Shift**: $P(Y)$ changes while $P(X|Y)$ remains constant.

> **Key Axiom**: Covariate shift $P(X)$ does **not** inherently imply predictive performance degradation $P(Y|X)$. DriftGuard explicitly decouples input drift detection from predictive quality audits.

---

## 2. Statistical Drift Detection Framework

### 2.1 Two-Sample Kolmogorov–Smirnov (KS) Test
For continuous numerical features, DriftGuard uses the two-sample KS test to compare the empirical cumulative distribution functions (ECDF) of baseline $F_0(x)$ and monitoring window $F_t(x)$:

$$D_{KS} = \sup_{x} |F_0(x) - F_t(x)|$$

The asymptotic p-value is evaluated under the null hypothesis $H_0: F_0 = F_t$.

### 2.2 Multiple Testing Problem & Benjamini–Hochberg (FDR) Correction
When monitoring tabular models with $m$ features, testing each feature at significance level $\alpha = 0.05$ causes Family-Wise Error Rate (FWER) inflation:

$$\text{FWER} = 1 - (1 - \alpha)^m$$

For a 10-feature model, naive testing yields a ~40% chance of at least one false positive drift alert under perfectly stationary conditions.

DriftGuard implements the **Benjamini–Hochberg (BH) Step-Up Procedure** to control the False Discovery Rate (FDR):
1. Sort raw p-values in ascending order: $p_{(1)} \le p_{(2)} \le \dots \le p_{(m)}$.
2. Compute critical cutoff: $c_k = \frac{k}{m} \cdot Q$, where $Q = 0.05$.
3. Find largest $k$ such that $p_{(k)} \le c_k$.
4. Reject $H_0$ for all $i \le k$.
5. Compute adjusted q-values: $q_{(k)} = \min_{j \ge k} \left( \min\left(1, \frac{m \cdot p_{(j)}}{j}\right) \right)$.

### 2.3 Effect Size: Population Stability Index (PSI)
Statistical tests suffer from the "large sample size paradox": with $N = 10,000$, trivial shifts (e.g., mean income shifting from $60,000 to $60,050) yield $p < 0.001$ despite zero practical significance.

DriftGuard pairs hypothesis testing with **decile-binned PSI**:

$$\text{PSI} = \sum_{b=1}^{B} \left( \text{Actual}\%_b - \text{Expected}\%_b \right) \times \ln\left( \frac{\text{Actual}\%_b}{\text{Expected}\%_b} \right)$$

- Quantiles are fitted on the baseline distribution ($B=10$ deciles).
- Monitoring batches are mapped onto baseline bins.
- Laplace smoothing ($\epsilon = 10^{-4}$) is applied to prevent division-by-zero or $\ln(0)$ on empty monitoring bins.
- **Interpretation Rule**:
  - $\text{PSI} < 0.10$: Stable / Negligible shift.
  - $0.10 \le \text{PSI} < 0.25$: Moderate shift (Warning).
  - $\text{PSI} \ge 0.25$: Significant shift (Action required).

### 2.4 Wasserstein Distance (Earth Mover's Distance)
For 1D continuous distributions, the 1st Wasserstein distance measures the minimum cost of transforming one probability distribution into another:

$$W_1(u, v) = \int_{-\infty}^{\infty} |U(x) - V(x)| dx$$

DriftGuard normalizes $W_1$ by the baseline standard deviation ($\sigma_{baseline}$) to produce a scale-invariant metric:

$$W_{norm} = \frac{W_1(u, v)}{\sigma_{baseline} + \epsilon}$$

### 2.5 Categorical Features: Chi-Square Goodness-of-Fit & Total Variation
For discrete features (e.g. `home_ownership`, `loan_purpose`), DriftGuard performs Pearson's $\chi^2$ goodness-of-fit:

$$\chi^2 = \sum_{c=1}^{C} \frac{(O_c - E_c)^2}{E_c}$$

Alongside Total Variation Distance (TVD):

$$\text{TVD} = \frac{1}{2} \sum_{c=1}^{C} |P_{base}(c) - P_{curr}(c)|$$

---

## 3. Delayed Ground-Truth Evaluation

In real-world applications, labels arrive asynchronously with variable delay:
- Credit default: 6 - 24 months post-issuance.
- Fraud detection: 14 - 60 days post-transaction.

DriftGuard implements delayed label binding:
1. Predictions and input rows are stored in immutable `prediction_batches`.
2. When delayed ground-truth arrives via `/api/v1/labels`, the system matches rows and calculates:
   - Macro-averaged F1: $F1_{macro} = \frac{F1_0 + F1_1}{2}$
   - Accuracy, Precision, Recall, ROC-AUC, PR-AUC.
   - Delta degradation against baseline: $\Delta F1 = F1_{observed} - F1_{baseline}$.
   - Degradation alert triggered when $\Delta F1 < -0.05$.

---

## 4. Retraining Strategy Formulations

| Policy | Trigger Condition | Training Data Window | Deployment Criteria |
|---|---|---|---|
| **Static** | None (never retrains) | Original baseline training set | Retains original model |
| **Periodic** | Fixed cadence (every $K$ windows) | Sliding window of recent labeled data | Automatic deployment |
| **Drift-Triggered** | Statistical drift detected ($\text{PSI} \ge 0.20$ or severity = MEDIUM/HIGH) | Recent labeled window | Automatic deployment |
| **Gated-Retraining** | Statistical drift detected | Recent labeled window (65% train, 35% validation) | **Gated**: $F1_{cand} \ge F1_{curr} - 0.02$. Rejects if candidate degrades performance. |

---

## 5. Preventing Data Leakage

To prevent experimental contamination:
1. **Preprocessing Pipeline Isolation**: `StandardScaler` and `OneHotEncoder` are fit strictly on the training partition; transforms are applied to validation/test partitions without refitting.
2. **Temporal Separation**: Retraining algorithms are provided labels only from historical and current simulation windows available up to the simulated decision timestamp, never peering into future stream batches.
