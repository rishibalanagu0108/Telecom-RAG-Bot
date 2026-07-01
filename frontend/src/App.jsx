import { useState, useRef, useEffect } from 'react'

const API = 'http://localhost:8000'

const basename = (s) => s.split('/').pop().split('\\').pop()

const CHIP_STYLE = {
  'faq.csv':           { bg: '#0c1a3a', text: '#93c5fd', border: '#1e3a6e' },
  'tickets.db':        { bg: '#1a0c3a', text: '#c4b5fd', border: '#3a1e6e' },
  'telecom_guide.pdf': { bg: '#0c2a1a', text: '#6ee7b7', border: '#1e5a3a' },
}

function SourceChip({ source }) {
  const name = basename(source)
  const s = CHIP_STYLE[name] ?? { bg: '#1e2433', text: '#94a3b8', border: '#334155' }
  return (
    <span style={{
      background: s.bg,
      color: s.text,
      border: `1px solid ${s.border}`,
      padding: '3px 10px',
      borderRadius: '6px',
      fontSize: '11px',
      fontFamily: 'ui-monospace, monospace',
      fontWeight: 500,
      letterSpacing: '0.02em',
    }}>
      {name}
    </span>
  )
}

function Message({ msg }) {
  const isUser = msg.role === 'user'
  return (
    <div style={{
      display: 'flex',
      justifyContent: isUser ? 'flex-end' : 'flex-start',
      marginBottom: '16px',
    }}>
      <div style={{
        maxWidth: '76%',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        alignItems: isUser ? 'flex-end' : 'flex-start',
      }}>
        <div style={{
          padding: '12px 16px',
          borderRadius: isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
          fontSize: '14px',
          lineHeight: '1.65',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          background: isUser ? '#5b6cf0' : '#161e2d',
          color: isUser ? '#fff' : '#dde4f0',
          border: isUser ? 'none' : '1px solid #1e2a40',
        }}>
          {msg.text}
          {msg.streaming && (
            <span style={{
              display: 'inline-block',
              width: '6px',
              height: '14px',
              marginLeft: '4px',
              background: '#5b6cf0',
              borderRadius: '2px',
              verticalAlign: 'middle',
              animation: 'blink 1s step-end infinite',
            }} />
          )}
        </div>

        {!isUser && !msg.streaming && msg.sources?.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', paddingLeft: '4px' }}>
            {msg.sources.map(s => <SourceChip key={s} source={s} />)}
          </div>
        )}

        {msg.error && (
          <span style={{ fontSize: '12px', color: '#f87171', paddingLeft: '4px' }}>
            {msg.error}
          </span>
        )}
      </div>
    </div>
  )
}

