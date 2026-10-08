import React, { useDebugValue, useState } from 'react';

interface TelemetryPoint {
    timestamp: string;
    temperature: number;
    status: string;
}

interface TelemetryData {
    device_id: string;
    history: TelemetryPoint[];
}

export default function TelemetryTable({jsonStr}: {jsonStr: string;})  {
    //控制底部原始明细表格的折叠展开
    const [showTable, setShowTable] = useState(false);
    try {
        const data: TelemetryData = JSON.parse(jsonStr);
        const rawHistory = data.history || [];
        if(rawHistory.length == 0) {
            return (
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-lg text-slate-400 text-sm">
                    暂无设备 {data.device_id} 的时序数据
                </div>
            );
        }

        //核心细节 1：时序对齐（数据库查询是倒序 DESC，图表横轴必须按时间正序从左至右）
        const chronologicalHistory = [...rawHistory].reverse();

        //核心细节 2：统计指标提取与告警判定
        const latestPoint = rawHistory[0] // 最新数据点
        const maxTemp = Math.max(...rawHistory.map((d) => d.temperature));
        const minTemp = Math.min(...rawHistory.map((d) => d.temperature));
        const isCritical = latestPoint.status === 'CRITICAL_FAULT' || latestPoint.temperature > 85;

        //核心细节 3：响应式 SVG 坐标空间设计（宽 500，高 140）
        const width = 500
        const height = 140
        const padding = {top: 25, bottom: 25, left: 35, right: 25}

        //Y 轴温度量程映射（最低 50°C，最高至少包含 105°C 或当前最高温）
        const yMin = Math.min(50, Math.floor(minTemp - 5));
        const yMax = Math.max(105, Math.ceil(maxTemp + 5));

        const getY = (val: number) => {
            return height - padding.bottom - ((val - yMin) / (yMax - yMin)) * (height - padding.top - padding.bottom);
        }
        const getX = (index: number) => {
            const step = (width - padding.left - padding.right) / (chronologicalHistory.length - 1 || 1);
            return padding.left + index * step;
        }

        //生成折线轨迹Path坐标串
        const pointsPath = chronologicalHistory.map((d, idx) => `${getX(idx)},${getY(d.temperature)}`).join(' ');

        //85度故障阈值红线Y坐标
        const warningLineY = getY(85);
        return (
            <div className="my-4 bg-slate-900/90 backdrop-blur rounded-xl border border-slate-700/80 shadow-2xl overflow-hidden font-sans">
                {/* 1. 顶部 Header & KPI 指标卡片 */}
                <div className="p-4 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <span className="text-lg">📊</span>
                        <div>
                            <div className="text-xs text-slate-400 font-mono">DEVICE MONITOR</div>
                            <div className="text-base font-bold text-slate-100 flex items-center gap-2">
                                <span>{data.device_id}</span>
                                <span className={`text-xs px-2 py-0.5 rounded font-mono font-bold ${
                                isCritical ? 'bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse' : 'bg-emerald-500/20 text-emerald-400'
                                }`}>
                                {latestPoint.status}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-4 text-xs font-mono">
                        <div className="bg-slate-950/60 px-3 py-1.5 rounded border border-slate-800">
                            <span className="text-slate-500 block">实时温度</span>
                            <span className={`text-sm font-bold ${latestPoint.temperature > 85 ? 'text-red-400' : 'text-emerald-400'}`}>
                                {latestPoint.temperature.toFixed(1)}°C
                            </span>
                        </div>
                        <div className="bg-slate-950/60 px-3 py-1.5 rounded border border-slate-800">
                            <span className="text-slate-500 block">区间峰值</span>
                            <span className="text-sm font-bold text-amber-400">{maxTemp.toFixed(1)}°C</span>
                        </div>
                    </div>
                </div>
                {/* 2. 核心时序趋势图 (SVG 响应式绘制) */}
                <div className="p-4 bg-slate-950/40">
                    <div className="flex justify-between items-center text-xs text-slate-400 mb-1">
                        <span className="font-mono flex items-center gap-2">
                        <span className="inline-block w-2 h-2 rounded-full bg-blue-500"></span>
                        温度变化趋势 ({chronologicalHistory.length} 个采样点)
                        </span>
                        <span className="text-red-400/80 flex items-center gap-1 font-mono">
                        <span className="w-3 border-b-2 border-dashed border-red-500"></span>
                        85°C 报警阈值
                        </span>
                    </div>
                    <div className="w-full overflow-hidden">
                        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible">
                        {/* 85°C 警示参考红线 */}
                        <line
                            x1={padding.left}
                            y1={warningLineY}
                            x2={width - padding.right}
                            y2={warningLineY}
                            stroke="#ef4444"
                            strokeDasharray="4 4"
                            strokeWidth="1.5"
                            opacity="0.8"
                        />
                        <text x={width - padding.right + 4} y={warningLineY + 3} fill="#ef4444" fontSize="9" fontFamily="monospace">
                            85°C
                        </text>
                        {/* 折线图连线 */}
                        <polyline
                            fill="none"
                            stroke="#38bdf8"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            points={pointsPath}
                        />
                        {/* 数据节点 & 标注 */}
                        {chronologicalHistory.map((d, idx) => {
                            const cx = getX(idx);
                            const cy = getY(d.temperature);
                            const isPointCritical = d.temperature > 85;
                            return (
                            <g key={idx} className="group cursor-pointer">
                                <circle
                                cx={cx}
                                cy={cy}
                                r={isPointCritical ? 4.5 : 3.5}
                                className={isPointCritical ? 'fill-red-500 stroke-red-200' : 'fill-blue-500 stroke-slate-900'}
                                strokeWidth="2"
                                />
                                {/* 温度数字标注 */}
                                <text
                                x={cx}
                                y={cy - 8}
                                textAnchor="middle"
                                fontSize="9"
                                fontFamily="monospace"
                                className={isPointCritical ? 'fill-red-400 font-bold' : 'fill-slate-400'}
                                >
                                {d.temperature}°
                                </text>
                                {/* 时间标签 (首末节点展示) */}
                                {(idx === 0 || idx === chronologicalHistory.length - 1) && (
                                <text
                                    x={cx}
                                    y={height - 8}
                                    textAnchor="middle"
                                    fontSize="8"
                                    fontFamily="monospace"
                                    fill="#64748b"
                                >
                                    {d.timestamp.split(' ')[1] || d.timestamp}
                                </text>
                                )}
                            </g>
                            );
                        })}
                        </svg>
                    </div>
                </div>
                 {/* 3. 底部：明细数据可折叠表格 */}
                <div className="border-t border-slate-800 bg-slate-900/60">
                    <button
                        onClick={() => setShowTable(!showTable)}
                        className="w-full px-4 py-2 text-xs font-mono text-slate-400 hover:text-slate-200 flex justify-between items-center transition-colors"
                    >
                        <span>{showTable ? '▲ 收起详细追溯日志' : '▼ 展开详细追溯日志 (' + rawHistory.length + '条记录)'}</span>
                        <span className="text-[10px] text-slate-500">SQLite 数据源</span>
                    </button>
                    {showTable && (
                        <div className="p-3 border-t border-slate-800/80">
                        <table className="w-full text-left text-xs font-mono text-slate-300">
                            <thead className="text-[10px] uppercase text-slate-500 border-b border-slate-800">
                            <tr>
                                <th className="pb-2">时间戳</th>
                                <th className="pb-2">温度</th>
                                <th className="pb-2 text-right">状态</th>
                            </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/50">
                            {rawHistory.map((row, index) => {
                                const rowCritical = row.status === 'CRITICAL_FAULT' || row.temperature > 85;
                                return (
                                <tr key={index} className={rowCritical ? 'bg-red-500/10' : ''}>
                                    <td className="py-1.5 text-slate-400">{row.timestamp}</td>
                                    <td className={`py-1.5 font-bold ${rowCritical ? 'text-red-400' : 'text-emerald-400'}`}>
                                    {row.temperature}°C
                                    </td>
                                    <td className="py-1.5 text-right">
                                    <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                                        rowCritical ? 'bg-red-500/20 text-red-400' : 'text-slate-400'
                                    }`}>
                                        {row.status}
                                    </span>
                                    </td>
                                </tr>
                                );
                            })}
                            </tbody>
                        </table>
                        </div>
                    )}
                </div>
            </div>
        );
    } catch (error) {
        return (
        <div className="text-red-400 text-xs bg-red-950/30 border border-red-900/50 p-3 rounded font-mono my-2">
            ⚠️ 遥测时序数据解析异常: {String(error)}
        </div>
        );
    }
}