"""
Module 1: Data Preprocessing & Feature Engineering
====================================================
Dataset: S19_All_Release_2_10_22 (CodeWorkout Spring 2019)
Output:  research/data/features_dataset.csv

Extracts per-student features from MainTable.csv + early.csv + Subject.csv
for use in EWS (Module 2) and Learning Trajectory (Module 3) analysis.
"""

import pandas as pd
import numpy as np
from pathlib import Path
import warnings
warnings.filterwarnings('ignore')

# ── Paths ────────────────────────────────────────────────────────────────────
DATASET_ROOT = Path(r"C:\Users\Acer\Downloads\S19_All_Release_2_10_22")
MAIN_TABLE   = DATASET_ROOT / "Data" / "MainTable.csv"
SUBJECT_CSV  = DATASET_ROOT / "Data" / "LinkTables" / "Subject.csv"
EARLY_CSV    = DATASET_ROOT / "early.csv"
LATE_CSV     = DATASET_ROOT / "late.csv"
OUT_DIR      = Path(r"C:\Users\Acer\Downloads\neu-codelens\research\data")
OUT_DIR.mkdir(parents=True, exist_ok=True)

print("=" * 60)
print("MODULE 1: Data Preprocessing & Feature Engineering")
print("=" * 60)

# ── 1. Load MainTable ────────────────────────────────────────────────────────
print("\n[1/6] Loading MainTable.csv (~202K rows)...")
mt = pd.read_csv(MAIN_TABLE, low_memory=False)
mt['ServerTimestamp'] = pd.to_datetime(mt['ServerTimestamp'], errors='coerce')
mt['Score'] = pd.to_numeric(mt['Score'], errors='coerce')
mt['AssignmentID'] = pd.to_numeric(mt['AssignmentID'], errors='coerce')
print(f"      Loaded {len(mt):,} rows, {mt['SubjectID'].nunique()} students")

# ── 2. Load Subject grades ───────────────────────────────────────────────────
print("[2/6] Loading Subject.csv (final grades)...")
subj = pd.read_csv(SUBJECT_CSV)
subj.columns = ['SubjectID', 'FinalGrade']
subj['FinalGrade'] = pd.to_numeric(subj['FinalGrade'], errors='coerce')
print(f"      Loaded {len(subj)} students, grade mean={subj['FinalGrade'].mean():.3f}")

# ── 3. Load early.csv ───────────────────────────────────────────────────────
print("[3/6] Loading early.csv...")
early = pd.read_csv(EARLY_CSV)
early['Attempts']          = pd.to_numeric(early['Attempts'], errors='coerce')
early['CorrectEventually'] = early['CorrectEventually'].map({'True': 1, 'False': 0})
early['Label']             = early['Label'].map({'True': 1, 'False': 0})
print(f"      Loaded {len(early):,} rows, {early['SubjectID'].nunique()} students")

# ── 4. Per-student features from MainTable ───────────────────────────────────
print("[4/6] Engineering features from MainTable...")

# Assign sequential order (1–5) to assignments
assignment_order = {aid: i+1 for i, aid in enumerate(sorted(mt['AssignmentID'].dropna().unique()))}
mt['AssignmentOrder'] = mt['AssignmentID'].map(assignment_order)

