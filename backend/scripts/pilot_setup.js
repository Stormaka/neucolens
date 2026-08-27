#!/usr/bin/env node
/**
 * Pilot setup — tạo lớp pilot + 15 SV + 3 bài tập pilot
 * Usage:
 *   node backend/scripts/pilot_setup.js --class PILOT-2026 --students 15
 *   DATABASE_PATH=/tmp/pilot.db JWT_SECRET=... node backend/scripts/pilot_setup.js
 */
import bcrypt from 'bcryptjs'
import { getDb, seedDatabase } from '../db/database.js'

const args = {}
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i]
  if (a.startsWith('--')) {
    const [k, v] = a.slice(2).split('=')
    if (v !== undefined) args[k] = v
    else {
      const next = process.argv[i + 1]
      if (next && !next.startsWith('--')) { args[k] = next; i++ }
      else args[k] = true
    }
  }
}
const className = args.class || args.c || 'PILOT-2026'
const nStudents = Number(args.students || args.n || 15)
const teacherEmail = args.teacher || 'teacher@neu.edu.vn'

const db = getDb()
await seedDatabase()
const teacher = db.prepare("SELECT id FROM users WHERE email=? AND role='teacher'").get(teacherEmail)
if (!teacher) {
  console.error(`❌ Không tìm thấy GV ${teacherEmail}. Hãy seed DB trước (SEED_DEMO_DATA=true) hoặc tạo GV thủ công.`)
  process.exit(1)
}
let classroom = db.prepare('SELECT id FROM classrooms WHERE name=?').get(className)
if (!classroom) {
  const r = db.prepare('INSERT INTO classrooms (name, description, lecturer_id, lang, semester) VALUES (?,?,?,?,?)')
    .run(className, 'Pilot Study — 4 tuần, 15 SV', teacher.id, 'C++', 'Pilot 2026')
  classroom = { id: r.lastInsertRowid }
  console.log(`✅ Tạo lớp ${className} id=${classroom.id}`)
} else console.log(`ℹ️ Lớp ${className} đã tồn tại id=${classroom.id}`)

const hash = bcrypt.hashSync('Pilot123!Aa', 10)
for (let i = 1; i <= nStudents; i++) {
  const email = `pilot${String(i).padStart(2, '0')}@neu.edu.vn`
  const name = `Pilot SV ${String(i).padStart(2, '0')}`
  const mssv = `PILOT${String(i).padStart(3, '0')}`
  let u = db.prepare('SELECT id FROM users WHERE email=?').get(email)
  if (!u) {
    const r = db.prepare('INSERT INTO users (email,password_hash,name,role,mssv) VALUES (?,?,?,?,?)').run(email, hash, name, 'student', mssv)
    u = { id: r.lastInsertRowid }
    console.log(`  + SV ${email} id=${u.id}`)
  }
  try { db.prepare('INSERT OR IGNORE INTO enrollments (student_id, classroom_id) VALUES (?,?)').run(u.id, classroom.id) } catch {}
}
console.log(`✅ Đã ghi danh ${nStudents} SV vào ${className}`)

// 3 bài pilot: I/O, Functions, Loops (lấy từ seed)
const pilotAsgns = [
  { title: '[Pilot] Tuần 1: Biến & I/O — Tính diện tích', description: 'Nhập r, in S=π×r². Test gồm hidden edge 0 và 10.', concepts: ['Variables','I/O','Arithmetic'], sample_code: '#include <iostream>\n#include <cmath>\nusing namespace std;\nint main(){double r;cin>>r;cout<<M_PI*r*r;return 0;}', tests: [{input:'5',expected:'78.539',hidden:false},{input:'0',expected:'0',hidden:true}] },
  { title: '[Pilot] Tuần 2: Hàm & Rẽ nhánh — Xếp loại', description: 'Nhập điểm, in Giỏi/Khá/TB/Yếu. Yêu cầu tách hàm xepLoai().', concepts: ['Conditionals','Functions','Boolean Logic'], sample_code: '#include <iostream>\nusing namespace std;\nstring xepLoai(double d){if(d>=8)return "Gioi";if(d>=6.5)return "Kha";if(d>=5)return "Trung binh";return "Yeu";}int main(){double d;cin>>d;cout<<xepLoai(d);return 0;}', tests: [{input:'8.5',expected:'Gioi',hidden:false},{input:'3',expected:'Yeu',hidden:false},{input:'10',expected:'Gioi',hidden:true}] },
  { title: '[Pilot] Tuần 3: Vòng lặp — Tam giác sao', description: 'Nhập n, in tam giác sao n hàng. Dùng nested loop.', concepts: ['Loops','Nested Loops'], sample_code: '#include <iostream>\nusing namespace std;\nint main(){int n;cin>>n;for(int i=1;i<=n;i++){for(int j=1;j<=i;j++)cout<<"* ";cout<<endl;}return 0;}', tests: [{input:'3',expected:'* \n* * \n* * * ',hidden:false},{input:'1',expected:'* ',hidden:false}] },
]
for (const a of pilotAsgns) {
  const exists = db.prepare('SELECT id FROM assignments WHERE classroom_id=? AND title=?').get(classroom.id, a.title)
  if (exists) { console.log(`  - Bài "${a.title}" đã tồn tại id=${exists.id}`); continue }
  const r = db.prepare(`
    INSERT INTO assignments (classroom_id,title,description,lang,deadline,concepts_json,sample_code,weight_t1,weight_t2,weight_t3,status,test_cases_json)
    VALUES (?,?,?,?,?,?,?,?,?,?,'open',?)
  `).run(classroom.id, a.title, a.description, 'C++', new Date(Date.now()+7*86400000).toISOString(), JSON.stringify(a.concepts), a.sample_code, 40,35,25, JSON.stringify(a.tests))
  console.log(`  + Bài "${a.title}" id=${r.lastInsertRowid}`)
}
console.log(`\n✅ Pilot setup xong!
  Lớp: ${className} (id=${classroom.id})
  GV: ${teacherEmail}
  SV: pilot01@neu.edu.vn … pilot${String(nStudents).padStart(2,'0')}@neu.edu.vn / Pilot123!Aa
  Bài: 3 bài pilot đã tạo (deadline +7 ngày, open)
  Tiếp theo: đăng nhập GV → TeacherDashboard → kiểm tra 3 bài, cho SV làm Pre-test (research_docs/pretest_posttest.md)
`)
