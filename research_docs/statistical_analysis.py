"""
================================================================================
 PHÂN TÍCH THỐNG KÊ — LLM-Assisted Programming Assessment Research
 Statistical Analysis Suite
================================================================================
 Mục đích: Chạy toàn bộ các phân tích thống kê sau khi thu thập dữ liệu
            từ main study (80 sinh viên × 15 tuần)

 Cài đặt:  pip install pandas numpy scipy statsmodels scikit-learn matplotlib seaborn openpyxl

 Cách dùng:
   python statistical_analysis.py --data student_data.xlsx --output results/
================================================================================
"""

import argparse
import json
import os
import warnings
from datetime import datetime
from pathlib import Path

import matplotlib
matplotlib.use('Agg')  # Non-interactive backend
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import numpy as np
import pandas as pd
import seaborn as sns
from scipy import stats
from scipy.stats import mannwhitneyu, wilcoxon, pearsonr, spearmanr
from sklearn.metrics import (cohen_kappa_score, classification_report,
                              confusion_matrix, precision_recall_fscore_support)
from sklearn.preprocessing import LabelEncoder

warnings.filterwarnings('ignore')

# ─── Cấu hình ───────────────────────────────────────────────────────────────
ALPHA = 0.05          # Mức ý nghĩa thống kê
TARGET_KAPPA = 0.61   # Ngưỡng Cohen's Kappa chấp nhận được (Substantial)
TARGET_R = 0.75       # Ngưỡng Pearson r
TARGET_MAE = 5.0      # Ngưỡng Mean Absolute Error (điểm)

COLORS = {
    'control':   '#60a5fa',   # Xanh dương — nhóm control
    'treatment': '#c0392b',   # Đỏ NEU     — nhóm treatment
    'warning':   '#f59e0b',   # Vàng        — cảnh báo
    'success':   '#34d399',   # Xanh lá    — tốt
    'neutral':   '#9ba3b0',   # Xám        — trung tính
}

# ─── Hàm tiện ích ────────────────────────────────────────────────────────────

def print_section(title: str, width: int = 65):
    print(f"\n{'═'*width}")
    print(f"  {title}")
    print(f"{'═'*width}")

def print_result(label: str, value, p_val: float = None, significant: bool = None):
    sig_str = ""
    if p_val is not None:
        sig_mark = "✅ *" if p_val < ALPHA else "❌ ns"
        sig_str = f"  p={p_val:.4f} {sig_mark}"
    print(f"  {label:<40} {str(value):<12}{sig_str}")

def interpret_cohens_d(d: float) -> str:
    d = abs(d)
    if d < 0.2:  return "rất nhỏ (negligible)"
    if d < 0.5:  return "nhỏ (small)"
    if d < 0.8:  return "trung bình (medium)"
    return "lớn (large)"

def interpret_kappa(k: float) -> str:
    if k < 0:    return "Không có sự đồng thuận (Poor)"
    if k < 0.20: return "Rất kém (Slight)"
    if k < 0.40: return "Yếu (Fair)"
    if k < 0.60: return "Trung bình (Moderate)"
    if k < 0.80: return "Tốt (Substantial) ✅"
    return "Rất tốt (Almost Perfect) ✅✅"

def save_fig(fig, output_dir: Path, filename: str):
    path = output_dir / filename
    fig.savefig(path, dpi=150, bbox_inches='tight',
                facecolor='#0a0b0e', edgecolor='none')
    plt.close(fig)
    print(f"  💾 Đã lưu: {filename}")


# ════════════════════════════════════════════════════════════════════════════
# MODULE 1: ĐỌC & CHUẨN BỊ DỮ LIỆU
# ════════════════════════════════════════════════════════════════════════════

