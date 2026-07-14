"""
================================================================================
 PROTOTYPE: LLM-Assisted Programming Assessment System
 Hệ Thống Đánh Giá Lập Trình Sinh Viên Hỗ Trợ Bởi LLM
================================================================================
 Tác giả: [Tên sinh viên/nhóm nghiên cứu]
 Ngày:    14/06/2026
 Phiên bản: v0.1 (Prototype / Proof of Concept)

 Mô tả:
   Pipeline hoàn chỉnh từ code submission của sinh viên → phân tích tĩnh
   → chạy test → phân tích git → LLM đánh giá → kết quả JSON có cấu trúc

 Cài đặt:
   pip install openai pylint radon gitpython python-dotenv
================================================================================
"""

import os
import ast
import json
import subprocess
import re
from datetime import datetime
from dataclasses import dataclass, field
from typing import Optional
from dotenv import load_dotenv

# Load API keys từ file .env
load_dotenv()

# ──────────────────────────────────────────────────────────────────────────────
# PHẦN 1: DATA MODELS — Cấu trúc dữ liệu
# ──────────────────────────────────────────────────────────────────────────────

@dataclass
class StaticAnalysisResult:
    """Kết quả từ phân tích tĩnh code (không cần chạy)"""
    syntax_valid: bool = False
    num_functions: int = 0
    num_lines: int = 0
    avg_function_length: float = 0.0
    cyclomatic_complexity: float = 0.0
    has_docstrings: bool = False
    naming_score: float = 0.0
    pylint_score: float = 0.0
    issues: list = field(default_factory=list)


@dataclass
class TestResult:
    """Kết quả chạy test cases"""
    total_tests: int = 0
    passed_tests: int = 0
    failed_tests: list = field(default_factory=list)
    pass_rate: float = 0.0
    error_message: Optional[str] = None


@dataclass
class CommitInfo:
    """Thông tin một lần commit"""
    hash: str
    timestamp: str
    message: str
    lines_added: int
    lines_deleted: int


@dataclass
class GitAnalysisResult:
    """Kết quả phân tích revision history"""
    total_commits: int = 0
    commits: list = field(default_factory=list)
    time_span_hours: float = 0.0
    commit_frequency: float = 0.0
    avg_message_quality: float = 0.0
    has_meaningful_messages: bool = False


@dataclass
class AssessmentResult:
    """Kết quả đánh giá hoàn chỉnh từ LLM"""
    student_id: str
    assignment_id: str
    timestamp: str
    # Điểm từng tiêu chí
    tier1_syntax_execution: int = 0
    tier1_functional_correctness: int = 0
    tier1_edge_case_handling: int = 0
    tier2_naming_readability: int = 0
    tier2_comments_documentation: int = 0
    tier2_structure_efficiency: int = 0
    tier2_idiomatic_code: int = 0
    tier3_problem_decomposition: int = 0
    tier3_abstraction_level: int = 0
    tier3_pattern_recognition: int = 0
    tier3_debugging_strategy: int = 0
    # Tổng hợp
    total_score: int = 0
    proficiency_level: str = ""
    strengths: list = field(default_factory=list)
    weaknesses: list = field(default_factory=list)
    specific_recommendations: list = field(default_factory=list)
    next_suggested_topic: str = ""
    justifications: dict = field(default_factory=dict)


# ──────────────────────────────────────────────────────────────────────────────
# PHẦN 2: STATIC ANALYZER
# ──────────────────────────────────────────────────────────────────────────────

