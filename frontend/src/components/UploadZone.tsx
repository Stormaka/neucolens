import { useState, useRef } from 'react'

interface UploadZoneProps {
  onUpload: (file: File | string) => void
}

export default function UploadZone({ onUpload }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [mode, setMode] = useState<'file' | 'url'>('file')
  const [githubUrl, setGithubUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [stage, setStage] = useState('')
  const pendingFileRef = useRef<File | null>(null)

  const STAGES = [
    'Đang giải nén project...',
    'Quét cấu trúc files...',
    'Phân tích imports & exports...',
    'Xác định kiến trúc tầng...',
    'Sinh knowledge graph...',
    'Tạo guided tour...',
    'Hoàn tất! ✓',
  ]

  const simulateUpload = (file?: File) => {
    if (file) pendingFileRef.current = file
    setUploading(true)
    setProgress(0)
    let i = 0
    const interval = setInterval(() => {
      const p = Math.min(100, (i + 1) * (100 / STAGES.length))
      setProgress(p)
      setStage(STAGES[i] || '')
      i++
      if (i >= STAGES.length) {
        clearInterval(interval)
        setTimeout(() => {
          if (mode === 'url') {
            onUpload(githubUrl)
          } else {
            onUpload(pendingFileRef.current ?? 'file')
          }
        }, 600)
      }
    }, 700)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file && (file.name.endsWith('.zip') || file.name.endsWith('.tar.gz'))) {
      simulateUpload(file)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) simulateUpload(file)
  }

  if (uploading) {
    return (
      <div style={{ textAlign: 'center', padding: '20px 0' }}>
        <div style={{ marginBottom: '24px' }}>
          <div style={{
            width: 64, height: 64,
            margin: '0 auto 16px',
            background: 'linear-gradient(135deg, var(--neu-red), #7b1c1c)',
            borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '28px',
            animation: progress < 100 ? 'spin 2s linear infinite' : 'none',
          }}>
            {progress < 100 ? '⚙️' : '✅'}
          </div>
          <div style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '6px' }}>
            {progress < 100 ? 'Đang phân tích project...' : 'Phân tích hoàn tất!'}
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
            {stage}
          </div>
        </div>
        <div className="progress-bar" style={{ marginBottom: '8px' }}>
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{Math.round(progress)}%</div>

        {/* Pipeline stages */}
        <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {STAGES.slice(0, -1).map((s, i) => {
            const stepProgress = ((i + 1) / (STAGES.length - 1)) * 100
            const done = progress >= stepProgress
            const active = progress >= (i / (STAGES.length - 1)) * 100 && progress < stepProgress
            return (
              <div key={s} style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                fontSize: '0.82rem',
                color: done ? 'var(--text-primary)' : active ? '#fbbf24' : 'var(--text-muted)',
                transition: 'color 0.3s',
              }}>
                <span>{done ? '✓' : active ? '◐' : '○'}</span>
                {s}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Mode selector */}
      <div className="tab-bar" style={{ marginBottom: '20px' }}>
        <button className={`tab-item ${mode === 'file' ? 'active' : ''}`} onClick={() => setMode('file')}>
          📦 Upload .zip
        </button>
        <button className={`tab-item ${mode === 'url' ? 'active' : ''}`} onClick={() => setMode('url')}>
          🔗 GitHub URL
        </button>
      </div>

      {mode === 'file' ? (
        <label
          className={`upload-zone ${isDragging ? 'drag-over' : ''}`}
          style={{ display: 'block', cursor: 'pointer' }}
          onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
        >
          <input
            type="file"
            accept=".zip,.tar.gz"
            style={{ display: 'none' }}
            onChange={handleFileSelect}
          />
          <div style={{ fontSize: '3rem', marginBottom: '16px' }}>📦</div>
          <div style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '8px' }}>
            Kéo thả file .zip vào đây
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '16px' }}>
            hoặc click để chọn file
          </div>
          <div className="badge badge-blue">Chấp nhận: .zip · .tar.gz</div>
        </label>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: '8px' }}>
              GitHub Repository URL
            </label>
            <input
              className="input"
              type="url"
              placeholder="https://github.com/username/your-thesis-project"
              value={githubUrl}
              onChange={e => setGithubUrl(e.target.value)}
            />
          </div>
          <div style={{
            background: 'var(--bg-elevated)',
            borderRadius: 'var(--radius-md)',
            padding: '12px',
            fontSize: '0.82rem',
            color: 'var(--text-secondary)',
            lineHeight: 1.6,
          }}>
            💡 Repository cần là <strong>public</strong> hoặc bạn đã cấp quyền truy cập cho NEU CodeLens.
          </div>
          <button
            className="btn btn-primary"
            style={{ justifyContent: 'center' }}
            onClick={() => simulateUpload()}
            disabled={!githubUrl.trim()}
          >
            🚀 Bắt đầu phân tích
          </button>
        </div>
      )}

      <div style={{
        marginTop: '20px',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '8px',
        fontSize: '0.78rem',
        color: 'var(--text-muted)',
      }}>
        {[
          '✓ Java, Python, JavaScript, TypeScript',
          '✓ C#, PHP, Go, Rust',
          '✓ Phân tích tự động trong ~3 phút',
          '✓ Dữ liệu được bảo mật nội bộ NEU',
        ].map(item => (
          <div key={item}>{item}</div>
        ))}
      </div>
    </div>
  )
}