class DataLoader:
    """Đọc và chuẩn bị dữ liệu từ file Excel."""

    def load(self, filepath: str) -> dict[str, pd.DataFrame]:
        """
        Đọc file Excel với các sheet sau:
          - students:     thông tin sinh viên (id, group, pre_score, post_score...)
          - submissions:  bài nộp hàng tuần (student_id, week, rubric scores...)
          - llm_vs_human: so sánh điểm LLM vs giảng viên (calibration data)
          - early_warning: nhãn at-risk và dự đoán của model

        Nếu không có file Excel, tạo dữ liệu mock để test.
        """
        if filepath and os.path.exists(filepath):
            print(f"  📂 Đang đọc dữ liệu từ: {filepath}")
            sheets = pd.read_excel(filepath, sheet_name=None)
            return sheets
        else:
            print("  ⚠️  Không tìm thấy file dữ liệu. Đang tạo mock data...")
            return self._generate_mock_data()

    def _generate_mock_data(self) -> dict[str, pd.DataFrame]:
        """
        Tạo dữ liệu giả lập (mock data) để test pipeline phân tích.
        Dữ liệu được tạo sao cho Treatment group thực sự tốt hơn Control.
        """
        np.random.seed(42)
        n_control = 38
        n_treatment = 40
        n_weeks = 15

        # ── Sheet 1: students ──────────────────────────────────────────────
        control_ids   = [f"C{i:03d}" for i in range(1, n_control + 1)]
        treatment_ids = [f"T{i:03d}" for i in range(1, n_treatment + 1)]

        # Pre-test: 2 nhóm tương đương nhau (p > 0.05 khi test)
        control_pre   = np.random.normal(28, 6, n_control).clip(0, 60)
        treatment_pre = np.random.normal(29, 6, n_treatment).clip(0, 60)

        # Post-test: Treatment tốt hơn Control (effect size ~0.5)
        control_post   = (control_pre   + np.random.normal(18, 5, n_control)).clip(0, 60)
        treatment_post = (treatment_pre + np.random.normal(24, 5, n_treatment)).clip(0, 60)

        # Final grade (0-100, tương quan với post-test)
        control_final   = (control_post   * 1.2 + np.random.normal(15, 8, n_control)).clip(0, 100)
        treatment_final = (treatment_post * 1.2 + np.random.normal(20, 8, n_treatment)).clip(0, 100)

        students = pd.DataFrame({
            'student_id': control_ids + treatment_ids,
            'group':      ['control'] * n_control + ['treatment'] * n_treatment,
            'pre_score':  np.concatenate([control_pre, treatment_pre]).round(1),
            'post_score': np.concatenate([control_post, treatment_post]).round(1),
            'final_grade':np.concatenate([control_final, treatment_final]).round(1),
            'gender':     np.random.choice(['M', 'F'], n_control + n_treatment),
            'age':        np.random.randint(18, 23, n_control + n_treatment),
            'dropout':    np.concatenate([
                np.random.choice([0, 1], n_control,   p=[0.88, 0.12]),
                np.random.choice([0, 1], n_treatment, p=[0.93, 0.07])
            ])
        })

        # ── Sheet 2: submissions (weekly scores) ───────────────────────────
        rows = []
        for sid, grp, pre in zip(students['student_id'],
                                 students['group'],
                                 students['pre_score']):
            base = pre * 0.8
            for week in range(1, n_weeks + 1):
                # Treatment group tiến bộ nhanh hơn
                slope = 2.5 if grp == 'treatment' else 1.5
                t1    = min(40, base * 0.4 + slope * week + np.random.normal(0, 3))
                t2    = min(35, base * 0.3 + slope * 0.8 * week + np.random.normal(0, 3))
                t3    = min(25, base * 0.2 + slope * 0.5 * week + np.random.normal(0, 2))
                rows.append({
                    'student_id': sid,
                    'group':      grp,
                    'week':       week,
                    'tier1_score': round(max(0, t1), 1),
                    'tier2_score': round(max(0, t2), 1),
                    'tier3_score': round(max(0, t3), 1),
                    'total_score': round(max(0, t1 + t2 + t3), 1),
                    'submissions_count': np.random.randint(1, 5),
                    'time_to_submit_hours': round(np.random.exponential(8), 1),
                })

        submissions = pd.DataFrame(rows)

        # ── Sheet 3: llm_vs_human (calibration) ───────────────────────────
        n_cal = 100  # 100 bài để calibration
        human_scores = np.random.normal(65, 18, n_cal).clip(0, 100).round(1)
        # LLM gần với human nhưng có noise nhỏ (MAE ~4 điểm)
        llm_scores   = (human_scores + np.random.normal(0, 4, n_cal)).clip(0, 100).round(1)

        def score_to_level(s):
            if s >= 90: return 5
            if s >= 75: return 4
            if s >= 55: return 3
            if s >= 35: return 2
            return 1

        llm_vs_human = pd.DataFrame({
            'submission_id': [f"CAL{i:03d}" for i in range(n_cal)],
            'human_score':   human_scores,
            'llm_score':     llm_scores,
            'human_level':   [score_to_level(s) for s in human_scores],
            'llm_level':     [score_to_level(s) for s in llm_scores],
        })

        # ── Sheet 4: early_warning ─────────────────────────────────────────
        ew_rows = []
        for _, row in students.iterrows():
            actual    = 1 if row['final_grade'] < 50 or row['dropout'] == 1 else 0
            # Treatment group: model dự đoán chính xác hơn
            if row['group'] == 'treatment':
                predicted = actual if np.random.rand() > 0.15 else 1 - actual
            else:
                predicted = actual if np.random.rand() > 0.25 else 1 - actual
            ew_rows.append({
                'student_id': row['student_id'],
                'group':      row['group'],
                'actual_at_risk': actual,
                'predicted_at_risk': predicted,
            })

        early_warning = pd.DataFrame(ew_rows)

        return {
            'students':      students,
            'submissions':   submissions,
            'llm_vs_human':  llm_vs_human,
            'early_warning': early_warning,
        }


# ════════════════════════════════════════════════════════════════════════════
# MODULE 2: RQ1 — ĐỘ CHÍNH XÁC CỦA LLM
# ════════════════════════════════════════════════════════════════════════════