class StaticCodeAnalyzer:
    """Phân tích code Python bằng AST mà không cần chạy."""

    def analyze(self, code: str) -> StaticAnalysisResult:
        result = StaticAnalysisResult()

        try:
            tree = ast.parse(code)
            result.syntax_valid = True
        except SyntaxError as e:
            result.issues.append(f"Syntax error: {e}")
            return result

        result.num_lines = len(code.strip().split('\n'))

        functions = [n for n in ast.walk(tree) if isinstance(n, ast.FunctionDef)]
        result.num_functions = len(functions)

        func_lengths = []
        docstring_count = 0
        for func in functions:
            func_lengths.append(func.end_lineno - func.lineno + 1)
            if (func.body and isinstance(func.body[0], ast.Expr)
                    and isinstance(func.body[0].value, ast.Constant)
                    and isinstance(func.body[0].value.value, str)):
                docstring_count += 1

        result.avg_function_length = (
            sum(func_lengths) / len(func_lengths) if func_lengths else 0
        )
        result.has_docstrings = docstring_count > 0
        result.naming_score = self._check_naming_quality(tree)
        result.pylint_score = self._run_pylint(code)
        return result

    def _check_naming_quality(self, tree: ast.AST) -> float:
        acceptable_single_char = {'i', 'j', 'k', 'n', 'm', 'x', 'y', 'e'}
        all_names, bad_names = [], []

        for node in ast.walk(tree):
            if isinstance(node, ast.Name):
                name = node.id
                if name.startswith('_') or name.isupper():
                    continue
                all_names.append(name)
                if len(name) == 1 and name not in acceptable_single_char:
                    bad_names.append(name)
                elif name in {'temp', 'tmp', 'var', 'val', 'res', 'ans', 'thing'}:
                    bad_names.append(name)

        if not all_names:
            return 0.5
        return max(0.0, 1.0 - len(bad_names) / len(all_names))

    def _run_pylint(self, code: str) -> float:
        import tempfile
        try:
            with tempfile.NamedTemporaryFile(
                mode='w', suffix='.py', delete=False, encoding='utf-8'
            ) as tmp:
                tmp.write(code)
                tmp_path = tmp.name

            out = subprocess.run(
                ['python', '-m', 'pylint', '--score=yes', tmp_path],
                capture_output=True, text=True, timeout=30
            )
            for line in out.stdout.split('\n'):
                if 'rated at' in line:
                    m = re.search(r'([\d.]+)/10', line)
                    if m:
                        return float(m.group(1))
        except Exception:
            pass
        finally:
            if 'tmp_path' in locals():
                try:
                    os.unlink(tmp_path)
                except Exception:
                    pass
        return 5.0


# ──────────────────────────────────────────────────────────────────────────────
# PHẦN 3: TEST RUNNER
# ──────────────────────────────────────────────────────────────────────────────

class SafeTestRunner:
    """Chạy test cases trong namespace cách ly."""

    def run_tests(self, student_code: str, test_cases: list) -> TestResult:
        result = TestResult(total_tests=len(test_cases))
        passed = 0

        for i, test in enumerate(test_cases):
            try:
                namespace = {}
                exec(student_code, namespace)  # noqa: S102
                func_name = test.get('function_name', 'solution')
                if func_name not in namespace:
                    result.failed_tests.append({
                        'test_id': i + 1,
                        'error': f"Không tìm thấy hàm '{func_name}'"
                    })
                    continue

                actual = namespace[func_name](*test['input'])
                if actual == test['expected_output']:
                    passed += 1
                else:
                    result.failed_tests.append({
                        'test_id': i + 1,
                        'input': test['input'],
                        'expected': test['expected_output'],
                        'actual': actual
                    })
            except Exception as e:
                result.failed_tests.append({'test_id': i + 1, 'error': str(e)})

        result.passed_tests = passed
        result.pass_rate = passed / len(test_cases) if test_cases else 0.0
        return result


# ──────────────────────────────────────────────────────────────────────────────
# PHẦN 4: GIT ANALYZER
# ──────────────────────────────────────────────────────────────────────────────

