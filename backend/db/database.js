import Database from 'better-sqlite3'
import { fileURLToPath } from 'url'
import path from 'path'
import bcrypt from 'bcryptjs'
import fs from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// Production (Render): DATABASE_PATH=/backend/db/skillslab.db (persistent disk)
// Development: local path
const DB_PATH = (() => {
  if (process.env.DATABASE_PATH) return process.env.DATABASE_PATH
  if (process.env.VERCEL) {
    const tmpPath = '/tmp/skillslab.db'
    if (!fs.existsSync(tmpPath)) {
      const srcPath = path.join(__dirname, 'skillslab.db')
      if (fs.existsSync(srcPath)) {
        try {
          fs.copyFileSync(srcPath, tmpPath)
          console.log('✅ Copied template database to /tmp/skillslab.db')
        } catch (e) {
          console.error('⚠️ Failed to copy database to /tmp:', e.message)
        }
      }
    }
    return tmpPath
  }
  return path.join(__dirname, 'skillslab.db')
})()

let db

export function getDb() {
  if (!db) {
    db = new Database(DB_PATH)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    initSchema()
    runMigrations()
  }
  return db
}

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('teacher','student')),
      mssv TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT UNIQUE NOT NULL,
      expires_at TEXT NOT NULL,
      revoked_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash);

    CREATE TABLE IF NOT EXISTS classrooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      lecturer_id INTEGER NOT NULL REFERENCES users(id),
      lang TEXT DEFAULT 'C++',
      semester TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS enrollments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL REFERENCES users(id),
      classroom_id INTEGER NOT NULL REFERENCES classrooms(id),
      enrolled_at TEXT DEFAULT (datetime('now')),
      UNIQUE(student_id, classroom_id)
    );

    CREATE TABLE IF NOT EXISTS assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      classroom_id INTEGER NOT NULL REFERENCES classrooms(id),
      title TEXT NOT NULL,
      description TEXT,
      lang TEXT DEFAULT 'C++',
      deadline TEXT,
      concepts_json TEXT DEFAULT '[]',
      sample_code TEXT DEFAULT '',
      weight_t1 INTEGER DEFAULT 40,
      weight_t2 INTEGER DEFAULT 35,
      weight_t3 INTEGER DEFAULT 25,
      status TEXT DEFAULT 'open' CHECK(status IN ('open','closed')),
      test_cases_json TEXT DEFAULT '[]',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      assignment_id INTEGER NOT NULL REFERENCES assignments(id),
      student_id INTEGER NOT NULL REFERENCES users(id),
      code TEXT NOT NULL,
      attempt_number INTEGER DEFAULT 1,
      score_total INTEGER DEFAULT 0,
      score_t1 INTEGER DEFAULT 0,
      score_t2 INTEGER DEFAULT 0,
      score_t3 INTEGER DEFAULT 0,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending','passed','failed','warning')),
      llm_feedback TEXT,
      ai_suspicion_flag INTEGER DEFAULT 0,
      ai_suspicion_confidence REAL DEFAULT 0,
      ai_suspicion_reason TEXT,
      misconceptions_json TEXT DEFAULT '[]',
      submitted_at TEXT DEFAULT (datetime('now'))
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_submissions_attempt ON submissions(assignment_id, student_id, attempt_number);

    CREATE TABLE IF NOT EXISTS student_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL REFERENCES users(id),
      classroom_id INTEGER NOT NULL REFERENCES classrooms(id),
      mastery_json TEXT DEFAULT '{}',
      overall_score INTEGER DEFAULT 0,
      profile_type TEXT DEFAULT 'on-track',
      risk_score REAL DEFAULT 0,
      trend TEXT DEFAULT 'stable',
      strengths_json TEXT DEFAULT '[]',
      improvements_json TEXT DEFAULT '[]',
      misconceptions_json TEXT DEFAULT '[]',
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(student_id, classroom_id)
    );

    -- Storm v4: AI_Chats
    CREATE TABLE IF NOT EXISTS ai_chats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL REFERENCES users(id),
      assignment_id INTEGER NOT NULL REFERENCES assignments(id),
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(student_id, assignment_id)
    );

    -- Ground Truth & AI Feedback Evaluation table
    CREATE TABLE IF NOT EXISTS feedback_ratings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      submission_id INTEGER NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id),
      user_role TEXT NOT NULL CHECK(user_role IN ('student','teacher')),
      rating INTEGER NOT NULL CHECK(rating IN (1,2,3,4,5)),
      comment TEXT CHECK(comment IS NULL OR length(comment) <= 500),
      helpfulness_category TEXT DEFAULT 'helpful'
        CHECK(helpfulness_category IN ('helpful','incorrect','unclear','too_generic','unsafe')),
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(submission_id, user_id)
    );

    -- Storm v4: AI_Messages
    CREATE TABLE IF NOT EXISTS ai_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id INTEGER NOT NULL REFERENCES ai_chats(id) ON DELETE CASCADE,
      sender TEXT NOT NULL CHECK(sender IN ('student','ai')),
      content TEXT NOT NULL,
      sent_at TEXT DEFAULT (datetime('now'))
    );

    -- Storm v4: Misconceptions
    CREATE TABLE IF NOT EXISTS misconceptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL REFERENCES users(id),
      assignment_id INTEGER NOT NULL REFERENCES assignments(id),
      classroom_id INTEGER NOT NULL,
      concept TEXT NOT NULL,
      description TEXT,
      detected_at TEXT DEFAULT (datetime('now'))
    );
  `)
}

/** Safe migrations */
function runMigrations() {
  const addCol = (table, col, def) => {
    try { db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`) } catch { }
  }
  addCol('assignments', 'sample_code', 'TEXT DEFAULT ""')
  addCol('assignments', 'test_cases_json', 'TEXT DEFAULT "[]"')
  addCol('student_profiles', 'mastery_json', 'TEXT DEFAULT "{}"')
  addCol('feedback_ratings', 'helpfulness_category', "TEXT DEFAULT 'helpful'")

  // Migration for feedback_ratings unique constraint on legacy databases
  try {
    db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_feedback_ratings_sub_user ON feedback_ratings(submission_id, user_id)`)
  } catch (e) {
    console.log('⚠️ Migration idx_feedback_ratings_sub_user skip:', e.message)
  }

  // Backfill misconceptions from submissions
  try {
    const miscCount = db.prepare('SELECT COUNT(*) as c FROM misconceptions').get().c
    if (miscCount === 0) {
      const subs = db.prepare(`
        SELECT s.id, s.student_id, s.assignment_id, s.misconceptions_json, a.classroom_id
        FROM submissions s JOIN assignments a ON s.assignment_id = a.id
        WHERE s.misconceptions_json != '[]' AND s.misconceptions_json IS NOT NULL
      `).all()
      const ins = db.prepare('INSERT OR IGNORE INTO misconceptions (student_id,assignment_id,classroom_id,concept,description) VALUES (?,?,?,?,?)')
      let n = 0
      subs.forEach(s => {
        try {
          JSON.parse(s.misconceptions_json || '[]').forEach(desc => {
            if (!desc || desc === 'Chưa nộp bài') return
            const concept = desc.split('—')[0].replace(/^[🔴⚠️📌⭐💡🚨\s]+/, '').trim().substring(0, 100)
            if (concept.length < 2) return
            ins.run(s.student_id, s.assignment_id, s.classroom_id, concept, desc); n++
          })
        } catch { }
      })
      if (n > 0) console.log(`✅ Backfilled ${n} misconceptions`)
    }
  } catch (e) { console.log('⚠️ Migration skip:', e.message) }
}

// ── Sample codes 15 tuần ─────────────────────────────────────────────────────
const SC = {
  w1:  `#include <iostream>\n#include <cmath>\nusing namespace std;\nint main() {\n    double r;\n    cout << "Nhap ban kinh r: "; cin >> r;\n    double S = M_PI * r * r;\n    cout << "Dien tich hinh tron: " << S << endl;\n    return 0;\n}`,
  w2:  `#include <iostream>\nusing namespace std;\nstring xepLoai(double d) {\n    if (d >= 8.0) return "Gioi";\n    else if (d >= 6.5) return "Kha";\n    else if (d >= 5.0) return "Trung binh";\n    else return "Yeu";\n}\nint main() {\n    double d; cout << "Nhap diem: "; cin >> d;\n    cout << "Hoc luc: " << xepLoai(d) << endl;\n    return 0;\n}`,
  w3:  `#include <iostream>\nusing namespace std;\nint main() {\n    int n; cout << "Nhap n: "; cin >> n;\n    for (int i = 1; i <= n; i++) {\n        for (int j = 1; j <= i; j++) cout << "* ";\n        cout << endl;\n    }\n    return 0;\n}`,
  w4:  `#include <iostream>\nusing namespace std;\nint main() {\n    int n; cin >> n; int a[100];\n    for (int i = 0; i < n; i++) cin >> a[i];\n    int mx = a[0], mn = a[0];\n    for (int i = 1; i < n; i++) {\n        if (a[i] > mx) mx = a[i];\n        if (a[i] < mn) mn = a[i];\n    }\n    cout << "Max: " << mx << endl << "Min: " << mn << endl;\n    return 0;\n}`,
  w5:  `#include <iostream>\nusing namespace std;\nlong long giaiThua(int n) {\n    if (n <= 1) return 1;\n    return n * giaiThua(n - 1);\n}\nint main() {\n    int n; cout << "Nhap n: "; cin >> n;\n    cout << n << "! = " << giaiThua(n) << endl;\n    return 0;\n}`,
  w6:  `#include <iostream>\nusing namespace std;\nvoid sapXep(int a[], int n) {\n    for (int i = 0; i < n-1; i++)\n        for (int j = i+1; j < n; j++)\n            if (a[i] > a[j]) { int t=a[i]; a[i]=a[j]; a[j]=t; }\n}\nint main() {\n    int n, a[100];\n    cout << "Nhap n: "; cin >> n;\n    for (int i = 0; i < n; i++) cin >> a[i];\n    sapXep(a, n);\n    cout << "Mang sau sap xep: ";\n    for (int i = 0; i < n; i++) cout << a[i] << " ";\n    cout << endl; return 0;\n}`,
  w7:  `#include <iostream>\n#include <string>\nusing namespace std;\nint main() {\n    string s; cout << "Nhap chuoi: "; getline(cin, s);\n    int count = 0;\n    for (char c : s)\n        if (c=='a'||c=='e'||c=='i'||c=='o'||c=='u'||\n            c=='A'||c=='E'||c=='I'||c=='O'||c=='U') count++;\n    cout << "So nguyen am: " << count << endl;\n    return 0;\n}`,
  w8:  `#include <iostream>\nusing namespace std;\nbool soNguyenTo(int n) {\n    if (n < 2) return false;\n    for (int i = 2; i*i <= n; i++)\n        if (n % i == 0) return false;\n    return true;\n}\nint main() {\n    int n; cout << "Nhap n: "; cin >> n;\n    cout << "So nguyen to den " << n << ": ";\n    for (int i = 2; i <= n; i++)\n        if (soNguyenTo(i)) cout << i << " ";\n    cout << endl; return 0;\n}`,
  w9:  `#include <iostream>\nusing namespace std;\nint ucln(int a, int b) {\n    while (b) { int t = b; b = a % b; a = t; }\n    return a;\n}\nint main() {\n    int a, b;\n    cout << "Nhap a b: "; cin >> a >> b;\n    int u = ucln(a, b);\n    cout << "UCLN: " << u << endl;\n    cout << "BCNN: " << a/u*b << endl;\n    return 0;\n}`,
  w10: `#include <iostream>\n#include <string>\nusing namespace std;\nstruct SinhVien { string ten; float diem; };\nint main() {\n    int n; cout << "Nhap n: "; cin >> n; cin.ignore();\n    SinhVien sv[100];\n    for (int i = 0; i < n; i++) {\n        cout << "Ten: "; getline(cin, sv[i].ten);\n        cout << "Diem: "; cin >> sv[i].diem; cin.ignore();\n    }\n    float mx = sv[0].diem; string top = sv[0].ten;\n    for (int i = 1; i < n; i++)\n        if (sv[i].diem > mx) { mx = sv[i].diem; top = sv[i].ten; }\n    cout << "SV diem cao nhat: " << top << " (" << mx << ")" << endl;\n    return 0;\n}`,
  w11: `#include <iostream>\nusing namespace std;\nvoid nhap(int* a, int n) { for(int i=0;i<n;i++) cin>>a[i]; }\nint timKiem(int* a, int n, int x) {\n    for(int i=0;i<n;i++) if(a[i]==x) return i;\n    return -1;\n}\nint main() {\n    int n, a[100]; cin >> n; nhap(a, n);\n    int x; cout << "Tim gia tri: "; cin >> x;\n    int kq = timKiem(a, n, x);\n    if (kq >= 0) cout << "Tim thay tai vi tri " << kq << endl;\n    else cout << "Khong tim thay" << endl;\n    return 0;\n}`,
  w12: `#include <iostream>\n#include <fstream>\nusing namespace std;\nint main() {\n    ofstream f("data.txt");\n    int n; cout << "Nhap n: "; cin >> n;\n    for (int i = 1; i <= n; i++) f << i << " ";\n    f.close();\n    ifstream g("data.txt"); int x;\n    cout << "Noi dung file: ";\n    while (g >> x) cout << x << " ";\n    cout << endl; return 0;\n}`,
  w13: `#include <iostream>\nusing namespace std;\nclass HinhChuNhat {\n    double dai, rong;\npublic:\n    HinhChuNhat(double d, double r) : dai(d), rong(r) {}\n    double dienTich() { return dai * rong; }\n    double chuVi() { return 2*(dai+rong); }\n};\nint main() {\n    double d, r;\n    cout << "Dai rong: "; cin >> d >> r;\n    HinhChuNhat h(d, r);\n    cout << "S = " << h.dienTich() << endl;\n    cout << "C = " << h.chuVi() << endl;\n    return 0;\n}`,
  w14: `#include <iostream>\nusing namespace std;\nstruct Node { int val; Node* next; };\nvoid push(Node*& head, int v) {\n    Node* n = new Node{v, head}; head = n;\n}\nvoid print(Node* head) {\n    while(head) { cout << head->val << " "; head = head->next; }\n    cout << endl;\n}\nint main() {\n    Node* head = nullptr;\n    int n, x; cin >> n;\n    for(int i=0;i<n;i++) { cin >> x; push(head, x); }\n    print(head); return 0;\n}`,
  w15: `#include <iostream>\n#include <vector>\n#include <algorithm>\nusing namespace std;\nint main() {\n    int n; cin >> n;\n    vector<int> a(n);\n    for(auto& x : a) cin >> x;\n    sort(a.begin(), a.end());\n    for(int x : a) cout << x << " ";\n    cout << endl; return 0;\n}`,
}