def analyze_llm_accuracy(df: pd.DataFrame, output_dir: Path) -> dict:
    """
    RQ1: LLM có thể đánh giá năng lực lập trình chính xác như thế nào
         so với chuyên gia con người?

    Chỉ số:
      - Cohen's Kappa (κ): đồng thuận phân loại mức độ
      - Pearson r: tương quan điểm số liên tục
      - MAE: sai lệch trung bình
      - Bias: LLM có xu hướng cho điểm cao hơn/thấp hơn người không?
    """
    print_section("RQ1: ĐỘ CHÍNH XÁC CỦA LLM vs. GIÁO VIÊN")

    results = {}

    # ── Pearson Correlation ────────────────────────────────────────────────
    r, p_r = pearsonr(df['human_score'], df['llm_score'])
    r_spearman, _ = spearmanr(df['human_score'], df['llm_score'])
    results['pearson_r'] = r
    results['pearson_p'] = p_r
    results['spearman_r'] = r_spearman
    print_result("Pearson r (điểm liên tục)", f"{r:.4f}", p_r, p_r < ALPHA)
    print_result("Spearman ρ (rank correlation)", f"{r_spearman:.4f}")

    # ── Cohen's Kappa ──────────────────────────────────────────────────────
    kappa = cohen_kappa_score(df['human_level'], df['llm_level'])
    results['cohens_kappa'] = kappa
    print_result("Cohen's Kappa κ (phân loại mức độ)", f"{kappa:.4f}")
    print(f"       → Diễn giải: {interpret_kappa(kappa)}")

    # ── MAE & Bias ────────────────────────────────────────────────────────
    diff = df['llm_score'] - df['human_score']
    mae  = np.mean(np.abs(diff))
    rmse = np.sqrt(np.mean(diff ** 2))
    bias = np.mean(diff)           # Dương = LLM cho cao hơn, âm = LLM cho thấp hơn

    results['mae']  = mae
    results['rmse'] = rmse
    results['bias'] = bias
    print_result("MAE (sai lệch trung bình)", f"{mae:.2f} điểm")
    print_result("RMSE", f"{rmse:.2f} điểm")
    print_result("Bias (LLM - Human)", f"{bias:+.2f} điểm")

    # ── Confusion Matrix ───────────────────────────────────────────────────
    cm = confusion_matrix(df['human_level'], df['llm_level'],
                          labels=[1, 2, 3, 4, 5])
    print("\n  Ma trận nhầm lẫn (Confusion Matrix):")
    print("  Hàng = Human, Cột = LLM (mức 1=Beginner → 5=Expert)")
    cm_df = pd.DataFrame(cm,
                         index=[f"H-Lv{i}" for i in range(1, 6)],
                         columns=[f"L-Lv{i}" for i in range(1, 6)])
    print(cm_df.to_string(col_space=8))

    # ── Kết luận ──────────────────────────────────────────────────────────
    print("\n  📋 KẾT LUẬN RQ1:")
    print(f"     Pearson r = {r:.3f}  {'✅ ĐẠT mục tiêu (>0.75)' if r >= TARGET_R else '❌ CHƯA đạt mục tiêu (>0.75)'}")
    print(f"     Kappa κ  = {kappa:.3f} {'✅ ĐẠT mục tiêu (>0.61)' if kappa >= TARGET_KAPPA else '❌ CHƯA đạt mục tiêu (>0.61)'}")
    print(f"     MAE      = {mae:.2f}  {'✅ ĐẠT mục tiêu (<5 điểm)' if mae <= TARGET_MAE else '❌ CHƯA đạt mục tiêu (<5 điểm)'}")

    # ── Biểu đồ: Scatter plot LLM vs Human ─────────────────────────────
    fig, axes = plt.subplots(1, 2, figsize=(14, 6),
                              facecolor='#111318')
    fig.suptitle('RQ1: LLM Accuracy vs. Human Experts',
                 color='white', fontsize=14, fontweight='bold', y=1.02)

    # Scatter: điểm số
    ax1 = axes[0]
    ax1.set_facecolor('#1e2128')
    ax1.scatter(df['human_score'], df['llm_score'],
                alpha=0.6, color=COLORS['treatment'], s=50, edgecolors='none')
    # Đường perfect agreement
    lo, hi = 0, 100
    ax1.plot([lo, hi], [lo, hi], 'w--', alpha=0.4, linewidth=1, label='Perfect agreement')
    # Đường regression
    m, b = np.polyfit(df['human_score'], df['llm_score'], 1)
    x_line = np.linspace(lo, hi, 100)
    ax1.plot(x_line, m * x_line + b, color=COLORS['warning'],
             linewidth=2, label=f'Linear fit (r={r:.3f})')
    ax1.set_xlabel('Human Score', color='#9ba3b0')
    ax1.set_ylabel('LLM Score', color='#9ba3b0')
    ax1.set_title(f'Score Correlation\nr = {r:.3f}, MAE = {mae:.2f}',
                  color='white', fontsize=11)
    ax1.tick_params(colors='#9ba3b0')
    ax1.legend(fontsize=9, labelcolor='white', facecolor='#1e2128',
               edgecolor='none')
    for spine in ax1.spines.values():
        spine.set_edgecolor('#333')

    # Confusion matrix heatmap
    ax2 = axes[1]
    sns.heatmap(cm, annot=True, fmt='d', cmap='YlOrRd',
                xticklabels=['Beg', 'Dev', 'Int', 'Adv', 'Exp'],
                yticklabels=['Beg', 'Dev', 'Int', 'Adv', 'Exp'],
                ax=ax2, cbar=True,
                annot_kws={'color': 'white', 'fontsize': 11})
    ax2.set_title('Confusion Matrix\n(Human vs LLM Level Classification)',
                  color='white', fontsize=11)
    ax2.set_xlabel('LLM Predicted Level', color='#9ba3b0')
    ax2.set_ylabel('Human True Level', color='#9ba3b0')
    ax2.tick_params(colors='#9ba3b0')

    plt.tight_layout()
    save_fig(fig, output_dir, 'rq1_llm_accuracy.png')

    return results