class GitHistoryAnalyzer:
    """Phân tích lịch sử commit của sinh viên."""

    def analyze(self, repo_path: str) -> GitAnalysisResult:
        result = GitAnalysisResult()
        try:
            out = subprocess.run(
                ['git', 'log', '--pretty=format:%H|%ai|%s'],
                capture_output=True, text=True, cwd=repo_path, timeout=10
            )
            if out.returncode != 0:
                return result

            commits = self._parse_git_log(out.stdout)
            result.commits = commits
            result.total_commits = len(commits)

            if len(commits) >= 2:
                t1 = datetime.fromisoformat(commits[-1].timestamp.replace(' ', 'T'))
                t2 = datetime.fromisoformat(commits[0].timestamp.replace(' ', 'T'))
                result.time_span_hours = abs((t2 - t1).total_seconds() / 3600)
                if result.time_span_hours > 0:
                    result.commit_frequency = result.total_commits / result.time_span_hours

            result.avg_message_quality = self._evaluate_messages(
                [c.message for c in commits]
            )
            result.has_meaningful_messages = result.avg_message_quality > 0.5
        except Exception as e:
            print(f"  ⚠️  Git analysis warning: {e}")
        return result

    def _parse_git_log(self, output: str) -> list:
        commits = []
        for line in output.strip().split('\n'):
            parts = line.split('|', 2)
            if len(parts) == 3:
                commits.append(CommitInfo(
                    hash=parts[0][:7],
                    timestamp=parts[1].strip(),
                    message=parts[2].strip(),
                    lines_added=0, lines_deleted=0
                ))
        return commits

    def _evaluate_messages(self, messages: list) -> float:
        if not messages:
            return 0.0
        good_kw = ['fix', 'add', 'update', 'refactor', 'implement', 'handle',
                   'resolve', 'improve', 'sửa', 'thêm', 'xử lý']
        vague = {'update', 'fix', 'done', 'ok', 'commit', 'save', '.', 'test'}
        scores = []
        for msg in messages:
            s = 0.0
            if len(msg) > 20:
                s += 0.5
            elif len(msg) > 10:
                s += 0.3
            if any(k in msg.lower() for k in good_kw) and msg.lower() not in vague:
                s += 0.5
            elif msg.lower() in vague or len(msg) < 5:
                s = max(0.0, s - 0.3)
            scores.append(min(1.0, s))
        return sum(scores) / len(scores)


# ──────────────────────────────────────────────────────────────────────────────
# PHẦN 5: LLM EVALUATOR
# ──────────────────────────────────────────────────────────────────────────────

