import { useState } from 'react'

function App() {
  // 💡 Vue 映射：等价于 const prompt = ref('')
  const [prompt, setPrompt] = useState('')

  // 💡 Vue 映射：等价于 const handleSubmit = () => { ... }
  const handleSubmit = () => {
    alert(`准备发送给后端的指令: ${prompt}`)
  }

  return (
    // 这里的 className 全是 Tailwind 语法，含义直白：满屏高度、柔和变灰背景、弹性居中
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-slate-800 rounded-xl shadow-2xl p-6 border border-slate-700">
        
        <h1 className="text-2xl font-bold text-blue-400 mb-6">
          ⚙️ FDE 现场设备排查终端
        </h1>
        
        {/* 对话展示区（暂时留空） */}
        <div className="h-64 bg-slate-900 rounded-lg p-4 mb-4 border border-slate-700 font-mono text-sm overflow-y-auto">
          <span className="text-slate-500">等待输入指令...</span>
        </div>

        {/* 输入区 */}
        <div className="flex gap-3">
          <input 
            type="text" 
            className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500 transition-colors"
            placeholder="例如：3号机 DEV-003 亮红灯了，查下情况！"
            // 💡 Vue 映射：等价于 v-model="prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          />
          <button 
            onClick={handleSubmit}
            className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-lg font-medium transition-colors"
          >
            发送
          </button>
        </div>

      </div>
    </div>
  )
}

export default App