# ════════════════════════════════════════════════════════════════════════════
# MODULE 3: RQ2 — KIỂM TRA TƯƠNG ĐỒNG BAN ĐẦU (BASELINE)
# ════════════════════════════════════════════════════════════════════════════

def check_baseline_equivalence(students: pd.DataFrame, output_dir: Path) -> dict:
    """
    Kiểm tra 2 nhóm có tương đồng về trình độ ban đầu không.
    Bắt buộc phải làm trước khi so sánh kết quả.
    p > 0.05 → 2 nhóm KHÔNG khác nhau đáng kể ban đầu → thực nghiệm hợp lệ.
    """
    print_section("KIỂM TRA TƯƠNG ĐỒNG BAN ĐẦU (BASELINE EQUIVALENCE)")

    ctrl = students[students['group'] == 'control']['pre_score']
    trt  = students[students['group'] == 'treatment']['pre_score']

    t_stat, p_ttest = stats.ttest_ind(ctrl, trt)
    u_stat, p_mwu   = mannwhitneyu(ctrl, trt, alternative='two-sided')

    results = {
        'control_pre_mean':   ctrl.mean(),
        'treatment_pre_mean': trt.mean(),
        'ttest_p':   p_ttest,
        'mwu_p':     p_mwu,
        'equivalent': p_ttest > ALPHA and p_mwu > ALPHA,
    }

    print_result("Pre-test TB nhóm Control",   f"{ctrl.mean():.2f} ± {ctrl.std():.2f}")
    print_result("Pre-test TB nhóm Treatment", f"{trt.mean():.2f} ± {trt.std():.2f}")
    print_result("Independent t-test", f"t={t_stat:.3f}", p_ttest)
    print_result("Mann-Whitney U",     f"U={u_stat:.1f}", p_mwu)

    verdict = "✅ HAI NHÓM TƯƠNG ĐỒNG — Thực nghiệm hợp lệ!" if results['equivalent'] \
              else "❌ HAI NHÓM KHÁC NHAU — Cần điều chỉnh phân tích (ANCOVA)!"
    print(f"\n  Kết luận: {verdict}")

    # ── Biểu đồ phân phối Pre-test ───────────────────────────────────────
    fig, ax = plt.subplots(figsize=(10, 5), facecolor='#111318')
    ax.set_facecolor('#1e2128')

    ax.hist(ctrl, bins=15, alpha=0.7, color=COLORS['control'],
            label=f'Control (n={len(ctrl)}, M={ctrl.mean():.1f})', edgecolor='none')
    ax.hist(trt,  bins=15, alpha=0.7, color=COLORS['treatment'],
            label=f'Treatment (n={len(trt)}, M={trt.mean():.1f})', edgecolor='none')

    ax.axvline(ctrl.mean(), color=COLORS['control'],  linestyle='--', alpha=0.8)
    ax.axvline(trt.mean(),  color=COLORS['treatment'], linestyle='--', alpha=0.8)

    ax.set_title(f'Baseline Pre-test Distribution\n(p={p_ttest:.3f} — {"Groups Equivalent ✅" if p_ttest > ALPHA else "Groups Different ❌"})',
                 color='white', fontsize=12)
    ax.set_xlabel('Pre-test Score (0-60)', color='#9ba3b0')
    ax.set_ylabel('Count', color='#9ba3b0')
    ax.tick_params(colors='#9ba3b0')
    ax.legend(labelcolor='white', facecolor='#1e2128', edgecolor='none')
    for spine in ax.spines.values():
        spine.set_edgecolor('#333')

    plt.tight_layout()
    save_fig(fig, output_dir, 'baseline_equivalence.png')

    return results


# ════════════════════════════════════════════════════════════════════════════
# MODULE 4: RQ3 — HIỆU QUẢ GIÁO DỤC (MAIN EFFECT)
# ════════════════════════════════════════════════════════════════════════════