class LLMEvaluator:
    """Gọi LLM với Rubric 3 tầng để chấm điểm code sinh viên."""

    RUBRIC_SYSTEM_PROMPT = """
Bạn là giáo viên lập trình Python kinh nghiệm, đang chấm bài sinh viên năm nhất.
Đánh giá code theo RUBRIC 3 TẦNG và trả về JSON CHÍNH XÁC (không thêm markdown):

═══ TẦNG 1: CORRECTNESS (40đ) ═══════════════════════════════════
1.1 Syntax & Execution (0-10):
    10: Chạy hoàn toàn không lỗi
    7-9: Lỗi nhỏ không thường xuyên
    4-6: Hay lỗi, chạy được một phần
    1-3: Syntax error, không chạy được
    0: Rỗng / không nộp

1.2 Functional Correctness (0-20):
    18-20: Pass tất cả test cases + edge cases
    13-17: Pass >75% tests
    7-12: Pass 50-75% tests
    1-6: Pass <50% tests
    0: Không pass test nào

1.3 Edge Case Handling (0-10):
    9-10: Xử lý đầy đủ: rỗng, None, âm, overflow, kiểu sai
    6-8: Xử lý phần lớn edge cases
    3-5: Chỉ xử lý 1-2 edge case đơn giản
    1-2: Gần như bỏ qua edge cases
    0: Hoàn toàn bỏ qua

═══ TẦNG 2: CODE QUALITY (35đ) ══════════════════════════════════
2.1 Naming & Readability (0-10):
    9-10: Tên rõ ràng, đúng snake_case, phản ánh vai trò
    6-8: Hầu hết có ý nghĩa, vài chỗ mơ hồ
    3-5: Nhiều tên ngắn vô nghĩa (arr, temp, res)
    1-2: Dùng tên 1 ký tự la liệt (a, b, c)
    0: Không thể hiểu

2.2 Comments & Documentation (0-8):
    7-8: Docstring mọi hàm + comment logic phức tạp
    5-6: Có comment quan trọng, có docstring chính
    3-4: Vài comment, thiếu docstring
    1-2: Hầu như không có comment
    0: Không có gì

2.3 Structure & Efficiency (0-12):
    11-12: DRY principle, thuật toán tối ưu, cấu trúc rõ
    8-10: Cấu trúc tốt, thuật toán chấp nhận được
    4-7: Lặp code đáng kể, thuật toán cần cải thiện nhiều
    1-3: Lộn xộn, lặp nhiều
    0: Không có cấu trúc

2.4 Idiomatic Code (0-5):
    5: Dùng thành thạo list comprehension, enumerate, f-string
    3-4: Biết dùng một số tính năng Pythonic
    2: C-style, dùng range(len()) thay vì enumerate
    0-1: Viết như ngôn ngữ khác

═══ TẦNG 3: COMPUTATIONAL THINKING (25đ) ════════════════════════
3.1 Problem Decomposition (0-8):
    7-8: Hàm nhỏ, mỗi hàm 1 nhiệm vụ, tái sử dụng được
    5-6: Có chia hàm, một số hàm còn quá dài
    3-4: Chỉ có main hoặc chia không hợp lý
    1-2: Toàn bộ trong 1 khối, không có hàm con
    0: Không có ý thức về hàm

3.2 Abstraction Level (0-7):
    6-7: Tổng quát, không hard-code, dùng parameters/constants
    4-5: Phần lớn tổng quát, còn vài hard-code
    2-3: Hard-code nhiều
    1: Hard-code hầu hết
    0: Không có ý thức abstraction

3.3 Pattern Recognition (0-5):
    5: Tái sử dụng hàm, built-in functions, không copy-paste
    3-4: Phần lớn nhận ra pattern
    2: Copy-paste nhiều
    0-1: Không nhận ra pattern

3.4 Debugging Strategy (0-5) [Từ git history]:
    5: Mỗi commit giải quyết 1 vấn đề, messages rõ ràng, có hệ thống
    3-4: Debug có hướng, đôi khi thay đổi nhiều thứ cùng lúc
    2: Thử-sai, messages mơ hồ ("fix", "update")
    1: Rất ít commit (1-2)
    0: Chỉ 1 commit / không có git history

Phản hồi = tiếng Việt, tích cực, phù hợp trình độ người mới học.
"""

    USER_PROMPT_TEMPLATE = """
THÔNG TIN BÀI NỘP:
Sinh viên: {student_id} | Bài: {assignment_id}
Đề bài: {assignment_description}

PHÂN TÍCH TĨNH:
- Cú pháp hợp lệ: {syntax_valid} | Số hàm: {num_functions} | Số dòng: {num_lines}
- Pylint score: {pylint_score}/10 | Có docstring: {has_docstrings}
- Vấn đề tìm thấy: {issues}

TEST CASES:
- Pass rate: {pass_rate:.0%} ({passed}/{total} tests)
- Tests thất bại: {failed_tests}

GIT HISTORY:
- Tổng commits: {total_commits} | Thời gian làm: {time_span_hours:.1f} giờ
- Commit messages: {commit_messages}
- Chất lượng messages: {msg_quality:.0%}

CODE CỦA SINH VIÊN:
```python
{student_code}
```

Trả về JSON CHÍNH XÁC theo cấu trúc:
{{
  "tier1": {{
    "syntax_execution": {{"score": <0-10>, "justification": "<tiếng Việt>"}},
    "functional_correctness": {{"score": <0-20>, "justification": "<tiếng Việt>"}},
    "edge_case_handling": {{"score": <0-10>, "justification": "<tiếng Việt>"}}
  }},
  "tier2": {{
    "naming_readability": {{"score": <0-10>, "justification": "<tiếng Việt>"}},
    "comments_documentation": {{"score": <0-8>, "justification": "<tiếng Việt>"}},
    "structure_efficiency": {{"score": <0-12>, "justification": "<tiếng Việt>"}},
    "idiomatic_code": {{"score": <0-5>, "justification": "<tiếng Việt>"}}
  }},
  "tier3": {{
    "problem_decomposition": {{"score": <0-8>, "justification": "<tiếng Việt>"}},
    "abstraction_level": {{"score": <0-7>, "justification": "<tiếng Việt>"}},
    "pattern_recognition": {{"score": <0-5>, "justification": "<tiếng Việt>"}},
    "debugging_strategy": {{"score": <0-5>, "justification": "<tiếng Việt>"}}
  }},
  "strengths": ["<điểm mạnh 1>", "<điểm mạnh 2>", "<điểm mạnh 3>"],
  "weaknesses": ["<điểm yếu 1>", "<điểm yếu 2>", "<điểm yếu 3>"],
  "specific_recommendations": ["<gợi ý 1 kèm ví dụ code>", "<gợi ý 2>", "<gợi ý 3>"],
  "next_suggested_topic": "<chủ đề nên học tiếp>",
  "encouragement_message": "<lời khích lệ ngắn, tích cực>"
}}
"""

    def __init__(self, provider: str = "openai"):
        self.provider = provider
        self._setup_client()

    def _setup_client(self):
        if self.provider == "openai":
            from openai import OpenAI
            self.client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
            self.model = "gpt-4o"
        elif self.provider == "gemini":
            import google.generativeai as genai
            genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
            self.client = genai.GenerativeModel('gemini-1.5-pro')

    def evaluate(self, student_id, assignment_id, assignment_description,
                 student_code, static_result, test_result, git_result) -> AssessmentResult:
        commit_messages = [f"[{c.hash}] {c.message}" for c in git_result.commits[:10]]

        prompt = self.USER_PROMPT_TEMPLATE.format(
            student_id=student_id,
            assignment_id=assignment_id,
            assignment_description=assignment_description,
            syntax_valid="Có" if static_result.syntax_valid else "Không",
            num_functions=static_result.num_functions,
            num_lines=static_result.num_lines,
            pylint_score=f"{static_result.pylint_score:.1f}",
            has_docstrings="Có" if static_result.has_docstrings else "Không",
            issues="; ".join(static_result.issues[:5]) or "Không có",
            pass_rate=test_result.pass_rate,
            passed=test_result.passed_tests,
            total=test_result.total_tests,
            failed_tests=json.dumps(test_result.failed_tests[:3], ensure_ascii=False),
            total_commits=git_result.total_commits,
            time_span_hours=git_result.time_span_hours,
            commit_messages="\n".join(commit_messages) or "Không có git history",
            msg_quality=git_result.avg_message_quality,
            student_code=student_code[:3000]
        )

        llm_response = self._call_llm(prompt)
        return self._parse_response(llm_response, student_id, assignment_id)

    def _call_llm(self, user_prompt: str) -> str:
        print("  🤖 Đang gọi LLM...")
        try:
            if self.provider == "openai":
                response = self.client.chat.completions.create(
                    model=self.model,
                    messages=[
                        {"role": "system", "content": self.RUBRIC_SYSTEM_PROMPT},
                        {"role": "user", "content": user_prompt}
                    ],
                    temperature=0.1,
                    max_tokens=2000,
                    response_format={"type": "json_object"}
                )
                return response.choices[0].message.content
            elif self.provider == "gemini":
                full = self.RUBRIC_SYSTEM_PROMPT + "\n\n" + user_prompt
                response = self.client.generate_content(full)
                return response.text
        except Exception as e:
            print(f"  ❌ LLM Error: {e}")
        return "{}"

    def _parse_response(self, response_text: str, student_id: str,
                        assignment_id: str) -> AssessmentResult:
        r = AssessmentResult(student_id=student_id, assignment_id=assignment_id,
                             timestamp=datetime.now().isoformat())
        try:
            m = re.search(r'\{.*\}', response_text, re.DOTALL)
            data = json.loads(m.group() if m else response_text)

            t1 = data.get('tier1', {})
            r.tier1_syntax_execution = t1.get('syntax_execution', {}).get('score', 0)
            r.tier1_functional_correctness = t1.get('functional_correctness', {}).get('score', 0)
            r.tier1_edge_case_handling = t1.get('edge_case_handling', {}).get('score', 0)

            t2 = data.get('tier2', {})
            r.tier2_naming_readability = t2.get('naming_readability', {}).get('score', 0)
            r.tier2_comments_documentation = t2.get('comments_documentation', {}).get('score', 0)
            r.tier2_structure_efficiency = t2.get('structure_efficiency', {}).get('score', 0)
            r.tier2_idiomatic_code = t2.get('idiomatic_code', {}).get('score', 0)

            t3 = data.get('tier3', {})
            r.tier3_problem_decomposition = t3.get('problem_decomposition', {}).get('score', 0)
            r.tier3_abstraction_level = t3.get('abstraction_level', {}).get('score', 0)
            r.tier3_pattern_recognition = t3.get('pattern_recognition', {}).get('score', 0)
            r.tier3_debugging_strategy = t3.get('debugging_strategy', {}).get('score', 0)

            r.total_score = sum([
                r.tier1_syntax_execution, r.tier1_functional_correctness,
                r.tier1_edge_case_handling, r.tier2_naming_readability,
                r.tier2_comments_documentation, r.tier2_structure_efficiency,
                r.tier2_idiomatic_code, r.tier3_problem_decomposition,
                r.tier3_abstraction_level, r.tier3_pattern_recognition,
                r.tier3_debugging_strategy
            ])
            r.proficiency_level = self._classify(r.total_score)
            r.strengths = data.get('strengths', [])
            r.weaknesses = data.get('weaknesses', [])
            r.specific_recommendations = data.get('specific_recommendations', [])
            r.next_suggested_topic = data.get('next_suggested_topic', '')
            r.justifications = data
        except Exception as e:
            print(f"  ⚠️  Parse error: {e}")
        return r

    @staticmethod
    def _classify(score: int) -> str:
        if score >= 90: return "Expert (Level 5) 🏆"
        if score >= 75: return "Advanced (Level 4) ⭐"
        if score >= 55: return "Intermediate (Level 3) 📈"
        if score >= 35: return "Developing (Level 2) 📚"
        return "Beginner (Level 1) 🆘"