const TC = {
  w1:  [
    { input: '5', expected: 'Dien tich hinh tron: 78.5398', hidden: false },
    { input: '1', expected: 'Dien tich hinh tron: 3.14159', hidden: false },
    { input: '0', expected: 'Dien tich hinh tron: 0', hidden: true },
    { input: '10', expected: 'Dien tich hinh tron: 314.159', hidden: true }
  ],
  w2:  [
    { input: '8.5', expected: 'Hoc luc: Gioi', hidden: false },
    { input: '7', expected: 'Hoc luc: Kha', hidden: false },
    { input: '5', expected: 'Hoc luc: Trung binh', hidden: false },
    { input: '3', expected: 'Hoc luc: Yeu', hidden: false },
    { input: '10.0', expected: 'Hoc luc: Gioi', hidden: true },
    { input: '0.0', expected: 'Hoc luc: Yeu', hidden: true }
  ],
  w3:  [
    { input: '3', expected: '* \n* * \n* * * ', hidden: false },
    { input: '1', expected: '* ', hidden: false },
    { input: '5', expected: '* \n* * \n* * * \n* * * * \n* * * * * ', hidden: true }
  ],
  w4:  [
    { input: '5\n3 1 4 1 5', expected: 'Max: 5\nMin: 1', hidden: false },
    { input: '3\n7 2 9', expected: 'Max: 9\nMin: 2', hidden: false },
    { input: '1\n42', expected: 'Max: 42\nMin: 42', hidden: true },
    { input: '4\n-5 -1 -10 -2', expected: 'Max: -1\nMin: -10', hidden: true }
  ],
  w5:  [
    { input: '5', expected: '5! = 120', hidden: false },
    { input: '0', expected: '0! = 1', hidden: false },
    { input: '10', expected: '10! = 3628800', hidden: true },
    { input: '1', expected: '1! = 1', hidden: true }
  ],
  w6:  [
    { input: '4\n3 1 4 2', expected: 'Mang sau sap xep: 1 2 3 4 ', hidden: false },
    { input: '3\n5 2 8', expected: 'Mang sau sap xep: 2 5 8 ', hidden: false },
    { input: '5\n9 8 7 6 5', expected: 'Mang sau sap xep: 5 6 7 8 9 ', hidden: true }
  ],
  w7:  [
    { input: 'Hello World', expected: 'So nguyen am: 3', hidden: false },
    { input: 'aeiou', expected: 'So nguyen am: 5', hidden: false },
    { input: 'bcdfg', expected: 'So nguyen am: 0', hidden: true }
  ],
  w8:  [
    { input: '10', expected: 'So nguyen to den 10: 2 3 5 7 ', hidden: false },
    { input: '20', expected: 'So nguyen to den 20: 2 3 5 7 11 13 17 19 ', hidden: false },
    { input: '2', expected: 'So nguyen to den 2: 2 ', hidden: true }
  ],
  w9:  [
    { input: '12 18', expected: 'UCLN: 6\nBCNN: 36', hidden: false },
    { input: '5 7', expected: 'UCLN: 1\nBCNN: 35', hidden: false },
    { input: '100 25', expected: 'UCLN: 25\nBCNN: 100', hidden: true }
  ],
  w10: [
    { input: '2\nAn\n9.0\nBinh\n8.5', expected: 'SV diem cao nhat: An (9)', hidden: true }
  ],
  w11: [
    { input: '5\n3 7 2 8 1\n7', expected: 'Tim thay tai vi tri 1', hidden: false },
    { input: '4\n1 2 3 4\n9', expected: 'Khong tim thay', hidden: false },
    { input: '3\n10 20 30\n10', expected: 'Tim thay tai vi tri 0', hidden: true }
  ],
  w12: [
    { input: '5', expected: 'Noi dung file: 1 2 3 4 5 ', hidden: true }
  ],
  w13: [
    { input: '4 5', expected: 'S = 20\nC = 18', hidden: false },
    { input: '10 10', expected: 'S = 100\nC = 40', hidden: true }
  ],
  w14: [
    { input: '3\n10 20 30', expected: '30 20 10 ', hidden: true }
  ],
  w15: [
    { input: '5\n3 1 4 1 5', expected: '1 1 3 4 5 ', hidden: false },
    { input: '3\n7 2 8', expected: '2 7 8 ', hidden: false },
    { input: '4\n100 -50 0 25', expected: '-50 0 25 100 ', hidden: true }
  ],
}


