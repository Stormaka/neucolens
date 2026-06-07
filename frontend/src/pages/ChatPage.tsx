import { useState, useRef, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import NavBar from '../components/NavBar'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

const SUGGESTED_QUESTIONS = [
  'Kiến trúc tổng thể của project này là gì?',
  'Luồng xử lý đăng nhập người dùng hoạt động như thế nào?',
  'Module nào phức tạp nhất và tại sao?',
  'Service layer được tổ chức như thế nào?',
  'Cách xử lý kết nối database?',
  'Có những design pattern nào được áp dụng?',
  'API endpoint nào quan trọng nhất?',
  'Cách xử lý lỗi và exception trong project?',
]

const AI_RESPONSES: Record<string, string> = {
  default: `Dựa trên knowledge graph đã phân tích project **"Hệ thống Quản lý Bán hàng Online"**, tôi có thể trả lời câu hỏi này.

Project được xây dựng theo mô hình **3-tier architecture** với Spring Boot:

- **Presentation Layer**: Controllers xử lý HTTP requests
- **Business Logic Layer**: Services chứa nghiệp vụ
- **Data Access Layer**: Repositories giao tiếp với MySQL

Các module chính:
1. \`AuthController\` → \`AuthService\` → \`UserRepository\`
2. \`ProductController\` → \`ProductService\` → \`ProductRepository\`
3. \`OrderController\` → \`OrderService\` → \`OrderRepository\`

Kiến trúc này tuân theo nguyên tắc **Separation of Concerns** và **Single Responsibility Principle**.`,

  auth: `Luồng xử lý **đăng nhập** trong project:

\`\`\`
POST /api/auth/login
  → AuthController.login()
  → AuthService.authenticate(email, password)
  → UserRepository.findByEmail()
  → BCryptPasswordEncoder.matches()
  → JwtTokenProvider.generateToken()
  → Trả về JWT token
\`\`\`

**JWT được lưu** ở localStorage phía client. Mỗi request tiếp theo gửi kèm \`Authorization: Bearer <token>\`.

**Điểm cần cải thiện**: Nên thêm refresh token để tăng bảo mật, và implement token blacklist khi logout.`,

  pattern: `Dựa vào knowledge graph, project sử dụng các **design patterns** sau:

1. **Repository Pattern** — \`UserRepository\`, \`ProductRepository\` abstract hóa data access
2. **Service Layer Pattern** — tách business logic ra khỏi controller  
3. **DTO Pattern** — \`UserDTO\`, \`ProductDTO\` để transfer data
4. **Builder Pattern** — trong việc tạo JWT token
5. **Singleton** — Spring beans mặc định là singleton

💡 *Gợi ý*: Có thể bổ sung **Observer Pattern** cho event handling (ví dụ: gửi email khi có đơn hàng mới).`,
}

export default function ChatPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      role: 'assistant',
      content: `Xin chào! 👋 Tôi là AI assistant được tích hợp với **Understand-Anything** để giúp bạn hiểu codebase của project **"Hệ thống Quản lý Bán hàng Online"**.

Knowledge graph đã được phân tích với **87 nodes** và **134 edges**. Bạn có thể hỏi tôi bất kỳ câu hỏi nào về kiến trúc, luồng xử lý, hoặc các pattern trong project.`,
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (text: string) => {
    if (!text.trim()) return

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setIsTyping(true)

    // Simulate AI response
    await new Promise(r => setTimeout(r, 1200 + Math.random() * 800))

    let responseContent = AI_RESPONSES.default
    const lower = text.toLowerCase()
    if (lower.includes('đăng nhập') || lower.includes('login') || lower.includes('auth')) {
      responseContent = AI_RESPONSES.auth
    } else if (lower.includes('pattern') || lower.includes('design')) {
      responseContent = AI_RESPONSES.pattern
    }

    const aiMsg: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: responseContent,
      timestamp: new Date(),
    }
    setMessages(prev => [...prev, aiMsg])
    setIsTyping(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-root)' }}>
      <NavBar role="student" userName="Nguyễn Văn An" />

      {/* Sub-header */}
      <div style={{
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border-subtle)',
        padding: '12px 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/project/${id}`)}>
            ← Quay lại Graph
          </button>
          <div className="divider" />
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
              💬 /understand-chat
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Hệ thống Quản lý Bán hàng Online · 87 nodes · 134 edges
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div className="status-dot success" />
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Graph đã sẵn sàng</span>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* ── Sidebar: suggested questions ── */}
        <div style={{
          width: '260px', flexShrink: 0,
          background: 'var(--bg-surface)',
          borderRight: '1px solid var(--border-subtle)',
          padding: '20px',
          overflow: 'auto',
          display: 'flex', flexDirection: 'column', gap: '16px',
        }}>
          <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            💡 Câu hỏi gợi ý
          </div>
          {SUGGESTED_QUESTIONS.map(q => (
            <button
              key={q}
              className="btn btn-ghost btn-sm"
              onClick={() => sendMessage(q)}
              style={{
                textAlign: 'left',
                padding: '10px 12px',
                lineHeight: 1.5,
                fontSize: '0.82rem',
                height: 'auto',
                whiteSpace: 'normal',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
              }}
            >
              {q}
            </button>
          ))}

          <div className="divider-h" />

          <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            📊 Context Graph
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
            AI đang sử dụng knowledge graph của project để trả lời. Context bao gồm:
          </div>
          {[
            { label: '87 nodes', desc: 'file, class, function' },
            { label: '134 edges', desc: 'imports, calls, inherits' },
            { label: '4 layers', desc: 'Controller → Entity' },
            { label: '5 tour steps', desc: 'hướng dẫn học' },
          ].map(item => (
            <div key={item.label} style={{
              background: 'var(--bg-elevated)',
              borderRadius: 'var(--radius-sm)',
              padding: '8px 10px',
              fontSize: '0.78rem',
            }}>
              <strong style={{ color: 'var(--text-primary)' }}>{item.label}</strong>
              <span style={{ color: 'var(--text-muted)' }}> — {item.desc}</span>
            </div>
          ))}
        </div>

        {/* ── Chat area ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {/* Messages */}
          <div style={{ flex: 1, overflow: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {messages.map(msg => (
              <div key={msg.id} style={{
                display: 'flex',
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                gap: '12px',
                alignItems: 'flex-end',
              }}>
                {msg.role === 'assistant' && (
                  <div style={{
                    width: 32, height: 32,
                    background: 'linear-gradient(135deg, var(--neu-red), #7b1c1c)',
                    borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '14px', flexShrink: 0,
                    boxShadow: '0 0 12px var(--neu-red-glow)',
                  }}>N</div>
                )}
                <div style={{ maxWidth: '70%' }}>
                  <div
                    className={`chat-bubble ${msg.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-ai'}`}
                    style={{
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }}
                    dangerouslySetInnerHTML={{
                      __html: formatMessage(msg.content)
                    }}
                  />
                  <div style={{
                    fontSize: '0.7rem',
                    color: 'var(--text-muted)',
                    marginTop: '4px',
                    textAlign: msg.role === 'user' ? 'right' : 'left',
                  }}>
                    {msg.timestamp.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            ))}

            {isTyping && (
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
                <div style={{
                  width: 32, height: 32,
                  background: 'linear-gradient(135deg, var(--neu-red), #7b1c1c)',
                  borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '14px',
                }}>N</div>
                <div className="chat-bubble chat-bubble-ai">
                  <TypingIndicator />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div style={{
            padding: '16px 24px',
            background: 'var(--bg-surface)',
            borderTop: '1px solid var(--border-subtle)',
          }}>
            <div style={{
              display: 'flex', gap: '12px', alignItems: 'flex-end',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-medium)',
              borderRadius: 'var(--radius-lg)',
              padding: '12px 16px',
              transition: 'border-color 0.2s',
            }}>
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Hỏi về code của bạn... (Enter để gửi, Shift+Enter xuống dòng)"
                rows={1}
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  resize: 'none',
                  color: 'var(--text-primary)',
                  fontSize: '0.9rem',
                  fontFamily: 'var(--font-sans)',
                  lineHeight: 1.6,
                  maxHeight: '120px',
                }}
                onInput={e => {
                  const el = e.currentTarget
                  el.style.height = 'auto'
                  el.style.height = Math.min(el.scrollHeight, 120) + 'px'
                }}
              />
              <button
                className="btn btn-primary btn-sm"
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || isTyping}
                style={{ flexShrink: 0, borderRadius: 'var(--radius-md)' }}
              >
                Gửi →
              </button>
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '8px', textAlign: 'center' }}>
              Powered by Understand-Anything · Mọi câu trả lời dựa trên knowledge graph của project
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function formatMessage(content: string): string {
  return content
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, `<code style="background:rgba(255,255,255,0.1);padding:2px 6px;border-radius:4px;font-family:var(--font-mono);font-size:0.85em">$1</code>`)
    .replace(/```[\w]*\n?([\s\S]+?)```/g, `<pre style="background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.1);padding:12px;border-radius:6px;margin:8px 0;font-family:var(--font-mono);font-size:0.82em;overflow-x:auto">$1</pre>`)
    .replace(/\n/g, '<br />')
}

function TypingIndicator() {
  return (
    <div style={{ display: 'flex', gap: '4px', alignItems: 'center', padding: '4px 0' }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          width: 6, height: 6,
          background: 'var(--text-muted)',
          borderRadius: '50%',
          animation: `float ${0.6 + i * 0.15}s ease-in-out infinite`,
          animationDelay: `${i * 0.15}s`,
        }} />
      ))}
    </div>
  )
}
