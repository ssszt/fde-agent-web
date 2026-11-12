import { useState, useEffect, useCallback } from 'react'

export interface WorkOrderItem {
  order_id: string
  device_id: string
  reason: string
  priority: string
  status: string
  created_at: string
}

interface WorkOrderPanelProps {
  apiBase: string
}

export default function WorkOrderPanel({ apiBase }: WorkOrderPanelProps) {
  const [orders, setOrders] = useState<WorkOrderItem[]>([])
  const [loading, setLoading] = useState(false)
  const [resolvingId, setResolvingId] = useState<string | null>(null)

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${apiBase}/v1/work-orders`)
      if (res.ok) {
        const data: WorkOrderItem[] = await res.json()
        setOrders(data)
      }
    } catch (err) {
      console.error('获取工单台账失败:', err)
    } finally {
      setLoading(false)
    }
  }, [apiBase])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  const handleResolve = async (orderId: string) => {
    setResolvingId(orderId)
    try {
      const res = await fetch(`${apiBase}/v1/work-orders/${orderId}/resolve`, {
        method: 'PATCH'
      })
      if (res.ok) {
        setOrders((prev) =>
          prev.map((o) => (o.order_id === orderId ? { ...o, status: 'RESOLVED' } : o))
        )
      }
    } catch (err) {
      console.error('工单闭环更新失败:', err)
    } finally {
      setResolvingId(null)
    }
  }

  const openCount = orders.filter((o) => o.status !== 'RESOLVED').length
  const resolvedCount = orders.filter((o) => o.status === 'RESOLVED').length

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-slate-950/40">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* 顶部操作栏 & KPI 概览 */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-6 text-xs font-mono">
            <div>
              <div className="text-slate-500">工单总数</div>
              <div className="text-xl font-bold text-slate-100">{orders.length}</div>
            </div>
            <div className="h-8 w-px bg-slate-800" />
            <div>
              <div className="text-slate-500">待处理 (OPEN)</div>
              <div className="text-xl font-bold text-amber-400">{openCount}</div>
            </div>
            <div className="h-8 w-px bg-slate-800" />
            <div>
              <div className="text-slate-500">已闭环 (RESOLVED)</div>
              <div className="text-xl font-bold text-emerald-400">{resolvedCount}</div>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <button
              onClick={fetchOrders}
              disabled={loading}
              className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer disabled:opacity-50"
            >
              {loading ? '刷新中...' : '🔄 刷新台账'}
            </button>
            <a
              href={`${apiBase}/v1/work-orders/export`}
              download="work_orders.csv"
              className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition-colors"
            >
              📥 导出 CSV
            </a>
          </div>
        </div>

        {/* 工单明细表格 */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
          {orders.length === 0 ? (
            <div className="p-12 text-center text-slate-500 font-mono text-xs">
              暂无工单记录。回到「💬 智能排障」触发一次超温诊断，AI 会自动派单并写入这里！
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/80 text-slate-400 font-mono border-b border-slate-800">
                  <tr>
                    <th scope="col" className="px-4 py-3">工单编号</th>
                    <th scope="col" className="px-4 py-3">设备</th>
                    <th scope="col" className="px-4 py-3">故障原因</th>
                    <th scope="col" className="px-4 py-3">优先级</th>
                    <th scope="col" className="px-4 py-3">状态</th>
                    <th scope="col" className="px-4 py-3">创建时间</th>
                    <th scope="col" className="px-4 py-3 text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70 text-slate-200">
                  {orders.map((order) => {
                    const isResolved = order.status === 'RESOLVED'
                    return (
                      <tr key={order.order_id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="px-4 py-3 font-mono font-bold text-blue-400 whitespace-nowrap">
                          {order.order_id}
                        </td>
                        <td className="px-4 py-3 font-mono whitespace-nowrap">{order.device_id}</td>
                        <td className="px-4 py-3 max-w-md text-slate-300">{order.reason}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded font-mono text-[11px] font-bold ${
                              order.priority === 'EMERGENCY'
                                ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            }`}
                          >
                            {order.priority}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded font-mono text-[11px] ${
                              isResolved
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                            }`}
                          >
                            {isResolved ? '✅ 已闭环' : '⏳ 待处理'}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-400 whitespace-nowrap">
                          {order.created_at}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          {isResolved ? (
                            <span className="text-slate-500 font-mono">已归档</span>
                          ) : (
                            <button
                              onClick={() => handleResolve(order.order_id)}
                              disabled={resolvingId === order.order_id}
                              className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors cursor-pointer disabled:opacity-50"
                            >
                              {resolvingId === order.order_id ? '处理中...' : '确认闭环'}
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}