"""
Module 3: Learning Trajectory Analysis – RQ4
==============================================
Input:  research/data/features_dataset.csv
        S19 MainTable.csv (for per-assignment scores)
Output: research/results/figures/trajectory_*.png
        research/results/trajectory_report.txt

Analyzes how student programming skills evolve across 5 assignments.
Clusters students into trajectory groups and models progression.
"""

import pandas as pd
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.gridspec as gridspec
import seaborn as sns
from pathlib import Path
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
from sklearn.impute import SimpleImputer
import warnings
warnings.filterwarnings('ignore')

# ── Paths ────────────────────────────────────────────────────────────────────
DATASET_ROOT = Path(r"C:\Users\Acer\Downloads\S19_All_Release_2_10_22")
MAIN_TABLE   = DATASET_ROOT / "Data" / "MainTable.csv"
SUBJECT_CSV  = DATASET_ROOT / "Data" / "LinkTables" / "Subject.csv"
DATA_DIR     = Path(r"C:\Users\Acer\Downloads\neu-codelens\research\data")
FIG_DIR      = Path(r"C:\Users\Acer\Downloads\neu-codelens\research\results\figures")
RESULTS_DIR  = Path(r"C:\Users\Acer\Downloads\neu-codelens\research\results")

plt.rcParams.update({
    'figure.dpi': 150, 'font.family': 'DejaVu Sans', 'font.size': 11,
    'axes.spines.top': False, 'axes.spines.right': False,
})

ASSIGNMENT_NAMES = {
    439.0: 'A1\nBasics',
    487.0: 'A2\nControl Flow',
    492.0: 'A3\nArrays',
    494.0: 'A4\nMethods',
    502.0: 'A5\nOOP',
}
GROUP_COLORS = ['#e74c3c', '#e67e22', '#3498db', '#2ecc71']
GROUP_NAMES  = ['At-Risk', 'Passing', 'Good', 'Excellent']

print("=" * 60)
print("MODULE 3: Learning Trajectory Analysis (RQ4)")
print("=" * 60)

# ── 1. Load data ──────────────────────────────────────────────────────────────
print("\n[1/5] Loading MainTable & grades...")
mt = pd.read_csv(MAIN_TABLE, low_memory=False)
mt['Score']        = pd.to_numeric(mt['Score'],        errors='coerce')
mt['AssignmentID'] = pd.to_numeric(mt['AssignmentID'], errors='coerce')
mt['ServerTimestamp'] = pd.to_datetime(mt['ServerTimestamp'], errors='coerce')

subj = pd.read_csv(SUBJECT_CSV)
subj.columns = ['SubjectID', 'FinalGrade']
subj['FinalGrade'] = pd.to_numeric(subj['FinalGrade'], errors='coerce')

# ── 2. Per-student × per-assignment best score ────────────────────────────────
print("[2/5] Computing per-assignment best scores...")
# Use best (max) score per student per assignment
best_scores = (
    mt.dropna(subset=['Score', 'AssignmentID'])
    .groupby(['SubjectID', 'AssignmentID'])['Score']
    .max()
    .reset_index()
    .rename(columns={'Score': 'BestScore'})
)

# Pivot: rows=students, cols=assignments
pivot = best_scores.pivot(index='SubjectID', columns='AssignmentID', values='BestScore')
pivot.columns = [ASSIGNMENT_NAMES.get(c, str(c)) for c in pivot.columns]
pivot = pivot.reset_index()
pivot = pivot.merge(subj, on='SubjectID', how='inner')
pivot['GradeGroup'] = pd.cut(
    pivot['FinalGrade'],
    bins=[0, 0.5, 0.7, 0.85, 1.01],
    labels=GROUP_NAMES, right=False
)
print(f"      {len(pivot)} students with per-assignment scores")
print(f"      Group distribution:\n{pivot['GradeGroup'].value_counts().to_string()}")

assign_cols = [c for c in pivot.columns if 'A' in c and '\n' in c]

# ── 3. K-Means clustering on trajectories ─────────────────────────────────────
print("[3/5] Clustering student trajectories (K=4)...")
X_traj = pivot[assign_cols].copy()
imp    = SimpleImputer(strategy='median')
X_imp  = imp.fit_transform(X_traj)
scaler = StandardScaler()
X_sc   = scaler.fit_transform(X_imp)

kmeans = KMeans(n_clusters=4, random_state=42, n_init=20)
pivot['Cluster'] = kmeans.fit_predict(X_sc)

# Label clusters by mean final grade
cluster_grades = pivot.groupby('Cluster')['FinalGrade'].mean().sort_values()
cluster_label_map = {cid: lbl for cid, lbl in zip(cluster_grades.index, GROUP_NAMES)}
pivot['ClusterLabel'] = pivot['Cluster'].map(cluster_label_map)

