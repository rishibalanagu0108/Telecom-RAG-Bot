import { useState, useRef, useEffect } from 'react'

const API = 'http://localhost:8000'

const basename = (s) => s.split('/').pop().split('\\').pop()

const SOURCE_COLORS = {
  'faq.csv':           'bg-blue-900/60 text-blue-300 border-blue-700',
  'tickets.db':        'bg-purple-900/60 text-purple-300 border-purple-700',
  'telecom_guide.pdf': 'bg-green-900/60 text-green-300 border-green-700',
}
const DEFAULT_COLOR = 'bg-slate-700/60 text-slate-300 border-slate-600'

function SourceChip({ source }) {
  const name = basename(source)
  const color = SOURCE_COLORS[name] ?? DEFAULT_COLOR
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs border font-mono ${color}`}>
      {name}
    </span>
  )
}

function Message({ msg }) {
  const isUser = msg.role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`max-w-[75%] flex flex-col gap-2 ${isUser ? 'items-end' : 'items-start'}`}>
        <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap
          ${isUser
            ? 'bg-indigo-600 text-white rounded-br-sm'
            : 'bg-slate-800 text-slate-100 rounded-bl-sm border border-slate-700'
          }`}>
          {msg.text}
          {msg.streaming && (
            <span className="inline-block w-1.5 h-4 ml-1 bg-slate-400 rounded-sm animate-pulse align-middle" />
          )}
        </div>

        {!isUser && !msg.streaming && msg.sources?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-1">
            {msg.sources.map((s) => <SourceChip key={s} source={s} />)}
          </div>
        )}

        {msg.error && (
          <span className="text-xs text-red-400 px-1">{msg.error}</span>
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

      // Safety: clear streaming flag if done event was missed
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
    <div className="min-h-screen bg-slate-950 flex justify-center">
    <div className="w-full max-w-3xl flex flex-col h-screen bg-[#0f1117] border-x border-slate-800">

      {/* Header */}
      <header className="flex items-center gap-3 px-6 py-4 border-b border-slate-800 shrink-0">
        <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
          T
        </div>
        <div className="text-left">
          <p className="text-sm font-semibold text-white leading-none">Tele-RAG</p>
          <p className="text-xs text-slate-500 mt-0.5">Telecom support assistant</p>
        </div>
        <div className="ml-auto flex gap-1.5 flex-wrap justify-end">
          {['faq.csv', 'tickets.db', 'telecom_guide.pdf'].map(s => (
            <SourceChip key={s} source={s} />
          ))}
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-center">
            <p className="text-lg font-medium text-slate-400">Ask a telecom question</p>
            <p className="text-sm text-slate-500">Answers grounded in your FAQ, tickets, and product guide</p>
          </div>
        )}
        {messages.map((msg, i) => <Message key={i} msg={msg} />)}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 pb-6 shrink-0">
        <div className="flex gap-2 items-end bg-slate-800 border border-slate-700 rounded-2xl px-4 py-3">
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Ask a question… (Enter to send)"
            disabled={loading}
            className="flex-1 bg-transparent text-sm text-slate-100 placeholder-slate-500 resize-none outline-none leading-relaxed disabled:opacity-50"
            style={{ maxHeight: '120px', overflowY: 'auto' }}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || loading}
            className="shrink-0 w-8 h-8 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
          >
            {loading
              ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z"/>
                </svg>
            }
          </button>
        </div>
        <p className="text-xs text-slate-600 text-center mt-2">Shift+Enter for new line · Enter to send</p>
      </div>
    </div>
    </div>
  )
}
