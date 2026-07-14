"""
Module 2: Early Warning System (EWS) – RQ5
============================================
Input:  research/data/features_dataset.csv
Output: research/results/figures/ews_*.png
        research/results/ews_report.txt

Trains multiple ML models to predict at-risk students
from early-stage behavioral + code features.
"""

import pandas as pd
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import seaborn as sns
from pathlib import Path
from sklearn.model_selection import StratifiedKFold, cross_val_score
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.metrics import (classification_report, roc_auc_score,
                             roc_curve, confusion_matrix,
                             precision_recall_curve, average_precision_score)
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
import warnings
warnings.filterwarnings('ignore')

# ── Paths ────────────────────────────────────────────────────────────────────
DATA_DIR    = Path(r"C:\Users\Acer\Downloads\neu-codelens\research\data")
FIG_DIR     = Path(r"C:\Users\Acer\Downloads\neu-codelens\research\results\figures")
RESULTS_DIR = Path(r"C:\Users\Acer\Downloads\neu-codelens\research\results")
FIG_DIR.mkdir(parents=True, exist_ok=True)

# ── Style ─────────────────────────────────────────────────────────────────────
plt.rcParams.update({
    'figure.dpi': 150,
    'font.family': 'DejaVu Sans',
    'font.size': 11,
    'axes.spines.top': False,
    'axes.spines.right': False,
})
PALETTE = {'Not At-Risk': '#2ecc71', 'At-Risk': '#e74c3c'}
COLORS  = ['#3498db', '#e67e22', '#9b59b6']

print("=" * 60)
print("MODULE 2: Early Warning System (RQ5)")
print("=" * 60)

# ── 1. Load data ──────────────────────────────────────────────────────────────
print("\n[1/6] Loading feature dataset...")
df = pd.read_csv(DATA_DIR / "features_dataset.csv")
print(f"      {len(df)} students, {len(df.columns)} columns")

# Feature columns (exclude IDs, targets, grade columns)
EXCLUDE = {'SubjectID', 'FinalGrade', 'at_risk', 'grade_group',
           'avg_score', 'max_score', 'late_avg_score', 'score_improvement'}
# Also exclude columns where ALL values are null (useless for ML)
FEATURES = [
    c for c in df.columns
    if c not in EXCLUDE
    and df[c].dtype in [np.float64, np.int64, float, int]
    and df[c].notna().sum() > 0          # must have at least 1 non-null
]

X = df[FEATURES].copy()
y = df['at_risk'].copy()

print(f"      Features used ({len(FEATURES)}): {FEATURES}")
print(f"      Class distribution: Not-at-risk={int((y==0).sum())}, At-risk={int((y==1).sum())}")

# ── 2. Define models ──────────────────────────────────────────────────────────
print("\n[2/6] Defining models...")
models = {
    'Logistic Regression': Pipeline([
        ('imputer', SimpleImputer(strategy='median')),
        ('scaler',  StandardScaler()),
        ('clf',     LogisticRegression(max_iter=1000, class_weight='balanced', C=0.1)),
    ]),
    'Random Forest': Pipeline([
        ('imputer', SimpleImputer(strategy='median')),
        ('clf',     RandomForestClassifier(n_estimators=200, class_weight='balanced',
                                           max_depth=6, random_state=42)),
    ]),
    'Gradient Boosting': Pipeline([
        ('imputer', SimpleImputer(strategy='median')),
        ('clf',     GradientBoostingClassifier(n_estimators=200, max_depth=4,
                                               learning_rate=0.05, random_state=42)),
    ]),
}

# ── 3. Cross-validation ───────────────────────────────────────────────────────
print("[3/6] Running 5-fold stratified cross-validation...")
cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
cv_results = {}

