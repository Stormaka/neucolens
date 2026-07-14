import { useState, useRef } from 'react'

interface UploadZoneProps {
  /** Truyền File object thật (ZIP) hoặc GitHub URL string */
  onUpload: (file: File | string) => void | Promise<void>
}

export default function UploadZone({ onUpload }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [mode, setMode] = useState<'file' | 'url'>('file')
  const [githubUrl, setGithubUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [stage, setStage] = useState('')
  const [error, setError] = useState('')

  const handleFile = async (file: File) => {
    if (!file.name.endsWith('.zip')) {
      setError('Chỉ hỗ trợ file .zip')
      return
    }
    setError('')
    setUploading(true)
    setStage('Đang tải file lên server...')
    try {
      await onUpload(file)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi không xác định'
      setError(msg)
    } finally {
      setUploading(false)
      setStage('')
    }
  }

  const handleUrl = async () => {
    if (!githubUrl.trim()) return
    setError('')
    setUploading(true)
    setStage('Đang kết nối GitHub...')
    try {
      await onUpload(githubUrl.trim())
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi không xác định'
      setError(msg)
    } finally {
      setUploading(false)
      setStage('')
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  if (uploading) {
    return (
      <div style={{ textAlign: 'center', padding: '20px 0' }}>
        <div style={{
          width: 64, height: 64,
          margin: '0 auto 16px',
          background: 'linear-gradient(135deg, var(--neu-red), #7b1c1c)',
          borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '28px',
          animation: 'spin 2s linear infinite',
        }}>⚙️</div>
        <div style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '6px' }}>
          Đang xử lý...
        </div>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
          {stage}
        </div>
        <div className="progress-bar" style={{ marginBottom: '8px' }}>
          <div className="progress-fill" style={{ width: '60%', animation: 'progress-indeterminate 1.5s ease infinite' }} />
        </div>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '16px' }}>
          Server đang tiếp nhận — phân tích sẽ chạy nền trong vài phút...
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

      {error && (
        <div style={{
          marginBottom: '12px',
          padding: '10px 14px',
          background: 'rgba(248,113,113,0.1)',
          border: '1px solid rgba(248,113,113,0.3)',
          borderRadius: 'var(--radius-md)',
          color: '#f87171',
          fontSize: '0.85rem',
        }}>
          ❌ {error}
        </div>
      )}

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
            accept=".zip"
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
          <div className="badge badge-blue">Chấp nhận: .zip (tối đa 200MB)</div>
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
              onKeyDown={e => e.key === 'Enter' && handleUrl()}
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
            💡 Repository cần là <strong>public</strong>. Backend sẽ clone và chạy phân tích tự động.
          </div>
          <button
            className="btn btn-primary"
            style={{ justifyContent: 'center' }}
            onClick={handleUrl}
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
          '✓ Phân tích tự động bằng Understand-Anything',
          '✓ Không dùng Gemini API — 100% local',
        ].map(item => (
          <div key={item}>{item}</div>
        ))}
      </div>
    </div>
  )
}
