import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { 
  DollarSign, Ship, Users, Anchor, Activity, AlertCircle, FileText, 
  TrendingUp, TrendingDown, Package, Layers, Info, Calendar, LayoutGrid
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';

export default function Dashboard({ token, selectedYear, user }) {
  const [kpis, setKpis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        const config = { headers: { Authorization: `Bearer ${token}` } };
        const response = await axios.get(`/api/dashboard/kpis?year=${selectedYear}`, config);
        setKpis(response.data);
      } catch (err) {
        console.error(err);
        setError('Failed to fetch dashboard summary metrics.');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [token, selectedYear]);

  if (loading) {
    return (
      <div class="space-y-8 animate-pulse p-6">
        <div class="h-10 bg-slate-900 rounded-xl w-1/4"></div>
        <div class="grid grid-cols-1 md:grid-cols-4 gap-8">
          {[1, 2, 3, 4].map(n => (
            <div key={n} class="h-32 bg-slate-900 rounded-2xl"></div>
          ))}
        </div>
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div class="lg:col-span-2 h-80 bg-slate-900 rounded-2xl"></div>
          <div class="h-80 bg-slate-900 rounded-2xl"></div>
        </div>
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

  const formatCurrency = (num) => {
    if (num >= 1.0e9) return `₹${(num / 1.0e9).toFixed(2)} Billion`;
    if (num >= 1.0e7) return `₹${(num / 1.0e7).toFixed(2)} Crore`;
    if (num >= 1.0e5) return `₹${(num / 1.0e5).toFixed(2)} Lakh`;
    return `₹${num.toLocaleString('en-IN')}`;
  };

  const formatGRT = (num) => {
    if (num >= 1.0e6) return `${(num / 1.0e6).toFixed(2)}M Tons`;
    return `${num.toLocaleString('en-IN')} Tons`;
  };

  return (
    <div class="space-y-10 animate-fade-in pb-12 px-2 max-w-[1600px] mx-auto">
      
      {/* Header and Welcome */}
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-900 pb-6">
        <div>
          <h2 class="text-3xl font-extrabold text-white tracking-tight">Executive Dashboard</h2>
          <p class="text-slate-400 text-sm mt-1">Cochin Port strategic summary and operations command.</p>
        </div>
        <div class="text-xs text-slate-400 font-mono flex items-center gap-2 bg-slate-900/80 px-4 py-2.5 rounded-xl border border-slate-800 self-start">
          <Activity class="h-4 w-4 text-blue-400 animate-pulse" />
          <span>Active Scope: {
            selectedYear === 'All' ? 'All Fiscal Years' : 
            selectedYear === 'Recent4' ? 'FY 2021–22 to FY 2024–25' : 
            `FY ${selectedYear}–${String(parseInt(selectedYear) + 1).slice(2)}`
          }</span>
        </div>
      </div>

      {/* Primary KPI Cards - Top Section */}
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
        
        {/* Total Revenue */}
        <div class="p-8 rounded-2xl glass-panel glow-blue flex flex-col justify-between hover:scale-[1.02] hover:shadow-[0_8px_30px_rgba(59,130,246,0.1)] transition-all duration-300 border border-slate-800/40 min-h-[160px]">
          <div class="flex items-center justify-between mb-4">
            <span class="text-xs font-bold uppercase tracking-wider text-slate-400">Total Port Revenue</span>
            <div class="p-2.5 bg-blue-500/10 rounded-xl text-blue-400">
              <DollarSign class="h-6 w-6" />
            </div>
          </div>
          <div>
            <h3 class="text-3xl font-black text-white font-display tracking-tight">
              {formatCurrency(kpis?.totalRevenue)}
            </h3>
            <span class="text-xs text-emerald-400 font-medium flex items-center gap-1 mt-2">
              Cumulative billing receipts
            </span>
          </div>
        </div>

        {/* YoY Growth Percentage */}
        <div class={`p-8 rounded-2xl glass-panel flex flex-col justify-between hover:scale-[1.02] transition-all duration-300 border border-slate-800/40 min-h-[160px] ${
          (kpis?.growthPercentage || 0) >= 0 ? 'glow-emerald' : 'glow-rose'
        }`}>
          <div class="flex items-center justify-between mb-4">
            <span class="text-xs font-bold uppercase tracking-wider text-slate-400">Revenue Growth Trend</span>
            <div class={`p-2.5 rounded-xl ${
              (kpis?.growthPercentage || 0) >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
            }`}>
              {(kpis?.growthPercentage || 0) >= 0 ? <TrendingUp class="h-6 w-6" /> : <TrendingDown class="h-6 w-6" />}
            </div>
          </div>
          <div>
            {selectedYear === 'All' || selectedYear === 'Recent4' ? (
              <div>
                <h3 class={`text-2xl font-black font-display tracking-tight ${(kpis?.cagr || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  CAGR: {(kpis?.cagr || 0) >= 0 ? '+' : ''}{kpis?.cagr}%
                </h3>
                <span class="text-xs text-slate-400 font-medium mt-2 block">
                  Overall Growth: {(kpis?.overallGrowth || 0) >= 0 ? '+' : ''}{kpis?.overallGrowth}%
                </span>
              </div>
            ) : (
              <div>
                <h3 class={`text-3xl font-black font-display tracking-tight ${(kpis?.growthPercentage || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {(kpis?.growthPercentage || 0) >= 0 ? '+' : ''}{kpis?.growthPercentage}%
                </h3>
                <span class="text-xs text-slate-400 font-medium flex items-center gap-1 mt-2">
                  VS previous fiscal year
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Vessel Calls */}
        <div class="p-8 rounded-2xl glass-panel glow-violet flex flex-col justify-between hover:scale-[1.02] hover:shadow-[0_8px_30px_rgba(168,85,247,0.1)] transition-all duration-300 border border-slate-800/40 min-h-[160px]">
          <div class="flex items-center justify-between mb-4">
            <span class="text-xs font-bold uppercase tracking-wider text-slate-400">Vessel Arrivals</span>
            <div class="p-2.5 bg-violet-500/10 rounded-xl text-violet-400">
              <Ship class="h-6 w-6" />
            </div>
          </div>
          <div>
            <h3 class="text-3xl font-black text-white font-display tracking-tight">
              {kpis?.totalVessels.toLocaleString('en-IN')}
            </h3>
            <span class="text-xs text-slate-400 font-medium flex items-center gap-1 mt-2">
              Distinct shipping line arrivals
            </span>
          </div>
        </div>

        {/* GRT Tonnage */}
        <div class="p-8 rounded-2xl glass-panel glow-orange flex flex-col justify-between hover:scale-[1.02] hover:shadow-[0_8px_30px_rgba(249,115,22,0.1)] transition-all duration-300 border border-slate-800/40 min-h-[160px]">
          <div class="flex items-center justify-between mb-4">
            <span class="text-xs font-bold uppercase tracking-wider text-slate-400">Gross Cargo Tonnage</span>
            <div class="p-2.5 bg-orange-500/10 rounded-xl text-orange-400">
              <Layers class="h-6 w-6" />
            </div>
          </div>
          <div>
            <h3 class="text-3xl font-black text-white font-display tracking-tight">
              {formatGRT(kpis?.totalGRT)}
            </h3>
            <span class="text-xs text-slate-400 font-medium flex items-center gap-1 mt-2">
              Volume capacity handled
            </span>
          </div>
        </div>

      </div>

      {/* Main Grid content with increased white space */}
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Executive Summary & Spaced Details */}
        <div class="lg:col-span-2 space-y-8">
          
          {/* Executive Summary Section */}
          <div class="p-8 rounded-2xl glass-panel border border-slate-900 space-y-6 glow-blue">
            <div>
              <h4 class="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                <FileText class="h-5.5 w-5.5 text-blue-400" /> Executive Summary & Insights
              </h4>
              <p class="text-xs text-slate-500 mt-1">Concisely selected key performance indicators from recent records.</p>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-slate-300 font-medium">
              
              {/* Left group */}
              <div class="space-y-4">
                <div class="p-4 bg-slate-950/45 border border-slate-900 rounded-xl space-y-1.5 hover:border-slate-800 transition-all">
                  <span class="text-[9px] uppercase tracking-wider font-extrabold text-blue-400">Revenue Growth</span>
                  <p class="text-slate-200 text-xs font-semibold leading-relaxed">
                    {selectedYear === 'Recent4' ? (
                      <span>Port revenue increased consistently over the last four fiscal years, with strongest YoY growth in <strong class="text-emerald-400">FY 2023–24</strong>.</span>
                    ) : (
                      <span>Port revenue has <strong class="text-emerald-400">{kpis?.growthPercentage >= 0 ? 'increased' : 'decreased'} by {Math.abs(kpis?.growthPercentage).toFixed(2)}%</strong> compared to previous year averages.</span>
                    )}
                  </p>
                </div>

                <div class="p-4 bg-slate-950/45 border border-slate-900 rounded-xl space-y-1.5 hover:border-slate-800 transition-all">
                  <span class="text-[9px] uppercase tracking-wider font-extrabold text-violet-400">Highest Revenue Charge</span>
                  <p class="text-slate-200 text-xs font-semibold">
                    The single most profitable charge category is <strong class="text-white font-extrabold">{kpis?.topCommodity}</strong>.
                  </p>
                </div>

                <div class="p-4 bg-slate-950/45 border border-slate-900 rounded-xl space-y-1.5 hover:border-slate-800 transition-all">
                  <span class="text-[9px] uppercase tracking-wider font-extrabold text-amber-400">Highest Revenue Customer</span>
                  <p class="text-slate-200 text-xs font-semibold leading-normal truncate" title={kpis?.topCustomer}>
                    Top billing partner: <strong class="text-white font-extrabold">{kpis?.topCustomer}</strong>.
                  </p>
                </div>
              </div>

              {/* Right group */}
              <div class="space-y-4">
                <div class="p-4 bg-slate-950/45 border border-slate-900 rounded-xl space-y-1.5 hover:border-slate-800 transition-all">
                  <span class="text-[9px] uppercase tracking-wider font-extrabold text-pink-400">Highest Revenue Berth</span>
                  <p class="text-slate-200 text-xs font-semibold">
                    The highest producing berth is <strong class="text-white font-extrabold">Berth {kpis?.topBerth}</strong>.
                  </p>
                </div>

                <div class="p-4 bg-slate-950/45 border border-slate-900 rounded-xl space-y-1.5 hover:border-slate-800 transition-all">
                  <span class="text-[9px] uppercase tracking-wider font-extrabold text-emerald-400">Fastest Growing Charge</span>
                  <p class="text-slate-200 text-xs font-semibold leading-relaxed">
                    Highest YoY demand: <strong class="text-emerald-400">{kpis?.fastestGrowingCommodity}</strong>.
                  </p>
                </div>

                <div class="p-4 bg-slate-950/45 border border-slate-900 rounded-xl space-y-1.5 hover:border-slate-800 transition-all">
                  <span class="text-[9px] uppercase tracking-wider font-extrabold text-rose-500">Largest Business Risk</span>
                  <p class="text-slate-200 text-xs font-semibold truncate" title={kpis?.largestBusinessRisk}>
                    Primary exposure: <strong class="text-rose-400">{kpis?.largestBusinessRisk}</strong>.
                  </p>
                </div>
              </div>

            </div>
          </div>

          {/* Yearly Revenue Trajectory Chart */}
          {kpis?.yearlyTrend && kpis.yearlyTrend.length > 0 && (
            <div class="p-8 rounded-2xl glass-panel space-y-6 glow-violet border border-slate-900">
              <div>
                <h4 class="text-lg font-bold text-white tracking-tight">Yearly Revenue Trajectory</h4>
                <p class="text-xs text-slate-500 mt-1">Answers: What is the port's overall yearly revenue trend?</p>
              </div>
              <div class="h-64 text-xs">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={kpis.yearlyTrend} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="year" stroke="#64748b" tickFormatter={(v) => {
                      const y = parseInt(v);
                      if (isNaN(y)) return v;
                      return `FY ${y}–${String(y + 1).slice(2)}`;
                    }} />
                    <YAxis stroke="#64748b" tickFormatter={(v) => `₹${(v / 1.0e9).toFixed(1)}B`} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', color: '#fff' }}
                      itemStyle={{ color: '#fff' }}
                      formatter={(v) => [formatCurrency(v), 'Revenue']}
                    />
                    <Area type="monotone" dataKey="revenue" stroke="#8b5cf6" strokeWidth={2.5} fillOpacity={1} fill="url(#colorRev)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

        </div>

        {/* Right Column: Operational Stats & System Meta */}
        <div class="space-y-8">
          
          {/* Operational Scope Overview */}
          <div class="p-8 rounded-2xl glass-panel space-y-6 border border-slate-900">
            <div>
              <h4 class="text-lg font-bold text-white flex items-center gap-2">
                <LayoutGrid class="h-5 w-5 text-violet-400" /> Operational Context
              </h4>
              <p class="text-xs text-slate-500 mt-1">Secondary parameters and key port activity counts.</p>
            </div>

            <div class="space-y-4">
              
              <div class="flex items-center justify-between p-4 bg-slate-950/40 border border-slate-900 rounded-xl hover:border-slate-800 transition-all">
                <div class="flex items-center gap-3">
                  <Users class="h-4.5 w-4.5 text-blue-400" />
                  <span class="text-xs text-slate-400 font-semibold">Active Partners</span>
                </div>
                <span class="text-xs font-bold text-white">{kpis?.totalCustomers}</span>
              </div>

              <div class="flex items-center justify-between p-4 bg-slate-950/40 border border-slate-900 rounded-xl hover:border-slate-800 transition-all">
                <div class="flex items-center gap-3">
                  <Anchor class="h-4.5 w-4.5 text-violet-400" />
                  <span class="text-xs text-slate-400 font-semibold">Active Berths</span>
                </div>
                <span class="text-xs font-bold text-white">{kpis?.totalBerths}</span>
              </div>

              <div class="flex items-center justify-between p-4 bg-slate-950/40 border border-slate-900 rounded-xl hover:border-slate-800 transition-all">
                <div class="flex items-center gap-3">
                  <Package class="h-4.5 w-4.5 text-emerald-400" />
                  <span class="text-xs text-slate-400 font-semibold">Active Commodities</span>
                </div>
                <span class="text-xs font-bold text-white">{kpis?.totalCommodities}</span>
              </div>

              <div class="flex items-center justify-between p-4 bg-slate-950/40 border border-slate-900 rounded-xl hover:border-slate-800 transition-all">
                <div class="flex items-center gap-3">
                  <FileText class="h-4.5 w-4.5 text-orange-400" />
                  <span class="text-xs text-slate-400 font-semibold">Total Records parsed</span>
                </div>
                <span class="text-xs font-bold text-white">
                  {kpis?.totalTransactions ? kpis.totalTransactions.toLocaleString('en-IN') : '0'}
                </span>
              </div>

            </div>
          </div>

          {/* System Profile & Mode */}
          <div class="p-8 rounded-2xl glass-panel space-y-5 border border-slate-900 font-medium text-xs text-slate-400">
            <h4 class="text-sm font-bold text-slate-200 uppercase tracking-wider">Cochin Port Authority</h4>
            <p class="leading-relaxed">
              India's major strategic transshipment port. The Decision Support System (PSIDSS) processes bulk manifests to forecast revenues, evaluate tariff changes, and analyze capacity risk.
            </p>
            <div class="border-t border-slate-800/60 pt-4 flex flex-col gap-2.5 font-mono text-[10px]">
              <div class="flex justify-between">
                <span>SYSTEM STATUS</span>
                <span class="text-emerald-400 font-bold uppercase">Online</span>
              </div>
              <div class="flex justify-between">
                <span>USER MODE</span>
                <span class="text-slate-300 font-bold uppercase">{user?.role}</span>
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
