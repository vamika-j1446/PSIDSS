import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import axios from 'axios';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { 
  Sliders, RefreshCw, Info, AlertCircle, TrendingUp, DollarSign, Activity, Percent, ShieldAlert
} from 'lucide-react';

export default function Sandbox({ token, selectedYear, activeTab }) {
  // Tariff percentage value: default +10%
  const [tariffPercent, setTariffPercent] = useState(10);
  
  const [simulationData, setSimulationData] = useState(null);
  const [historicalSeries, setHistoricalSeries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Local drilldown scope for Berth: Default to "All Berths"
  const [localBerth, setLocalBerth] = useState('All Berths');
  const [berthList, setBerthList] = useState(['All Berths']);
  const fetchingRef = useRef(false);

  const runSimulation = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setLoading(true);
    setError('');
    try {
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const response = await axios.post('/api/simulation/run', {
        selectedBerth: localBerth,
        yearScope: selectedYear,
        tariffPercent: 0 // Always fetch base baseline - tariff is applied client-side
      }, config);
      console.log('Simulation API response keys:', Object.keys(response.data || {}));
      setSimulationData(response.data);
      if (response.data && response.data.projection && response.data.projection.length > 0) {
        console.log('Simulation projection sample:', response.data.projection[0]);
        setHistoricalSeries(response.data.projection);
      } else {
        console.warn('Simulation returned empty projection data:', response.data);
        setHistoricalSeries([]);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to run simulation. Ensure your account has Analyst/Admin permissions.');
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, [token, selectedYear, localBerth]);

  // Run simulation when berth, year, or token changes (not on tariffPercent changes)
  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      runSimulation();
    }, 250);
    return () => clearTimeout(delayDebounce);
  }, [runSimulation]);

  // Auto-refresh after Excel upload
  useEffect(() => {
    const handler = () => {
      fetchingRef.current = false;
      runSimulation();
    };
    window.addEventListener('psidss-data-updated', handler);
    return () => window.removeEventListener('psidss-data-updated', handler);
  }, [runSimulation]);

  // Synchronize dropdown options with backend berths array
  useEffect(() => {
    if (simulationData && simulationData.berths) {
      setBerthList(simulationData.berths);
    }
  }, [simulationData]);

  const resetSliders = () => {
    setTariffPercent(10);
    setLocalBerth('All Berths');
  };

  const formatCurrency = (num) => {
    if (num >= 1.0e9) return `₹${(num / 1.0e9).toFixed(2)} B`;
    if (num >= 1.0e7) return `₹${(num / 1.0e7).toFixed(2)} Cr`;
    if (num >= 1.0e5) return `₹${(num / 1.0e5).toFixed(2)} L`;
    return `₹${num.toLocaleString('en-IN')}`;
  };

  // Calculate overall metrics locally based on tariffPercent
  const totalBase = simulationData?.baseRevenue ?? 0;
  const totalSim = totalBase * (1 + tariffPercent / 100);
  const revDiff = totalSim - totalBase;
  const pctChange = tariffPercent;

  // Recalculate projectionData dynamically using useMemo when tariffPercent changes
  const projectionData = useMemo(() => {
    const multiplier = 1 + Number(tariffPercent || 0) / 100;
    const result = historicalSeries.map((row) => {
      // Accept multiple possible key names from backend
      const base = Number(
        row.historicalRevenue ?? row.baseRevenue ?? row.revenue ?? 0
      );
      return {
        year: row.year || row.period || row.source_year || 0,
        period: row.period || row.year || row.source_year || '',
        historicalRevenue: base,
        simulatedRevenue: parseFloat((base * multiplier).toFixed(2)),
        revenueDelta: parseFloat((base * (Number(tariffPercent || 0) / 100)).toFixed(2)),
      };
    });
    console.log('projectionData computed, length:', result.length, 'tariffPercent:', tariffPercent, result[0]);
    return result;
  }, [historicalSeries, tariffPercent]);

  const getDiagnosticMessage = () => {
    const sign = tariffPercent >= 0 ? '+' : '';
    const share = simulationData?.diagnostics?.revenueShare ?? 0;
    if (localBerth === 'All' || localBerth === 'All Berths') {
      return `A ${sign}${tariffPercent}% tariff adjustment increases estimated revenue from ${formatCurrency(totalBase)} to ${formatCurrency(totalSim)}, creating ${formatCurrency(revDiff)} additional revenue. This is based on all selected historical billing records.`;
    }
    return `This berth contributes ${share}% of selected-scope revenue. A ${sign}${tariffPercent}% tariff adjustment creates ${formatCurrency(revDiff)} additional estimated revenue.`;
  };

  return (
    <div class="space-y-8 animate-fade-in pb-12">
      {/* Header */}
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 class="text-3xl font-extrabold text-white tracking-tight">Tariff Simulation Sandbox</h2>
          <p class="text-slate-400 text-sm mt-1">What-if forecasting dashboard. Adjust tariffs, account allocations, and cargo shares to project revenue impact.</p>
        </div>
        <button 
          onClick={resetSliders}
          class="text-xs text-blue-400 hover:text-blue-300 border border-blue-500/20 hover:bg-blue-500/5 px-4 py-1.5 rounded-lg font-bold transition-all focus:outline-none self-start"
        >
          Reset Simulation
        </button>
      </div>

      {error && (
        <div class="p-4 bg-red-950/30 border border-red-900/40 rounded-xl text-red-300 flex items-center gap-2 max-w-xl mx-auto my-6">
          <AlertCircle class="h-5 w-5" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Sandbox Layout */}
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Sliders panel */}
        <div class="p-6 rounded-2xl glass-panel space-y-6 glow-blue h-fit">
          <h4 class="text-base font-bold text-white flex items-center gap-2">
            <Sliders class="h-5 w-5 text-blue-400" /> Adjust Parameters
          </h4>

          {/* Drilldown selectors */}
          <div class="bg-slate-950/60 p-4 rounded-xl border border-slate-900 space-y-4">
            <div class="flex flex-col space-y-1">
              <span class="text-[9px] text-slate-500 font-bold uppercase">Simulation Berth</span>
              <select
                value={localBerth}
                onChange={(e) => setLocalBerth(e.target.value)}
                class="bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none w-full"
              >
                {berthList.map(b => (
                  <option key={b} value={b}>{b === 'All' || b === 'All Berths' ? 'All Berths' : b}</option>
                ))}
              </select>
            </div>
            
            <div class="text-[10px] text-slate-500 font-mono flex items-center gap-1.5">
              <Info class="h-3 w-3 text-slate-500" />
              <span>Year synced to global filter: {selectedYear}</span>
            </div>
          </div>

          <div class="space-y-6">
            
            {/* Unified Tariff Rate Slider and Presets */}
            <div class="space-y-3">
              <div class="flex justify-between text-xs font-semibold uppercase tracking-wider text-slate-400">
                <span>Tariff Adjustment</span>
                <span class="text-blue-400 font-bold font-mono">{tariffPercent >= 0 ? '+' : ''}{tariffPercent}%</span>
              </div>
              
              <input 
                type="range" 
                min="-20" 
                max="50" 
                step="1"
                value={tariffPercent} 
                onChange={(e) => setTariffPercent(parseInt(e.target.value, 10))}
                class="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />

              {/* Quick Preset Buttons */}
              <div class="flex gap-2">
                {[3, 5, 10, 15, 20].map((pct) => (
                  <button
                    key={pct}
                    onClick={() => setTariffPercent(pct)}
                    class={`flex-1 py-1.5 px-2 rounded text-[10px] font-bold border transition-all ${
                      tariffPercent === pct
                        ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/10'
                        : 'bg-slate-900/50 border-slate-800 text-slate-300 hover:text-white hover:bg-slate-900'
                    }`}
                  >
                    +{pct}%
                  </button>
                ))}
              </div>
              <span class="text-[9px] text-slate-500 block leading-normal pt-1">
                Drag the slider for custom rates, or click quick buttons to snap to preset increases.
              </span>
            </div>

          </div>

          <div class="border-t border-slate-800 pt-4 flex gap-2 items-start text-[10px] text-slate-500 leading-relaxed">
            <Info class="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
            <span>
              Simulation estimates tariff impact by applying the selected percentage to historical billing revenue.
            </span>
          </div>
        </div>

        {/* Right Column: Calculations and Charts */}
        <div class="lg:col-span-2 space-y-6">
          
          {/* Calculations Summary Card Grid */}
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Base Revenue */}
            <div class="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col justify-between shadow-sm">
              <span class="text-[9px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                <Activity class="h-3 w-3" /> Base Revenue
              </span>
              <h5 class="text-sm font-bold text-slate-200 mt-2 truncate">{formatCurrency(totalBase)}</h5>
            </div>

            {/* Selected Tariff Pct */}
            <div class="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col justify-between shadow-sm">
              <span class="text-[9px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                <Percent class="h-3 w-3" /> Tariff Selected
              </span>
              <h5 class="text-sm font-bold text-blue-400 mt-2 truncate">{pctChange >= 0 ? '+' : ''}{pctChange}%</h5>
            </div>

            {/* Simulated Revenue */}
            <div class="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col justify-between shadow-sm">
              <span class="text-[9px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                <DollarSign class="h-3 w-3" /> Sim Revenue
              </span>
              <h5 class="text-sm font-bold text-white mt-2 truncate">{formatCurrency(totalSim)}</h5>
            </div>

            {/* Revenue Difference */}
            <div class="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col justify-between shadow-sm">
              <span class="text-[9px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                <TrendingUp class="h-3 w-3" /> Revenue Delta
              </span>
              <h5 class={`text-sm font-bold mt-2 truncate ${revDiff >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {revDiff >= 0 ? '+' : ''}{formatCurrency(revDiff)}
              </h5>
            </div>

          </div>

          {/* Berth Diagnostics & Risk Panel */}
          <div class="p-6 rounded-2xl glass-panel space-y-4 glow-rose border border-slate-900">
            <h4 class="text-sm font-bold text-white flex items-center gap-2">
              <ShieldAlert class="h-4.5 w-4.5 text-rose-400" /> Simulation Risk & Berth Diagnostics
            </h4>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Left Column: Diagnostics Statistics */}
              <div class="p-4 bg-slate-900/40 border border-slate-800 rounded-xl space-y-2.5 text-xs font-medium text-slate-400">
                <span class="text-[9px] text-slate-500 font-bold uppercase tracking-wider block border-b border-slate-800/60 pb-1.5">
                  Berth Projections summary ({localBerth === 'All' || localBerth === 'All Berths' ? 'Port-wide' : `Berth ${localBerth}`})
                </span>
                <div class="flex justify-between">
                  <span>Selected scope:</span>
                  <span class="text-slate-200">{simulationData?.yearScope || selectedYear}</span>
                </div>
                <div class="flex justify-between">
                  <span>Total historical revenue:</span>
                  <span class="text-slate-200">{formatCurrency(totalBase)}</span>
                </div>
                <div class="flex justify-between">
                  <span>Simulated revenue:</span>
                  <span class="text-slate-200">{formatCurrency(totalSim)}</span>
                </div>
                <div class="flex justify-between">
                  <span>Revenue Difference:</span>
                  <span class={`font-bold ${revDiff >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {revDiff >= 0 ? '+' : ''}{formatCurrency(revDiff)} ({pctChange >= 0 ? '+' : ''}{pctChange}%)
                  </span>
                </div>
                <div class="flex justify-between">
                  <span>Tariff Revenue Impact:</span>
                  <span class="text-blue-400 font-mono font-bold">
                    {formatCurrency(revDiff)}
                  </span>
                </div>
                {localBerth !== 'All' && localBerth !== 'All Berths' && (
                  <div class="flex justify-between">
                    <span>Revenue Share:</span>
                    <span class="text-slate-200">{simulationData?.diagnostics?.revenueShare || 0}% of selected-scope revenue</span>
                  </div>
                )}
                <div class="flex justify-between">
                  <span>Number of transactions:</span>
                  <span class="text-slate-200">{(simulationData?.diagnostics?.transactionCount || 0).toLocaleString()}</span>
                </div>
                <div class="flex justify-between">
                  <span>Number of vessel calls:</span>
                  <span class="text-slate-200">{(simulationData?.diagnostics?.vesselCount || 0).toLocaleString()}</span>
                </div>
                <div class="flex justify-between">
                  <span>Number of customers:</span>
                  <span class="text-slate-200">{(simulationData?.diagnostics?.customerCount || 0).toLocaleString()}</span>
                </div>
              </div>

              {/* Right Column: Diagnostic Messages */}
              <div class="space-y-3">
                {(!simulationData || simulationData.baseRevenue === 0) ? (
                  <div class="p-4 bg-slate-900/50 border border-slate-800 rounded-xl text-center flex flex-col justify-center h-full">
                    <AlertCircle class="h-6 w-6 text-slate-500 mx-auto mb-1" />
                    <p class="text-[11px] text-slate-400 font-bold">Insufficient historical data to calculate risk for this berth</p>
                  </div>
                ) : (
                  <div class="p-5 bg-blue-950/10 border border-blue-900/25 rounded-xl flex flex-col justify-between h-full space-y-4">
                    <div class="space-y-2">
                      <div class="flex items-center justify-between border-b border-slate-800/60 pb-2">
                        <span class="text-xs font-bold text-white">{simulationData.diagnostics.title}</span>
                        {simulationData.diagnostics.impactLevel && simulationData.diagnostics.impactLevel !== 'N/A' && (
                          <span class={`px-2 py-0.5 text-[9px] font-extrabold rounded uppercase ${
                            simulationData.diagnostics.impactLevel.includes('High') 
                              ? 'bg-red-500/20 text-red-400 border border-red-800/30' 
                              : simulationData.diagnostics.impactLevel.includes('Moderate') 
                              ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-800/30' 
                              : 'bg-emerald-500/10 text-emerald-400 border border-emerald-800/30'
                          }`}>
                            {simulationData.diagnostics.impactLevel}
                          </span>
                        )}
                      </div>
                      <p class="text-[11px] text-slate-300 leading-relaxed font-medium pt-1">
                        {getDiagnosticMessage()}
                      </p>
                    </div>
                    
                    <div class="border-t border-slate-800/60 pt-3 flex gap-2 items-start text-[10px] text-slate-500 leading-normal">
                      <Info class="h-4 w-4 text-blue-500 shrink-0" />
                      <span>This is a financial what-if simulation based on historical billing revenue.</span>
                    </div>
                  </div>
                )}
              </div>

            </div>
          </div>

          {/* Charts panel */}
          <div class="p-6 rounded-2xl glass-panel space-y-4 glow-violet">
            <div class="flex items-center justify-between">
              <h4 class="text-base font-bold text-white">Simulation Overlay Projection</h4>
              {loading && (
                <RefreshCw class="h-4 w-4 text-blue-400 animate-spin" />
              )}
            </div>

            <div class="h-80 w-full text-xs">
              {(!simulationData || !projectionData || projectionData.length === 0) ? (
                <p class="text-slate-400 text-center py-20 border border-slate-900 rounded-xl">
                  No simulation data available for selected filter scope.
                </p>
              ) : (() => {
                // Temporary debug logs as requested
                console.log("Tariff:", tariffPercent);
                console.log("Projection Data:", projectionData.slice(0, 3));

                const maxChartVal = Math.max(
                  ...projectionData.map(p => Math.max(p.historicalRevenue, p.simulatedRevenue))
                );

                return (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart key={`${selectedYear}_${activeTab}_${tariffPercent}`} data={projectionData} margin={{ top: 10, right: 10, left: -15, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="year" stroke="#64748b" />
                      <YAxis 
                        stroke="#64748b" 
                        tickFormatter={(v) => `₹${(v / 1.0e7).toFixed(1)} Cr`} 
                        domain={[0, maxChartVal ? Math.ceil(maxChartVal * 1.1) : 'auto']}
                      />
                      <Tooltip 
                        content={({ active, payload, label }) => {
                          if (active && payload && payload.length) {
                            const hist = payload.find(p => p.dataKey === 'historicalRevenue')?.value || 0;
                            const sim = payload.find(p => p.dataKey === 'simulatedRevenue')?.value || 0;
                            const diff = sim - hist;
                            return (
                              <div class="p-4 bg-slate-950/95 border border-slate-800 rounded-xl space-y-1.5 text-xs text-slate-300 leading-normal shadow-xl">
                                <p class="font-bold text-white mb-1">Fiscal Year {label}</p>
                                <p class="flex justify-between gap-6">
                                  <span>Historical Baseline:</span>
                                  <span class="font-bold text-slate-400">{formatCurrency(hist)}</span>
                                </p>
                                <p class="flex justify-between gap-6">
                                  <span>Simulation Revenue:</span>
                                  <span class="font-bold text-blue-400">{formatCurrency(sim)}</span>
                                </p>
                                <p class="flex justify-between gap-6 border-t border-slate-900 pt-1.5 mt-1.5 font-bold">
                                  <span>Difference:</span>
                                  <span class={diff >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                                    {diff >= 0 ? '+' : ''}{formatCurrency(diff)}
                                  </span>
                                </p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                      
                      {/* Baseline Line */}
                      <Line 
                        type="monotone" 
                        dataKey="historicalRevenue" 
                        name="Historical Baseline" 
                        stroke="#475569" 
                        dot={false}
                        strokeDasharray="5 5"
                        isAnimationActive={true}
                        animationDuration={1000}
                        animationEasing="ease-in-out"
                      />

                      {/* Simulated Line */}
                      <Line 
                        type="monotone" 
                        dataKey="simulatedRevenue" 
                        name="Simulation Revenue" 
                        stroke="#3b82f6" 
                        strokeWidth={3}
                        dot={false}
                        activeDot={{ r: 6 }}
                        isAnimationActive={true}
                        animationDuration={1000}
                        animationEasing="ease-in-out"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                );
              })()}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