for name, pipe in models.items():
    auc_scores = cross_val_score(pipe, X, y, cv=cv, scoring='roc_auc', n_jobs=-1)
    f1_scores  = cross_val_score(pipe, X, y, cv=cv, scoring='f1',      n_jobs=-1)
    pr_scores  = cross_val_score(pipe, X, y, cv=cv, scoring='precision', n_jobs=-1)
    re_scores  = cross_val_score(pipe, X, y, cv=cv, scoring='recall',    n_jobs=-1)
    cv_results[name] = {
        'AUC':       (auc_scores.mean(), auc_scores.std()),
        'F1':        (f1_scores.mean(),  f1_scores.std()),
        'Precision': (pr_scores.mean(),  pr_scores.std()),
        'Recall':    (re_scores.mean(),  re_scores.std()),
    }
    print(f"  {name:22s} AUC={auc_scores.mean():.3f}±{auc_scores.std():.3f}  F1={f1_scores.mean():.3f}±{f1_scores.std():.3f}")

# ── 4. Final model – fit on all data ──────────────────────────────────────────
print("\n[4/6] Training final Gradient Boosting model on full data...")
best_pipe = models['Gradient Boosting']
best_pipe.fit(X, y)

# Feature importance from GBM - use only columns that survived imputation
imputer_fitted = best_pipe.named_steps['imputer']
X_transformed = imputer_fitted.transform(X)
# imputer may drop all-NaN columns depending on version; use shape to align
actual_features = FEATURES[:X_transformed.shape[1]]
X_imp = pd.DataFrame(X_transformed, columns=actual_features)
clf   = best_pipe.named_steps['clf']
importances = pd.Series(clf.feature_importances_, index=actual_features).sort_values(ascending=False)

# ── 5. ROC & PR curves ────────────────────────────────────────────────────────
print("[5/6] Generating evaluation plots...")

# Re-fit each model and collect predictions (80/20 split for plotting)
from sklearn.model_selection import train_test_split
X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.2, stratify=y, random_state=42)

fig, axes = plt.subplots(1, 3, figsize=(18, 5))
fig.suptitle('Early Warning System – Model Evaluation (RQ5)', fontsize=14, fontweight='bold', y=1.02)

# --- Plot 1: ROC Curves ---
ax = axes[0]
for (name, pipe), color in zip(models.items(), COLORS):
    pipe.fit(X_tr, y_tr)
    y_prob = pipe.predict_proba(X_te)[:, 1]
    fpr, tpr, _ = roc_curve(y_te, y_prob)
    auc = roc_auc_score(y_te, y_prob)
    ax.plot(fpr, tpr, color=color, lw=2, label=f'{name} (AUC={auc:.3f})')
ax.plot([0,1],[0,1],'k--', alpha=0.4, label='Random')
ax.set_xlabel('False Positive Rate'); ax.set_ylabel('True Positive Rate')
ax.set_title('ROC Curves'); ax.legend(fontsize=9); ax.grid(alpha=0.3)
ax.fill_between([0,1],[0,1],[0,1], alpha=0.05, color='gray')

# --- Plot 2: Feature Importance ---
ax = axes[1]
top10 = importances.head(10)
colors_fi = ['#e74c3c' if 'error' in c or 'risk' in c else '#3498db' for c in top10.index]
bars = ax.barh(range(len(top10)), top10.values, color=colors_fi, edgecolor='white')
ax.set_yticks(range(len(top10)))
ax.set_yticklabels([c.replace('_', '\n') for c in top10.index], fontsize=9)
ax.invert_yaxis()
ax.set_xlabel('Feature Importance'); ax.set_title('Top 10 Features\n(Gradient Boosting)')
ax.grid(axis='x', alpha=0.3)
red_patch   = mpatches.Patch(color='#e74c3c', label='Risk-related')
blue_patch  = mpatches.Patch(color='#3498db', label='Performance')
ax.legend(handles=[red_patch, blue_patch], fontsize=9)

# --- Plot 3: Confusion Matrix (best model) ---
ax = axes[2]
best_pipe.fit(X_tr, y_tr)
y_pred = best_pipe.predict(X_te)
cm = confusion_matrix(y_te, y_pred)
sns.heatmap(cm, annot=True, fmt='d', cmap='Blues', ax=ax,
            xticklabels=['Not At-Risk', 'At-Risk'],
            yticklabels=['Not At-Risk', 'At-Risk'],
            cbar=False, annot_kws={'size': 14})