features = []
for sid, grp in mt.groupby('SubjectID'):
    n_total         = len(grp)
    n_compile_err   = (grp['EventType'] == 'Compile.Error').sum()
    n_compile       = (grp['EventType'] == 'Compile').sum()
    n_run           = (grp['EventType'] == 'Run.Program').sum()
    compile_err_rate = n_compile_err / n_total if n_total > 0 else 0

    # Score statistics
    scores = grp['Score'].dropna()
    avg_score        = scores.mean() if len(scores) > 0 else np.nan
    max_score        = scores.max()  if len(scores) > 0 else np.nan
    score_trend      = np.nan  # filled below

    # Score trend (linear regression slope over time)
    score_df = grp[['ServerTimestamp', 'Score']].dropna()
    if len(score_df) >= 3:
        score_df = score_df.sort_values('ServerTimestamp')
        t_vals = (score_df['ServerTimestamp'] - score_df['ServerTimestamp'].min()).dt.total_seconds()
        if t_vals.std() > 0:
            score_trend = float(np.polyfit(t_vals, score_df['Score'], 1)[0] * 3600)  # per hour

    # Early vs late score comparison
    early_runs = grp[grp['AssignmentOrder'] <= 2]['Score'].dropna()
    late_runs  = grp[grp['AssignmentOrder'] >= 4]['Score'].dropna()
    early_avg  = early_runs.mean() if len(early_runs) > 0 else np.nan
    late_avg   = late_runs.mean()  if len(late_runs)  > 0 else np.nan
    score_improvement = (late_avg - early_avg) if (not np.isnan(early_avg) and not np.isnan(late_avg)) else np.nan

    # Session analysis (gap > 30 min = new session)
    ts_sorted = grp['ServerTimestamp'].dropna().sort_values()
    if len(ts_sorted) > 1:
        gaps = ts_sorted.diff().dt.total_seconds().fillna(0)
        session_count = int((gaps > 1800).sum()) + 1
    else:
        session_count = 1

    # Time span of activity
    if len(ts_sorted) >= 2:
        activity_span_hours = (ts_sorted.max() - ts_sorted.min()).total_seconds() / 3600
    else:
        activity_span_hours = 0.0

    # Unique problems attempted
    unique_problems = grp['ProblemID'].nunique()

    # Compile success rate
    compile_rows = grp[grp['EventType'].isin(['Compile', 'Compile.Error'])]
    compile_success_rate = (compile_rows['EventType'] == 'Compile').mean() if len(compile_rows) > 0 else np.nan

    features.append({
        'SubjectID'           : sid,
        'n_total_events'      : n_total,
        'n_compile_errors'    : n_compile_err,
        'n_run_events'        : n_run,
        'compile_error_rate'  : round(compile_err_rate, 4),
        'compile_success_rate': round(compile_success_rate, 4) if not np.isnan(compile_success_rate) else np.nan,
        'avg_score'           : round(avg_score, 4) if not np.isnan(avg_score) else np.nan,
        'max_score'           : round(max_score, 4) if not np.isnan(max_score) else np.nan,
        'early_avg_score'     : round(early_avg, 4) if not np.isnan(early_avg) else np.nan,
        'late_avg_score'      : round(late_avg, 4) if not np.isnan(late_avg) else np.nan,
        'score_improvement'   : round(score_improvement, 4) if not np.isnan(score_improvement) else np.nan,
        'score_trend_per_hour': round(score_trend, 6) if not np.isnan(score_trend) else np.nan,
        'session_count'       : session_count,
        'activity_span_hours' : round(activity_span_hours, 2),
        'unique_problems'     : unique_problems,
    })

feat_df = pd.DataFrame(features)
print(f"      Created {len(feat_df)} student feature rows, {len(feat_df.columns)} columns")

# ── 5. Per-student features from early.csv ───────────────────────────────────
print("[5/6] Engineering features from early.csv...")
early_feat = early.groupby('SubjectID').agg(
    n_early_problems      = ('ProblemID',          'count'),
    avg_attempts_early    = ('Attempts',            'mean'),
    max_attempts_early    = ('Attempts',            'max'),
    correct_eventually_rate = ('CorrectEventually', 'mean'),
    at_risk_rate_early    = ('Label',               'mean'),
).reset_index()
early_feat.columns = [c for c in early_feat.columns]

# ── 6. Merge all ─────────────────────────────────────────────────────────────
print("[6/6] Merging features + grades...")
df = feat_df.merge(early_feat, on='SubjectID', how='left')
df = df.merge(subj,           on='SubjectID', how='left')

# Target variables
df['at_risk']     = (df['FinalGrade'] < 0.5).astype(int)
df['grade_group'] = pd.cut(df['FinalGrade'],
                           bins=[0, 0.5, 0.7, 0.85, 1.01],
                           labels=['At-Risk', 'Passing', 'Good', 'Excellent'],
                           right=False)

# Filter to students with final grade (needed for supervised learning)
df_labeled = df.dropna(subset=['FinalGrade']).copy()

# Save
df_labeled.to_csv(OUT_DIR / "features_dataset.csv", index=False)
df.to_csv(OUT_DIR / "features_all.csv", index=False)

# ── Summary ───────────────────────────────────────────────────────────────────
print("\n" + "=" * 60)
print("FEATURE ENGINEERING COMPLETE")
print("=" * 60)
print(f"Total students (with grades): {len(df_labeled)}")
print(f"Features created:             {len(df_labeled.columns)}")
print(f"\nTarget distribution (at_risk = grade < 0.5):")
vc = df_labeled['at_risk'].value_counts()
print(f"  Not at-risk (0): {vc.get(0, 0)} students ({vc.get(0,0)/len(df_labeled)*100:.1f}%)")
print(f"  At-risk     (1): {vc.get(1, 0)} students ({vc.get(1,0)/len(df_labeled)*100:.1f}%)")

print(f"\nGrade group distribution:")
print(df_labeled['grade_group'].value_counts().to_string())

print(f"\nFeature list:")
for col in df_labeled.columns:
    n_null = df_labeled[col].isna().sum()
    print(f"  {col:<30} (nulls: {n_null})")

print(f"\nSaved to: {OUT_DIR / 'features_dataset.csv'}")
print("\n[DONE] Run Module 2 next: python 02_early_warning_system.py")
