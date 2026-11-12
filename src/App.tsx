import { useState, useRef, useEffect, useCallback } from 'react'
import TelemetryTable from './components/TelemetryTable'
import Sidebar, { type SessionItem } from './components/Sidebar'
import ReactMarkdown from 'react-markdown'
import WorkOrderPanel from './components/WorkOrderPanel'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  toolLogs: any[]
}

const API_BASE = 'http://127.0.0.1:8000'

function App() {
  const [prompt, setPrompt] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [isThinking, setIsThinking] = useState(false)

  // 多会话管理状态
  const [sessions, setSessions] = useState<SessionItem[]>([])
  const [currentSessionId, setCurrentSessionId] = useState<string>('')
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)

  const [provider, setProvider] = useState<'gemini' | 'local'>('gemini')
  const [activeTab, setActiveTab] = useState<'chat' | 'orders'>('chat')
  // 消息自动滚到底部
  const chatBottomRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isThinking])

  // 1. 获取会话列表
  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/v1/sessions`)
      if (res.ok) {
        const data: SessionItem[] = await res.json()
        setSessions(data)
        return data
      }
    } catch (err) {
      console.error('获取会话列表失败:', err)
    }
    return []
  }, [])

  // 2. 加载指定会话的消息历史与 Generative UI 轨迹
  const loadSessionMessages = useCallback(async (sessionId: string) => {
    try {
      const res = await fetch(`${API_BASE}/v1/sessions/${sessionId}/messages`)
      if (res.ok) {
        const data = await res.json()
        const history: Message[] = (data.messages || []).map((m: any) => ({
          id: `msg-${m.id}`,
          role: m.role,
          content: m.content,
          toolLogs: m.tool_calls || []
        }))
        setMessages(history)
      }
    } catch (err) {
      console.error('加载会话消息失败:', err)
    }
  }, [])

  // 3. 页面初次加载：拉取会话列表，默认挂载最新一个会话（若无则新建）
  useEffect(() => {
    const initWorkspace = async () => {
      const list = await fetchSessions()
      if (list && list.length > 0) {
        const latestId = list[0].session_id
        setCurrentSessionId(latestId)
        await loadSessionMessages(latestId)
      } else {
        handleNewSession()
      }
    }
    initWorkspace()
  }, [fetchSessions, loadSessionMessages])

  // 4. 切换会话
  const handleSelectSession = async (sessionId: string) => {
    if (sessionId === currentSessionId || isThinking) return
    setCurrentSessionId(sessionId)
    await loadSessionMessages(sessionId)
  }

  // 5. 新建排查会话
  const handleNewSession = async () => {
    if (isThinking) return
    try {
      const res = await fetch(`${API_BASE}/v1/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: '新排查会话' })
      })
      if (res.ok) {
        const newSess: SessionItem = await res.json()
        setSessions((prev) => [newSess, ...prev])
        setCurrentSessionId(newSess.session_id)
        setMessages([]) // 清空当前视图准备录入新排查
      }
    } catch (err) {
      console.error('创建会话失败:', err)
    }
  }

  // 6. 删除会话
  const handleDeleteSession = async (sessionId: string) => {
    if (isThinking) return
    if (!window.confirm('确定要删除该排查会话及其全部记录吗？')) return

    try {
      const res = await fetch(`${API_BASE}/v1/sessions/${sessionId}`, {
        method: 'DELETE'
      })
      if (res.ok) {
        const remaining = sessions.filter((s) => s.session_id !== sessionId)
        setSessions(remaining)
        if (sessionId === currentSessionId) {
          if (remaining.length > 0) {
            handleSelectSession(remaining[0].session_id)
          } else {
            handleNewSession()
          }
        }
      }
    } catch (err) {
      console.error('删除会话失败:', err)
    }
  }

  // 7. 发送流式排查指令
  const handleSubmit = async () => {
    if (!prompt.trim() || isThinking || !currentSessionId) return

    const userText = prompt
    setPrompt('')
    setIsThinking(true)

    // 乐观追加用户消息与助手空气泡
    const userMsgId = 'msg-' + Date.now()
    const assistantMsgId = 'msg-' + (Date.now() + 1)

    const userMessage: Message = {
      id: userMsgId,
      role: 'user',
      content: userText,
      toolLogs: []
    }

    const assistantPlaceholder: Message = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      toolLogs: []
    }

    setMessages((prev) => [...prev, userMessage, assistantPlaceholder])

    try {
      const response = await fetch(`${API_BASE}/v1/agent/dispatch/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: userText,
          session_id: currentSessionId, // 👈 绑定当前选中的持久化 Session ID！
          provider: provider,
        })
      })

      if (!response.body) throw new Error('浏览器不支持流式读取')

      const reader = response.body.getReader()
      const decoder = new TextDecoder('utf-8')
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split('\n\n')
        buffer = parts.pop() || ''

        for (const part of parts) {
          const lines = part.split('\n')
          let eventType = ''
          let dataStr = ''

          for (const line of lines) {
            if (line.startsWith('event:')) eventType = line.replace('event:', '').trim()
            else if (line.startsWith('data:')) dataStr = line.replace('data:', '').trim()
          }

          if (dataStr) {
            try {
              const parsedData = JSON.parse(dataStr)

              if (eventType === 'delta' && parsedData.text) {
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMsgId
                      ? { ...msg, content: msg.content + parsedData.text }
                      : msg
                  )
                )
              } else if (eventType === 'tool_call') {
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMsgId
                      ? { ...msg, toolLogs: [...msg.toolLogs, parsedData] }
                      : msg
                  )
                )
              }
            } catch (e) {
              console.warn('JSON解析跳过非标准数据:', dataStr)
            }
          }
        }
      }
    } catch (error) {
      console.error('通信断开:', error)
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMsgId
            ? { ...msg, content: msg.content + '\n[系统提示] 无法连接到设备中心，请检查后端服务。' }
            : msg
        )
      )
    } finally {
      setIsThinking(false)
      // 流式结束：刷新一次会话列表（同步后端自动提炼的首轮会话标题与更新时间）
      fetchSessions()
    }
  }

  // 渲染 Markdown 与 Generative UI 时序大屏组件
  const renderMessageContent = (text: string) => {
    const dbMarker = '**【数据库真实追溯结果】**'
    if (text.includes(dbMarker)) {
      const [beforeText, restText] = text.split(dbMarker)
      const jsonMatch = restText.match(/```json\n([\s\S]*?)\n```/)

      return (
        <div className="flex flex-col space-y-2">
          {beforeText && <ReactMarkdown>{beforeText}</ReactMarkdown>}
          {jsonMatch && <TelemetryTable jsonStr={jsonMatch[1]} />}
          {jsonMatch && restText.split(jsonMatch[0])[1] && (
            <ReactMarkdown>{restText.split(jsonMatch[0])[1]}</ReactMarkdown>
          )}
        </div>
      )
    }
    return <ReactMarkdown>{text}</ReactMarkdown>
  }

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* 1. 左侧可收缩抽屉：多会话工作站 */}
      <Sidebar
        sessions={sessions}
        currentSessionId={currentSessionId}
        onSelectSession={handleSelectSession}
        onNewSession={handleNewSession}
        onDeleteSession={handleDeleteSession}
        isOpen={isSidebarOpen}
        onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
      />

      {/* 2. 右侧主排障控制台 */}
      <main className="flex-1 flex flex-col h-full bg-slate-900 overflow-hidden">
        {/* 顶部状态栏 */}
        <div className="flex items-center gap-4">
          <h1 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <span className="text-base">⚙️</span> 工业现场智能排障工作站 (FDE Console 2.0)
          </h1>
          <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
            <button
              onClick={() => setActiveTab('chat')}
              className={`px-3 py-1 rounded-md font-medium transition-all cursor-pointer ${
                activeTab === 'chat'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              💬 智能排障
            </button>
            <button
              onClick={() => setActiveTab('orders')}
              className={`px-3 py-1 rounded-md font-medium transition-all cursor-pointer ${
                activeTab === 'orders'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              📋 工单台账
            </button>
          </div>
        </div>

        {/* 消息历史滚动区 */}
        {activeTab === 'orders' ? (
          <WorkOrderPanel apiBase={API_BASE} />
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-950/40">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-600 font-mono text-xs space-y-2 select-none">
                  <span className="text-4xl mb-2">💬</span>
                  <p>当前会话暂无历史排查记录</p>
                  <p className="text-slate-500">
                    可尝试输入："请排查3号机当前的运行状态"，或从左侧抽屉切换历史会话
                  </p>
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    {/* 角色标识 */}
                    <span className="text-[11px] font-mono text-slate-500 mb-1 px-1">
                      {msg.role === 'user' ? '👤 现场工程师' : '🤖 FDE 智能专家'}
                    </span>

                    {/* 消息气泡卡片 */}
                    <div
                      className={`max-w-[85%] rounded-xl p-4 text-sm ${
                        msg.role === 'user'
                          ? 'bg-blue-600 text-white shadow-lg shadow-blue-950/30'
                          : 'bg-slate-900 border border-slate-800 text-slate-200 shadow-xl'
                      }`}
                    >
                      {/* 若有工具调度日志，置于顶部 */}
                      {msg.toolLogs && msg.toolLogs.length > 0 && (
                        <div className="mb-4 space-y-2">
                          {msg.toolLogs.map((log, idx) => (
                            <div
                              key={idx}
                              className="bg-slate-950/80 border-l-4 border-amber-500 p-2.5 rounded text-xs"
                            >
                              <div className="text-amber-400 font-bold flex items-center gap-1.5">
                                <span className="animate-pulse">⚡</span> 底层调度: {log.tool_name}
                              </div>
                              <pre className="text-slate-400 text-[11px] font-mono mt-1 overflow-x-auto whitespace-pre-wrap">
                                {JSON.stringify(log.arguments, null, 2)}
                              </pre>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* 文本回复区域 */}
                      {msg.content ? (
                        <div className="prose prose-invert prose-blue max-w-none text-slate-200">
                          {renderMessageContent(msg.content)}
                        </div>
                      ) : msg.role === 'assistant' ? (
                        <div className="flex items-center gap-2 text-slate-500 font-mono text-xs animate-pulse">
                          <span>🧠</span> 思考中 / 正在调度物理底层工具...
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
            <div ref={chatBottomRef} />
            </div>
          </>
        )}

        {/* 底部输入框 */}
        {activeTab === 'orders' ? (<WorkOrderPanel apiBase={API_BASE} />) : (
          <>
            <div className="p-4 border-t border-slate-800 bg-slate-900/90">
              <div className="max-w-4xl mx-auto flex gap-3">
                <input
                  type="text"
                  className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all disabled:opacity-50 font-mono text-sm"
                  placeholder="输入排查指令，例如：'请排查3号机状态并派单'，支持多轮连续追问..."
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                  disabled={isThinking}
                />
                <button
                  onClick={handleSubmit}
                  disabled={isThinking}
                  className="bg-blue-600 hover:bg-blue-500 active:scale-95 disabled:bg-slate-800 disabled:text-slate-600 text-white px-7 py-3 rounded-lg font-medium transition-all shadow-lg shadow-blue-900/20 cursor-pointer text-sm"
                >
                  {isThinking ? '诊断中...' : '发送指令'}
                </button>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  )
}

export default App