import { useState, useRef, useEffect, useCallback } from 'react'
import TelemetryTable from './components/TelemetryTable'
import Sidebar, { type SessionItem } from './components/Sidebar'
import ReactMarkdown from 'react-markdown'
import WorkOrderPanel from './components/WorkOrderPanel'
import DevicePanel, { type DeviceHealthResponse } from './components/DevicePanel'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  toolLogs: any[]
}

type ColorScheme = 'light' | 'dark'

const API_BASE = 'http://127.0.0.1:8000'

const readStoredScheme = (): ColorScheme | null => {
  try {
    const val = localStorage.getItem('color-scheme')
    return val === 'light' || val === 'dark' ? val : null
  } catch {
    return null
  }
}

const applyColorSchemeMeta = (stored: ColorScheme | null) => {
  const meta = document.querySelector('meta[name="color-scheme"]')
  if (meta) {
    meta.setAttribute('content', stored ?? 'light dark')
  }
}

function App() {
  const [prompt, setPrompt] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [isThinking, setIsThinking] = useState(false)

  // 多会话管理状态
  const [sessions, setSessions] = useState<SessionItem[]>([])
  const [currentSessionId, setCurrentSessionId] = useState<string>('')
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)

  const [provider, setProvider] = useState<'gemini' | 'local'>('gemini')
  const [activeTab, setActiveTab] = useState<'devices' | 'chat' | 'orders'>('devices')

  const [healthData, setHealthData] = useState<DeviceHealthResponse | null>(null)
  const [healthLoading, setHealthLoading] = useState(false)

  // 主题模式：遵循系统偏好，支持浅色 / 深色覆盖并持久化
  const [storedScheme, setStoredScheme] = useState<ColorScheme | null>(() => readStoredScheme())
  const [systemScheme, setSystemScheme] = useState<ColorScheme>(() =>
    window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  )
  const resolvedScheme: ColorScheme = storedScheme ?? systemScheme

  useEffect(() => {
    applyColorSchemeMeta(storedScheme)
  }, [storedScheme])

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onSystemChange = (e: MediaQueryListEvent) => {
      setSystemScheme(e.matches ? 'dark' : 'light')
    }
    const onStorageChange = (e: StorageEvent) => {
      if (e.key === 'color-scheme' || e.key === null) {
        const next = readStoredScheme()
        setStoredScheme(next)
        applyColorSchemeMeta(next)
      }
    }
    media.addEventListener('change', onSystemChange)
    window.addEventListener('storage', onStorageChange)
    return () => {
      media.removeEventListener('change', onSystemChange)
      window.removeEventListener('storage', onStorageChange)
    }
  }, [])

  const handleToggleTheme = () => {
    const target: ColorScheme = resolvedScheme === 'dark' ? 'light' : 'dark'
    const nextStored: ColorScheme | null = target === systemScheme ? null : target
    try {
      if (nextStored === null) {
        localStorage.removeItem('color-scheme')
      } else {
        localStorage.setItem('color-scheme', nextStored)
      }
    } catch {
      // 隐私模式下忽略存储异常，仍应用当前页面主题
    }
    setStoredScheme(nextStored)
    applyColorSchemeMeta(nextStored)
  }
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

  const fetchDeviceHealth = useCallback(async () => {
    setHealthLoading(true)
    try {
      const res = await fetch(`${API_BASE}/v1/devices/health`)
      if (res.ok) {
        const data: DeviceHealthResponse = await res.json()
        setHealthData(data)
      }
    } catch (err) {
      console.error('获取设备健康概览失败:', err)
    } finally {
      setHealthLoading(false)
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
      await fetchDeviceHealth()
    }
    initWorkspace()

  }, [fetchSessions, loadSessionMessages, fetchDeviceHealth])

  // 4. 切换会话（并自动切回智能排障对话视图）
  const handleSelectSession = async (sessionId: string) => {
    if (isThinking) return
    setActiveTab('chat')
    if (sessionId === currentSessionId) return
    setCurrentSessionId(sessionId)
    await loadSessionMessages(sessionId)
  }

  // 5. 新建排查会话（并自动切回智能排障对话视图）
  const handleNewSession = async () => {
    if (isThinking) return null
    setActiveTab('chat')
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
        return newSess.session_id
      }
    } catch (err) {
      console.error('创建会话失败:', err)
    }
    return null
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

  // 7. 核心流式请求发送器（供输入框提交与设备卡片一键排障共同复用）
  const sendPrompt = async (userText: string, targetSessionId: string) => {
    if (!userText.trim() || isThinking || !targetSessionId) return

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
          session_id: targetSessionId,
          provider: provider
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
      // 流式结束：同步刷新会话列表 + 设备健康与工单角标
      fetchSessions()
      fetchDeviceHealth()
    }
  }

  // 8. 输入框提交排查指令
  const handleSubmit = async () => {
    if (!prompt.trim() || isThinking || !currentSessionId) return
    const userText = prompt
    setPrompt('')
    await sendPrompt(userText, currentSessionId)
  }

  // 9. 设备看板卡片「一键 AI 排障」联动
  const handleInvestigateDevice = async (deviceId: string) => {
    if (isThinking) return
    setActiveTab('chat')
    const newSessionId = await handleNewSession()
    if (newSessionId) {
      await sendPrompt(`请排查 ${deviceId} 当前的运行状态与异常情况`, newSessionId)
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

  const activeSession = sessions.find((s) => s.session_id === currentSessionId)

  return (
    <div className="flex h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden font-sans">
      {/* 1. 左侧可收缩工作台菜单 & 多会话工作站 */}
      <Sidebar
        sessions={sessions}
        currentSessionId={currentSessionId}
        activeTab={activeTab}
        abnormalDevices={healthData?.summary.abnormal_devices ?? 0}
        openWorkOrders={healthData?.summary.open_work_orders ?? 0}
        onSelectTab={setActiveTab}
        onSelectSession={handleSelectSession}
        onNewSession={handleNewSession}
        onDeleteSession={handleDeleteSession}
        isOpen={isSidebarOpen}
        onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
      />

      {/* 2. 右侧主排障控制台 */}
      <main className="flex-1 flex flex-col h-full min-w-0 bg-slate-50 dark:bg-slate-900 overflow-hidden">
        {/* 顶部状态栏（精简聚焦：左侧页面标题，右侧双轨引擎切换 + 右上角主题切换） */}
        <header className="h-14 shrink-0 border-b border-slate-300 dark:border-slate-800 px-5 flex items-center justify-between gap-4 bg-white/90 dark:bg-slate-900/60 backdrop-blur-sm select-none">
          <div className="flex items-center gap-3 min-w-0">
            {!isSidebarOpen && (
              <button
                type="button"
                onClick={() => setIsSidebarOpen(true)}
                className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 dark:bg-slate-950 dark:hover:bg-slate-800 dark:text-slate-300 dark:border-slate-800 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0"
                title="展开侧边栏菜单"
              >
                ☰ 菜单
              </button>
            )}
            <div className="flex items-center gap-2 min-w-0">
              <h1 className="text-sm font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                {activeTab === 'devices' && '🖥️ 设备实时健康总览'}
                {activeTab === 'orders' && '📋 工单台账管理'}
                {activeTab === 'chat' && '💬 智能排障对话'}
              </h1>
              {activeTab === 'chat' && activeSession?.title && (
                <span
                  className="text-xs text-slate-500 dark:text-slate-400 truncate hidden sm:inline"
                  title={activeSession.title}
                >
                  · {activeSession.title}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <div className="flex items-center bg-slate-100 dark:bg-slate-950 p-1 rounded-lg border border-slate-300 dark:border-slate-800">
              <button
                onClick={() => !isThinking && setProvider('gemini')}
                disabled={isThinking}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                  provider === 'gemini'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                ☁️ 云端 Gemini
              </button>
              <button
                onClick={() => !isThinking && setProvider('local')}
                disabled={isThinking}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                  provider === 'local'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                🛡️ 本地私有引擎
              </button>
            </div>

            <button
              type="button"
              onClick={handleToggleTheme}
              aria-label={resolvedScheme === 'dark' ? '切换到浅色模式' : '切换到深色模式'}
              title={
                storedScheme
                  ? `当前固定为${resolvedScheme === 'dark' ? '深色' : '浅色'}模式，点击切换`
                  : `跟随系统（当前${resolvedScheme === 'dark' ? '深色' : '浅色'}），点击切换`
              }
              className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 dark:bg-slate-950 dark:hover:bg-slate-800 dark:text-slate-200 dark:border-slate-800 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap"
            >
              <span className="hidden dark:inline-flex items-center gap-1.5">
                <span aria-hidden="true">☀️</span>
                <span className="sr-only">切换到</span>浅色
              </span>
              <span className="inline-flex dark:hidden items-center gap-1.5">
                <span aria-hidden="true">🌙</span>
                <span className="sr-only">切换到</span>深色
              </span>
            </button>
          </div>
        </header>

        {/* 主工作区：设备总览 / 工单台账 / 智能排障 */}
        {activeTab === 'devices' ? (
          <DevicePanel
            healthData={healthData}
            loading={healthLoading}
            onRefresh={fetchDeviceHealth}
            onInvestigate={handleInvestigateDevice}
          />
        ) : activeTab === 'orders' ? (
          <WorkOrderPanel apiBase={API_BASE} onOrderResolved={fetchDeviceHealth} />
        ) : (
          <>
            {/* 消息历史滚动区（与底部输入框对齐 max-w-4xl，提升宽屏阅读舒适度） */}
            <div className="flex-1 overflow-y-auto p-6 bg-slate-100/80 dark:bg-slate-950/40 custom-scrollbar">
              <div className="max-w-4xl mx-auto w-full h-full flex flex-col">
                {messages.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-slate-600 dark:text-slate-400 text-xs space-y-4 select-none">
                    <div className="text-center space-y-1.5">
                      <div className="text-4xl mb-2">💬</div>
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        当前会话暂无历史排查记录
                      </p>
                      <p className="font-mono text-slate-500 dark:text-slate-400">
                        可点击下方快捷指令一键开测，或直接在底部输入排查需求
                      </p>
                    </div>
                    <div className="flex flex-wrap justify-center gap-2 max-w-xl">
                      {[
                        '请排查 DEV-003 当前的运行状态并派单',
                        '对比 DEV-001 和 DEV-003 近期温度趋势',
                        '查询 DEV-003 冷却系统高温应急 SOP'
                      ].map((quickText) => (
                        <button
                          key={quickText}
                          type="button"
                          disabled={isThinking || !currentSessionId}
                          onClick={() => sendPrompt(quickText, currentSessionId)}
                          className="px-3 py-1.5 rounded-full bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-300 hover:border-blue-300 dark:bg-slate-900 dark:hover:bg-slate-800 dark:text-slate-300 dark:hover:text-blue-300 dark:border-slate-700 text-xs transition-colors cursor-pointer disabled:opacity-50"
                        >
                          ✨ {quickText}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6 pb-2">
                    {messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                      >
                        {/* 角色标识 */}
                        <span className="text-[11px] font-mono text-slate-600 dark:text-slate-400 mb-1 px-1">
                          {msg.role === 'user' ? '👤 现场工程师' : '🤖 FDE 智能专家'}
                        </span>

                        {/* 消息气泡卡片 */}
                        <div
                          className={`max-w-[85%] rounded-xl p-4 text-sm ${
                            msg.role === 'user'
                              ? 'bg-blue-600 text-white shadow-md dark:shadow-lg dark:shadow-blue-950/30'
                              : 'bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 text-slate-800 dark:text-slate-200 shadow-md dark:shadow-xl'
                          }`}
                        >
                          {/* 若有工具调度日志，置于顶部 */}
                          {msg.toolLogs && msg.toolLogs.length > 0 && (
                            <div className="mb-4 space-y-2">
                              {msg.toolLogs.map((log, idx) => (
                                <div
                                  key={idx}
                                  className="bg-slate-50 dark:bg-slate-950/80 border-l-4 border-amber-500 p-2.5 rounded text-xs border border-slate-200 dark:border-slate-800/50"
                                >
                                  <div className="text-amber-700 dark:text-amber-400 font-bold flex items-center gap-1.5">
                                    <span className="animate-pulse">⚡</span> 底层调度: {log.tool_name}
                                  </div>
                                  <pre className="text-slate-600 dark:text-slate-400 text-[11px] font-mono mt-1 overflow-x-auto whitespace-pre-wrap">
                                    {JSON.stringify(log.arguments, null, 2)}
                                  </pre>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* 文本回复区域（用户气泡始终蓝底白字，不受 prose 浅色正文变量覆盖） */}
                          {msg.content ? (
                            msg.role === 'user' ? (
                              <div className="prose prose-invert max-w-none text-white [&_p]:my-0">
                                {renderMessageContent(msg.content)}
                              </div>
                            ) : (
                              <div className="prose dark:prose-invert prose-blue max-w-none text-slate-800 dark:text-slate-200">
                                {renderMessageContent(msg.content)}
                              </div>
                            )
                          ) : msg.role === 'assistant' ? (
                            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 font-mono text-xs animate-pulse">
                              <span>🧠</span> 思考中 / 正在调度物理底层工具...
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ))}
                    <div ref={chatBottomRef} />
                  </div>
                )}
              </div>
            </div>

            {/* 底部输入框 */}
            <div className="p-4 border-t border-slate-300 dark:border-slate-800 bg-white/95 dark:bg-slate-900/90 shrink-0">
              <div className="max-w-4xl mx-auto flex gap-3">
                <input
                  type="text"
                  className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-4 py-3 text-slate-900 dark:text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all disabled:opacity-50 font-mono text-sm"
                  placeholder="输入排查指令，例如：'请排查3号机状态并派单'，支持多轮连续追问..."
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                  disabled={isThinking}
                />
                <button
                  onClick={handleSubmit}
                  disabled={isThinking}
                  className="bg-blue-600 hover:bg-blue-500 active:scale-95 disabled:bg-slate-300 disabled:text-slate-500 dark:disabled:bg-slate-800 dark:disabled:text-slate-600 text-white px-7 py-3 rounded-lg font-medium transition-all shadow-md dark:shadow-lg dark:shadow-blue-900/20 cursor-pointer text-sm whitespace-nowrap"
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