for lbl in GROUP_NAMES:
    n = (pivot['ClusterLabel'] == lbl).sum()
    mg = pivot[pivot['ClusterLabel'] == lbl]['FinalGrade'].mean()
    print(f"  Cluster '{lbl}': {n} students, mean grade={mg:.3f}")

# ── 4. Plots ───────────────────────────────────────────────────────────────────
print("[4/5] Generating trajectory plots...")

# --- Figure 1: Learning Curves by Grade Group ---
fig, axes = plt.subplots(1, 2, figsize=(16, 6))
fig.suptitle('Learning Trajectory Analysis – RQ4\n(S19 CodeWorkout Dataset, n=372 students)',
             fontsize=13, fontweight='bold')

ax = axes[0]
ax.set_title('Mean Score per Assignment by Grade Group', fontweight='bold')
for grp, color in zip(GROUP_NAMES, GROUP_COLORS):
    subset = pivot[pivot['GradeGroup'] == grp]
    means  = subset[assign_cols].mean()
    stds   = subset[assign_cols].std()
    x      = range(len(assign_cols))
    ax.plot(x, means.values, 'o-', color=color, lw=2.5, ms=8,
            label=f'{grp} (n={len(subset)})')
    ax.fill_between(x,
                    means.values - stds.values * 0.5,
                    means.values + stds.values * 0.5,
                    alpha=0.12, color=color)

ax.set_xticks(range(len(assign_cols)))
ax.set_xticklabels(assign_cols, fontsize=10)
ax.set_ylabel('Best Score (0–1)')
ax.set_xlabel('Assignment')
ax.set_ylim(-0.05, 1.15)
ax.axhline(0.5, ls='--', color='gray', alpha=0.5, lw=1.2, label='Pass threshold')
ax.legend(fontsize=9)
ax.grid(alpha=0.25)

# --- Figure 2: Cluster trajectories ---
ax = axes[1]
ax.set_title('K-Means Trajectory Clusters (K=4)', fontweight='bold')
for lbl, color in zip(GROUP_NAMES, GROUP_COLORS):
    subset = pivot[pivot['ClusterLabel'] == lbl]
    means  = subset[assign_cols].mean()
    x      = range(len(assign_cols))
    ax.plot(x, means.values, 'o-', color=color, lw=2.5, ms=8,
            label=f'{lbl} (n={len(subset)}, grade={subset["FinalGrade"].mean():.2f})')

ax.set_xticks(range(len(assign_cols)))
ax.set_xticklabels(assign_cols, fontsize=10)
ax.set_ylabel('Mean Best Score (0–1)')
ax.set_xlabel('Assignment')
ax.set_ylim(-0.05, 1.15)
ax.axhline(0.5, ls='--', color='gray', alpha=0.5, lw=1.2)
ax.legend(fontsize=9)
ax.grid(alpha=0.25)

plt.tight_layout()
plt.savefig(FIG_DIR / "trajectory_learning_curves.png", bbox_inches='tight', dpi=150)
plt.close()
print("      Saved: trajectory_learning_curves.png")

# --- Figure 2: Score progression heatmap + boxplots ---
fig, axes = plt.subplots(1, 2, figsize=(16, 6))
fig.suptitle('Score Distribution Across Assignments', fontsize=13, fontweight='bold')

# Heatmap of mean scores: group × assignment
ax = axes[0]
heatmap_data = pivot.groupby('GradeGroup')[assign_cols].mean()
heatmap_data = heatmap_data.reindex(GROUP_NAMES[::-1])
sns.heatmap(heatmap_data, annot=True, fmt='.2f', cmap='RdYlGn',
            vmin=0, vmax=1, ax=ax, cbar_kws={'label': 'Mean Best Score'},
            linewidths=0.5)
ax.set_title('Mean Score by Group × Assignment', fontweight='bold')
ax.set_xlabel('Assignment')
ax.set_ylabel('Grade Group')
ax.set_yticklabels(ax.get_yticklabels(), rotation=0)

# Boxplot of final scores per assignment
ax = axes[1]
long_df = pivot[assign_cols + ['GradeGroup']].melt(
    id_vars='GradeGroup', var_name='Assignment', value_name='Score'
)
long_df = long_df.dropna()
bp = sns.boxplot(data=long_df, x='Assignment', y='Score', hue='GradeGroup',
                 palette=dict(zip(GROUP_NAMES, GROUP_COLORS)),
                 width=0.6, ax=ax, linewidth=1.2)
ax.set_title('Score Distribution per Assignment\nby Grade Group', fontweight='bold')
ax.set_ylabel('Best Score (0–1)')
ax.set_xlabel('Assignment')
ax.axhline(0.5, ls='--', color='gray', alpha=0.5)
ax.legend(title='Grade Group', fontsize=9, title_fontsize=9, loc='upper right')
ax.grid(axis='y', alpha=0.3)
ax.set_xticklabels(ax.get_xticklabels(), fontsize=9)

