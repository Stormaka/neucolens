import { useState, useRef, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import NavBar from '../components/NavBar'
import { projectStore } from '../data/projectStore'

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

function getDynamicResponse(text: string, project: any): string {
  const lower = text.toLowerCase()
  const name = project?.name ?? 'Hệ thống Quản lý Bán hàng'
  const lang = project?.lang ?? 'Java · Spring Boot'
  const isJava = lang.toLowerCase().includes('java')
  const isReact = lang.toLowerCase().includes('react') || lang.toLowerCase().includes('typescript') || lang.toLowerCase().includes('javascript')
  const isPython = lang.toLowerCase().includes('python')
  const layers = project?.layerNames ?? ['API', 'Service', 'Repository', 'Entity']
  const mainLang = lang.split(' · ')[0]
  const mainFramework = lang.split(' · ')[1] ?? ''

  // Helper to generate node names for a layer
  const getSampleNodes = (layerName: string) => {
    if (project?.graphSource === 'sample') {
      if (project.id === 'proj-1') {
        if (layerName === 'API') return ['AuthController', 'ProductController']
        if (layerName === 'Service') return ['AuthService', 'ProductService']
        if (layerName === 'Repository') return ['UserRepository', 'ProductRepository']
        if (layerName === 'Entity') return ['User', 'Product']
      } else if (project.id === 'proj-2') {
        if (layerName === 'Frontend') return ['App.tsx', 'Login.tsx']
        if (layerName === 'API') return ['authController.js', 'userController.js']
        if (layerName === 'Database') return ['db.js', 'UserModel.js']
      }
    }
    return [`${layerName}Component1`, `${layerName}Component2`]
  }

  if (lower.includes('kiến trúc') || lower.includes('tổng thể') || lower.includes('architecture')) {
    const layerList = layers.map((l: string) => {
      const samples = getSampleNodes(l).map(n => `\`${n}\``).join(', ')
      return `- **Tầng ${l}**: Chứa các component như ${samples}. Xử lý các tác vụ thuộc trách nhiệm của tầng ${l}.`
    }).join('\n')

    return `Kiến trúc tổng thể của project **"${name}"** (${lang}) được xây dựng theo mô hình phân tầng (**Layered Architecture**) với **${layers.length} tầng** rõ rệt:

${layerList}

Các tầng giao tiếp với nhau theo chiều dọc từ trên xuống dưới, đảm bảo nguyên tắc **Separation of Concerns** (phân tách trách nhiệm) và **Single Responsibility Principle**.`
  }

  if (lower.includes('đăng nhập') || lower.includes('login') || lower.includes('auth')) {
    let flow = ''
    if (isJava) {
      flow = `1. Client gửi credentials qua POST /api/auth/login
2. Tầng Controller/API tiếp nhận request (ví dụ: AuthController hoặc APIComponent1)
3. Tầng Service xác thực và kiểm tra mật khẩu đã mã hóa (ví dụ: AuthService hoặc ServiceComponent1)
4. Tầng Repository truy cập database tìm User (ví dụ: UserRepository hoặc RepositoryComponent1)
5. Tạo JWT Token và trả về cho Client.`
    } else if (isReact) {
      flow = `1. Client nhập tài khoản trên giao diện (ví dụ: LoginComponent hoặc FrontendComponent1)
2. Gọi API đăng nhập POST /api/auth/login
3. Tầng API backend xử lý xác thực (ví dụ: APIComponent1)
4. Database check thông tin người dùng (ví dụ: DatabaseComponent1)
5. Trả về Token hoặc Session, Client lưu vào localStorage/Cookies.`
    } else {
      flow = `1. Client gửi request đăng nhập qua form hoặc API
2. Controller/Route tiếp nhận request
3. Service layer so khớp mật khẩu và tìm thông tin tài khoản
4. Truy vấn Database để kiểm tra thực thể người dùng
5. Cấp Token/Session trả về client.`
    }

    return `Luồng xử lý **đăng nhập và xác thực** trong project **"${name}"** hoạt động như sau:

\`\`\`
${flow}
\`\`\`

**Bảo mật**: Hệ thống sử dụng token-based authentication (như JWT). Client cần lưu trữ token này và đính kèm vào header \`Authorization: Bearer <token>\` ở các request tiếp theo.`
  }

  if (lower.includes('pattern') || lower.includes('design') || lower.includes('mẫu thiết kế')) {
    const patterns = [
      `**MVC / Layered Architecture**: Phân tách code thành các lớp rõ ràng (${layers.join(' → ')}).`,
      `**Dependency Injection / IoC**: Tự động quản lý và inject các instance (đặc biệt khi dùng ${mainFramework || mainLang}).`,
      `**Data Transfer Object (DTO)**: Chuyển dữ liệu sạch giữa client và server hoặc giữa các tầng mà không expose trực tiếp thực thể DB.`,
    ]
    if (isJava) {
      patterns.push(`**Repository Pattern**: Che giấu chi tiết truy xuất dữ liệu phía sau các interface Repository.`);
      patterns.push(`**Builder Pattern**: Tạo các đối tượng phức tạp (như cấu hình bảo mật hoặc JWT claims) một cách an toàn.`);
    } else if (isReact) {
      patterns.push(`**Component-Based**: UI được chia nhỏ thành các component tái sử dụng.`);
      patterns.push(`**Custom Hooks**: Tách biệt logic quản lý state ra khỏi giao diện hiển thị.`);
    }

    return `Trong project **"${name}"**, các **Design Patterns** sau đây được áp dụng nổi bật:

${patterns.map((p, i) => `${i + 1}. ${p}`).join('\n')}

Điều này giúp dự án tuân thủ tiêu chuẩn lập trình sạch (Clean Code), dễ dàng bảo trì và mở rộng.`
  }

  if (lower.includes('phức tạp nhất') || lower.includes('complex') || lower.includes('khó nhất')) {
    const complexNode = project?.graphSource === 'sample' && project.id === 'proj-1' 
      ? 'OrderService / OrderController' 
      : `${layers[Math.floor(layers.length / 2)]}Component1`

    return `Trong project **"${name}"**, module được đánh giá có độ phức tạp cao nhất là **\`${complexNode}\`**.

**Lý do:**
1. **Liên kết nghiệp vụ lớn**: Node này có nhiều kết nối với các node khác (degree cao), thay đổi tại đây có thể ảnh hưởng diện rộng.
2. **Nhiều dependencies**: Gọi hoặc bị gọi bởi nhiều component khác nhau thuộc các tầng.
3. **Logic phức tạp**: Chứa các xử lý nghiệp vụ chính hoặc các truy vấn phức tạp.`
  }

  if (lower.includes('service') || lower.includes('logic') || lower.includes('nghiệp vụ')) {
    const serviceLayer = layers.find((l: string) => l.toLowerCase().includes('service') || l.toLowerCase().includes('logic') || l.toLowerCase().includes('business')) || 'Service'
    const sampleSvc = getSampleNodes(serviceLayer)[0]

    return `Tầng nghiệp vụ (**${serviceLayer} Layer**) trong project **"${name}"** là nơi tập trung xử lý logic cốt lõi:

- **Nhiệm vụ**: Nhận dữ liệu đầu vào, thực hiện business validations, tính toán nghiệp vụ, và điều phối thao tác xuống tầng dữ liệu.
- **Ví dụ thành phần**: Component \`${sampleSvc}\` chịu trách nhiệm chạy các logic chính.
- **Tính độc lập**: Tách biệt khỏi giao thức truyền tải (HTTP) giúp dễ dàng viết unit test độc lập.`
  }

  if (lower.includes('database') || lower.includes('kết nối') || lower.includes('cơ sở dữ liệu') || lower.includes('sql') || lower.includes('db')) {
    let dbDetail = ''
    if (isJava) {
      dbDetail = `Sử dụng **Spring Data JPA (Hibernate)** để tự động map các Java Entity sang SQL tables. Quản lý connection thông qua \`application.properties\`.`
    } else if (isReact && lang.includes('Express')) {
      dbDetail = `Kết nối cơ sở dữ liệu (ví dụ MongoDB/MySQL) qua các thư viện ODM/ORM như Mongoose hoặc Sequelize, cấu hình trong các file config.`
    } else {
      dbDetail = `Kết nối và thao tác với Database thông qua driver hoặc thư viện ORM phù hợp của ngôn ngữ ${mainLang}.`
    }

    return `Hệ thống cơ sở dữ liệu và kết nối trong project **"${name}"** được tổ chức như sau:

- **Cách thức kết nối**: ${dbDetail}
- **Đảm bảo toàn vẹn (Transaction)**: Sử dụng các cơ chế quản lý giao dịch để đảm bảo dữ liệu luôn đồng nhất. Khi một tiến trình lỗi ở giữa, toàn bộ thay đổi sẽ được rollback tự động.`
  }

  if (lower.includes('endpoint') || lower.includes('api') || lower.includes('url')) {
    const apiLayer = layers.find((l: string) => l.toLowerCase().includes('api') || l.toLowerCase().includes('controller') || l.toLowerCase().includes('frontend')) || layers[0]
    const sampleApi = getSampleNodes(apiLayer)[0]

    return `Các API endpoints trong project **"${name}"** cung cấp cổng kết nối và truyền nhận dữ liệu:

- **Ví dụ endpoint**: \`POST /api/auth/login\` hoặc các endpoint của component \`${sampleApi}\`.
- **Định dạng**: Trả về dữ liệu dạng JSON với các mã trạng thái HTTP chuẩn (200, 201, 400, 401, 403, 500).
- **Phân quyền**: Các endpoint công khai (public) cho mọi đối tượng và endpoint cần token xác thực (protected) để truy cập.`
  }

  if (lower.includes('lỗi') || lower.includes('exception') || lower.includes('error')) {
    return `Cách xử lý lỗi và exception trong project **"${name}"** được xử lý tập trung:

1. **Bắt exception chủ động**: Bao bọc các thao tác nhạy cảm (truy vấn DB, gọi API ngoài) bằng các khối try-catch.
2. **Xử lý tập trung (Global Handler)**: Map các Exception kỹ thuật thành các thông báo thân thiện dạng JSON trả về client, thay vì in stack trace thô.
3. **Validate input**: Kiểm tra tính hợp lệ của dữ liệu ngay tại tầng Presentation trước khi xử lý tiếp.`
  }

  // Fallback chung
  return `Tôi đã nhận được câu hỏi về **"${text}"** cho project **"${name}"** (${project?.nodes ?? 87} nodes).

Dựa trên cấu trúc phân tích thuộc các tầng: **${layers.join(', ')}**, đây là phần quan trọng của hệ thống. Bạn có muốn đi sâu vào logic cụ thể của component nào thuộc tầng \`${layers[0]}\` hay \`${layers[Math.min(1, layers.length - 1)]}\` không?`
}

export default function ChatPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  // Lấy project từ store
  const storedProject = id ? projectStore.getById(id) : undefined
  const projectName = storedProject?.name ?? 'Hệ thống Quản lý Bán hàng Online'
  const projectNodes = storedProject?.nodes ?? 87
  const projectEdges = storedProject?.edges ?? 134
  const projectLang = storedProject?.lang ?? 'Java · Spring Boot'

  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      role: 'assistant',
      content: `Xin chào! 👋 Tôi là AI assistant được tích hợp với **Understand-Anything** để giúp bạn hiểu codebase của project **"${projectName}"**.

Knowledge graph đã được phân tích với **${projectNodes} nodes** và **${projectEdges} edges**. Bạn có thể hỏi tôi bất kỳ câu hỏi nào về kiến trúc, luồng xử lý, hoặc các pattern trong project.`,
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

    let responseContent = getDynamicResponse(text, storedProject)

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
      <NavBar role="student" userName={storedProject?.student ?? 'Nguyễn Văn An'} />

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
              {projectName} · {projectNodes} nodes · {projectEdges} edges
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
            { label: `${projectNodes} nodes`, desc: 'file, class, function' },
            { label: `${projectEdges} edges`, desc: 'imports, calls, inherits' },
            { label: `${storedProject?.layers ?? 4} layers`, desc: `${storedProject?.layerNames?.join(', ') ?? 'Controller → Entity'}` },
            { label: `${storedProject?.lang ?? projectLang}`, desc: 'ngôn ngữ & framework' },
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
