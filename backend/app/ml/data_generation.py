import os
import numpy as np
import pandas as pd
from typing import Tuple, Dict, Any
from sklearn.datasets import load_breast_cancer
from app.core.config import settings
from app.core.logging import logger


def generate_credit_default_dataset(n_samples: int = 4000, random_seed: int = 42) -> pd.DataFrame:
    """
    Generates a realistic educational tabular credit default dataset with known
    covariate structure and documented features.
    
    Target:
      - default: 1 if borrower defaults on loan, 0 otherwise (~20% base rate).
    """
    rng = np.random.RandomState(random_seed)

    # 1. Numerical Features
    age = rng.normal(loc=41.0, scale=11.0, size=n_samples).clip(20, 75).round().astype(int)
    
    # Income depends partially on age and career progression
    log_income = rng.normal(loc=10.8 + 0.01 * (age - 35), scale=0.55, size=n_samples)
    income = np.exp(log_income).round(-2)
    
    # Credit score (FICO style 350-850)
    credit_score = rng.normal(loc=675, scale=65, size=n_samples).clip(350, 850).round().astype(int)
    
    # Debt to income ratio (0.05 to 0.70)
    debt_to_income = (rng.beta(a=2.5, b=4.5, size=n_samples) * 0.75).round(3)
    
    # Loan amount ($1,000 to $50,000)
    loan_amount = (rng.gamma(shape=3.0, scale=4000, size=n_samples) + 2000).clip(1000, 50000).round(-2)
    
    # Employment years
    employment_years = (rng.exponential(scale=5.0, size=n_samples)).clip(0, age - 18).round(1)

    # 2. Categorical Features
    home_ownership_probs = [0.42, 0.40, 0.15, 0.03]  # RENT, MORTGAGE, OWN, OTHER
    home_ownership = rng.choice(["RENT", "MORTGAGE", "OWN", "OTHER"], size=n_samples, p=home_ownership_probs)
    
    purpose_probs = [0.45, 0.25, 0.15, 0.10, 0.05]
    loan_purpose = rng.choice(
        ["DEBT_CONSOLIDATION", "CREDIT_CARD", "HOME_IMPROVEMENT", "SMALL_BUSINESS", "MAJOR_PURCHASE"],
        size=n_samples,
        p=purpose_probs
    )

    # 3. Ground Truth Generation (Log-odds logistic model)
    # Higher debt_to_income, lower credit score, lower income, RENT increase default risk
    home_rent_effect = (home_ownership == "RENT").astype(float) * 0.45
    business_effect = (loan_purpose == "SMALL_BUSINESS").astype(float) * 0.60
    
    std_income = (income - 60000) / 30000
    std_credit = (credit_score - 675) / 65
    std_dti = (debt_to_income - 0.35) / 0.15
    std_loan = (loan_amount - 15000) / 10000
    
    logit = (
        -1.55
        + 0.95 * std_dti
        - 1.15 * std_credit
        - 0.45 * std_income
        + 0.40 * std_loan
        + home_rent_effect
        + business_effect
        + rng.normal(0, 0.35, size=n_samples)
    )
    
    prob_default = 1.0 / (1.0 + np.exp(-logit))
    default = (rng.uniform(0, 1, size=n_samples) < prob_default).astype(int)

    df = pd.DataFrame({
        "age": age,
        "income": income,
        "credit_score": credit_score,
        "debt_to_income": debt_to_income,
        "loan_amount": loan_amount,
        "employment_years": employment_years,
        "home_ownership": home_ownership,
        "loan_purpose": loan_purpose,
        "default": default
    })
    return df


def get_dataset(dataset_name: str = "credit_default", n_samples: int = 4000, random_seed: int = 42) -> pd.DataFrame:
    """
    Returns a clean DataFrame for the chosen dataset name.
    """
    if dataset_name == "breast_cancer":
        data = load_breast_cancer(as_frame=True)
        df = data.frame.copy()
        # Rename target column to 'target'
        if "target" not in df.columns and "class" in df.columns:
            df = df.rename(columns={"class": "target"})
        return df
    
    # Default is credit_default
    csv_path = os.path.join(settings.DATA_DIR, "credit_default.csv")
    if os.path.exists(csv_path):
        try:
            return pd.read_csv(csv_path)
        except Exception as e:
            logger.warning(f"Error reading existing CSV: {e}. Regenerating...")

    df = generate_credit_default_dataset(n_samples=n_samples, random_seed=random_seed)
    df.to_csv(csv_path, index=False)
    logger.info(f"Generated default dataset saved at: {csv_path}")
    return df