def analyze_learning_outcomes(students: pd.DataFrame, output_dir: Path) -> dict:
    """
    RQ3: LLM feedback có thực sự cải thiện kết quả học tập không?

    Phân tích:
      - Learning Gain Score
      - Điểm cuối kỳ
      - Effect size (Cohen's d)
    """
    print_section("RQ3: HIỆU QUẢ GIÁO DỤC (LEARNING OUTCOMES)")

    ctrl = students[students['group'] == 'control']
    trt  = students[students['group'] == 'treatment']

    # ── Learning Gain ──────────────────────────────────────────────────────
    def learning_gain(pre, post, max_score=60):
        return ((post - pre) / (max_score - pre).replace(0, np.nan) * 100).fillna(0)

    ctrl_gain = learning_gain(ctrl['pre_score'], ctrl['post_score'])
    trt_gain  = learning_gain(trt['pre_score'],  trt['post_score'])

    # ── Final grade ────────────────────────────────────────────────────────
    ctrl_final = ctrl['final_grade']
    trt_final  = trt['final_grade']

    results = {}
    comparisons = [
        ('Learning Gain (%)',   ctrl_gain,  trt_gain),
        ('Final Grade (0-100)', ctrl_final, trt_final),
    ]

    for name, c, t in comparisons:
        u, p = mannwhitneyu(c, t, alternative='less')  # H1: Treatment > Control
        d = (t.mean() - c.mean()) / np.sqrt((c.std()**2 + t.std()**2) / 2)

        print(f"\n  📊 {name}:")
        print_result("  Control (M ± SD)",   f"{c.mean():.1f} ± {c.std():.1f}")
        print_result("  Treatment (M ± SD)", f"{t.mean():.1f} ± {t.std():.1f}")
        print_result("  Mann-Whitney U", f"U={u:.1f}", p)
        print(f"       Cohen's d = {d:.3f}  ({interpret_cohens_d(d)})")

        results[name] = {'ctrl_mean': c.mean(), 'trt_mean': t.mean(),
                         'p': p, 'cohens_d': d}

    # ── Dropout rate ───────────────────────────────────────────────────────
    ctrl_drop = ctrl['dropout'].mean() * 100
    trt_drop  = trt['dropout'].mean() * 100
    chi2, p_chi2 = stats.chi2_contingency(
        [[ctrl['dropout'].sum(), len(ctrl) - ctrl['dropout'].sum()],
         [trt['dropout'].sum(),  len(trt)  - trt['dropout'].sum()]]
    )[:2]

    print(f"\n  📊 Dropout Rate:")
    print_result("  Control",   f"{ctrl_drop:.1f}%")
    print_result("  Treatment", f"{trt_drop:.1f}%")
    print_result("  Chi-square test", f"χ²={chi2:.3f}", p_chi2)
    results['dropout'] = {'ctrl': ctrl_drop, 'trt': trt_drop, 'p': p_chi2}

    # ── Biểu đồ ──────────────────────────────────────────────────────────
    fig, axes = plt.subplots(1, 3, figsize=(16, 6), facecolor='#111318')

    # 1. Learning Gain boxplot
    ax1 = axes[0]
    ax1.set_facecolor('#1e2128')
    bp = ax1.boxplot(
        [ctrl_gain.dropna(), trt_gain.dropna()],
        patch_artist=True, notch=True,
        medianprops=dict(color='white', linewidth=2),
        whiskerprops=dict(color='#9ba3b0'),
        capprops=dict(color='#9ba3b0'),
        flierprops=dict(marker='o', markerfacecolor='#9ba3b0',
                        markersize=4, alpha=0.5),
    )
    for patch, color in zip(bp['boxes'], [COLORS['control'], COLORS['treatment']]):
        patch.set_facecolor(color)
        patch.set_alpha(0.7)
    ax1.set_xticklabels(['Control', 'Treatment'], color='white')
    ax1.set_title('Learning Gain Score (%)', color='white', fontsize=11)
    ax1.set_ylabel('Learning Gain (%)', color='#9ba3b0')
    ax1.tick_params(colors='#9ba3b0')
    for spine in ax1.spines.values(): spine.set_edgecolor('#333')

    # 2. Final grade violin
    ax2 = axes[1]
    ax2.set_facecolor('#1e2128')
    parts = ax2.violinplot(
        [ctrl_final.dropna(), trt_final.dropna()],
        showmeans=True, showmedians=True
    )
    for i, (pc, color) in enumerate(zip(
        parts['bodies'], [COLORS['control'], COLORS['treatment']]
    )):
        pc.set_facecolor(color)
        pc.set_alpha(0.6)
    ax2.set_xticks([1, 2])
    ax2.set_xticklabels(['Control', 'Treatment'], color='white')
    ax2.set_title('Final Grade Distribution', color='white', fontsize=11)
    ax2.set_ylabel('Final Grade (0-100)', color='#9ba3b0')
    ax2.tick_params(colors='#9ba3b0')
    for spine in ax2.spines.values(): spine.set_edgecolor('#333')

    # 3. Dropout bar
    ax3 = axes[2]
    ax3.set_facecolor('#1e2128')
    bars = ax3.bar(['Control', 'Treatment'], [ctrl_drop, trt_drop],
                   color=[COLORS['control'], COLORS['treatment']],
                   alpha=0.8, width=0.5)
    for bar, val in zip(bars, [ctrl_drop, trt_drop]):
        ax3.text(bar.get_x() + bar.get_width() / 2, bar.get_height() + 0.5,
                 f'{val:.1f}%', ha='center', va='bottom', color='white',
                 fontsize=12, fontweight='bold')
    ax3.set_title('Dropout Rate (%)', color='white', fontsize=11)
    ax3.set_ylabel('Dropout Rate (%)', color='#9ba3b0')
    ax3.tick_params(colors='#9ba3b0')
    for spine in ax3.spines.values(): spine.set_edgecolor('#333')

    fig.suptitle('RQ3: Learning Outcomes — Control vs Treatment',
                 color='white', fontsize=14, fontweight='bold', y=1.02)
    plt.tight_layout()
    save_fig(fig, output_dir, 'rq3_learning_outcomes.png')

    return results


