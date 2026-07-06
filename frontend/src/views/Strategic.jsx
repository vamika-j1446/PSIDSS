import React, { useEffect, useState, useRef, useCallback } from 'react';
import axios from 'axios';
import { ShieldAlert, TrendingDown, TrendingUp, AlertTriangle, AlertCircle, CheckCircle, Info } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

export default function Strategic({ token, selectedYear, activeTab }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState('granular'); // 'granular' or 'group'
  const fetchingRef = useRef(false);

  const fetchStrategicData = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const response = await axios.get(`/api/strategic/analysis?year=${selectedYear}`, config);
      console.log('Strategic API response keys:', Object.keys(response.data || {}));
      setData(response.data);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch strategic analysis.');
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, [token, selectedYear]);

  useEffect(() => {
    fetchStrategicData();
  }, [fetchStrategicData]);

  // Auto-refresh after Excel upload
  useEffect(() => {
    const handler = () => {
      fetchingRef.current = false;
      fetchStrategicData();
    };
    window.addEventListener('psidss-data-updated', handler);
    return () => window.removeEventListener('psidss-data-updated', handler);
  }, [fetchStrategicData]);

  if (loading) {
    return (
      <div class="flex items-center justify-center h-96">
        <div class="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div class="p-4 bg-red-950/30 border border-red-900/40 rounded-xl text-red-300 flex items-center gap-2 max-w-xl mx-auto my-12">
        <AlertCircle class="h-5 w-5" />
        <span>{error}</span>
      </div>
    );
  }

  const hhiVal = data?.concentration.hhi || 0;
  const stabilityScore = Math.max(0, Math.min(100, Math.round(100 - (hhiVal / 100))));

  const getStabilityRiskText = (score) => {
    if (score < 75) return { label: 'Highly Concentrated (Critical Risk)', color: 'text-red-400' };
    if (score < 85) return { label: 'Moderately Diversified (Moderate Risk)', color: 'text-yellow-400' };
    return { label: 'Well Diversified (Low Risk)', color: 'text-emerald-400' };
  };

  const stabilityStatus = getStabilityRiskText(stabilityScore);

  const formatCurrency = (num) => {
    if (num >= 1.0e9) return `₹${(num / 1.0e9).toFixed(2)} B`;
    if (num >= 1.0e7) return `₹${(num / 1.0e7).toFixed(2)} Cr`;
    if (num >= 1.0e5) return `₹${(num / 1.0e5).toFixed(2)} L`;
    return `₹${num.toLocaleString('en-IN')}`;
  };

  // Filter granular commodities
  const expandingList = data?.commodityGrowth
    ? data.commodityGrowth.filter(c => c.growthRate > 0).sort((a, b) => b.growthRate - a.growthRate)
    : [];

  const decliningList = data?.commodityGrowth
    ? data.commodityGrowth.filter(c => c.growthRate < 0).sort((a, b) => a.growthRate - b.growthRate)
    : [];

  // Filter commodity groups
  const expandingGroups = data?.groupGrowth
    ? data.groupGrowth.filter(g => g.growthRate > 0).sort((a, b) => b.growthRate - a.growthRate)
    : [];

  const decliningGroups = data?.groupGrowth
    ? data.groupGrowth.filter(g => g.growthRate < 0).sort((a, b) => a.growthRate - b.growthRate)
    : [];

  const expData = viewMode === 'granular' ? expandingList : expandingGroups;
  const decData = viewMode === 'granular' ? decliningList : decliningGroups;

  return (
    <div class="space-y-8 animate-fade-in pb-12">
      {/* Header */}
      <div>
        <h2 class="text-3xl font-extrabold text-white tracking-tight">Strategic Risk Assessment</h2>
        <p class="text-slate-400 text-sm mt-1">Billing concentration diagnostics, market stability indicators, and terminal capacity bottlenecks.</p>
      </div>

      {/* Top Section: HHI and Concentration Gauges */}
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Concentration summary card */}
        <div class="p-6 rounded-2xl glass-panel space-y-5 glow-blue h-fit">
          <h4 class="text-base font-bold text-white flex items-center gap-2">
            <Info class="h-5 w-5 text-blue-400" /> Market Stability Risk
          </h4>
          <div class="space-y-4">
            <div>
              <span class="text-xs text-slate-500 font-semibold uppercase tracking-wider block">Market Stability Score</span>
              <h3 class="text-4xl font-extrabold text-white mt-1 font-display">
                {stabilityScore}%
              </h3>
              <p class="text-[10px] text-slate-500 leading-normal mt-1.5">
                Measures port carrier diversification. A higher percentage indicates lower revenue dependency on a single shipping client.
              </p>
              <p class={`text-xs font-semibold mt-2 ${stabilityStatus.color}`}>
                {stabilityStatus.label}
              </p>
            </div>
            
            <div class="border-t border-slate-800/60 pt-4 space-y-3">
              <div>
                <div class="flex justify-between text-xs font-medium text-slate-400 mb-1">
                  <span>Top Client revenue share</span>
                  <span class="text-slate-200">{data?.concentration.top1Share}%</span>
                </div>
                <div class="h-1.5 bg-slate-900 rounded-full overflow-hidden">
                  <div 
                    class={`h-full rounded-full ${data?.concentration.top1Share > 50 ? 'bg-red-500' : data?.concentration.top1Share > 30 ? 'bg-yellow-500' : 'bg-emerald-500'}`}
                    style={{ width: `${data?.concentration.top1Share}%` }}
                  ></div>
                </div>
              </div>

              <div>
                <div class="flex justify-between text-xs font-medium text-slate-400 mb-1">
                  <span>Top 5 Clients combined share</span>
                  <span class="text-slate-200">{data?.concentration.top5Share}%</span>
                </div>
                <div class="h-1.5 bg-slate-900 rounded-full overflow-hidden">
                  <div 
                    class={`h-full rounded-full bg-violet-500`}
                    style={{ width: `${data?.concentration.top5Share}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Executive Business Insights Warning Panel */}
        <div class="lg:col-span-2 p-6 rounded-2xl glass-panel space-y-4 glow-violet">
          <h4 class="text-base font-bold text-white flex items-center gap-2">
            <ShieldAlert class="h-5 w-5 text-violet-400" /> Executive Business Insights
          </h4>
          
          <div class="space-y-4 max-h-[340px] overflow-y-auto pr-1">
            {(!data?.risks || data.risks.length === 0) ? (
              <div class="p-6 bg-slate-900/40 border border-slate-800 rounded-2xl text-center">
                <span class="text-xs font-bold text-emerald-400 block mb-1">No Insights Available</span>
                <p class="text-[10px] text-slate-500">All data parameters must be verified to display strategic insights.</p>
              </div>
            ) : (
              data.risks.map((r, i) => {
                const riskTitle = r.title || 'Strategic Insight';
                const riskStatus = r.status || 'Needs Review';
                const riskMeaning = r.meaning || 'This area needs further review.';
                const riskReason = r.reason || 'Insufficient data available for detailed explanation.';
                const riskAction = r.action || 'Review operational records and update the risk rule.';

                const bgClass = riskStatus.includes('High') 
                  ? 'bg-red-950/10 border-red-900/30 text-red-200 glow-red' 
                  : riskStatus.includes('Medium') 
                  ? 'bg-yellow-950/10 border-yellow-900/20 text-yellow-200' 
                  : 'bg-emerald-950/10 border-emerald-900/20 text-emerald-200';
                
                const borderClass = riskStatus.includes('High')
                  ? 'border-l-4 border-l-red-500'
                  : riskStatus.includes('Medium')
                  ? 'border-l-4 border-l-yellow-500'
                  : 'border-l-4 border-l-emerald-500';

                return (
                  <div key={i} class={`p-4 border rounded-xl flex flex-col gap-2 text-xs leading-relaxed ${bgClass} ${borderClass}`}>
                    <div class="flex items-center justify-between">
                      <span class="font-bold text-slate-100">{riskTitle}</span>
                      <span class={`px-2 py-0.5 text-[9px] font-extrabold rounded uppercase ${
                        riskStatus.includes('High') ? 'bg-red-500/20 text-red-400 border border-red-800/30' : riskStatus.includes('Medium') ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-800/30' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-800/30'
                      }`}>
                        Status: {riskStatus}
                      </span>
                    </div>
                    <div class="space-y-1 text-slate-300 font-medium text-[11px]">
                      <p><strong>Evidence:</strong> {riskReason}</p>
                      <p><strong>Business Impact:</strong> {riskMeaning}</p>
                    </div>
                    <div class="p-2.5 bg-slate-950/60 border border-slate-900 rounded-lg">
                      <span class="text-[9px] text-blue-400 font-extrabold uppercase tracking-wide block mb-0.5">Recommendation</span>
                      <p class="text-[11px] text-slate-200 leading-normal font-semibold">{riskAction}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Bottom Row: Commodity Expansion and Contraction Matrix */}
      <div class="space-y-6">
        <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900/40 p-4 rounded-2xl border border-slate-800/60">
          <div>
            <h3 class="text-base font-bold text-white">Commodity Growth Dynamics</h3>
            <p class="text-[11px] text-slate-400">Toggle to view granular commodity items or high-level aggregated groups.</p>
          </div>
          <div class="flex bg-slate-950/80 p-1 rounded-xl border border-slate-800 text-[11px] font-bold">
            <button 
              onClick={() => setViewMode('granular')}
              class={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${viewMode === 'granular' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-slate-400 hover:text-white'}`}
            >
              Granular Commodities
            </button>
            <button 
              onClick={() => setViewMode('group')}
              class={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${viewMode === 'group' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-slate-400 hover:text-white'}`}
            >
              Commodity Groups
            </button>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Expansion list (Top Growing Commodities) */}
          <div class="p-6 rounded-2xl glass-panel space-y-4 glow-emerald">
            <h4 class="text-base font-bold text-white flex items-center gap-2">
              <TrendingUp class="h-5 w-5 text-emerald-400" /> 
              Expanding {viewMode === 'granular' ? 'Granular Commodities' : 'Group'}
            </h4>
            {viewMode === 'granular' && (
              <p class="text-[10px] text-slate-500 italic">
                Service charges are excluded. Similar commodity labels are grouped for accurate growth calculation.
              </p>
            )}
            <div class="h-80 text-xs flex items-center justify-center">
              {expData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart key={`exp_${selectedYear}_${activeTab}_${viewMode}`} data={expData} margin={{ top: 10, right: 10, left: -20, bottom: viewMode === 'granular' ? 65 : 20 }}>
                    <defs>
                      <linearGradient id="expandingGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity={0.95}/>
                        <stop offset="100%" stopColor="#047857" stopOpacity={0.65}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis 
                      dataKey="name" 
                      stroke="#64748b" 
                      angle={viewMode === 'granular' ? -45 : 0} 
                      textAnchor={viewMode === 'granular' ? 'end' : 'middle'} 
                      interval={0} 
                      height={viewMode === 'granular' ? 75 : 30}
                      tick={{ fontSize: 9, fill: '#94a3b8' }} 
                    />
                    <YAxis stroke="#64748b" tickFormatter={(v) => `${v}%`} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', color: '#fff' }}
                      itemStyle={{ color: '#fff' }}
                      formatter={(value) => [`+${value.toFixed(2)}%`, 'Growth']}
                    />
                    <Bar 
                      dataKey="growthRate" 
                      name="Growth" 
                      fill="url(#expandingGrad)" 
                      radius={[4, 4, 0, 0]} 
                      isAnimationActive={true}
                      animationDuration={1500}
                      animationEasing="ease-out"
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div class="text-center p-6 border border-dashed border-slate-800 rounded-xl w-full">
                  <p class="text-slate-400 text-xs font-bold">No expanding commodities found for the selected period.</p>
                </div>
              )}
            </div>
          </div>

          {/* Contraction list (Top Declining Commodities) */}
          <div class="p-6 rounded-2xl glass-panel space-y-4 glow-rose">
            <h4 class="text-base font-bold text-white flex items-center gap-2">
              <TrendingDown class="h-5 w-5 text-rose-500" /> 
              Contracting {viewMode === 'granular' ? 'Granular Commodities' : 'Group'}
            </h4>
            {viewMode === 'granular' && (
              <p class="text-[10px] text-slate-500 italic">
                Service charges are excluded. Similar commodity labels are grouped for accurate growth calculation.
              </p>
            )}
            <div class="h-80 text-xs flex items-center justify-center">
              {decData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart key={`dec_${selectedYear}_${activeTab}_${viewMode}`} data={decData} margin={{ top: 10, right: 10, left: -20, bottom: viewMode === 'granular' ? 65 : 20 }}>
                    <defs>
                      <linearGradient id="decliningGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.95}/>
                        <stop offset="100%" stopColor="#be123c" stopOpacity={0.65}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis 
                      dataKey="name" 
                      stroke="#64748b" 
                      angle={viewMode === 'granular' ? -45 : 0} 
                      textAnchor={viewMode === 'granular' ? 'end' : 'middle'} 
                      interval={0} 
                      height={viewMode === 'granular' ? 75 : 30}
                      tick={{ fontSize: 9, fill: '#94a3b8' }} 
                    />
                    <YAxis stroke="#64748b" tickFormatter={(v) => `${Math.abs(v)}%`} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', color: '#fff' }}
                      itemStyle={{ color: '#fff' }}
                      formatter={(value) => [`${value.toFixed(2)}%`, 'Decline']}
                    />
                    <ReferenceLine y={0} stroke="#475569" strokeWidth={1} />
                    <Bar 
                      dataKey="growthRate" 
                      name="Decline" 
                      fill="url(#decliningGrad)" 
                      radius={[0, 0, 4, 4]} 
                      isAnimationActive={true}
                      animationDuration={1500}
                      animationEasing="ease-out"
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div class="text-center p-6 border border-dashed border-slate-800 rounded-xl w-full">
                  <p class="text-slate-400 text-xs font-bold">No major contracting commodity detected.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Developer Validation Log / Debug Table */}
      <details class="p-6 rounded-2xl glass-panel border border-slate-900 text-xs">
        <summary class="font-bold text-slate-400 cursor-pointer hover:text-white select-none transition-colors">
          Developer Validation Log (Debug Data View)
        </summary>
        <div class="mt-4 overflow-x-auto max-h-60">
          <table class="w-full text-left border-collapse text-[10px] font-mono">
            <thead>
              <tr class="border-b border-slate-800 text-slate-500 uppercase font-semibold">
                <th class="py-2 px-3">Commodity</th>
                <th class="py-2 px-3 text-right">Previous Year Revenue</th>
                <th class="py-2 px-3 text-right">Current Year Revenue</th>
                <th class="py-2 px-3 text-right">Growth Rate %</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-800/40 text-slate-300">
              {data?.commodityGrowth.map((cg, idx) => (
                <tr key={idx} class="hover:bg-slate-900/10">
                  <td class="py-2 px-3 text-slate-200 font-bold">{cg.name}</td>
                  <td class="py-2 px-3 text-right">{formatCurrency(cg.previousRevenue)}</td>
                  <td class="py-2 px-3 text-right">{formatCurrency(cg.latestRevenue)}</td>
                  <td class={`py-2 px-3 text-right font-bold ${cg.growthRate > 0 ? 'text-emerald-400' : cg.growthRate < 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                    {cg.growthRate >= 0 ? '+' : ''}{cg.growthRate.toFixed(2)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