def simulate_stream_batch(
    reference_df: pd.DataFrame,
    batch_size: int = 200,
    scenario: str = "no_shift",
    batch_index: int = 0,
    random_seed: int = 42,
    target_col: str = "default"
) -> Tuple[pd.DataFrame, np.ndarray]:
    """
    Simulates a stream batch under a controlled shift scenario.
    Returns (X_batch_df, y_batch_array).
    
    Controlled scenarios:
      - 'no_shift': Resampled from baseline distribution without shift.
      - 'mean_shift': Numerical mean shift (+2.2 std on debt_to_income, -1.8 std on credit_score).
      - 'variance_shift': Numerical variance expansion (scale standard deviations 2.5x).
      - 'categorical_shift': Major shift in categorical distribution (RENT increases to 85%).
      - 'class_imbalance_shift': Sampling biased to increase default rate to 45%+.
      - 'concept_shift': Underlying P(Y|X) changes! (Macroeconomic shock: default threshold drops sharply).
    """
    rng = np.random.RandomState(random_seed + batch_index * 1337)
    
    # Sample base rows with replacement
    sample_indices = rng.choice(len(reference_df), size=batch_size, replace=True)
    batch_df = reference_df.iloc[sample_indices].copy().reset_index(drop=True)
    
    y = batch_df[target_col].values.copy()
    X = batch_df.drop(columns=[target_col])

    if scenario == "no_shift":
        # Pure i.i.d. random sample from the same distribution
        pass

    elif scenario == "mean_shift":
        # Numerical feature mean shift: debt_to_income shifts up, credit_score shifts down
        if "debt_to_income" in X.columns:
            shift = rng.normal(0.18, 0.03, size=batch_size)
            X["debt_to_income"] = (X["debt_to_income"] + shift).clip(0.05, 0.95).round(3)
        if "credit_score" in X.columns:
            shift = rng.normal(60, 10, size=batch_size)
            X["credit_score"] = (X["credit_score"] - shift).clip(350, 850).round().astype(int)
        if "income" in X.columns:
            shift = rng.normal(12000, 2000, size=batch_size)
            X["income"] = (X["income"] - shift).clip(15000, 300000).round(-2)

    elif scenario == "variance_shift":
        # Numerical feature variance shift: expands spreads around feature means
        for col in ["loan_amount", "income", "debt_to_income"]:
            if col in X.columns:
                mean_val = reference_df[col].mean()
                dev = X[col] - mean_val
                # Expand standard deviation by 2.2x
                X[col] = (mean_val + dev * 2.2).clip(lower=reference_df[col].min() * 0.5)
                if col in ["loan_amount", "income"]:
                    X[col] = X[col].round(-2)
                else:
                    X[col] = X[col].round(3)

    elif scenario == "categorical_shift":
        # Shift categorical frequencies: home_ownership RENT dominates (80%), MORTGAGE collapses
        if "home_ownership" in X.columns:
            new_probs = [0.80, 0.08, 0.08, 0.04]  # RENT, MORTGAGE, OWN, OTHER
            X["home_ownership"] = rng.choice(["RENT", "MORTGAGE", "OWN", "OTHER"], size=batch_size, p=new_probs)
        if "loan_purpose" in X.columns:
            new_purp_probs = [0.10, 0.15, 0.05, 0.65, 0.05]  # SMALL_BUSINESS spikes
            X["loan_purpose"] = rng.choice(
                ["DEBT_CONSOLIDATION", "CREDIT_CARD", "HOME_IMPROVEMENT", "SMALL_BUSINESS", "MAJOR_PURCHASE"],
                size=batch_size,
                p=new_purp_probs
            )

    elif scenario == "class_imbalance_shift":
        # Re-sample or re-weight to bias the class ratio
        pos_indices = reference_df[reference_df[target_col] == 1].index.values
        neg_indices = reference_df[reference_df[target_col] == 0].index.values
        # Target 50% positive rate instead of baseline ~20%
        n_pos = int(batch_size * 0.52)
        n_neg = batch_size - n_pos
        chosen_pos = rng.choice(pos_indices, size=n_pos, replace=True)
        chosen_neg = rng.choice(neg_indices, size=n_neg, replace=True)
        all_chosen = np.concatenate([chosen_pos, chosen_neg])
        rng.shuffle(all_chosen)
        batch_df = reference_df.loc[all_chosen].copy().reset_index(drop=True)
        y = batch_df[target_col].values.copy()
        X = batch_df.drop(columns=[target_col])

    elif scenario == "concept_shift":
        # P(Y|X) changes! Covariates X remain approximately in domain, but default behavior shifts.
        # Macroeconomic crisis scenario: even previously "safe" borrowers default at much higher rates.
        # We recalculate true label y with an altered scoring function:
        if "debt_to_income" in X.columns and "credit_score" in X.columns:
            std_dti = (X["debt_to_income"] - 0.35) / 0.15
            std_credit = (X["credit_score"] - 675) / 65
            # Shifted logit intercept + heavier penalty
            new_logit = 0.50 + 1.45 * std_dti - 0.65 * std_credit + rng.normal(0, 0.4, size=batch_size)
            new_prob = 1.0 / (1.0 + np.exp(-new_logit))
            y = (rng.uniform(0, 1, size=batch_size) < new_prob).astype(int)

    return X, y