ax.set_xlabel('Predicted'); ax.set_ylabel('Actual')
ax.set_title('Confusion Matrix\n(Gradient Boosting, 80/20 split)')

plt.tight_layout()
plt.savefig(FIG_DIR / "ews_evaluation.png", bbox_inches='tight', dpi=150)
plt.close()
print(f"      Saved: ews_evaluation.png")

# --- Plot 4: Score distribution by at-risk label ---
fig, axes = plt.subplots(1, 2, figsize=(14, 5))
fig.suptitle('Student Profile: At-Risk vs Not-At-Risk', fontsize=13, fontweight='bold')

ax = axes[0]
for label, color, name in [(0, '#2ecc71', 'Not At-Risk'), (1, '#e74c3c', 'At-Risk')]:
    subset = df[df['at_risk'] == label]['FinalGrade'].dropna()
    ax.hist(subset, bins=20, alpha=0.6, color=color, label=f'{name} (n={len(subset)})', edgecolor='white')
ax.set_xlabel('Final Grade'); ax.set_ylabel('Number of Students')
ax.set_title('Final Grade Distribution'); ax.legend(); ax.grid(alpha=0.3)

ax = axes[1]
feat_compare = 'compile_error_rate'
for label, color, name in [(0, '#2ecc71', 'Not At-Risk'), (1, '#e74c3c', 'At-Risk')]:
    subset = df[df['at_risk'] == label][feat_compare].dropna()
    ax.hist(subset, bins=20, alpha=0.6, color=color, label=f'{name}', edgecolor='white')
ax.set_xlabel('Compile Error Rate'); ax.set_ylabel('Number of Students')
ax.set_title('Compile Error Rate by Risk Level'); ax.legend(); ax.grid(alpha=0.3)

plt.tight_layout()
plt.savefig(FIG_DIR / "ews_profiles.png", bbox_inches='tight', dpi=150)
plt.close()
print(f"      Saved: ews_profiles.png")

# ── 6. Save text report ───────────────────────────────────────────────────────
print("[6/6] Writing EWS report...")
report_lines = [
    "=" * 60,
    "EARLY WARNING SYSTEM RESULTS (RQ5)",
    "=" * 60,
    f"Dataset: S19_All_Release_2_10_22 (CodeWorkout Spring 2019)",
    f"Students: {len(df)} (with final grades)",
    f"At-risk definition: Final Grade < 0.5",
    f"At-risk students: {int(y.sum())} / {len(y)} ({y.mean()*100:.1f}%)",
    f"Validation: 5-fold Stratified Cross-Validation",
    "",
    "─" * 60,
    "CROSS-VALIDATION RESULTS:",
    "─" * 60,
]
for name, res in cv_results.items():
    report_lines += [
        f"\n{name}:",
        f"  AUC-ROC  : {res['AUC'][0]:.3f} ± {res['AUC'][1]:.3f}",
        f"  F1 Score : {res['F1'][0]:.3f} ± {res['F1'][1]:.3f}",
        f"  Precision: {res['Precision'][0]:.3f} ± {res['Precision'][1]:.3f}",
        f"  Recall   : {res['Recall'][0]:.3f} ± {res['Recall'][1]:.3f}",
    ]

report_lines += [
    "",
    "─" * 60,
    "TOP 10 PREDICTIVE FEATURES (Gradient Boosting):",
    "─" * 60,
]
for feat, imp in importances.head(10).items():
    report_lines.append(f"  {feat:<35} {imp:.4f}")

report_lines += [
    "",
    "─" * 60,
    "CLASSIFICATION REPORT (Gradient Boosting, 80/20 split):",
    "─" * 60,
    classification_report(y_te, y_pred, target_names=['Not At-Risk', 'At-Risk']),
]

report_text = "\n".join(report_lines)
with open(RESULTS_DIR / "ews_report.txt", 'w', encoding='utf-8') as f:
    f.write(report_text)

safe_report = report_text.encode('ascii', errors='replace').decode('ascii')
print("\n" + safe_report)
print(f"\nSaved: research/results/ews_report.txt")
print("\n[DONE] Module 2 complete. Run Module 3 next.")
