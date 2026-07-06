import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  BarChart, Bar, Legend, PieChart, Pie, Cell 
} from 'recharts';
import { Calendar, DollarSign, TrendingUp, AlertCircle, RefreshCw } from 'lucide-react';

const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f43f5e', '#ef4444', '#f97316', '#eab308', '#22c55e', '#10b981', '#06b6d4'];

export default function Historical({ token, selectedYear, activeTab }) {
  const [trends, setTrends] = useState({ yearly: [], monthly: [] });
  const [customers, setCustomers] = useState([]);
  const [berths, setBerths] = useState([]);
  const [commodities, setCommodities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [yearFilterRange, setYearFilterRange] = useState([2016, 2025]);
  const [selectedBerth, setSelectedBerth] = useState('All');

  useEffect(() => {
    setSelectedBerth('All');
    fetchHistoricalData();
  }, [token, selectedYear]);

  const fetchHistoricalData = async () => {
    setLoading(true);
    setError('');
    try {
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const [trendsRes, custRes, berthRes, commRes] = await Promise.all([
        axios.get(`/api/historical/trends?year=${selectedYear}`, config),
        axios.get(`/api/historical/customers?year=${selectedYear}`, config),
        axios.get(`/api/historical/berths?year=${selectedYear}`, config),
        axios.get(`/api/historical/commodities?year=${selectedYear}`, config)
      ]);
      
      setTrends(trendsRes.data);
      setCustomers(custRes.data);
      setBerths(berthRes.data);
      setCommodities(commRes.data);
      
      // Calculate min and max years dynamically
      if (trendsRes.data.yearly.length > 0) {
        const years = trendsRes.data.yearly.map(t => parseInt(t.year)).filter(y => !isNaN(y));
        if (years.length > 0) {
          setYearFilterRange([Math.min(...years), Math.max(...years)]);
        }
      }
    } catch (err) {
      console.error(err);
      setError('Failed to fetch historical analytics data.');
    } finally {
      setLoading(false);
    }
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

  const filteredYearlyTrends = trends.yearly.filter(t => {
    const y = parseInt(t.year);
    return y >= yearFilterRange[0] && y <= yearFilterRange[1];
  });

  const minAvailableYear = trends.yearly.length > 0 
    ? Math.min(...trends.yearly.map(t => parseInt(t.year)).filter(y => !isNaN(y))) 
    : 2016;
  const maxAvailableYear = trends.yearly.length > 0 
    ? Math.max(...trends.yearly.map(t => parseInt(t.year)).filter(y => !isNaN(y))) 
    : 2024;

  // Aggregated calculations
  const totalRevenue = filteredYearlyTrends.reduce((sum, item) => sum + item.revenue, 0);
  const avgGrowth = filteredYearlyTrends.length > 1 
    ? filteredYearlyTrends.slice(1).reduce((sum, item) => sum + item.growthRate, 0) / (filteredYearlyTrends.length - 1)
    : 0;

  // Formatting helpers
  const formatXAxisYear = (yr) => {
    const y = parseInt(yr);
    if (isNaN(y)) return yr;
    return `FY${String(y).slice(2)}–${String(y + 1).slice(2)}`;
  };

  const formatFullYearRange = (yr) => {
    const y = parseInt(yr);
    if (isNaN(y)) return yr;
    return `${y}–${y + 1}`;
  };

  const formatCurrency = (num) => {
    if (num >= 1.0e9) return `₹${(num / 1.0e9).toFixed(2)} B`;
    if (num >= 1.0e7) return `₹${(num / 1.0e7).toFixed(2)} Cr`;
    if (num >= 1.0e5) return `₹${(num / 1.0e5).toFixed(2)} L`;
    return `₹${num.toLocaleString('en-IN')}`;
  };

  return (
    <div class="space-y-8 animate-fade-in">
      {/* Header and Controls */}
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 class="text-3xl font-extrabold text-white tracking-tight">Historical Performance</h2>
          <p class="text-slate-400 text-sm mt-1">Multi-year cargo movements, berth traffic, and tariff earnings.</p>
        </div>
        
        {/* Sliders for dynamic YoY ranges */}
        <div class="flex items-center gap-4 bg-slate-900/50 px-4 py-2 border border-slate-800 rounded-xl max-w-sm">
          <Calendar class="h-4 w-4 text-blue-400 shrink-0" />
          <div class="flex flex-col w-full text-xs">
            <span class="text-slate-500 font-semibold mb-1">
              Timeline Scale: {formatXAxisYear(yearFilterRange[0])} to {formatXAxisYear(yearFilterRange[1])}
            </span>
            <div class="flex items-center gap-2">
              <input 
                type="range"
                min={minAvailableYear}
                max={maxAvailableYear}
                value={yearFilterRange[0]}
                onChange={(e) => setYearFilterRange([Math.min(parseInt(e.target.value), yearFilterRange[1] - 1), yearFilterRange[1]])}
                class="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              <input 
                type="range"
                min={minAvailableYear}
                max={maxAvailableYear}
                value={yearFilterRange[1]}
                onChange={(e) => setYearFilterRange([yearFilterRange[0], Math.max(parseInt(e.target.value), yearFilterRange[0] + 1)])}
                class="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Mini Performance Cards */}
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div class="p-6 rounded-2xl glass-card flex items-center gap-4">
          <div class="p-3 bg-blue-500/10 rounded-xl text-blue-400">
            <DollarSign class="h-6 w-6" />
          </div>
          <div>
            <span class="text-xs text-slate-500 uppercase font-semibold tracking-wider">Filtered Revenue</span>
            <h4 class="text-xl font-bold text-white font-display mt-0.5">{formatCurrency(totalRevenue)}</h4>
          </div>
        </div>

        <div class="p-6 rounded-2xl glass-card flex items-center gap-4">
          <div class="p-3 bg-emerald-500/10 rounded-xl text-emerald-400">
            <TrendingUp class="h-6 w-6" />
          </div>
          <div>
            <span class="text-xs text-slate-500 uppercase font-semibold tracking-wider">Average YoY Growth</span>
            <h4 class="text-xl font-bold text-emerald-400 font-display mt-0.5">{avgGrowth.toFixed(2)}%</h4>
            {filteredYearlyTrends.length >= 2 && (
              <span class="text-[10px] text-slate-400 block mt-0.5">
                CAGR: {(() => {
                  const first = filteredYearlyTrends[0].revenue;
                  const last = filteredYearlyTrends[filteredYearlyTrends.length - 1].revenue;
                  const n = filteredYearlyTrends.length - 1;
                  if (first > 0 && n > 0) {
                    return `${((Math.pow(last / first, 1 / n) - 1) * 100).toFixed(2)}%`;
                  }
                  return '0.00%';
                })()}
              </span>
            )}
          </div>
        </div>

        <div class="p-6 rounded-2xl glass-card flex items-center gap-4">
          <div class="p-3 bg-violet-500/10 rounded-xl text-violet-400">
            <RefreshCw class="h-6 w-6 animate-pulse" />
          </div>
          <div>
            <span class="text-xs text-slate-500 uppercase font-semibold tracking-wider">Fiscal Years Count</span>
            <h4 class="text-xl font-bold text-white font-display mt-0.5">{filteredYearlyTrends.length} Fiscal Years</h4>
          </div>
        </div>
      </div>

      {/* Chart Rows */}
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* YoY Revenue Trend Area Chart */}
        <div class="lg:col-span-2 p-6 rounded-2xl glass-panel space-y-4 glow-blue">
          <h4 class="text-base font-bold text-white">Year-over-Year Revenue Trend</h4>
          <div class="h-72 w-full text-xs">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart key={`${selectedYear}_${activeTab}`} data={filteredYearlyTrends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="year" stroke="#64748b" tickFormatter={formatXAxisYear} />
                <YAxis stroke="#64748b" tickFormatter={(v) => `₹${(v / 1.0e7).toFixed(1)} Cr`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', color: '#fff' }}
                  itemStyle={{ color: '#fff' }}
                  formatter={(value) => [formatCurrency(value), 'Revenue']}
                  labelStyle={{ color: '#fff', fontWeight: 'bold' }}
                  labelFormatter={formatFullYearRange}
                />
                <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorRevenue)" isAnimationActive={true} animationDuration={1000} animationEasing="ease-in-out" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Customers shares Pie chart */}
        <div class="p-6 rounded-2xl glass-panel space-y-4 glow-violet">
          <h4 class="text-base font-bold text-white">Customer Revenue Share</h4>
          <div class="h-60 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart key={`${selectedYear}_${activeTab}`}>
                <Pie
                  data={customers}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                  isAnimationActive={true}
                  animationDuration={1000}
                  animationEasing="ease-in-out"
                >
                  {customers.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', color: '#fff' }}
                  itemStyle={{ color: '#fff' }}
                  formatter={(value, name, props) => [`${formatCurrency(value)} (${props.payload.percentage}%)`, props.payload.name]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          {/* Custom Legends list */}
          <div class="flex flex-col gap-1.5 max-h-24 overflow-y-auto pr-1 text-[10px] text-slate-400">
            {customers.map((c, i) => (
              <div key={c.name} class="flex items-center justify-between">
                <div class="flex items-center gap-1.5 truncate">
                  <span class="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }}></span>
                  <span class="truncate">{c.name}</span>
                </div>
                <span class="font-semibold text-slate-200">{c.percentage}%</span>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Second Row: Berth Traffic & Commodity Distribution */}
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Berth Traffic Analysis Card */}
        <div class="p-6 rounded-2xl glass-panel space-y-4 glow-emerald">
          <div class="flex items-center justify-between">
            <h4 class="text-base font-bold text-white">Berth Traffic Analysis</h4>
            <select
              value={selectedBerth}
              onChange={(e) => setSelectedBerth(e.target.value)}
              class="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-300 focus:outline-none"
            >
              <option value="All">All Docks</option>
              {berths.map(b => (
                <option key={b.berth} value={b.berth}>{b.berth}</option>
              ))}
            </select>
          </div>

          <div class="h-72 w-full text-xs">
            {selectedBerth === 'All' ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart key={`${selectedYear}_${activeTab}`} data={berths}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="berth" stroke="#64748b" />
                  <YAxis yAxisId="left" stroke="#3b82f6" orientation="left" tickFormatter={(v) => `₹${(v / 1.0e7).toFixed(1)} Cr`} />
                  <YAxis yAxisId="right" stroke="#10b981" orientation="right" tickFormatter={(v) => `${v}`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', color: '#fff' }}
                    itemStyle={{ color: '#fff' }}
                    labelStyle={{ color: '#fff', fontWeight: 'bold' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <Bar yAxisId="left" dataKey="revenue" name="Revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} isAnimationActive={true} animationDuration={1000} animationEasing="ease-in-out" />
                  <Bar yAxisId="right" dataKey="vesselsCount" name="Vessel Arrivals" fill="#10b981" radius={[4, 4, 0, 0]} isAnimationActive={true} animationDuration={1000} animationEasing="ease-in-out" />
                </BarChart>
              </ResponsiveContainer>
            ) : (() => {
              const b = berths.find(item => item.berth === selectedBerth);
              if (!b) return <p class="text-slate-500 py-20 text-center">No data for selected berth.</p>;
              const avgRevenueRate = b.vesselsCount > 0 ? b.revenue / b.vesselsCount : 0;
              const shareOfTotal = totalRevenue > 0 ? (b.revenue / totalRevenue) * 100 : 0;
              return (
                <div class="space-y-5 pt-2">
                  <div class="grid grid-cols-3 gap-4">
                    <div class="p-4 bg-slate-950/40 border border-slate-900 rounded-xl">
                      <span class="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Acquired Revenue</span>
                      <h5 class="text-sm font-bold text-white mt-1">{formatCurrency(b.revenue)}</h5>
                    </div>
                    <div class="p-4 bg-slate-950/40 border border-slate-900 rounded-xl">
                      <span class="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Vessels Handled</span>
                      <h5 class="text-sm font-bold text-white mt-1">{b.vesselsCount} Arrivals</h5>
                    </div>
                    <div class="p-4 bg-slate-950/40 border border-slate-900 rounded-xl">
                      <span class="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Avg Revenue Rate</span>
                      <h5 class="text-sm font-bold text-emerald-400 mt-1">{formatCurrency(avgRevenueRate)} <span class="text-[9px] text-slate-400 font-normal">/ ship</span></h5>
                    </div>
                  </div>
                  <div class="p-4 bg-slate-950/40 border border-slate-900 rounded-xl space-y-2">
                    <div class="flex justify-between text-xs font-semibold text-slate-400">
                      <span>Berth Revenue Share of Filtered Total</span>
                      <span class="text-blue-400 font-bold">{shareOfTotal.toFixed(2)}%</span>
                    </div>
                    <div class="h-2 bg-slate-900 rounded-full overflow-hidden">
                      <div class="h-full bg-blue-500 rounded-full" style={{ width: `${shareOfTotal}%` }}></div>
                    </div>
                  </div>
                  <div class="text-[11px] text-slate-500 italic bg-slate-900/30 p-3 rounded-lg border border-slate-900/60">
                    This dock has processed {b.vesselsCount} vessel arrivals in this filtered period with a total Gross Register Tonnage (GRT) of {b.totalGRT.toLocaleString()} tons.
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Commodity Distribution Bar Chart */}
        <div class="p-6 rounded-2xl glass-panel space-y-4">
          <h4 class="text-base font-bold text-white">Commodity Revenue distribution</h4>
          <div class="h-72 w-full text-xs">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart key={`${selectedYear}_${activeTab}`} data={commodities} layout="vertical" margin={{ left: 10, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis type="number" stroke="#64748b" tickFormatter={(v) => `₹${(v / 1.0e7).toFixed(1)} Cr`} />
                <YAxis dataKey="name" type="category" stroke="#64748b" width={90} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', color: '#fff' }}
                  itemStyle={{ color: '#fff' }}
                  formatter={(value) => [formatCurrency(value), 'Revenue']}
                />
                <Bar dataKey="value" name="Revenue" fill="#8b5cf6" radius={[0, 4, 4, 0]} isAnimationActive={true} animationDuration={1000} animationEasing="ease-in-out" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </div>
  );
}
