import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Briefcase, ArrowUpRight, TrendingUp, AlertTriangle, Filter, AlertCircle, CheckCircle } from 'lucide-react';

export default function Recommendations({ token, selectedYear }) {
  const [recs, setRecs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  
  // Interactive strategy initiation tracking
  const [activeStrategies, setActiveStrategies] = useState([]);
  const [toastMessage, setToastMessage] = useState('');

  const initiateStrategy = (id, title) => {
    if (activeStrategies.includes(id)) return;
    setActiveStrategies(prev => [...prev, id]);
    setToastMessage(`Strategy "${title}" has been successfully initiated and deployed to live operations!`);
    setTimeout(() => {
      setToastMessage('');
    }, 4500);
  };

  useEffect(() => {
    const fetchRecs = async () => {
      try {
        const config = { headers: { Authorization: `Bearer ${token}` } };
        const response = await axios.get(`/api/recommendations?year=${selectedYear}`, config);
        setRecs(response.data);
      } catch (err) {
        console.error(err);
        setError('Failed to fetch recommendations.');
      } finally {
        setLoading(false);
      }
    };

    fetchRecs();
  }, [token, selectedYear]);

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

  const categories = [
    'All',
    'Revenue Growth',
    'Customer Risk',
    'Berth Performance',
    'Commodity / Cargo',
    'Retention',
    'Opportunities'
  ];

  const filteredRecs = categoryFilter === 'All' 
    ? recs 
    : recs.filter(r => r.category === categoryFilter);

  const getImpactBadgeClass = (impact) => {
    const imp = String(impact).toLowerCase();
    if (imp.includes('critical')) return 'bg-red-500/10 text-red-400 border border-red-800/20';
    if (imp.includes('high')) return 'bg-orange-500/10 text-orange-400 border border-orange-800/20';
    return 'bg-yellow-500/10 text-yellow-400 border border-yellow-800/20';
  };

  return (
    <div class="space-y-8 animate-fade-in relative">
      {/* Header & Category Filters */}
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 class="text-3xl font-extrabold text-white tracking-tight">Executive Advisory Briefings</h2>
          <p class="text-slate-400 text-sm mt-1">Data-driven strategic recommendations, operations optimization, and risk mitigation strategies.</p>
        </div>

        {/* Filters */}
        <div class="flex items-center gap-2 bg-slate-900/80 p-1.5 rounded-xl border border-slate-800 self-start text-xs">
          <Filter class="h-3.5 w-3.5 text-slate-500 ml-2 shrink-0" />
          <div class="flex gap-1">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                class={`px-3 py-1 rounded-lg font-medium transition-all ${
                  categoryFilter === cat 
                    ? 'bg-blue-600 text-white shadow' 
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Advisory list */}
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {filteredRecs.length === 0 ? (
          <div class="col-span-full p-8 rounded-2xl glass-panel border border-slate-900 text-center flex flex-col justify-center items-center py-20 space-y-4">
            <CheckCircle class="h-12 w-12 text-emerald-400 animate-pulse" />
            <div class="space-y-1">
              <h3 class="text-base font-bold text-white">No Issues Detected</h3>
              <p class="text-slate-400 text-xs max-w-md mx-auto leading-relaxed">
                No advisory generated for this category because no significant issue was detected.
              </p>
            </div>
          </div>
        ) : (
          filteredRecs.map((rec) => {
            const borderClass = rec.impact.toLowerCase().includes('critical')
              ? 'border-l-4 border-l-red-500'
              : rec.impact.toLowerCase().includes('high')
              ? 'border-l-4 border-l-orange-500'
              : 'border-l-4 border-l-yellow-500';

            const isActive = activeStrategies.includes(rec.id);

            return (
              <div 
                key={rec.id} 
                class={`p-6 rounded-2xl glass-panel flex flex-col justify-between hover:shadow-[0_0_20px_rgba(59,130,246,0.08)] hover:-translate-y-0.5 transition-all duration-300 border border-slate-900/60 ${borderClass}`}
              >
                <div class="space-y-4">
                  {/* Header: Category & Impact */}
                  <div class="flex items-center justify-between">
                    <span class="text-[10px] font-extrabold uppercase tracking-wider text-blue-400 bg-blue-500/5 px-2.5 py-1 border border-blue-500/10 rounded-lg">
                      {rec.category}
                    </span>
                    <span class={`px-2 py-0.5 text-[9px] font-extrabold uppercase rounded ${getImpactBadgeClass(rec.impact)}`}>
                      {rec.impact}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 class="text-lg font-bold text-white leading-snug">
                    {rec.title}
                  </h3>

                  {/* 3-Part Structured Brief */}
                  <div class="space-y-3 pt-1 text-xs">
                    {/* Evidence */}
                    <div class="flex items-start gap-2">
                      <span class="text-slate-500 font-bold shrink-0 mt-0.5">EVIDENCE:</span>
                      <p class="text-slate-300 leading-relaxed font-medium">{rec.evidence}</p>
                    </div>

                    {/* Action Plan */}
                    <div class="flex items-start gap-2 bg-slate-950/40 p-3 rounded-xl border border-slate-900">
                      <span class="text-blue-400 font-bold shrink-0">ACTION:</span>
                      <p class="text-slate-200 leading-relaxed font-semibold">{rec.action}</p>
                    </div>

                    {/* Expected Benefit */}
                    <div class="flex items-center gap-2 pt-1">
                      <span class="text-emerald-400 font-bold shrink-0">EXPECTED BENEFIT:</span>
                      <p class="text-emerald-300 font-semibold">{rec.benefit}</p>
                    </div>
                  </div>
                </div>

                {/* Action Button */}
                <div class="border-t border-slate-900/60 mt-5 pt-4 flex items-center justify-end">
                  {isActive ? (
                    <span class="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5">
                      ✓ Strategy Active
                    </span>
                  ) : (
                    <button 
                      onClick={() => initiateStrategy(rec.id, rec.title)}
                      class="bg-blue-600/10 hover:bg-blue-600 border border-blue-500/20 hover:border-blue-500 text-blue-400 hover:text-white px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all focus:outline-none"
                    >
                      Initiate Strategy <ArrowUpRight class="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Floating Strategy Activation Toast Alert */}
      {toastMessage && (
        <div class="fixed bottom-6 right-6 z-50 p-4 bg-slate-950 border border-emerald-500/30 text-white rounded-xl shadow-2xl flex items-center gap-3 animate-slide-in glow-emerald max-w-md">
          <div class="p-1.5 bg-emerald-500/15 text-emerald-400 rounded-lg shrink-0">
            <CheckCircle class="h-5 w-5" />
          </div>
          <div>
            <span class="text-xs font-bold block text-emerald-400 uppercase tracking-wider">Strategy Deployed</span>
            <p class="text-slate-300 text-xs mt-0.5 font-medium leading-relaxed">{toastMessage}</p>
          </div>
        </div>
      )}
    </div>
  );
}