# ════════════════════════════════════════════════════════════════════════════
# MODULE 5: RQ4 — MÔ HÌNH TIẾN BỘ THEO THỜI GIAN
# ════════════════════════════════════════════════════════════════════════════

def analyze_progression(submissions: pd.DataFrame, output_dir: Path) -> dict:
    """
    RQ4: Mô hình tiến bộ nào phản ánh chính xác nhất sự phát triển
         năng lực theo thời gian?

    Phân tích:
      - Weekly mean scores per group
      - Linear slope comparison
      - Tier-specific growth (Tier1 vs Tier2 vs Tier3)
      - Interaction effect: group × week
    """
    print_section("RQ4: MÔ HÌNH TIẾN BỘ THEO THỜI GIAN")

    weekly = (submissions
              .groupby(['group', 'week'])['total_score']
              .agg(['mean', 'std', 'count'])
              .reset_index())

    ctrl_weekly = weekly[weekly['group'] == 'control']
    trt_weekly  = weekly[weekly['group'] == 'treatment']

    # ── Slope analysis ─────────────────────────────────────────────────────
    def calc_slope(df_group):
        weeks  = df_group['week'].values
        scores = df_group['mean'].values
        slope, intercept, r_val, p_val, _ = stats.linregress(weeks, scores)
        return slope, r_val**2, p_val

    ctrl_slope, ctrl_r2, ctrl_p = calc_slope(ctrl_weekly)
    trt_slope,  trt_r2,  trt_p  = calc_slope(trt_weekly)

    results = {
        'control_slope':   ctrl_slope,
        'treatment_slope': trt_slope,
        'slope_ratio':     trt_slope / ctrl_slope if ctrl_slope != 0 else np.inf,
    }

    print_result("Control learning rate (slope/tuần)",   f"{ctrl_slope:.3f} điểm/tuần")
    print_result("Treatment learning rate (slope/tuần)", f"{trt_slope:.3f} điểm/tuần")
    print_result("Tỷ lệ (Treatment/Control)",
                 f"{results['slope_ratio']:.2f}x nhanh hơn")

    # ── Tier-specific analysis ─────────────────────────────────────────────
    print("\n  Phân tích theo từng tầng:")
    tiers = ['tier1_score', 'tier2_score', 'tier3_score']
    tier_names = ['Tầng 1 (Correctness)', 'Tầng 2 (Code Quality)',
                  'Tầng 3 (CT)']

    tier_results = {}
    for tier_col, tier_name in zip(tiers, tier_names):
        tier_weekly = (submissions.groupby(['group', 'week'])[tier_col]
                       .mean().reset_index())
        ctrl_tier = tier_weekly[tier_weekly['group'] == 'control']
        trt_tier  = tier_weekly[tier_weekly['group'] == 'treatment']
        slope_c, _, _ = calc_slope(ctrl_tier.rename(columns={tier_col: 'mean'}))
        slope_t, _, _ = calc_slope(trt_tier.rename(columns={tier_col: 'mean'}))
        print_result(f"  {tier_name} — slope ratio",
                     f"Ctrl={slope_c:.2f}, Trt={slope_t:.2f}")
        tier_results[tier_col] = {'ctrl': slope_c, 'trt': slope_t}

    results['tier_slopes'] = tier_results

    # ── Biểu đồ: Time series ──────────────────────────────────────────────
    fig, axes = plt.subplots(1, 2, figsize=(16, 6), facecolor='#111318')

    # 1. Total score over time
    ax1 = axes[0]
    ax1.set_facecolor('#1e2128')

    for grp, color, label in [
        ('control',   COLORS['control'],   'Control'),
        ('treatment', COLORS['treatment'], 'Treatment'),
    ]:
        grp_data = weekly[weekly['group'] == grp]
        ax1.plot(grp_data['week'], grp_data['mean'],
                 color=color, linewidth=2.5, marker='o', markersize=5,
                 label=f'{label} (slope={ctrl_slope:.2f if grp=="control" else trt_slope:.2f}/wk)')
        # Confidence interval
        se = grp_data['std'] / np.sqrt(grp_data['count'])
        ax1.fill_between(grp_data['week'],
                         grp_data['mean'] - 1.96 * se,
                         grp_data['mean'] + 1.96 * se,
                         color=color, alpha=0.15)

    ax1.set_xlabel('Tuần (Week)', color='#9ba3b0')
    ax1.set_ylabel('Mean Score (0-100)', color='#9ba3b0')
    ax1.set_title('Score Progression Over 15 Weeks', color='white', fontsize=12)
    ax1.set_xticks(range(1, 16))
    ax1.tick_params(colors='#9ba3b0')
    ax1.legend(labelcolor='white', facecolor='#1e2128', edgecolor='none')
    ax1.grid(True, alpha=0.1, color='white')
    for spine in ax1.spines.values(): spine.set_edgecolor('#333')

    # 2. Tier breakdown — bar chart week 1 vs week 15
    ax2 = axes[1]
    ax2.set_facecolor('#1e2128')

    groups = ['Control W1', 'Control W15', 'Treatment W1', 'Treatment W15']
    t1_vals, t2_vals, t3_vals = [], [], []
    for grp, week in [('control',1),('control',15),('treatment',1),('treatment',15)]:
        sub = submissions[(submissions['group']==grp) & (submissions['week']==week)]
        t1_vals.append(sub['tier1_score'].mean())
        t2_vals.append(sub['tier2_score'].mean())
        t3_vals.append(sub['tier3_score'].mean())

    x = np.arange(len(groups))
    w = 0.25
    ax2.bar(x - w, t1_vals, w, label='Tier 1 Correctness',
            color='#60a5fa', alpha=0.8)
    ax2.bar(x,     t2_vals, w, label='Tier 2 Code Quality',
            color='#fbbf24', alpha=0.8)
    ax2.bar(x + w, t3_vals, w, label='Tier 3 Comp. Thinking',
            color='#c0392b', alpha=0.8)

    ax2.set_xticks(x)
    ax2.set_xticklabels(groups, rotation=15, ha='right', color='white', fontsize=9)
    ax2.set_title('Tier Breakdown: Week 1 vs Week 15', color='white', fontsize=12)
    ax2.set_ylabel('Mean Score', color='#9ba3b0')
    ax2.tick_params(colors='#9ba3b0')
    ax2.legend(labelcolor='white', facecolor='#1e2128', edgecolor='none', fontsize=9)
    ax2.grid(True, alpha=0.1, color='white', axis='y')
    for spine in ax2.spines.values(): spine.set_edgecolor('#333')

    fig.suptitle('RQ4: Skill Progression Model',
                 color='white', fontsize=14, fontweight='bold', y=1.02)
    plt.tight_layout()
    save_fig(fig, output_dir, 'rq4_progression.png')

    return results


