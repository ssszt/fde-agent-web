import React from 'react';
export default function TelemetryTable({ jsonStr }) {
  try {
    // 1. 将拦截到的 JSON 字符串解析回 JS 对象
    const data = JSON.parse(jsonStr);
    const history = data.history || [];

    // 2. 渲染带有 Tailwind 样式的现代化表格
    return (
      <div className="mt-4 mb-4 bg-gray-800 rounded-lg overflow-hidden border border-gray-700 shadow-lg">
        <div className="px-4 py-3 bg-gray-900 border-b border-gray-700 flex justify-between items-center">
          <span className="text-sm font-bold text-gray-200">
            📊 设备 <span className="text-blue-400">{data.device_id}</span> 历史遥测数据
          </span>
        </div>
        <table className="w-full text-left text-sm text-gray-300">
          <thead className="bg-gray-800 text-xs uppercase text-gray-400 border-b border-gray-700">
            <tr>
              <th className="px-4 py-3">时间戳</th>
              <th className="px-4 py-3">温度 (°C)</th>
              <th className="px-4 py-3">状态评估</th>
            </tr>
          </thead>
          <tbody>
            {history.map((row, index) => {
              // 核心逻辑：设定告警阈值（温度大于85或状态为严重故障）
              const isCritical = row.status === 'CRITICAL_FAULT' || row.temperature > 85;
              
              return (
                <tr 
                  key={index} 
                  // 触发告警时，整行背景变红
                  className={`border-b border-gray-700/50 ${isCritical ? 'bg-red-900/20' : 'hover:bg-gray-700/30'}`}
                >
                  <td className="px-4 py-3 font-mono text-xs">{row.timestamp}</td>
                  <td className={`px-4 py-3 font-bold ${isCritical ? 'text-red-400' : 'text-green-400'}`}>
                    {row.temperature}
                  </td>
                  <td className="px-4 py-3">
                    {isCritical ? (
                      <span className="bg-red-500/20 text-red-400 px-2 py-1 rounded text-xs font-bold border border-red-500/30">
                        {row.status}
                      </span>
                    ) : (
                      <span className="bg-green-500/10 text-green-400 px-2 py-1 rounded text-xs border border-green-500/20">
                        {row.status}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  } catch (e) {
    // 如果大模型返回的 JSON 有语法错误，降级显示原始文本防崩溃
    return <div className="text-red-400 text-sm bg-red-900/20 p-4 rounded">数据解析失败: {jsonStr}</div>;
  }
}