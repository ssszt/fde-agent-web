export interface SessionItem {
  session_id: string
  title: string
  created_at: string
  updated_at: string
}

interface SidebarProps {
  sessions: SessionItem[]
  currentSessionId: string
  onSelectSession: (sessionId: string) => void
  onNewSession: () => void
  onDeleteSession: (sessionId: string) => void
  isOpen: boolean
  onToggle: () => void
}

export default function Sidebar({
  sessions,
  currentSessionId,
  onSelectSession,
  onNewSession,
  onDeleteSession,
  isOpen,
  onToggle
}: SidebarProps) {
  if (!isOpen) {
    return (
      <button
        onClick={onToggle}
        className="fixed top-4 left-4 z-50 bg-slate-900 border border-slate-700 hover:border-blue-500 text-slate-300 p-2.5 rounded-lg shadow-xl cursor-pointer text-sm transition-all"
        title="展开历史会话抽屉"
      >
        📑 展开历史
      </button>
    )
  }

  return (
    <aside className="w-72 bg-slate-950 border-r border-slate-800 flex flex-col h-screen select-none z-40 transition-all">
      {/* 侧边栏头部与新建按钮 */}
      <div className="p-4 border-b border-slate-800 flex flex-col gap-3">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2 text-slate-200 font-bold text-sm tracking-wide">
            <span>🗂️</span> 排障历史会话
          </div>
          <button
            onClick={onToggle}
            className="text-slate-500 hover:text-slate-300 text-xs px-2 py-1 rounded hover:bg-slate-900 transition-colors cursor-pointer"
            title="收起侧边栏"
          >
            ◀ 收起
          </button>
        </div>

        <button
          onClick={onNewSession}
          className="w-full bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white py-2.5 px-4 rounded-lg font-medium text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-900/30 cursor-pointer"
        >
          <span className="text-base leading-none font-bold">+</span> 新建排查会话
        </button>
      </div>

      {/* 历史会话卡片列表 */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1.5 custom-scrollbar">
        {sessions.length === 0 ? (
          <div className="text-center py-12 text-slate-600 text-xs font-mono">
            暂无历史排查记录
          </div>
        ) : (
          sessions.map((sess) => {
            const isActive = sess.session_id === currentSessionId
            // 格式化时间戳显示 MM-DD HH:mm
            const timeStr = sess.updated_at
              ? sess.updated_at.replace('T', ' ').slice(5, 16)
              : ''

            return (
              <div
                key={sess.session_id}
                onClick={() => onSelectSession(sess.session_id)}
                className={`group relative p-3 rounded-lg cursor-pointer transition-all border text-left flex flex-col gap-1 ${
                  isActive
                    ? 'bg-slate-900/90 border-blue-500/80 shadow-md shadow-blue-950/40 text-blue-100'
                    : 'bg-slate-950/40 border-slate-800/60 hover:bg-slate-900/50 hover:border-slate-700 text-slate-400 hover:text-slate-200'
                }`}
              >
                {/* 会话标题与删除按钮 */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium truncate flex-1" title={sess.title}>
                    {isActive ? '🔹 ' : '▫️ '}
                    {sess.title || '新排查会话'}
                  </span>

                  <button
                    onClick={(e) => {
                      e.stopPropagation() // 阻止触发切换会话
                      onDeleteSession(sess.session_id)
                    }}
                    className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-rose-400 p-1 rounded hover:bg-slate-800 text-xs transition-opacity cursor-pointer"
                    title="删除此会话"
                  >
                    🗑️
                  </button>
                </div>

                {/* 时间戳与 Session 短 ID */}
                <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
                  <span>{timeStr}</span>
                  <span className="truncate max-w-[80px]">{sess.session_id}</span>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* 底部工作站状态 */}
      <div className="p-3 border-t border-slate-800/80 text-[11px] font-mono text-slate-500 flex items-center justify-between bg-slate-950/60">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          SQLite 持久化就绪
        </span>
        <span>v2.0</span>
      </div>
    </aside>
  )
}