# ════════════════════════════════════════════════════════════════════════════
# MODULE 6: RQ5 — HỆ THỐNG CẢNH BÁO SỚM
# ════════════════════════════════════════════════════════════════════════════

def analyze_early_warning(ew_df: pd.DataFrame, output_dir: Path) -> dict:
    """
    RQ5: Có thể phát hiện sớm sinh viên có nguy cơ không?

    Chỉ số:
      - Precision, Recall, F1 Score
      - So sánh giữa nhóm control và treatment
    """
    print_section("RQ5: HỆ THỐNG CẢNH BÁO SỚM (EARLY WARNING)")

    results = {}
    for grp in ['control', 'treatment', 'overall']:
        if grp == 'overall':
            df_g = ew_df
        else:
            df_g = ew_df[ew_df['group'] == grp]

        y_true = df_g['actual_at_risk']
        y_pred = df_g['predicted_at_risk']

        p, r, f1, _ = precision_recall_fscore_support(
            y_true, y_pred, average='binary', zero_division=0
        )
        results[grp] = {'precision': p, 'recall': r, 'f1': f1}

        label = grp.capitalize()
        print(f"\n  [{label}]")
        print_result("  Precision",             f"{p:.3f}  {'✅' if p >= 0.80 else '❌'}")
        print_result("  Recall (Sensitivity)",  f"{r:.3f}  {'✅' if r >= 0.75 else '❌'}")
        print_result("  F1 Score",              f"{f1:.3f} {'✅' if f1 >= 0.77 else '❌'}")

    # ── Biểu đồ ───────────────────────────────────────────────────────────
    fig, axes = plt.subplots(1, 2, figsize=(14, 6), facecolor='#111318')

    # 1. Precision/Recall comparison
    ax1 = axes[0]
    ax1.set_facecolor('#1e2128')
    metrics_names = ['Precision', 'Recall', 'F1 Score']
    ctrl_vals = [results['control']['precision'],
                 results['control']['recall'],
                 results['control']['f1']]
    trt_vals  = [results['treatment']['precision'],
                 results['treatment']['recall'],
                 results['treatment']['f1']]
    x = np.arange(len(metrics_names))
    w = 0.35
    ax1.bar(x - w/2, ctrl_vals, w, label='Control',
            color=COLORS['control'], alpha=0.8)
    ax1.bar(x + w/2, trt_vals,  w, label='Treatment',
            color=COLORS['treatment'], alpha=0.8)
    ax1.axhline(0.80, color=COLORS['warning'], linestyle='--',
                alpha=0.6, linewidth=1.5, label='Target (0.80)')
    ax1.set_xticks(x)
    ax1.set_xticklabels(metrics_names, color='white')
    ax1.set_ylim(0, 1.1)
    ax1.set_title('Early Warning System Performance', color='white', fontsize=12)
    ax1.set_ylabel('Score', color='#9ba3b0')
    ax1.tick_params(colors='#9ba3b0')
    ax1.legend(labelcolor='white', facecolor='#1e2128', edgecolor='none')
    for spine in ax1.spines.values(): spine.set_edgecolor('#333')

    # 2. Confusion matrix (overall)
    ax2 = axes[1]
    cm = confusion_matrix(ew_df['actual_at_risk'], ew_df['predicted_at_risk'])
    sns.heatmap(cm, annot=True, fmt='d', cmap='YlOrRd',
                xticklabels=['Not At-Risk', 'At-Risk'],
                yticklabels=['Not At-Risk', 'At-Risk'],
                ax=ax2, annot_kws={'color': 'white', 'fontsize': 14})
    ax2.set_title('Confusion Matrix\n(Overall Early Warning)',
                  color='white', fontsize=12)
    ax2.set_xlabel('Predicted', color='#9ba3b0')
    ax2.set_ylabel('Actual', color='#9ba3b0')
    ax2.tick_params(colors='#9ba3b0')

    fig.suptitle('RQ5: Early Warning System Evaluation',
                 color='white', fontsize=14, fontweight='bold', y=1.02)
    plt.tight_layout()
    save_fig(fig, output_dir, 'rq5_early_warning.png')

    return results