const ASGN_15 = [
  { title:'Tuần 1: Biến & Nhập xuất',        desc:'Tính diện tích hình tròn. Nhập r, xuất S=π×r².', cons:'["Variables","I/O","Arithmetic"]', wk:'w1', st:'closed', dl:'2026-02-23T23:59' },
  { title:'Tuần 2: Câu lệnh Rẽ nhánh',       desc:'Phân loại học lực Giỏi/Khá/TB/Yếu bằng if-else if.', cons:'["Conditionals","Boolean Logic","Functions"]', wk:'w2', st:'closed', dl:'2026-03-02T23:59' },
  { title:'Tuần 3: Vòng lặp & In hình',       desc:'In hình tam giác sao n hàng bằng for lồng nhau.', cons:'["Loops","Nested Loops","Pattern Printing"]', wk:'w3', st:'closed', dl:'2026-03-09T23:59' },
  { title:'Tuần 4: Mảng 1 chiều',             desc:'Nhập mảng n phần tử. Tìm Max và Min.', cons:'["Arrays","Loops","Linear Search"]', wk:'w4', st:'closed', dl:'2026-03-16T23:59' },
  { title:'Tuần 5: Hàm & Đệ quy',            desc:'Hàm đệ quy tính n! (long long). Kiểm tra base case.', cons:'["Functions","Recursion","Base Case"]', wk:'w5', st:'closed', dl:'2026-03-23T23:59' },
  { title:'Tuần 6: Sắp xếp mảng (Bubble)',   desc:'Tự viết Bubble Sort, không dùng sort().', cons:'["Functions","Arrays","Sorting Algorithm","Loops"]', wk:'w6', st:'closed', dl:'2026-03-30T23:59' },
  { title:'Tuần 7: Xử lý chuỗi',             desc:'Đếm nguyên âm trong chuỗi nhập từ bàn phím.', cons:'["String Manipulation","Loops","I/O"]', wk:'w7', st:'closed', dl:'2026-04-06T23:59' },
  { title:'Tuần 8: Số nguyên tố',             desc:'Liệt kê số nguyên tố ≤ n. Viết hàm kiểm tra isPrime.', cons:'["Functions","Loops","Boolean Logic"]', wk:'w8', st:'closed', dl:'2026-04-13T23:59' },
  { title:'Tuần 9: ƯCLN & BCNN (Euclid)',    desc:'Tính ƯCLN và BCNN bằng thuật toán Euclid đệ quy.', cons:'["Functions","Recursion","Arithmetic"]', wk:'w9', st:'closed', dl:'2026-04-20T23:59' },
  { title:'Tuần 10: Struct & Mảng SV',        desc:'Nhập n sinh viên (tên, điểm). Tìm SV điểm cao nhất.', cons:'["OOP","Arrays","I/O","Conditionals"]', wk:'w10', st:'closed', dl:'2026-04-27T23:59' },
  { title:'Tuần 11: Con trỏ & Tìm kiếm',     desc:'Dùng con trỏ. Tìm kiếm tuần tự trong mảng.', cons:'["Pointers","Linear Search","Functions"]', wk:'w11', st:'closed', dl:'2026-05-04T23:59' },
  { title:'Tuần 12: File I/O',                desc:'Ghi dãy 1..n vào file. Đọc lại và in ra màn hình.', cons:'["I/O","Loops","Memory"]', wk:'w12', st:'closed', dl:'2026-05-11T23:59' },
  { title:'Tuần 13: Lập trình OOP cơ bản',   desc:'Class HinhChuNhat với constructor, diện tích và chu vi.', cons:'["OOP","Functions","Variables"]', wk:'w13', st:'closed', dl:'2026-05-18T23:59' },
  { title:'Tuần 14: Danh sách liên kết',      desc:'Linked list đơn: thêm phần tử đầu, in toàn bộ.', cons:'["Pointers","Memory","Functions","Recursion"]', wk:'w14', st:'closed', dl:'2026-05-25T23:59' },
  { title:'Tuần 15: Tổng hợp & Thi cuối kỳ', desc:'Dùng vector<int> và sort(). Tổng hợp toàn bộ kiến thức.', cons:'["Arrays","Sorting Algorithm","Functions","Loops"]', wk:'w15', st:'closed', dl:'2026-06-01T23:59' },
]

