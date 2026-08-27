#!/usr/bin/env node
/**
 * Convert research export JSON → Excel 4 sheets for statistical_analysis.py
 * Usage: node backend/scripts/json_to_excel.js pilot_data.json pilot_data.xlsx
 * Fallback if exceljs not installed: just pretty-print JSON and exit.
 */
import fs from 'node:fs'
const [,, inPath, outPath] = process.argv
if (!inPath) { console.error('Usage: node json_to_excel.js <input.json> <output.xlsx>'); process.exit(1) }
const data = JSON.parse(fs.readFileSync(inPath, 'utf8'))
const sheets = {
  students: ['student_id','group','gender','age','major','class_code','consent_signed','pre_score','pre_test_date','post_score','post_test_date','midterm_grade','final_grade','dropout','dropout_week','dropout_reason','interview_done','notes'],
  submissions: ['student_id','group','week','assignment_id','submitted_at','submissions_count','time_to_submit_hours','git_commits','test_pass_rate','tier1_score','tier2_score','tier3_score','total_score','llm_proficiency_level','llm_feedback_length','teacher_reviewed','teacher_override_score'],
  llm_vs_human: ['submission_id','student_id','week','human_score_g1','human_score_g2','human_score_g3','human_score_avg','llm_score','human_level','llm_level','grader_disagreement','notes'],
  early_warning: ['student_id','group','week_assessed','system_flag','system_risk_score','teacher_notified','intervention_done','actual_at_risk','predicted_at_risk','outcome_notes'],
}
try {
  const { default: ExcelJS } = await import('exceljs')
  const wb = new ExcelJS.Workbook()
  wb.creator = 'NEU-CodeLens'
  wb.created = new Date()
  for (const [name, cols] of Object.entries(sheets)) {
    const ws = wb.addWorksheet(name)
    ws.addRow(cols)
    const h = ws.getRow(1); h.font = { bold: true, color: { argb: 'FFFFFFFF' } }; h.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2D3748' } }; h.commit()
    for (const r of (data[name] || [])) ws.addRow(cols.map(c => r[c] ?? ''))
    ws.columns.forEach(col => col.width = 14)
  }
  const out = outPath || inPath.replace(/\.json$/, '.xlsx')
  await wb.xlsx.writeFile(out)
  console.log(`✅ Đã tạo ${out} với 4 sheets từ ${inPath}`)
} catch (e) {
  if (String(e.message).includes('Cannot find package')) {
    console.warn('⚠️ exceljs chưa cài (npm install exceljs --prefix backend). Đang giữ JSON, bạn có thể import CSV zip vào Excel thủ công.')
    console.log(`ℹ️ JSON vẫn dùng được: ${inPath} — 4 keys: ${Object.keys(data).join(', ')}`)
  } else throw e
}