# ──────────────────────────────────────────────────────────────────────────────
# PHẦN 6: PROFICIENCY TRACKER — Theo dõi tiến bộ
# ──────────────────────────────────────────────────────────────────────────────

class ProficiencyTracker:
    """Theo dõi tiến bộ của sinh viên qua nhiều bài nộp."""

    def __init__(self, data_file: str = "student_progress.json"):
        self.data_file = data_file
        self.history: dict = self._load()

    def _load(self) -> dict:
        if os.path.exists(self.data_file):
            with open(self.data_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        return {}

    def save(self, result: AssessmentResult) -> None:
        if result.student_id not in self.history:
            self.history[result.student_id] = []

        self.history[result.student_id].append({
            "assignment_id": result.assignment_id,
            "timestamp": result.timestamp,
            "total_score": result.total_score,
            "proficiency_level": result.proficiency_level,
            "tier1": (result.tier1_syntax_execution +
                      result.tier1_functional_correctness +
                      result.tier1_edge_case_handling),
            "tier2": (result.tier2_naming_readability +
                      result.tier2_comments_documentation +
                      result.tier2_structure_efficiency +
                      result.tier2_idiomatic_code),
            "tier3": (result.tier3_problem_decomposition +
                      result.tier3_abstraction_level +
                      result.tier3_pattern_recognition +
                      result.tier3_debugging_strategy)
        })

        with open(self.data_file, 'w', encoding='utf-8') as f:
            json.dump(self.history, f, ensure_ascii=False, indent=2)

    def get_progress_report(self, student_id: str) -> dict:
        """Báo cáo tiến bộ + phát hiện sớm nguy cơ."""
        data = self.history.get(student_id, [])
        if not data:
            return {"error": f"Không có dữ liệu cho {student_id}"}

        scores = [d['total_score'] for d in data]
        n = len(scores)

        # Tính xu hướng (linear regression đơn giản)
        if n >= 2:
            x_mean = (n - 1) / 2
            y_mean = sum(scores) / n
            numerator = sum((i - x_mean) * (s - y_mean) for i, s in enumerate(scores))
            denominator = sum((i - x_mean) ** 2 for i in range(n)) or 1
            slope = numerator / denominator
        else:
            slope = 0

        trend = ("📈 Đang tiến bộ tốt" if slope > 1 else
                 "📉 Có dấu hiệu giảm sút" if slope < -1 else "➡️ Ổn định")

        # Cảnh báo sớm
        is_at_risk = (
            scores[-1] < 35 or
            (n >= 3 and all(s < 45 for s in scores[-3:])) or
            slope < -5
        )

        return {
            "student_id": student_id,
            "total_submissions": n,
            "scores_history": scores,
            "current_score": scores[-1],
            "average_score": round(sum(scores) / n, 1),
            "best_score": max(scores),
            "improvement_from_start": scores[-1] - scores[0],
            "trend": trend,
            "slope_per_assignment": round(slope, 2),
            "is_at_risk": is_at_risk,
            "early_warning": "⚠️ CẢNH BÁO: Sinh viên cần được hỗ trợ ngay!" if is_at_risk else None,
            "tier_history": {
                "tier1": [d['tier1'] for d in data],
                "tier2": [d['tier2'] for d in data],
                "tier3": [d['tier3'] for d in data]
            }
        }


# ──────────────────────────────────────────────────────────────────────────────
# PHẦN 7: MAIN PIPELINE
# ──────────────────────────────────────────────────────────────────────────────

class AssessmentPipeline:
    """Pipeline hoàn chỉnh: submission → phân tích → đánh giá → kết quả."""

    def __init__(self, llm_provider: str = "openai"):
        self.static_analyzer = StaticCodeAnalyzer()
        self.test_runner = SafeTestRunner()
        self.git_analyzer = GitHistoryAnalyzer()
        self.llm_evaluator = LLMEvaluator(provider=llm_provider)
        self.tracker = ProficiencyTracker()

    def assess(self, student_id: str, assignment_id: str,
               assignment_description: str, student_code: str,
               test_cases: list, repo_path: Optional[str] = None) -> AssessmentResult:

        print(f"\n{'='*60}")
        print(f"  ĐÁNH GIÁ: {student_id} / {assignment_id}")
        print(f"{'='*60}")

        # Bước 1: Static analysis
        print("  📐 Bước 1: Phân tích tĩnh code...")
        static = self.static_analyzer.analyze(student_code)
        print(f"      Cú pháp: {'✅' if static.syntax_valid else '❌'} | "
              f"Hàm: {static.num_functions} | Pylint: {static.pylint_score:.1f}/10")

        # Bước 2: Run tests
        print("  🧪 Bước 2: Chạy test cases...")
        tests = self.test_runner.run_tests(student_code, test_cases)
        print(f"      Pass rate: {tests.pass_rate:.0%} "
              f"({tests.passed_tests}/{tests.total_tests})")

        # Bước 3: Git history
        print("  📋 Bước 3: Phân tích git history...")
        if repo_path and os.path.exists(repo_path):
            git = self.git_analyzer.analyze(repo_path)
            print(f"      Commits: {git.total_commits} | "
                  f"Thời gian: {git.time_span_hours:.1f}h")
        else:
            git = GitAnalysisResult()
            print("      Không có git repository")

        # Bước 4: LLM evaluation
        print("  🤖 Bước 4: LLM đánh giá theo Rubric 3 tầng...")
        result = self.llm_evaluator.evaluate(
            student_id, assignment_id, assignment_description,
            student_code, static, tests, git
        )

        # Bước 5: Lưu và in kết quả
        self.tracker.save(result)
        self._print_report(result)
        return result

    def _print_report(self, r: AssessmentResult) -> None:
        t1 = r.tier1_syntax_execution + r.tier1_functional_correctness + r.tier1_edge_case_handling
        t2 = r.tier2_naming_readability + r.tier2_comments_documentation + r.tier2_structure_efficiency + r.tier2_idiomatic_code
        t3 = r.tier3_problem_decomposition + r.tier3_abstraction_level + r.tier3_pattern_recognition + r.tier3_debugging_strategy

        print(f"\n{'─'*60}")
        print(f"  📊 KẾT QUẢ ĐÁNH GIÁ — {r.student_id} / {r.assignment_id}")
        print(f"{'─'*60}")
        print(f"  Tầng 1 - Correctness:           {t1:3d} / 40")
        print(f"  Tầng 2 - Code Quality:          {t2:3d} / 35")
        print(f"  Tầng 3 - Computational Thinking:{t3:3d} / 25")
        print(f"  {'─'*35}")
        print(f"  TỔNG ĐIỂM:                      {r.total_score:3d} / 100")
        print(f"  Mức độ: {r.proficiency_level}")
        print(f"\n  ✅ Điểm mạnh:")
        for s in r.strengths: print(f"     • {s}")
        print(f"\n  ⚠️  Cần cải thiện:")
        for w in r.weaknesses: print(f"     • {w}")
        print(f"\n  💡 Gợi ý:")
        for rec in r.specific_recommendations: print(f"     → {rec}")
        print(f"\n  📚 Học tiếp: {r.next_suggested_topic}")
        print(f"{'='*60}\n")


# ──────────────────────────────────────────────────────────────────────────────
# PHẦN 8: DEMO
# ──────────────────────────────────────────────────────────────────────────────

def demo():
    """Demo chạy hệ thống với bài tập và code mẫu."""

    ASSIGNMENT_DESC = """
    Bài tập 03: Tính điểm trung bình và xếp loại
    Viết hàm calculate_grade(scores) nhận list điểm (0-10),
    trả về tuple (average, classification):
    - Xuất sắc (>=9), Giỏi (>=8), Khá (>=6.5), Trung bình (>=5), Yếu (<5)
    Xử lý trường hợp list rỗng (trả về None).
    """

    # Code sinh viên mức Intermediate (có ưu và nhược điểm để demo)
    STUDENT_CODE = '''
def calculate_grade(scores):
    # tính điểm trung bình
    if len(scores) == 0:
        return None
    
    total = 0
    for s in scores:
        total = total + s
    avg = total / len(scores)
    avg = round(avg, 2)
    
    # xếp loại - ngưỡng cố định
    if avg >= 9:
        xep_loai = "Xuất sắc"
    elif avg >= 8:
        xep_loai = "Giỏi"
    elif avg >= 6.5:
        xep_loai = "Khá"
    elif avg >= 5:
        xep_loai = "Trung bình"
    else:
        xep_loai = "Yếu"
    
    return (avg, xep_loai)

# test thử  
print(calculate_grade([8, 9, 7, 8.5]))
'''

    TEST_CASES = [
        {"function_name": "calculate_grade",
         "input": [[8, 9, 7, 8.5]], "expected_output": (8.12, "Giỏi")},
        {"function_name": "calculate_grade",
         "input": [[10, 10, 10]], "expected_output": (10.0, "Xuất sắc")},
        {"function_name": "calculate_grade",
         "input": [[3, 4, 2]], "expected_output": (3.0, "Yếu")},
        {"function_name": "calculate_grade",
         "input": [[]], "expected_output": None},
        {"function_name": "calculate_grade",
         "input": [[5, 6, 7, 8]], "expected_output": (6.5, "Khá")}
    ]

    pipeline = AssessmentPipeline(llm_provider="openai")  # đổi thành "gemini" nếu muốn

    result = pipeline.assess(
        student_id="SV2024001",
        assignment_id="BT03",
        assignment_description=ASSIGNMENT_DESC,
        student_code=STUDENT_CODE,
        test_cases=TEST_CASES,
        repo_path=None
    )

    # Lưu kết quả JSON
    output = {
        "student_id": result.student_id,
        "assignment_id": result.assignment_id,
        "total_score": result.total_score,
        "proficiency_level": result.proficiency_level,
        "tier_scores": {
            "tier1": result.tier1_syntax_execution + result.tier1_functional_correctness + result.tier1_edge_case_handling,
            "tier2": result.tier2_naming_readability + result.tier2_comments_documentation + result.tier2_structure_efficiency + result.tier2_idiomatic_code,
            "tier3": result.tier3_problem_decomposition + result.tier3_abstraction_level + result.tier3_pattern_recognition + result.tier3_debugging_strategy
        },
        "feedback": result.justifications
    }
    with open("assessment_output.json", "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    print("  💾 Kết quả lưu tại: assessment_output.json")

    # Báo cáo tiến bộ
    progress = pipeline.tracker.get_progress_report("SV2024001")
    print(f"\n  📈 BÁO CÁO TIẾN BỘ:")
    print(json.dumps(progress, ensure_ascii=False, indent=2))

    return result


if __name__ == "__main__":
    print("🚀 LLM-Assisted Programming Assessment System v0.1\n")

    api_ok = os.getenv("OPENAI_API_KEY") or os.getenv("GEMINI_API_KEY")
    if not api_ok:
        print("⚠️  Tạo file .env với nội dung:")
        print("   OPENAI_API_KEY=sk-...   (nếu dùng GPT-4)")
        print("   GEMINI_API_KEY=AIza...  (nếu dùng Gemini)")
    else:
        demo()