plt.tight_layout()
plt.savefig(FIG_DIR / "trajectory_distributions.png", bbox_inches='tight', dpi=150)
plt.close()
print("      Saved: trajectory_distributions.png")

# --- Figure 3: Individual trajectory spaghetti ---
fig, axes = plt.subplots(2, 2, figsize=(14, 10))
fig.suptitle('Individual Learning Trajectories by Group', fontsize=13, fontweight='bold')

axes_flat = axes.flatten()
for i, (lbl, color) in enumerate(zip(GROUP_NAMES, GROUP_COLORS)):
    ax = axes_flat[i]
    subset = pivot[pivot['ClusterLabel'] == lbl]
    sample = subset.sample(min(30, len(subset)), random_state=42)
    for _, row in sample.iterrows():
        vals = [row[c] for c in assign_cols]
        ax.plot(range(len(assign_cols)), vals, color=color, alpha=0.25, lw=1)
    means = subset[assign_cols].mean()
    ax.plot(range(len(assign_cols)), means.values, color=color, lw=3,
            marker='o', ms=8, label='Group mean', zorder=5)
    ax.set_title(f'{lbl} Group (n={len(subset)}, avg grade={subset["FinalGrade"].mean():.2f})',
                 fontweight='bold', color=color)
    ax.set_xticks(range(len(assign_cols)))
    ax.set_xticklabels(assign_cols, fontsize=9)
    ax.set_ylim(-0.05, 1.1)
    ax.set_ylabel('Score'); ax.set_xlabel('Assignment')
    ax.axhline(0.5, ls='--', color='gray', alpha=0.4)
    ax.grid(alpha=0.2)
    ax.legend(fontsize=9)

plt.tight_layout()
plt.savefig(FIG_DIR / "trajectory_individual.png", bbox_inches='tight', dpi=150)
plt.close()
print("      Saved: trajectory_individual.png")

# ── 5. Save report ─────────────────────────────────────────────────────────────
print("[5/5] Writing trajectory report...")

# Compute slope (linear regression on assignment order 1-5)
def compute_slope(row, cols):
    vals = [row[c] for c in cols if not pd.isna(row[c])]
    xs   = list(range(1, len(vals)+1))
    if len(vals) < 2: return np.nan
    return float(np.polyfit(xs, vals, 1)[0])

pivot['score_slope'] = pivot.apply(compute_slope, axis=1, cols=assign_cols)

report_lines = [
    "=" * 60,
    "LEARNING TRAJECTORY ANALYSIS RESULTS (RQ4)",
    "=" * 60,
    f"Dataset: S19_All_Release_2_10_22 (Spring 2019)",
    f"Students analyzed: {len(pivot)}",
    f"Assignments: {len(assign_cols)} ({', '.join(assign_cols)})",
    "",
    "─" * 60,
    "MEAN SCORE PER ASSIGNMENT (all students):",
    "─" * 60,
]
for col in assign_cols:
    vals = pivot[col].dropna()
    report_lines.append(f"  {col:20s}: mean={vals.mean():.3f}  std={vals.std():.3f}  n={len(vals)}")

report_lines += [
    "",
    "─" * 60,
    "GRADE GROUP STATISTICS:",
    "─" * 60,
]
for grp in GROUP_NAMES:
    sub = pivot[pivot['GradeGroup'] == grp]
    if len(sub) == 0: continue
    slopes = sub['score_slope'].dropna()
    report_lines += [
        f"\n{grp} (n={len(sub)}):",
        f"  Final Grade  : mean={sub['FinalGrade'].mean():.3f}, std={sub['FinalGrade'].std():.3f}",
        f"  Score Slope  : mean={slopes.mean():.4f} (positive = improving over assignments)",
        f"  A1 Score     : {sub[assign_cols[0]].mean():.3f}",
        f"  A5 Score     : {sub[assign_cols[-1]].mean():.3f}",
        f"  Δ Score (A5-A1): {sub[assign_cols[-1]].mean() - sub[assign_cols[0]].mean():+.3f}",
    ]

report_lines += [
    "",
    "─" * 60,
    "K-MEANS CLUSTER ANALYSIS (K=4):",
    "─" * 60,
]
for lbl in GROUP_NAMES:
    sub = pivot[pivot['ClusterLabel'] == lbl]
    report_lines.append(f"  {lbl:12s}: n={len(sub):3d}, mean_grade={sub['FinalGrade'].mean():.3f}")

report_text = "\n".join(report_lines)
with open(RESULTS_DIR / "trajectory_report.txt", 'w', encoding='utf-8') as f:
    f.write(report_text)

safe_report = report_text.encode('ascii', errors='replace').decode('ascii')
print("\n" + safe_report)
print(f"\nSaved: research/results/trajectory_report.txt")
print("\n[DONE] Module 3 complete!")
print("\n>>> ALL MODULES DONE. Check research/results/ for reports and figures.")