# ════════════════════════════════════════════════════════════════════════════
# MODULE 7: TỔNG HỢP & BÁO CÁO
# ════════════════════════════════════════════════════════════════════════════

def generate_summary_report(all_results: dict, output_dir: Path):
    """Tạo báo cáo tổng hợp JSON và in tóm tắt cuối cùng."""
    print_section("📋 BÁO CÁO TỔNG HỢP — KẾT QUẢ NGHIÊN CỨU")

    report = {
        'generated_at': datetime.now().isoformat(),
        'study': 'LLM-Assisted Programming Assessment Research',
        'results': all_results,
        'conclusions': {}
    }

    # RQ1
    rq1 = all_results.get('rq1', {})
    rq1_pass = (rq1.get('pearson_r', 0) >= TARGET_R and
                rq1.get('cohens_kappa', 0) >= TARGET_KAPPA and
                rq1.get('mae', 100) <= TARGET_MAE)
    report['conclusions']['RQ1'] = (
        "LLM ĐẠT độ chính xác tương đương chuyên gia con người"
        if rq1_pass else
        "LLM CHƯA ĐẠT — cần cải thiện rubric hoặc prompt"
    )

    # RQ3
    rq3 = all_results.get('rq3', {})
    lg  = rq3.get('Learning Gain (%)', {})
    rq3_pass = lg.get('p', 1) < ALPHA
    report['conclusions']['RQ3'] = (
        f"LLM feedback CÓ hiệu quả — Treatment cải thiện {lg.get('trt_mean',0)-lg.get('ctrl_mean',0):.1f}% "
        f"so với Control (p={lg.get('p',1):.4f})"
        if rq3_pass else
        "CHƯA có đủ bằng chứng về hiệu quả giáo dục"
    )

    # RQ4
    rq4 = all_results.get('rq4', {})
    ratio = rq4.get('slope_ratio', 1)
    report['conclusions']['RQ4'] = (
        f"Treatment tiến bộ {ratio:.2f}× nhanh hơn Control "
        f"(slope: {rq4.get('treatment_slope',0):.2f} vs {rq4.get('control_slope',0):.2f} điểm/tuần)"
    )

    # RQ5
    rq5 = all_results.get('rq5', {})
    ov  = rq5.get('overall', {})
    rq5_pass = ov.get('f1', 0) >= 0.77
    report['conclusions']['RQ5'] = (
        f"Early Warning đạt F1={ov.get('f1',0):.3f} — HỆ THỐNG HOẠT ĐỘNG TỐT ✅"
        if rq5_pass else
        f"Early Warning F1={ov.get('f1',0):.3f} — CẦN CẢI THIỆN MODEL"
    )

    # In tóm tắt
    for rq, conclusion in report['conclusions'].items():
        print(f"\n  {rq}: {conclusion}")

    # Lưu JSON
    report_path = output_dir / 'research_results_summary.json'
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2, default=str)
    print(f"\n  💾 Báo cáo đầy đủ: {report_path}")


# ════════════════════════════════════════════════════════════════════════════
# MAIN
# ════════════════════════════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(
        description='Phân tích thống kê cho nghiên cứu LLM Assessment')
    parser.add_argument('--data',   default='',          help='Đường dẫn file Excel dữ liệu')
    parser.add_argument('--output', default='results/',  help='Thư mục lưu kết quả')
    args = parser.parse_args()

    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)

    print("🚀 LLM Programming Assessment — Statistical Analysis Suite")
    print(f"   Output: {output_dir.resolve()}")

    # Load data
    loader = DataLoader()
    data   = loader.load(args.data)

    students      = data['students']
    submissions   = data['submissions']
    llm_vs_human  = data['llm_vs_human']
    early_warning = data['early_warning']

    print(f"\n   📊 Dữ liệu: {len(students)} sinh viên, "
          f"{len(submissions)} submissions, {len(llm_vs_human)} calibration samples")

    # Chạy toàn bộ phân tích
    all_results = {}
    all_results['baseline'] = check_baseline_equivalence(students,     output_dir)
    all_results['rq1']      = analyze_llm_accuracy(llm_vs_human,       output_dir)
    all_results['rq3']      = analyze_learning_outcomes(students,       output_dir)
    all_results['rq4']      = analyze_progression(submissions,          output_dir)
    all_results['rq5']      = analyze_early_warning(early_warning,      output_dir)

    # Báo cáo tổng hợp
    generate_summary_report(all_results, output_dir)

    print(f"\n✅ Hoàn tất! Tất cả kết quả đã lưu tại: {output_dir.resolve()}")
    print("   Các file:")
    for f in sorted(output_dir.iterdir()):
        print(f"   • {f.name}")


if __name__ == '__main__':
    main()
