import { useState, useRef, useEffect } from 'react'
import TelemetryTable from './components/TelemetryTable'
import ReactMarkdown from 'react-markdown'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  toolLogs: any[]
}

function App() {
  const [prompt, setPrompt] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [isThinking, setIsThinking] = useState(false)

  // 为本次浏览器访问生成一个稳定的 session_id
  const sessionIdRef = useRef<string>(
    'sess-' + Math.random().toString(36).substring(2, 9)
  )

  // 消息自动滚到底部
  const chatBottomRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isThinking])

  const handleSubmit = async () => {
    if (!prompt.trim() || isThinking) return

    const userText = prompt
    setPrompt('')
    setIsThinking(true)

    // 1. 生成用户消息和空的助理回复占位
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

    // 将用户问题和助手空气泡先追加到对话列表中（不清空旧记录！）
    setMessages((prev) => [...prev, userMessage, assistantPlaceholder])

    try {
      const response = await fetch('http://127.0.0.1:8000/v1/agent/dispatch/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: userText,
          session_id: sessionIdRef.current // 👈 传递同一个会话ID！
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
                // 流式更新当前这轮 assistant 消息的内容
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMsgId
                      ? { ...msg, content: msg.content + parsedData.text }
                      : msg
                  )
                )
              } else if (eventType === 'tool_call') {
                // 追加到当前这轮 assistant 消息的工具日志中
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
    }
  }

  // 渲染单条回复中的 Markdown 和动态表格组件
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
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-4xl bg-slate-900 rounded-xl shadow-2xl p-6 border border-slate-800 flex flex-col h-[85vh]">
        
        {/* 头部导航与 Session 标识 */}
        <div className="flex justify-between items-center pb-4 mb-4 border-b border-slate-800">
          <h1 className="text-xl font-bold text-blue-500 flex items-center gap-2">
            ⚙️ 现场设备多轮排查工作站 (FDE Console 2.0)
          </h1>
          <div className="text-xs font-mono text-slate-500 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            会话保持: {sessionIdRef.current}
          </div>
        </div>

        {/* 消息历史滚动区 */}
        <div className="flex-1 bg-slate-950 rounded-lg p-6 mb-4 border border-slate-800 overflow-y-auto space-y-6">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-600 font-mono text-sm">
              <span className="text-4xl mb-3">💬</span>
              等待现场指令录入，支持连续多轮追问与上下文跨设备对比...
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${
                  msg.role === 'user' ? 'items-end' : 'items-start'
                }`}
              >
                {/* 角色标识 */}
                <span className="text-[11px] font-mono text-slate-500 mb-1 px-1">
                  {msg.role === 'user' ? '👤 现场工程师' : '🤖 FDE 智能专家'}
                </span>

                {/* 消息卡片容器 */}
                <div
                  className={`max-w-[90%] rounded-xl p-4 text-sm ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white shadow-lg'
                      : 'bg-slate-900 border border-slate-800 text-slate-200 shadow-xl'
                  }`}
                >
                  {/* 若有工具调度卡片，优先展示在助理回复顶部 */}
                  {msg.toolLogs && msg.toolLogs.length > 0 && (
                    <div className="mb-4 space-y-2">
                      {msg.toolLogs.map((log, idx) => (
                        <div
                          key={idx}
                          className="bg-slate-950 border-l-4 border-amber-500 p-3 rounded text-xs"
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
                      <span>🧠</span> 思考中 / 工具联动中...
                    </div>
                  ) : null}
                </div>
              </div>
            ))
          )}
          <div ref={chatBottomRef} />
        </div>

        {/* 底部输入框 */}
        <div className="flex gap-3 pt-2">
          <input
            type="text"
            className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all disabled:opacity-50 font-mono text-sm"
            placeholder="例如第一轮：'3号机 DEV-003 亮红灯了，查下情况！'，第二轮追问：'刚才派发的工单号是什么？'"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            disabled={isThinking}
          />
          <button
            onClick={handleSubmit}
            disabled={isThinking}
            className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 text-white px-8 py-3 rounded-lg font-medium transition-colors shadow-lg shadow-blue-900/20 cursor-pointer text-sm"
          >
            {isThinking ? '诊断中...' : '发送'}
          </button>
        </div>

      </div>
    </div>
  )
}

export default App