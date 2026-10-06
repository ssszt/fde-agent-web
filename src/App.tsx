import { useState } from 'react'
import ReactMarkdown from 'react-markdown'

function App() {
  const [prompt, setPrompt] = useState('')
  const [reply, setReply] = useState('')
  // 新增：专门用于独立存放后台工具调用的状态数组
  const [toolLogs, setToolLogs] = useState<any[]>([])
  const [isThinking, setIsThinking] = useState(false)

  const handleSubmit = async () => {
    if (!prompt.trim() || isThinking) return;
    
    const currentPrompt = prompt;
    setPrompt('');
    setReply('');
    setToolLogs([]); // 每次发新消息清空旧日志
    setIsThinking(true);

    try {
      const response = await fetch('http://127.0.0.1:8000/v1/agent/dispatch/stream', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: currentPrompt }) 
      });

      if (!response.body) throw new Error('浏览器不支持流式读取');

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() || '';

        for (const part of parts) {
          const lines = part.split('\n');
          let eventType = '';
          let dataStr = '';

          for (const line of lines) {
            if (line.startsWith('event:')) eventType = line.replace('event:', '').trim();
            else if (line.startsWith('data:')) dataStr = line.replace('data:', '').trim();
          }

          if (dataStr) {
            try {
              const parsedData = JSON.parse(dataStr);
              
              if (eventType === 'delta' && parsedData.text) {
                // 纯文本增量直接拼接
                setReply((prev) => prev + parsedData.text);
              } 
              else if (eventType === 'tool_call') {
                // 工具调用存入独立数组，用于渲染雷达卡片
                setToolLogs((prev) => [...prev, parsedData]);
              }
            } catch (e) {
              console.warn("JSON解析跳过非标准数据:", dataStr);
            }
          }
        }
      }
    } catch (error) {
      console.error('通信断开:', error);
      setReply('\n[系统提示] 无法连接到设备中心，请检查后端服务状态。');
    } finally {
      setIsThinking(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-3xl bg-slate-900 rounded-xl shadow-2xl p-6 border border-slate-800">
        
        <h1 className="text-2xl font-bold text-blue-500 mb-6 flex items-center gap-2">
          ⚙️ 现场设备排查终端 (FDE Console)
        </h1>
        
        {/* 对话展示区 */}
        <div className="h-[500px] bg-slate-950 rounded-lg p-6 mb-4 border border-slate-800 overflow-y-auto">
          
          {/* 1. 优先渲染底层工具调用卡片 */}
          {toolLogs.map((log, idx) => (
            <div key={idx} className="bg-slate-800/50 border-l-4 border-amber-500 p-4 mb-6 rounded shadow-sm">
              <div className="text-amber-500 font-bold text-sm mb-2 flex items-center gap-2">
                <span className="animate-pulse">⚡</span> 底层调度: {log.tool_name}
              </div>
              <pre className="text-slate-400 text-xs font-mono whitespace-pre-wrap break-all">
                {JSON.stringify(log.arguments, null, 2)}
              </pre>
            </div>
          ))}

          {/* 2. 渲染 Markdown 排版的正式回复 */}
          {reply ? (
            <div className="prose prose-invert prose-blue max-w-none">
              <ReactMarkdown>{reply}</ReactMarkdown>
            </div>
          ) : (
            <div className="text-slate-600 font-mono text-sm mt-2">
              等待现场指令录入...
            </div>
          )}
        </div>

        {/* 输入区 */}
        <div className="flex gap-3">
          <input 
            type="text" 
            className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all disabled:opacity-50 font-mono text-sm"
            placeholder="例如：3号机 DEV-003 亮红灯了，查下情况！"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            disabled={isThinking}
          />
          <button 
            onClick={handleSubmit}
            disabled={isThinking}
            className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 text-white px-8 py-3 rounded-lg font-medium transition-colors shadow-lg shadow-blue-900/20"
          >
            {isThinking ? '诊断中...' : '发送'}
          </button>
        </div>

      </div>
    </div>
  )
}

export default App