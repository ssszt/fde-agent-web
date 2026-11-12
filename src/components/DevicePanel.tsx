export interface DeviceHealthItem {
  device_id: string
  temperature: number
  status: string
  last_updated: string
  open_orders: number
}

export interface DeviceHealthResponse {
  devices: DeviceHealthItem[]
  summary: {
    total_devices: number
    abnormal_devices: number
    open_work_orders: number
  }
}

interface DevicePanelProps {
  healthData: DeviceHealthResponse | null
  loading: boolean
  onRefresh: () => void
  onInvestigate: (deviceId: string) => void
}

const STATUS_STYLE_MAP: Record<
  string,
  { label: string; border: string; badge: string; dot: string }
> = {
  CRITICAL_FAULT: {
    label: '严重告警',
    border: 'border-red-300 dark:border-red-500/40 shadow-red-500/10 dark:shadow-red-950/20',
    badge: 'bg-red-50 text-red-700 border border-red-300 dark:bg-red-500/20 dark:text-red-400 dark:border-red-500/30',
    dot: 'bg-red-500 animate-ping'
  },
  WARNING: {
    label: '温度预警',
    border: 'border-amber-300 dark:border-amber-500/40 shadow-amber-500/10 dark:shadow-amber-950/20',
    badge: 'bg-amber-50 text-amber-800 border border-amber-300 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/30',
    dot: 'bg-amber-400 animate-pulse'
  },
  NORMAL: {
    label: '运行正常',
    border: 'border-emerald-300 dark:border-emerald-500/30 shadow-emerald-500/10 dark:shadow-emerald-950/10',
    badge: 'bg-emerald-50 text-emerald-700 border border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30',
    dot: 'bg-emerald-500'
  }
}

export default function DevicePanel({
  healthData,
  loading,
  onRefresh,
  onInvestigate
}: DevicePanelProps) {
  const devices = healthData?.devices ?? []
  const summary = healthData?.summary ?? {
    total_devices: 0,
    abnormal_devices: 0,
    open_work_orders: 0
  }
  const normalCount = summary.total_devices - summary.abnormal_devices

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-slate-100/80 dark:bg-slate-950/40 custom-scrollbar">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* 顶部 KPI 概览栏 */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-6 text-xs font-mono">
            <div>
              <div className="text-slate-600 dark:text-slate-400">接入设备总数</div>
              <div className="text-xl font-bold text-slate-900 dark:text-slate-100">{summary.total_devices}</div>
            </div>
            <div className="h-8 w-px bg-slate-300 dark:bg-slate-800" />
            <div>
              <div className="text-slate-600 dark:text-slate-400">健康运行 (NORMAL)</div>
              <div className="text-xl font-bold text-emerald-700 dark:text-emerald-400">{normalCount}</div>
            </div>
            <div className="h-8 w-px bg-slate-300 dark:bg-slate-800" />
            <div>
              <div className="text-slate-600 dark:text-slate-400">异常告警设备</div>
              <div className="text-xl font-bold text-red-600 dark:text-red-400">{summary.abnormal_devices}</div>
            </div>
            <div className="h-8 w-px bg-slate-300 dark:bg-slate-800" />
            <div>
              <div className="text-slate-600 dark:text-slate-400">未闭环工单</div>
              <div className="text-xl font-bold text-amber-700 dark:text-amber-400">{summary.open_work_orders}</div>
            </div>
          </div>

          <button
            onClick={onRefresh}
            disabled={loading}
            className="px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 dark:border-slate-700 text-xs transition-colors cursor-pointer disabled:opacity-50"
          >
            {loading ? '巡检中...' : '🔄 立即刷新巡检'}
          </button>
        </div>

        {/* 设备健康卡片网格 */}
        {devices.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl p-12 text-center text-slate-600 dark:text-slate-400 font-mono text-xs">
            暂无设备遥测数据，请确认后端已执行 mock_db.py 初始化。
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {devices.map((dev) => {
              const style = STATUS_STYLE_MAP[dev.status] ?? STATUS_STYLE_MAP.WARNING
              const isAlert = dev.status !== 'NORMAL'

              return (
                <div
                  key={dev.device_id}
                  className={`bg-white dark:bg-slate-900 border rounded-xl p-5 shadow-md dark:shadow-xl flex flex-col justify-between space-y-4 transition-all hover:translate-y-[-2px] ${style.border}`}
                >
                  <div className="space-y-3">
                    {/* 卡片头：设备编号 + 状态呼吸灯 */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
                          <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${style.dot}`} />
                          <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${dev.status === 'NORMAL' ? 'bg-emerald-500' : dev.status === 'WARNING' ? 'bg-amber-400' : 'bg-red-500'}`} />
                        </span>
                        <span className="font-mono font-bold text-base text-slate-900 dark:text-slate-100">
                          {dev.device_id}
                        </span>
                      </div>
                      <span className={`px-2 py-0.5 rounded font-mono text-[11px] font-bold ${style.badge}`}>
                        {style.label}
                      </span>
                    </div>

                    {/* 核心遥测温度 */}
                    <div className="bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800/80 rounded-lg p-3 flex items-baseline justify-between">
                      <span className="text-xs text-slate-600 dark:text-slate-400 font-mono">最新核心温度</span>
                      <span
                        className={`text-2xl font-mono font-bold ${
                          dev.temperature >= 85
                            ? 'text-red-600 dark:text-red-400'
                            : dev.temperature >= 75
                              ? 'text-amber-700 dark:text-amber-400'
                              : 'text-emerald-700 dark:text-emerald-400'
                        }`}
                      >
                        {dev.temperature.toFixed(1)} °C
                      </span>
                    </div>

                    {/* 辅助元信息 */}
                    <div className="flex items-center justify-between text-[11px] font-mono text-slate-600 dark:text-slate-400">
                      <span>上报: {dev.last_updated}</span>
                      {dev.open_orders > 0 ? (
                        <span className="text-amber-700 dark:text-amber-300 font-bold">
                          ⏳ 待办工单: {dev.open_orders}
                        </span>
                      ) : (
                        <span className="text-slate-600 dark:text-slate-400">无待办工单</span>
                      )}
                    </div>
                  </div>

                  {/* 一键发起 AI 排查 */}
                  <button
                    onClick={() => onInvestigate(dev.device_id)}
                    className={`w-full py-2.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                      isAlert
                        ? 'bg-red-600 hover:bg-red-500 text-white shadow-md dark:shadow-lg dark:shadow-red-950/30'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 dark:border-slate-700'
                    }`}
                  >
                    🔍 立即 AI 排障
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}