export default function App() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage() {
    const question = input.trim()
    if (!question || loading) return

    setInput('')
    setLoading(true)
    setMessages(prev => [...prev, { role: 'user', text: question }])

    const aiId = Date.now()
    setMessages(prev => [...prev, { id: aiId, role: 'ai', text: '', streaming: true, sources: [] }])

    try {
      const res = await fetch(`${API}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      })

      if (!res.ok) {
        const err = await res.json()
        setMessages(prev => prev.map(m =>
          m.id === aiId ? { ...m, streaming: false, error: err.detail ?? 'Request failed' } : m
        ))
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let lastEventType = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop()

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            lastEventType = line.slice(7).trim()
          } else if (line.startsWith('data: ')) {
            const payload = JSON.parse(line.slice(6))
            if (lastEventType === 'done' && payload.sources) {
              setMessages(prev => prev.map(m =>
                m.id === aiId ? { ...m, streaming: false, sources: payload.sources } : m
              ))
            } else if (lastEventType === 'error' && payload.error) {
              setMessages(prev => prev.map(m =>
                m.id === aiId ? { ...m, streaming: false, error: payload.error } : m
              ))
            } else if (payload.token) {
              setMessages(prev => prev.map(m =>
                m.id === aiId ? { ...m, text: m.text + payload.token } : m
              ))
            }
            lastEventType = ''
          }
        }
      }

      setMessages(prev => prev.map(m =>
        m.id === aiId && m.streaming ? { ...m, streaming: false } : m
      ))
    } catch (err) {
      setMessages(prev => prev.map(m =>
        m.id === aiId ? { ...m, streaming: false, error: err.message } : m
      ))
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { height: 100%; background: #080b12; font-family: system-ui, -apple-system, sans-serif; }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        textarea { font-family: inherit; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #1e2a40; border-radius: 4px; }
      `}</style>

      {/* Page centering shell */}
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        justifyContent: 'center',
        background: '#080b12',
      }}>
        {/* Chat container */}
        <div style={{
          width: '100%',
          maxWidth: '760px',
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          background: '#0e1420',
          borderLeft: '1px solid #1a2236',
          borderRight: '1px solid #1a2236',
        }}>

          {/* ── Header ─────────────────────────────────────── */}
          <header style={{
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            padding: '16px 24px',
            borderBottom: '1px solid #1a2236',
          }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #5b6cf0, #7c3aed)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontWeight: 700,
              fontSize: '15px',
              flexShrink: 0,
            }}>T</div>

            <div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#e2e8f0', lineHeight: 1.2 }}>
                Tele-RAG
              </div>
              <div style={{ fontSize: '11px', color: '#475569', marginTop: '2px', letterSpacing: '0.02em' }}>
                Telecom support assistant
              </div>
            </div>

            <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {['faq.csv', 'tickets.db', 'telecom_guide.pdf'].map(s => (
                <SourceChip key={s} source={s} />
              ))}
            </div>
          </header>

          {/* ── Messages ───────────────────────────────────── */}
          {/* min-height: 0 is required — without it flex-1 overflows the container */}
          <div style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            padding: '24px',
          }}>
            {messages.length === 0 && (
              <div style={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                textAlign: 'center',
              }}>
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '14px',
                  background: 'rgba(91,108,240,0.12)',
                  border: '1px solid rgba(91,108,240,0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '22px',
                  marginBottom: '4px',
                }}>📡</div>
                <div style={{ fontSize: '16px', fontWeight: 600, color: '#94a3b8' }}>
                  Ask a telecom question
                </div>
                <div style={{ fontSize: '13px', color: '#475569', maxWidth: '260px', lineHeight: 1.6 }}>
                  Answers grounded in your FAQ, support tickets, and product guide
                </div>
              </div>
            )}
            {messages.map((msg, i) => <Message key={i} msg={msg} />)}
            <div ref={bottomRef} />
          </div>

          {/* ── Input ──────────────────────────────────────── */}
          <div style={{
            flexShrink: 0,
            padding: '16px 24px 24px',
            borderTop: '1px solid #1a2236',
          }}>
            <div style={{
              display: 'flex',
              gap: '10px',
              alignItems: 'flex-end',
              background: '#161e2d',
              border: '1px solid #1e2a40',
              borderRadius: '14px',
              padding: '12px 12px 12px 16px',
            }}>
              <textarea
                ref={inputRef}
                rows={1}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Ask a question… (Enter to send)"
                disabled={loading}
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  resize: 'none',
                  fontSize: '14px',
                  color: '#dde4f0',
                  maxHeight: '80px',
                  overflowY: 'auto',
                  opacity: loading ? 0.5 : 1,
                }}
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || loading}
                style={{
                  flexShrink: 0,
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: '#5b6cf0',
                  border: 'none',
                  cursor: input.trim() && !loading ? 'pointer' : 'not-allowed',
                  opacity: input.trim() && !loading ? 1 : 0.4,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'opacity 0.15s, background 0.15s',
                }}
                onMouseEnter={e => { if (!e.currentTarget.disabled) e.currentTarget.style.background = '#4f60e8' }}
                onMouseLeave={e => { e.currentTarget.style.background = '#5b6cf0' }}
              >
                {loading
                  ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="9" stroke="rgba(255,255,255,0.3)" strokeWidth="2.5"/>
                      <path d="M12 3a9 9 0 0 1 9 9" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                        <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.75s" repeatCount="indefinite"/>
                      </path>
                    </svg>
                  : <svg width="14" height="14" viewBox="0 0 20 20" fill="white">
                      <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z"/>
                    </svg>
                }
              </button>
            </div>
            <div style={{
              textAlign: 'center',
              fontSize: '11px',
              color: '#2a3649',
              marginTop: '10px',
              letterSpacing: '0.02em',
            }}>
              Shift+Enter for new line · Enter to send
            </div>
          </div>

        </div>
      </div>
    </>
  )
}
