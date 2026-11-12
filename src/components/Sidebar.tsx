export interface SessionItem {
  session_id: string
  title: string
  created_at: string
  updated_at: string
}

interface SidebarProps {
  sessions: SessionItem[]
  currentSessionId: string
  activeTab: 'devices' | 'chat' | 'orders'
  abnormalDevices: number
  openWorkOrders: number
  onSelectTab: (tab: 'devices' | 'chat' | 'orders') => void
  onSelectSession: (sessionId: string) => void
  onNewSession: () => void
  onDeleteSession: (sessionId: string) => void
  isOpen: boolean
  onToggle: () => void
}

export default function Sidebar({
  sessions,
  currentSessionId,
  activeTab,
  abnormalDevices,
  openWorkOrders,
  onSelectTab,
  onSelectSession,
  onNewSession,
  onDeleteSession,
  isOpen,
  onToggle
}: SidebarProps) {
  if (!isOpen) {
    return null
  }

  return (
    <aside className="w-72 shrink-0 bg-slate-50 dark:bg-slate-950 border-r border-slate-300 dark:border-slate-800 flex flex-col h-screen select-none z-40 transition-all">
      {/* 1. 顶部品牌栏（与右侧主 header 等高对齐） */}
      <div className="h-14 px-4 border-b border-slate-300 dark:border-slate-800 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100 font-bold text-sm tracking-wide truncate">
          <span>⚙️</span>
          <span className="truncate">FDE Console 2.0</span>
        </div>
        <button
          onClick={onToggle}
          className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 text-xs px-2 py-1 rounded hover:bg-slate-200 dark:hover:bg-slate-900 transition-colors cursor-pointer whitespace-nowrap"
          title="收起侧边栏"
        >
          ◀ 收起
        </button>
      </div>

      {/* 2. 工作台导航菜单区 */}
      <nav aria-label="主功能菜单" className="p-3 border-b border-slate-300 dark:border-slate-800 space-y-1 shrink-0">
        <div className="px-2 pb-1 text-[11px] font-mono font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          工作台菜单
        </div>

        <button
          onClick={() => onSelectTab('devices')}
          className={`w-full px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-between transition-all cursor-pointer border whitespace-nowrap ${
            activeTab === 'devices'
              ? 'bg-blue-50 text-blue-700 border-blue-200 shadow-sm dark:bg-blue-600/15 dark:text-blue-300 dark:border-blue-500/30'
              : 'border-transparent text-slate-700 hover:bg-slate-200/70 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-slate-100'
          }`}
        >
          <span className="flex items-center gap-2">
            <span aria-hidden="true">🖥️</span>
            <span>设备总览</span>
          </span>
          {abnormalDevices > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-mono font-bold leading-none">
              {abnormalDevices}
            </span>
          )}
        </button>

        <button
          onClick={() => onSelectTab('chat')}
          className={`w-full px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-between transition-all cursor-pointer border whitespace-nowrap ${
            activeTab === 'chat'
              ? 'bg-blue-50 text-blue-700 border-blue-200 shadow-sm dark:bg-blue-600/15 dark:text-blue-300 dark:border-blue-500/30'
              : 'border-transparent text-slate-700 hover:bg-slate-200/70 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-slate-100'
          }`}
        >
          <span className="flex items-center gap-2">
            <span aria-hidden="true">💬</span>
            <span>智能排障</span>
          </span>
        </button>

        <button
          onClick={() => onSelectTab('orders')}
          className={`w-full px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-between transition-all cursor-pointer border whitespace-nowrap ${
            activeTab === 'orders'
              ? 'bg-blue-50 text-blue-700 border-blue-200 shadow-sm dark:bg-blue-600/15 dark:text-blue-300 dark:border-blue-500/30'
              : 'border-transparent text-slate-700 hover:bg-slate-200/70 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-slate-100'
          }`}
        >
          <span className="flex items-center gap-2">
            <span aria-hidden="true">📋</span>
            <span>工单台账</span>
          </span>
          {openWorkOrders > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-amber-500 text-slate-950 text-[10px] font-mono font-bold leading-none">
              {openWorkOrders}
            </span>
          )}
        </button>
      </nav>

      {/* 3. 排障历史会话标题与新建按钮 */}
      <div className="px-4 pt-3 pb-2 flex flex-col gap-2.5 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 font-semibold text-[11px] font-mono uppercase tracking-wider">
            <span>🗂️</span> 排障历史会话
          </div>
          <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
            {sessions.length} 条
          </span>
        </div>

        <button
          onClick={onNewSession}
          className="w-full bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white py-2 px-4 rounded-lg font-medium text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm dark:shadow-lg dark:shadow-blue-900/30 cursor-pointer whitespace-nowrap"
        >
          <span className="text-base leading-none font-bold">+</span> 新建排查会话
        </button>
      </div>

      {/* 4. 历史会话卡片列表 */}
      <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1.5 custom-scrollbar">
        {sessions.length === 0 ? (
          <div className="text-center py-12 text-slate-600 dark:text-slate-400 text-xs font-mono">
            暂无历史排查记录
          </div>
        ) : (
          sessions.map((sess) => {
            const isActive = activeTab === 'chat' && sess.session_id === currentSessionId
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
                    ? 'bg-blue-50 dark:bg-slate-900/90 border-blue-500 dark:border-blue-500/80 shadow-sm dark:shadow-md dark:shadow-blue-950/40 text-blue-900 dark:text-blue-100'
                    : 'bg-white dark:bg-slate-950/40 border-slate-200 dark:border-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-900/50 hover:border-slate-300 dark:hover:border-slate-700 text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
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
                    className="opacity-0 group-hover:opacity-100 text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-xs transition-opacity cursor-pointer"
                    title="删除此会话"
                  >
                    🗑️
                  </button>
                </div>

                {/* 时间戳与 Session 短 ID */}
                <div className="flex items-center justify-between text-[10px] font-mono text-slate-600 dark:text-slate-400">
                  <span>{timeStr}</span>
                  <span className="truncate max-w-[80px]">{sess.session_id}</span>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* 底部工作站状态 */}
      <div className="p-3 border-t border-slate-300 dark:border-slate-800/80 text-[11px] font-mono text-slate-600 dark:text-slate-400 flex items-center justify-between bg-slate-100/80 dark:bg-slate-950/60 shrink-0">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          SQLite 持久化就绪
        </span>
        <span>v2.0</span>
      </div>
    </aside>
  )
}