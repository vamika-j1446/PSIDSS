import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { Sparkles, TrendingDown, Users, AlertTriangle, AlertCircle } from 'lucide-react';

export default function Predictive({ token, selectedYear, activeTab }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [horizonFilter, setHorizonFilter] = useState('month');

  // Expanded card toggle states
  const [expandedDetails, setExpandedDetails] = useState({});
  const [showAllCustomers, setShowAllCustomers] = useState(false);
  const [showAllCommodities, setShowAllCommodities] = useState(false);

  useEffect(() => {
    const fetchForecasts = async () => {
      try {
        const config = { headers: { Authorization: `Bearer ${token}` } };
        const response = await axios.get(`/api/predictive/forecasts?year=${selectedYear}`, config);
        setData(response.data);
      } catch (err) {
        console.error(err);
        setError('Failed to fetch forecasting data.');
      } finally {
        setLoading(false);
      }
    };

    fetchForecasts();
  }, [token, selectedYear]);

  const toggleDetails = (index) => {
    setExpandedDetails(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const formatRiskStatusLabel = (level) => {
    if (!level) return 'No risk';
    const l = String(level).toUpperCase();
    if (l.includes('HIGH')) return 'High';
    if (l.includes('MEDIUM')) return 'Medium';
    if (l.includes('LOW')) return 'Low';
    return 'No risk';
  };

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

  // Filter forecasts by horizon (month, quarter, year)
  const filteredRevenueForecasts = (data?.revenue || []).filter(f => f.horizon === horizonFilter);

  // Format currency
  const formatCurrency = (num) => {
    if (num >= 1.0e9) return `₹${(num / 1.0e9).toFixed(2)} B`;
    if (num >= 1.0e7) return `₹${(num / 1.0e7).toFixed(2)} Cr`;
    if (num >= 1.0e5) return `₹${(num / 1.0e5).toFixed(2)} L`;
    return `₹${num.toLocaleString('en-IN')}`;
  };

  // Slice Top 5 lists
  const displayedCustomers = showAllCustomers 
    ? (data?.atRiskCustomers || []) 
    : (data?.atRiskCustomers || []).slice(0, 5);

  const displayedCommodities = showAllCommodities 
    ? (data?.decliningCommodities || []) 
    : (data?.decliningCommodities || []).slice(0, 5);

  return (
    <div class="space-y-8 animate-fade-in">
      {/* Header & Horizon Filters */}
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 class="text-3xl font-extrabold text-white tracking-tight">Predictive Insights</h2>
          <p class="text-slate-400 text-sm mt-1">Linear regression forecasting, confidence boundaries, and structural churn risks.</p>
        </div>

        {/* Segmented Horizon Filter */}
        <div class="flex bg-slate-900/80 p-1 rounded-xl border border-slate-800 self-start">
          {['month', 'quarter', 'year'].map((h) => (
            <button
              key={h}
              onClick={() => setHorizonFilter(h)}
              class={`px-4 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all ${
                horizonFilter === h 
                  ? 'bg-blue-600 text-white shadow' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {h === 'month' ? 'Monthly' : h === 'quarter' ? 'Quarterly' : 'Yearly'}
            </button>
          ))}
        </div>
      </div>

      {/* Main Forecast Chart Container */}
      <div class="p-6 rounded-2xl glass-panel space-y-4 glow-blue">
        <div class="flex items-center justify-between">
          <h4 class="text-base font-bold text-white flex items-center gap-2">
            <Sparkles class="h-5 w-5 text-blue-400 animate-pulse" /> Revenue Projection & Confidence Bounds (95% Interval)
          </h4>
          <span class="text-[10px] text-slate-500 font-mono">Horizon: {horizonFilter.toUpperCase()}</span>
        </div>

        {filteredRevenueForecasts.length === 0 ? (
          <p class="text-slate-400 text-xs text-center py-12 border border-slate-900 rounded-xl">
            No forecasts computed yet. Ingest port records first.
          </p>
        ) : (
          <div class="h-80 w-full text-xs">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart key={`${selectedYear}_${activeTab}`} data={filteredRevenueForecasts} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="forecastGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.01}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="date" stroke="#64748b" />
                <YAxis stroke="#64748b" tickFormatter={(v) => `₹${(v / 1.0e7).toFixed(1)} Cr`} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', color: '#fff' }}
                  itemStyle={{ color: '#fff' }}
                  labelStyle={{ color: '#fff', fontWeight: 'bold' }}
                />
                
                <Area 
                  type="monotone" 
                  dataKey="upperBound" 
                  stroke="transparent" 
                  fill="#3b82f6" 
                  fillOpacity={0.12} 
                  name="95% Upper Bound"
                  isAnimationActive={true}
                  animationDuration={1000}
                  animationEasing="ease-in-out"
                />
                <Area 
                  type="monotone" 
                  dataKey="lowerBound" 
                  stroke="transparent" 
                  fill="#020617" 
                  fillOpacity={0.9} 
                  name="95% Lower Bound"
                  isAnimationActive={true}
                  animationDuration={1000}
                  animationEasing="ease-in-out"
                />
                <Area 
                  type="monotone" 
                  dataKey="value" 
                  stroke="#3b82f6" 
                  strokeWidth={2.5} 
                  fill="url(#forecastGrad)" 
                  name="Predicted Value"
                  isAnimationActive={true}
                  animationDuration={1000}
                  animationEasing="ease-in-out"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Summary Box */}
      <div class="p-6 rounded-2xl glass-panel border border-slate-800/85 bg-slate-950/20 space-y-4 glow-violet">
        <h4 class="text-sm font-bold text-white uppercase tracking-wider">Risk Summary</h4>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-semibold">
          <div class="p-4 bg-slate-900/40 border border-slate-800 rounded-xl flex flex-col justify-between">
            <span class="text-slate-400 text-[10px] uppercase block mb-1">Customer Churn</span>
            <span class={`text-sm font-bold ${
              data?.calculatedRisks?.[0]?.level.includes('HIGH') ? 'text-red-400' : data?.calculatedRisks?.[0]?.level.includes('MEDIUM') ? 'text-yellow-400' : 'text-emerald-400'
            }`}>
              {formatRiskStatusLabel(data?.calculatedRisks?.[0]?.level)}
            </span>
          </div>
          <div class="p-4 bg-slate-900/40 border border-slate-800 rounded-xl flex flex-col justify-between">
            <span class="text-slate-400 text-[10px] uppercase block mb-1">Berth Dependency</span>
            <span class={`text-sm font-bold ${
              data?.calculatedRisks?.[1]?.level.includes('HIGH') ? 'text-red-400' : data?.calculatedRisks?.[1]?.level.includes('MEDIUM') ? 'text-yellow-400' : 'text-emerald-400'
            }`}>
              {formatRiskStatusLabel(data?.calculatedRisks?.[1]?.level)}
            </span>
          </div>
          <div class="p-4 bg-slate-900/40 border border-slate-800 rounded-xl flex flex-col justify-between">
            <span class="text-slate-400 text-[10px] uppercase block mb-1">Commodity Decline</span>
            <span class={`text-sm font-bold ${
              data?.calculatedRisks?.[2]?.level.includes('HIGH') ? 'text-red-400' : data?.calculatedRisks?.[2]?.level.includes('MEDIUM') ? 'text-yellow-400' : 'text-emerald-400'
            }`}>
              {formatRiskStatusLabel(data?.calculatedRisks?.[2]?.level)}
            </span>
          </div>
          <div class="p-4 bg-slate-900/40 border border-slate-800 rounded-xl flex flex-col justify-between">
            <span class="text-slate-400 text-[10px] uppercase block mb-1">Revenue Projection</span>
            <span class={`text-sm font-bold ${
              data?.calculatedRisks?.[3]?.level.includes('HIGH') ? 'text-red-400' : data?.calculatedRisks?.[3]?.level.includes('MEDIUM') ? 'text-yellow-400' : 'text-emerald-400'
            }`}>
              {formatRiskStatusLabel(data?.calculatedRisks?.[3]?.level)}
            </span>
          </div>
        </div>
      </div>

      {/* Executive Risks Assessment Grid */}
      <div class="space-y-4">
        <h4 class="text-base font-bold text-white flex items-center gap-2">
          <AlertCircle class="h-5 w-5 text-blue-400" /> Executive Risk Assessment
        </h4>
        {(!data?.calculatedRisks || data.calculatedRisks.length === 0) ? (
          <div class="p-6 bg-slate-900/40 border border-slate-800 rounded-2xl text-center">
            <span class="text-xs font-bold text-emerald-400 block mb-1">No Risk Detected</span>
            <p class="text-[10px] text-slate-500">All port predictive metrics indicate stable operations. No risk detected.</p>
          </div>
        ) : (
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            {data.calculatedRisks.map((risk, index) => {
              const isHigh = risk.level.includes('HIGH');
              const isMedium = risk.level.includes('MEDIUM');
              const bgClass = isHigh
                ? 'bg-red-950/10 border-red-900/30 text-red-200 glow-red' 
                : isMedium
                ? 'bg-yellow-950/10 border-yellow-900/20 text-yellow-200'
                : 'bg-emerald-950/10 border-emerald-900/20 text-emerald-200';
              
              const isExpanded = !!expandedDetails[index];
              
              return (
                <div key={index} class={`p-5 border rounded-xl flex flex-col gap-2.5 text-xs leading-relaxed ${bgClass}`}>
                  <div class="flex items-center justify-between">
                    <span class="font-bold text-slate-100">{risk.name}</span>
                    <span class={`px-2 py-0.5 text-[9px] font-extrabold uppercase rounded border ${
                      isHigh ? 'bg-red-500/20 text-red-400 border-red-800/30' : isMedium ? 'bg-yellow-500/10 text-yellow-400 border-yellow-800/30' : 'bg-emerald-500/10 text-emerald-400 border-emerald-800/30'
                    }`}>
                      {risk.level}
                    </span>
                  </div>

                  <div class="space-y-1.5">
                    <div>
                      <span class="text-[9px] text-slate-400 font-bold block uppercase">Meaning</span>
                      <p class="text-[11px] text-slate-200 font-semibold">{risk.why}</p>
                    </div>
                    <div>
                      <span class="text-[9px] text-slate-400 font-bold block uppercase">Evidence</span>
                      <p class="text-[11px] text-slate-300 font-medium">{risk.evidence}</p>
                    </div>
                    <div>
                      <span class="text-[9px] text-blue-400 font-bold block uppercase">Recommendation</span>
                      <p class="text-[11px] text-slate-200 font-bold">{risk.action}</p>
                    </div>
                  </div>

                  <div class="pt-1.5 border-t border-slate-800/40">
                    <button 
                      onClick={() => toggleDetails(index)} 
                      class="text-blue-400 hover:text-blue-300 font-bold text-[11px] flex items-center gap-1 focus:outline-none transition-colors cursor-pointer"
                    >
                      {isExpanded ? 'Hide details' : 'View details'}
                    </button>
                    {isExpanded && (
                      <div class="mt-2 p-2.5 bg-slate-950/80 border border-slate-900 rounded-lg text-slate-400 text-[10px] space-y-1 font-medium leading-relaxed animate-fade-in">
                        <p>This automated strategic assessment runs diagnostic scans on YoY billing volatility and concentration levels across Cochin Port financial records. Projections are parsed monthly using regression forecasting models.</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Decline Risk Alerts Grid */}
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* At-Risk Customers */}
        <div class="p-6 rounded-2xl glass-panel space-y-4 glow-violet">
          <h4 class="text-base font-bold text-white flex items-center gap-2">
            <Users class="h-5 w-5 text-violet-400" /> At-Risk Customers (Negative Forecasts)
          </h4>
          
          {(!data?.atRiskCustomers || data.atRiskCustomers.length === 0) ? (
            <div class="p-6 bg-slate-900/40 border border-slate-800 rounded-2xl text-center">
              <span class="text-xs font-bold text-emerald-400 block mb-1">No Risk Detected</span>
              <p class="text-[10px] text-slate-500">No customers currently show negative forecast based on recent historical trend.</p>
            </div>
          ) : (
            <div class="space-y-3">
              {displayedCustomers.map((c, i) => (
                <div key={i} class="p-4 bg-slate-900/40 border border-slate-800/80 rounded-xl flex flex-col gap-2">
                  <div class="flex items-center justify-between">
                    <span class="text-slate-200 text-xs font-bold block">{c.name}</span>
                    <span class={`px-2 py-0.5 text-[9px] font-bold uppercase rounded ${
                      c.riskLevel.includes('HIGH') ? 'bg-red-500/10 text-red-400 border border-red-800/20' : 'bg-yellow-500/10 text-yellow-400 border border-yellow-800/20'
                    }`}>
                      {c.riskLevel}
                    </span>
                  </div>
                  <div class="text-[10px] text-slate-400 space-y-1">
                    <p class="text-rose-400 font-bold">-{c.declinePercentage.toFixed(1)}% decline</p>
                    <p class="font-medium">{formatCurrency(c.previousRevenue)} → {formatCurrency(c.latestRevenue)}</p>
                    <p class="text-[11px] text-slate-300 mt-1 font-semibold leading-normal">
                      {c.reason}
                    </p>
                  </div>
                </div>
              ))}

              {(data?.atRiskCustomers || []).length > 5 && (
                <button
                  onClick={() => setShowAllCustomers(!showAllCustomers)}
                  class="w-full py-2 bg-slate-900/80 hover:bg-slate-900 border border-slate-850 rounded-xl text-xs font-bold text-blue-400 transition-colors focus:outline-none cursor-pointer mt-1"
                >
                  {showAllCustomers ? 'Show less' : 'View all at-risk customers'}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Shrinking Commodities */}
        <div class="p-6 rounded-2xl glass-panel space-y-4">
          <h4 class="text-base font-bold text-white flex items-center gap-2">
            <AlertTriangle class="h-5 w-5 text-yellow-500 animate-pulse" /> Declining Commodity Projections
          </h4>
          
          {(!data?.decliningCommodities || data.decliningCommodities.length === 0) ? (
            <div class="p-6 bg-slate-900/40 border border-slate-800 rounded-2xl text-center">
              <span class="text-xs font-bold text-emerald-400 block mb-1">No Risk Detected</span>
              <p class="text-[10px] text-slate-500">No declining commodities found for the selected period.</p>
            </div>
          ) : (
            <div class="space-y-3">
              {displayedCommodities.map((cc, i) => (
                <div key={i} class="p-4 bg-slate-900/40 border border-slate-800/80 rounded-xl flex flex-col gap-2">
                  <div class="flex items-center justify-between">
                    <span class="text-slate-200 text-xs font-bold block">{cc.name}</span>
                    <span class={`px-2 py-0.5 text-[9px] font-bold uppercase rounded ${
                      cc.riskLevel.includes('HIGH') ? 'bg-red-500/10 text-red-400 border border-red-800/20' : 'bg-yellow-500/10 text-yellow-400 border border-yellow-800/20'
                    }`}>
                      {cc.riskLevel}
                    </span>
                  </div>
                  <div class="text-[10px] text-slate-400 space-y-1">
                    <p class="text-rose-400 font-bold">-{cc.declinePercentage.toFixed(1)}% decline</p>
                    <p class="font-medium">{formatCurrency(cc.previousRevenue)} → {formatCurrency(cc.latestRevenue)}</p>
                    <p class="text-[11px] text-slate-300 mt-1 font-semibold leading-normal">
                      {cc.reason}
                    </p>
                  </div>
                </div>
              ))}

              {(data?.decliningCommodities || []).length > 5 && (
                <button
                  onClick={() => setShowAllCommodities(!showAllCommodities)}
                  class="w-full py-2 bg-slate-900/80 hover:bg-slate-900 border border-slate-850 rounded-xl text-xs font-bold text-blue-400 transition-colors focus:outline-none cursor-pointer mt-1"
                >
                  {showAllCommodities ? 'Show less' : 'View all declining commodities'}
                </button>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
