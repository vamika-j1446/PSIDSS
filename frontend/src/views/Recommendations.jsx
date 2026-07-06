import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { 
  Briefcase, ArrowUpRight, TrendingUp, AlertTriangle, Filter, AlertCircle, CheckCircle, Info, ShieldAlert
} from 'lucide-react';

export default function Recommendations({ token, selectedYear }) {
  const [recs, setRecs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  
  // Accordion details tracking
  const [expandedRecs, setExpandedRecs] = useState({});

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

  const toggleRec = (id) => {
    setExpandedRecs(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
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
    const imp = String(impact).toUpperCase();
    if (imp.includes('HIGH') || imp.includes('CRITICAL')) {
      return 'bg-red-500/10 text-red-400 border border-red-800/20';
    }
    if (imp.includes('MEDIUM')) {
      return 'bg-yellow-500/10 text-yellow-400 border border-yellow-800/20';
    }
    return 'bg-emerald-500/10 text-emerald-400 border border-emerald-800/20';
  };

  const getFilterCount = (cat) => {
    if (cat === 'All') return recs.length;
    return recs.filter(r => r.category === cat).length;
  };

  // Strategic priorities counts
  const highImpactCount = recs.filter(r => r.impact.includes('HIGH') || r.impact.includes('CRITICAL')).length;
  const mediumImpactCount = recs.filter(r => r.impact.includes('MEDIUM')).length;
  const retentionAlerts = recs.filter(r => r.category === 'Retention').length;
  const growthOpportunities = recs.filter(r => r.category === 'Opportunities').length;

  return (
    <div class="space-y-8 animate-fade-in relative">
      {/* Header & Category Filters */}
      <div class="flex flex-col xl:flex-row xl:items-center justify-between gap-4 border-b border-slate-900 pb-5">
        <div>
          <h2 class="text-3xl font-extrabold text-white tracking-tight">Executive Advisory Briefings</h2>
          <p class="text-slate-400 text-sm mt-1">Data-driven strategic recommendations, operations optimization, and risk mitigation strategies.</p>
        </div>

        {/* Filters */}
        <div class="flex items-center gap-2 bg-slate-900/80 p-1.5 rounded-xl border border-slate-800 self-start text-xs overflow-x-auto max-w-full">
          <Filter class="h-3.5 w-3.5 text-slate-500 ml-2 shrink-0" />
          <div class="flex gap-1">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                class={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer shrink-0 ${
                  categoryFilter === cat 
                    ? 'bg-blue-600 text-white shadow shadow-blue-500/20' 
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {cat} ({getFilterCount(cat)})
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Summary Box */}
      <div class="p-6 rounded-2xl glass-panel border border-slate-800/80 bg-slate-950/20 space-y-4 glow-violet">
        <h4 class="text-sm font-bold text-white uppercase tracking-wider">Strategic Priorities</h4>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-semibold">
          <div class="p-4 bg-slate-900/40 border border-slate-800 rounded-xl flex flex-col justify-between">
            <span class="text-slate-400 text-[10px] uppercase block mb-1">High Impact</span>
            <span class="text-sm font-bold text-red-400">{highImpactCount}</span>
          </div>
          <div class="p-4 bg-slate-900/40 border border-slate-800 rounded-xl flex flex-col justify-between">
            <span class="text-slate-400 text-[10px] uppercase block mb-1">Medium Impact</span>
            <span class="text-sm font-bold text-yellow-400">{mediumImpactCount}</span>
          </div>
          <div class="p-4 bg-slate-900/40 border border-slate-800 rounded-xl flex flex-col justify-between">
            <span class="text-slate-400 text-[10px] uppercase block mb-1">Customer Retention</span>
            <span class="text-sm font-bold text-blue-400">{retentionAlerts} Alert{retentionAlerts !== 1 ? 's' : ''}</span>
          </div>
          <div class="p-4 bg-slate-900/40 border border-slate-800 rounded-xl flex flex-col justify-between">
            <span class="text-slate-400 text-[10px] uppercase block mb-1">Opportunities</span>
            <span class="text-sm font-bold text-emerald-400">{growthOpportunities} Growth Segment{growthOpportunities !== 1 ? 's' : ''}</span>
          </div>
        </div>
        <p class="text-[10px] text-slate-500 italic">
          These recommendations are generated from uploaded Cochin Port billing records.
        </p>
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
            const isHigh = rec.impact.toUpperCase().includes('HIGH') || rec.impact.toUpperCase().includes('CRITICAL');
            const borderClass = isHigh
              ? 'border-l-4 border-l-red-500'
              : 'border-l-4 border-l-yellow-500';

            const isExpanded = !!expandedRecs[rec.id];

            return (
              <div 
                key={rec.id} 
                class={`p-6 rounded-2xl glass-panel flex flex-col justify-between hover:shadow-[0_0_20px_rgba(59,130,246,0.08)] transition-all duration-300 border border-slate-900/60 ${borderClass}`}
              >
                <div class="space-y-3.5">
                  {/* Category & Impact Row */}
                  <div class="flex items-center justify-between">
                    <span class="text-[9px] font-extrabold uppercase tracking-wider text-blue-400 bg-blue-500/5 px-2.5 py-1 border border-blue-500/10 rounded-lg">
                      {rec.category}
                    </span>
                    <span class={`px-2 py-0.5 text-[9px] font-extrabold uppercase rounded ${getImpactBadgeClass(rec.impact)}`}>
                      {rec.impact}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 class="text-base font-bold text-white leading-snug">
                    {rec.title}
                  </h3>

                  {/* Structured Core Points */}
                  <div class="space-y-2 text-xs font-semibold">
                    <div>
                      <span class="text-[9px] text-slate-500 uppercase block tracking-wider mb-0.5">Problem</span>
                      <p class="text-[11px] text-slate-300 leading-normal font-medium">{rec.shortProblem || 'Significant billing variance identified.'}</p>
                    </div>

                    <div class="p-2.5 bg-slate-950/60 border border-slate-900 rounded-lg w-fit">
                      <span class="text-[9px] text-blue-400 uppercase block tracking-wider mb-0.5">Key Evidence</span>
                      <p class="text-[11px] text-slate-100 font-mono font-bold leading-normal">{rec.evidence}</p>
                    </div>

                    <div>
                      <span class="text-[9px] text-slate-500 uppercase block tracking-wider mb-0.5">Recommended Action</span>
                      <p class="text-[11px] text-slate-200 leading-normal font-bold">{rec.action}</p>
                    </div>

                    <div>
                      <span class="text-[9px] text-emerald-400 uppercase block tracking-wider mb-0.5">Expected Benefit</span>
                      <p class="text-[11px] text-emerald-300 leading-normal font-bold">{rec.benefit}</p>
                    </div>
                  </div>
                </div>

                {/* Accordion Expand Details */}
                <div class="border-t border-slate-900/60 mt-5 pt-4">
                  <button 
                    onClick={() => toggleRec(rec.id)}
                    class="bg-blue-600/10 hover:bg-blue-600 border border-blue-500/20 hover:border-blue-500 text-blue-400 hover:text-white px-4 py-1.5 rounded-lg text-xs font-bold transition-all focus:outline-none cursor-pointer self-start"
                  >
                    {isExpanded ? 'Hide Action Plan' : 'View Action Plan'}
                  </button>

                  {isExpanded && (
                    <div class="mt-4 p-3 bg-slate-950/80 border border-slate-900 rounded-xl space-y-1.5 text-slate-400 text-[10px] leading-relaxed font-medium animate-fade-in">
                      <p>{rec.explanation || 'Detailed tactical recommendations are computed from billing transaction volumes and terminal log concentration indexes.'}</p>
                      <div class="flex items-center gap-1.5 text-slate-500 border-t border-slate-900 pt-2 mt-2">
                        <Info class="h-3.5 w-3.5" />
                        <span>Source context derived strictly from uploaded Cochin Port records.</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