export async function seedDatabase() {
  const d = getDb()
  const existing = d.prepare('SELECT COUNT(*) as c FROM users').get()
  if (existing.c > 0) {
    const asgnList = d.prepare('SELECT id FROM assignments ORDER BY id').all()
    asgnList.forEach((a, i) => {
      const wk = `w${i+1}`
      const cur = d.prepare('SELECT sample_code, test_cases_json FROM assignments WHERE id=?').get(a.id)
      if (!cur?.sample_code && SC[wk]) d.prepare('UPDATE assignments SET sample_code=? WHERE id=?').run(SC[wk], a.id)
      if ((!cur?.test_cases_json || cur.test_cases_json === '[]') && TC[wk])
        d.prepare('UPDATE assignments SET test_cases_json=? WHERE id=?').run(JSON.stringify(TC[wk]), a.id)
    })
    return console.log('✅ Database already seeded. Codes & test cases updated.')
  }

  console.log('🌱 Seeding — 15 tuần · 10 SV · 1 lớp...')
  const h = p => bcrypt.hashSync(p, 10)
  const iU = d.prepare('INSERT INTO users (email,password_hash,name,role,mssv) VALUES (?,?,?,?,?)')

  const teacher = iU.run('teacher@neu.edu.vn', h('teacher123'), 'TS. Nguyễn Minh Đức', 'teacher', null).lastInsertRowid

  const svs = [
    iU.run('an@neu.edu.vn',    h('student123'), 'Nguyễn Văn An',   'student', '11201001').lastInsertRowid,
    iU.run('tuan@neu.edu.vn',  h('student123'), 'Lê Minh Tuấn',    'student', '11201002').lastInsertRowid,
    iU.run('binh@neu.edu.vn',  h('student123'), 'Trần Thị Bình',   'student', '11201003').lastInsertRowid,
    iU.run('son@neu.edu.vn',   h('student123'), 'Phạm Hồng Sơn',   'student', '11201004').lastInsertRowid,
    iU.run('linh@neu.edu.vn',  h('student123'), 'Nguyễn Thu Linh', 'student', '11201005').lastInsertRowid,
    iU.run('hung@neu.edu.vn',  h('student123'), 'Đặng Quốc Hùng',  'student', '11201006').lastInsertRowid,
    iU.run('mai@neu.edu.vn',   h('student123'), 'Vũ Thị Mai',      'student', '11201007').lastInsertRowid,
    iU.run('long@neu.edu.vn',  h('student123'), 'Bùi Đức Long',    'student', '11201008').lastInsertRowid,
    iU.run('huong@neu.edu.vn', h('student123'), 'Lê Thị Hương',    'student', '11201009').lastInsertRowid,
    iU.run('khoa@neu.edu.vn',  h('student123'), 'Trần Minh Khoa',  'student', '11201010').lastInsertRowid,
  ]
  const [sv0,sv1,sv2,sv3,sv4,sv5,sv6,sv7,sv8,sv9] = svs

  const cid = d.prepare('INSERT INTO classrooms (name,description,lecturer_id,lang,semester) VALUES (?,?,?,?,?)').run(
    'LTCB-2026A', 'Lập trình Căn bản C++ — Sinh viên Kinh tế năm 1 (10 SV demo, đại diện 80 SV)', teacher, 'C++', 'HK1 2026'
  ).lastInsertRowid

  svs.forEach(sid => d.prepare('INSERT OR IGNORE INTO enrollments (student_id,classroom_id) VALUES (?,?)').run(sid, cid))

  const iA = d.prepare('INSERT INTO assignments (classroom_id,title,description,lang,deadline,concepts_json,sample_code,weight_t1,weight_t2,weight_t3,status,test_cases_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
  const aids = ASGN_15.map(a =>
    iA.run(cid, a.title, a.desc, 'C++', a.dl, a.cons, SC[a.wk]||'', 40, 35, 25, a.st, JSON.stringify(TC[a.wk]||[])).lastInsertRowid
  )

  const iS = d.prepare(`INSERT INTO submissions
    (assignment_id,student_id,code,attempt_number,score_total,score_t1,score_t2,score_t3,
     status,llm_feedback,ai_suspicion_flag,ai_suspicion_confidence,ai_suspicion_reason,misconceptions_json,submitted_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)

  const sub = (wi, sid, t1, t2, t3, code, fb, at, dt, mis='[]', aiF=0, aiC=0.05, aiR='') => {
    if (!code && at === 0) return
    // Demo history must not pretend students submitted the instructor's exact answer.
    if (code && code === SC[`w${wi + 1}`]) code = `${code}\n// Demo submission variant`
    const total = t1+t2+t3
    iS.run(aids[wi], sid, code||'', at, total, t1, t2, t3,
      total >= 70 ? 'passed' : total >= 50 ? 'warning' : 'failed',
      fb, aiF, aiC, aiR, mis, dt)
  }

  // ── SV0: Nguyễn Văn An — ADVANCED ──────────────────────────────────────────
  sub(0,sv0,38,33,24,SC.w1,'✅ Code sạch, đặt tên biến chuẩn. Có prompt nhập liệu.',1,'2026-02-22T08:30:00Z')
  sub(1,sv0,37,32,23,SC.w2,'✅ Logic if-else if chuẩn xác.',1,'2026-03-01T09:00:00Z')
  sub(2,sv0,38,32,24,SC.w3,'✅ Nested loop đúng.',1,'2026-03-08T08:45:00Z')
  sub(3,sv0,37,32,23,SC.w4,'✅ Duyệt mảng tốt, khởi tạo max=a[0].',1,'2026-03-15T10:00:00Z')
  sub(4,sv0,38,33,24,SC.w5,'✅ Hàm đệ quy base case đúng.',1,'2026-03-22T14:20:00Z')
  sub(5,sv0,39,33,24,SC.w6,'✅ Bubble sort tối ưu!',1,'2026-03-29T09:00:00Z')
  sub(6,sv0,37,32,23,SC.w7,'✅ Xử lý chuỗi tốt.',1,'2026-04-05T09:30:00Z')
  sub(7,sv0,38,32,24,SC.w8,'✅ isPrime đúng, hiệu quả.',1,'2026-04-12T10:00:00Z')
  sub(8,sv0,38,33,24,SC.w9,'✅ Euclid đệ quy chuẩn.',1,'2026-04-19T09:15:00Z')
  sub(9,sv0,37,31,23,SC.w10,'✅ Struct và mảng SV đúng.',1,'2026-04-26T09:00:00Z')
  sub(10,sv0,38,32,23,SC.w11,'✅ Con trỏ và tìm kiếm đúng.',1,'2026-05-03T10:30:00Z')
  sub(11,sv0,36,31,22,SC.w12,'✅ File I/O hoạt động tốt.',1,'2026-05-10T09:00:00Z')
  sub(12,sv0,38,33,24,SC.w13,'✅ OOP class đầy đủ.',1,'2026-05-17T09:00:00Z')
  sub(13,sv0,36,31,22,SC.w14,'✅ Linked list đúng.',1,'2026-05-24T09:00:00Z')

  // ── SV1: Lê Minh Tuấn — AT-RISK (nhiều lỗi, bỏ bài) ──────────────────────
  sub(0,sv1,26,22,18,'#include<iostream>\nusing namespace std;\nint main(){int a,b;cin>>a>>b;cout<<a*b;return 0;}','⚠️ Đúng nhưng thiếu prompt.',2,'2026-02-22T09:12:00Z')
  sub(1,sv1,18,16,14,'#include<iostream>\nusing namespace std;\nint main(){double d;cin>>d;if(d>=8)cout<<"GIOI";if(d>=6.5)cout<<"KHA";if(d>=5)cout<<"TB";else cout<<"YEU";return 0;}','⚠️ Nhiều if độc lập → in nhiều kết quả cùng lúc.',5,'2026-03-01T10:45:00Z','["Dùng nhiều if độc lập thay vì if-else chain"]')
  sub(2,sv1,10,8,7,'#include<iostream>\nusing namespace std;\nint main(){int n;cin>>n;int i=1;while(i<=n){cout<<"*";}return 0;}','🔴 Vòng lặp while thiếu i++ → chạy vô hạn.',18,'2026-03-09T15:30:00Z','["Vòng lặp vô hạn — thiếu lệnh cập nhật biến"]')
  sub(3,sv1,5,4,3,'#include<iostream>\nusing namespace std;\nint main(){int n;cin>>n;int a[10];for(int i=0;i<=n;i++)cin>>a[i];}','❌ Buffer overflow + off-by-one.',6,'2026-03-16T09:30:00Z','["Off-by-one: dùng i<=n","Buffer overflow: mảng khai báo quá nhỏ"]')
  sub(5,sv1,8,7,5,'#include<iostream>\nusing namespace std;\nint main(){int n;cin>>n;return 0;}','❌ Thiếu code sắp xếp.',3,'2026-03-30T22:00:00Z','["Thiếu cài đặt thuật toán sắp xếp"]')

  // ── SV2: Trần Thị Bình — ON-TRACK ─────────────────────────────────────────
  sub(0,sv2,34,29,22,'#include<iostream>\nusing namespace std;\nint main(){double d,r;cout<<"Dai: ";cin>>d;cout<<"Rong: ";cin>>r;cout<<"S = "<<d*r;}','✅ Có prompt.',1,'2026-02-22T08:45:00Z')
  sub(1,sv2,32,28,21,'#include<iostream>\nusing namespace std;\nint main(){int n;cin>>n;if(n%2==0)cout<<n<<" chan";else cout<<n<<" le";}','✅ if-else đúng.',1,'2026-03-01T09:20:00Z')
  sub(2,sv2,28,24,18,'#include<iostream>\nusing namespace std;\nint main(){for(int i=1;i<=10;i++)cout<<"2 x "<<i<<" = "<<2*i<<endl;}','✅ Vòng lặp đơn tốt.',3,'2026-03-08T09:10:00Z')
  sub(3,sv2,26,22,17,'#include<iostream>\nusing namespace std;\nint main(){int n;cin>>n;int a[100];for(int i=0;i<n;i++)cin>>a[i];int s=0;for(int i=0;i<n;i++)s+=a[i];cout<<s;}','✅ Fix off-by-one lần 4.',4,'2026-03-16T11:15:00Z','["Off-by-one: i<=n thay vì i<n (lần 1-3)"]')
  sub(4,sv2,28,24,18,SC.w5,'✅ Hàm đúng.',2,'2026-03-22T15:10:00Z')
  sub(5,sv2,30,26,20,SC.w6,'✅ Tổng hợp tốt.',2,'2026-03-29T10:00:00Z')
  sub(6,sv2,29,25,19,SC.w7,'✅ Đếm nguyên âm đúng.',1,'2026-04-05T09:00:00Z')
  sub(7,sv2,30,26,19,SC.w8,'✅ Số nguyên tố đúng.',2,'2026-04-12T09:30:00Z')
  sub(8,sv2,31,27,20,SC.w9,'✅ Euclid đúng.',1,'2026-04-19T10:00:00Z')
  sub(9,sv2,28,23,18,SC.w10,'✅ Struct tốt.',2,'2026-04-26T10:30:00Z')
  sub(10,sv2,30,25,19,SC.w11,'✅ Tìm kiếm đúng.',1,'2026-05-03T09:00:00Z')
  sub(11,sv2,28,24,18,SC.w12,'✅ File I/O OK.',2,'2026-05-10T10:00:00Z')
  sub(12,sv2,30,26,20,SC.w13,'✅ OOP cơ bản đúng.',1,'2026-05-17T10:00:00Z')
  sub(13,sv2,26,22,17,SC.w14,'⚠️ Linked list hoạt động.',3,'2026-05-24T10:00:00Z','["Con trỏ NULL chưa kiểm tra"]')

  // ── SV3: Phạm Hồng Sơn — AI-WARNING ───────────────────────────────────────
  sub(0,sv3,35,30,22,SC.w1,'✅ Đúng.',1,'2026-02-22T08:50:00Z')
  sub(1,sv3,33,28,21,SC.w2,'✅ Nhất quán.',2,'2026-03-01T09:32:00Z')
  sub(2,sv3,30,26,20,'#include<vector>\n#include<algorithm>\nvoid print(std::vector<int>&v){std::sort(v.begin(),v.end(),[](int a,int b){return a<b;});for(const auto&x:v)std::cout<<x<<" ";}','⚠️ vector+lambda+auto C++11 vượt xa trình độ.',1,'2026-03-09T19:30:00Z','["Dùng vector+lambda+auto C++11 chưa học"]',1,0.88,'vector+lambda+auto chưa học')
  sub(3,sv3,28,24,19,'int bs(int a[],int l,int r,int x){while(l<=r){int m=l+(r-l)/2;if(a[m]==x)return m;if(a[m]<x)l=m+1;else r=m-1;}return -1;}','⚠️ Binary search overflow-safe bất thường.',1,'2026-03-16T22:15:00Z','["Binary search overflow-safe bất thường"]',1,0.92,'Binary search không phổ biến với SV năm 1')
  sub(4,sv3,30,26,20,'bool isPrime(int n){if(n<2)return false;if(n<3)return true;if(n%2==0||n%3==0)return false;for(int i=5;i*i<=n;i+=6)if(n%i==0||n%(i+2)==0)return false;return true;}','⚠️ isPrime bước 6 quá tinh vi.',1,'2026-03-22T08:00:00Z','["isPrime tối ưu bước 6 bất thường với SV năm 1"]',1,0.90,'Sieve-optimized isPrime')
  sub(5,sv3,32,28,21,SC.w6,'✅ Bình thường hơn.',1,'2026-03-29T09:30:00Z')
  sub(6,sv3,30,26,19,SC.w7,'✅ OK.',1,'2026-04-06T09:00:00Z')
  sub(7,sv3,32,27,21,SC.w8,'✅ Đúng.',1,'2026-04-13T09:00:00Z')
  sub(8,sv3,33,28,21,SC.w9,'✅ Euclid đúng.',1,'2026-04-20T09:00:00Z')
  sub(9,sv3,31,26,20,SC.w10,'✅ Struct đúng.',1,'2026-04-27T09:00:00Z')
  sub(10,sv3,30,26,19,SC.w11,'✅ Tìm kiếm OK.',1,'2026-05-03T09:30:00Z')

  // ── SV4: Nguyễn Thu Linh — IMPROVING ──────────────────────────────────────
  sub(0,sv4,18,15,12,'#include<iostream>\nusing namespace std;\nint main(){int r;cin>>r;cout<<3.14*r*r;}','⚠️ Dùng 3.14 thay M_PI.',3,'2026-02-23T22:00:00Z','["Dùng hằng số xấp xỉ thay M_PI"]')
  sub(1,sv4,22,18,15,'#include<iostream>\nusing namespace std;\nint main(){float d;cin>>d;if(d>=8)cout<<"Gioi";else if(d>=6.5)cout<<"Kha";else cout<<"TB";}','⚠️ Thiếu nhánh Yếu.',2,'2026-03-02T21:00:00Z','["Thiếu nhánh Yếu trong phân loại điểm"]')
  sub(2,sv4,26,22,17,'#include<iostream>\nusing namespace std;\nint main(){int n;cin>>n;for(int i=1;i<=n;i++){for(int j=1;j<=i;j++)cout<<"*";cout<<endl;}}','⚠️ Thiếu dấu cách sau *.',2,'2026-03-09T20:00:00Z')
  sub(3,sv4,28,24,18,SC.w4,'✅ Đúng sau 4 lần thử.',4,'2026-03-17T10:00:00Z')
  sub(4,sv4,30,25,19,SC.w5,'✅ Đệ quy đúng.',2,'2026-03-23T09:00:00Z')
  sub(5,sv4,31,27,20,SC.w6,'✅ Sắp xếp đúng.',1,'2026-03-30T10:00:00Z')
  sub(6,sv4,32,27,20,SC.w7,'✅ Tốt hơn nhiều.',1,'2026-04-06T09:30:00Z')
  sub(7,sv4,33,28,21,SC.w8,'✅ Đúng.',1,'2026-04-13T10:00:00Z')
  sub(8,sv4,34,29,22,SC.w9,'✅ Rất tốt!',1,'2026-04-20T09:00:00Z')
  sub(9,sv4,33,28,21,SC.w10,'✅ Struct đúng.',1,'2026-04-27T09:30:00Z')
  sub(10,sv4,34,29,22,SC.w11,'✅ Con trỏ đúng.',1,'2026-05-03T10:00:00Z')

  // ── SV5: Đặng Quốc Hùng — ON-TRACK ────────────────────────────────────────
  const dates5 = ['2026-02-22','2026-03-01','2026-03-08','2026-03-15','2026-03-22','2026-03-29','2026-04-05','2026-04-12','2026-04-19','2026-04-26','2026-05-03','2026-05-10','2026-05-17','2026-05-24']
  const codes5 = [SC.w1,SC.w2,SC.w3,SC.w4,SC.w5,SC.w6,SC.w7,SC.w8,SC.w9,SC.w10,SC.w11,SC.w12,SC.w13,SC.w14]
  dates5.forEach((dt,i) => sub(i,sv5,28,24,18,codes5[i],'✅ Đúng yêu cầu. Code đủ dùng.',1,dt+'T09:00:00Z'))

  // ── SV6: Vũ Thị Mai — AT-RISK (nhiều bài sai/không nộp) ───────────────────
  sub(0,sv6,20,17,13,'#include<iostream>\nusing namespace std;\nint main(){double r;cin>>r;cout<<r*r;}','❌ Quên M_PI, không có prompt.',4,'2026-02-23T23:00:00Z','["Thiếu công thức: quên nhân PI"]')
  sub(1,sv6,15,13,10,'#include<iostream>\nusing namespace std;\nint main(){int n;cin>>n;if(n>5)cout<<"lon";else cout<<"nho";}','❌ Logic hoàn toàn sai với yêu cầu.',6,'2026-03-03T22:00:00Z','["Hiểu sai yêu cầu bài toán"]')
  sub(4,sv6,12,10,8,'#include<iostream>\nusing namespace std;\nint main(){int n;cin>>n;cout<<n;}','❌ Không tính giai thừa.',8,'2026-03-24T23:00:00Z','["Thiếu thuật toán tính giai thừa"]')
  sub(7,sv6,14,12,9,'#include<iostream>\nusing namespace std;\nint main(){int n;cin>>n;for(int i=2;i<=n;i++)cout<<i<<" ";}','❌ Liệt kê tất cả không phải nguyên tố.',5,'2026-04-14T23:00:00Z','["Không kiểm tra tính nguyên tố"]')

  // ── SV7: Bùi Đức Long — ADVANCED (top student) ─────────────────────────────
  const dates7 = ['2026-02-21','2026-03-01','2026-03-07','2026-03-14','2026-03-21','2026-03-28','2026-04-04','2026-04-11','2026-04-18','2026-04-25','2026-05-02','2026-05-09','2026-05-16','2026-05-23']
  const codes7 = [SC.w1,SC.w2,SC.w3,SC.w4,SC.w5,SC.w6,SC.w7,SC.w8,SC.w9,SC.w10,SC.w11,SC.w12,SC.w13,SC.w14]
  dates7.forEach((dt,i) => sub(i,sv7,38,32,23,codes7[i],'✅ Xuất sắc! Comment rõ ràng, đặt tên chuẩn.',1,dt+'T08:30:00Z'))

  // ── SV8: Lê Thị Hương — DECLINING (đầu tốt, sau sa sút) ───────────────────
  sub(0,sv8,35,30,22,SC.w1,'✅ Tốt.',1,'2026-02-22T09:00:00Z')
  sub(1,sv8,33,28,21,SC.w2,'✅ Tốt.',1,'2026-03-01T09:00:00Z')
  sub(2,sv8,32,27,20,SC.w3,'✅ Khá.',1,'2026-03-08T09:00:00Z')
  sub(3,sv8,22,18,15,'#include<iostream>\nusing namespace std;\nint main(){int n;cin>>n;int a[100];for(int i=0;i<=n;i++)cin>>a[i];int m=a[0];for(int i=1;i<=n;i++)if(a[i]>m)m=a[i];cout<<m;}','⚠️ Off-by-one nghiêm trọng.',4,'2026-03-17T22:00:00Z','["Off-by-one: i<=n liên tục"]')
  sub(4,sv8,15,12,10,'#include<iostream>\nusing namespace std;\nlong long gt(int n){return n*gt(n-1);}int main(){int n;cin>>n;cout<<gt(n);}','🔴 Đệ quy thiếu base case → stack overflow!',7,'2026-03-24T23:00:00Z','["Thiếu base case đệ quy → stack overflow"]')
  sub(5,sv8,10,8,7,'#include<iostream>\nusing namespace std;\nint main(){int n;cin>>n;}','❌ Thiếu thuật toán sắp xếp hoàn toàn.',10,'2026-04-01T23:00:00Z','["Bỏ qua yêu cầu sắp xếp"]')

  // ── SV9: Trần Minh Khoa — ON-TRACK ─────────────────────────────────────────
  const dates9 = ['2026-02-22','2026-03-01','2026-03-08','2026-03-15','2026-03-22','2026-03-29','2026-04-05','2026-04-12','2026-04-19','2026-04-26','2026-05-03','2026-05-10']
  const codes9 = [SC.w1,SC.w2,SC.w3,SC.w4,SC.w5,SC.w6,SC.w7,SC.w8,SC.w9,SC.w10,SC.w11,SC.w12]
  dates9.forEach((dt,i) => sub(i,sv9,27+Math.floor(i/4),23+Math.floor(i/5),18+Math.floor(i/6),codes9[i],'✅ Đúng yêu cầu.',1+(i%3===0?1:0),dt+'T10:00:00Z'))

  // ── Student Profiles ────────────────────────────────────────────────────────
  const iP = d.prepare(`INSERT OR REPLACE INTO student_profiles
    (student_id,classroom_id,mastery_json,overall_score,profile_type,risk_score,trend,
     strengths_json,improvements_json,misconceptions_json) VALUES (?,?,?,?,?,?,?,?,?,?)`)

  iP.run(sv0,cid,JSON.stringify({Variables:96,IO:93,Conditionals:91,Loops:93,Arrays:91,Functions:94,Recursion:93,Sorting:91,Strings:88,OOP:87,Pointers:85,Memory:84,LinkedList:83}),
    94,'advanced',0.04,'stable','["Đặt tên chuẩn","Đệ quy tốt","Logic rẽ nhánh tối ưu","Tất cả 14 bài passed"]','["Thêm comment","Thử bài nâng cao"]','[]')

  iP.run(sv1,cid,JSON.stringify({Variables:72,IO:68,Conditionals:55,Loops:28,Arrays:12,Functions:0,Recursion:0}),
    35,'at-risk',0.90,'declining','["Kiên trì thử nhiều lần","Hiểu biến cơ bản"]','["Ôn vòng lặp NGAY","Chưa học Arrays/Functions"]',
    '["Vòng lặp vô hạn","Off-by-one","Nhiều if độc lập","Buffer overflow"]')

  iP.run(sv2,cid,JSON.stringify({Variables:88,IO:86,Conditionals:83,Loops:75,Arrays:72,Functions:74,Recursion:70,Sorting:72,Strings:75,OOP:70,Pointers:68,Memory:65,LinkedList:62}),
    78,'on-track',0.2,'improving','["Tiến bộ đều","if-else đúng","Xử lý chuỗi tốt","Linked list nộp đúng"]','["Off-by-one vẫn xảy ra","Con trỏ cần ôn"]',
    '["Off-by-one: i<=n (3 lần)","Con trỏ NULL chưa kiểm tra"]')

  iP.run(sv3,cid,JSON.stringify({Variables:88,IO:85,Conditionals:83,Loops:80,Arrays:85,Functions:72,Recursion:68,Sorting:72,Strings:75,OOP:72,Pointers:70}),
    83,'ai-warning',0.42,'stable','["Điểm số cao"]','["Cần phỏng vấn trực tiếp","Xác minh code tự viết"]',
    '["AI-generated: vector+lambda tuần 3","Binary search tối ưu tuần 4","isPrime bước 6 tuần 5"]')

  iP.run(sv4,cid,JSON.stringify({Variables:72,IO:70,Conditionals:68,Loops:78,Arrays:80,Functions:82,Recursion:80,Sorting:83,Strings:84,OOP:83,Pointers:85}),
    80,'on-track',0.18,'improving','["Tiến bộ vượt bậc từ tuần 4","Điểm tăng đều"]','["Chú ý công thức toán","Cần thêm prompt nhập liệu"]',
    '["Dùng hằng số xấp xỉ thay M_PI","Thiếu nhánh điều kiện"]')

  iP.run(sv5,cid,JSON.stringify({Variables:84,IO:82,Conditionals:80,Loops:82,Arrays:80,Functions:80,Recursion:78,Sorting:80,Strings:80,OOP:78,Memory:76,LinkedList:75}),
    73,'on-track',0.25,'stable','["Ổn định đều đặn 14 bài"]','["Cần thêm comment","Chưa thử bài nâng cao"]','[]')

  iP.run(sv6,cid,JSON.stringify({Variables:52,IO:48,Conditionals:32,Loops:18,Arrays:0,Functions:0,Recursion:0}),
    22,'at-risk',0.94,'declining','["Có đến lớp"]','["Cần hỗ trợ ngay lập tức","Hiểu sai bài toán nhiều lần","Nhiều bài không nộp"]',
    '["Thiếu PI","Logic sai yêu cầu","Không cài thuật toán","Không phân biệt nguyên tố"]')

  iP.run(sv7,cid,JSON.stringify({Variables:97,IO:95,Conditionals:93,Loops:95,Arrays:93,Functions:96,Recursion:94,Sorting:93,Strings:91,OOP:92,Pointers:90,Memory:89,LinkedList:88}),
    96,'advanced',0.03,'stable','["Code chất lượng cao","Comment đầy đủ","Tất cả 14 bài xuất sắc"]','["Thách thức bài nâng cao hơn"]','[]')

  iP.run(sv8,cid,JSON.stringify({Variables:88,IO:85,Conditionals:83,Loops:55,Arrays:48,Functions:38,Recursion:22,Sorting:15}),
    56,'on-track',0.58,'declining','["Tuần 1-3 tốt"]','["Sa sút rõ từ tuần 4","Off-by-one lặp lại","Thiếu base case đệ quy"]',
    '["Off-by-one liên tục","Thiếu base case đệ quy","Bỏ qua yêu cầu sắp xếp"]')

  iP.run(sv9,cid,JSON.stringify({Variables:84,IO:82,Conditionals:80,Loops:81,Arrays:80,Functions:79,Recursion:77,Sorting:79,Strings:78,OOP:75,Pointers:72,Memory:70}),
    74,'on-track',0.23,'stable','["Đều đặn 12 bài","Đúng yêu cầu"]','["Cần cải thiện tốc độ nộp","Thêm comment"]','[]')

  console.log('✅ Seed hoàn tất! 10 SV · 1 lớp · 15 bài tập (tuần 1-15) · Test cases đầy đủ')
  console.log('   📊 Profiles: 2 advanced · 2 at-risk · 4 on-track · 1 ai-warning · 1 declining')
}
