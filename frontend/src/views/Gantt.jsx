import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Anchor, Calendar, Info, AlertCircle, HelpCircle } from 'lucide-react';

export default function Gantt({ token, selectedYear }) {
  const [vessels, setVessels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Local filter states
  const [localYear, setLocalYear] = useState(selectedYear || 'All');
  const [localMonth, setLocalMonth] = useState('All');

  // Timezone-safe local date parser
  const parseLocalDate = (dateStr) => {
    if (!dateStr) return null;
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      return new Date(y, m, d, 0, 0, 0);
    }
    return new Date(dateStr);
  };

  // Parses vessel date format (e.g. YYYY-MM-DD HH:mm:ss) consistently
  const parseVesselDate = (dateStr) => {
    if (!dateStr) return null;
    const clean = String(dateStr).replace(' ', 'T');
    return new Date(clean);
  };

  // Date range inputs (initialized from database limits)
  const [startDateStr, setStartDateStr] = useState('');
  const [endDateStr, setEndDateStr] = useState('');

  const isValidDate = (dStr) => {
    if (!dStr) return false;
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(dStr)) return false;
    const d = new Date(dStr);
    return !isNaN(d.getTime());
  };

  const months = [
    { value: 'All', label: 'All Months' },
    { value: '1', label: 'January' },
    { value: '2', label: 'February' },
    { value: '3', label: 'March' },
    { value: '4', label: 'April' },
    { value: '5', label: 'May' },
    { value: '6', label: 'June' },
    { value: '7', label: 'July' },
    { value: '8', label: 'August' },
    { value: '9', label: 'September' },
    { value: '10', label: 'October' },
    { value: '11', label: 'November' },
    { value: '12', label: 'December' }
  ];

  // Sync year state when global selectedYear changes
  useEffect(() => {
    setLocalYear(selectedYear);
    setLocalMonth('All');
  }, [selectedYear]);

  useEffect(() => {
    const fetchGanttData = async () => {
      setLoading(true);
      try {
        const config = { headers: { Authorization: `Bearer ${token}` } };
        const response = await axios.get(`/api/historical/gantt?year=${localYear}`, config);
        const data = response.data;
        setVessels(data);

        if (data.length > 0) {
          // Sort arrival dates
          const dates = data.map(v => parseVesselDate(v.ata)).filter(Boolean).sort((a, b) => a - b);
          const minDate = dates[0] || new Date();
          const maxDate = dates[dates.length - 1] || new Date();
          
          // Default: show the first 30 days of data, or the full year range
          const start = minDate;
          const end = new Date(minDate.getTime() + 30 * 24 * 60 * 60 * 1000) < maxDate 
            ? new Date(minDate.getTime() + 30 * 24 * 60 * 60 * 1000) 
            : maxDate;
          
          setStartDateStr(start.toISOString().split('T')[0]);
          setEndDateStr(end.toISOString().split('T')[0]);
        } else {
          setStartDateStr('');
          setEndDateStr('');
        }
      } catch (err) {
        console.error(err);
        setError('Failed to load berth timeline Gantt data.');
      } finally {
        setLoading(false);
      }
    };

    fetchGanttData();
  }, [token, localYear]);

  // Debounced/refetch query when valid date range is entered manually
  useEffect(() => {
    if (!isValidDate(startDateStr) || !isValidDate(endDateStr)) return;

    const refetchRange = async () => {
      try {
        const config = { headers: { Authorization: `Bearer ${token}` } };
        const response = await axios.get(`/api/historical/gantt?year=${localYear}&startDate=${startDateStr}&endDate=${endDateStr}`, config);
        setVessels(response.data);
      } catch (err) {
        console.error('Failed to load range Gantt data:', err);
      }
    };

    const delay = setTimeout(() => {
      refetchRange();
    }, 450);

    return () => clearTimeout(delay);
  }, [startDateStr, endDateStr, token, localYear]);

  const handleMonthChange = (mVal) => {
    setLocalMonth(mVal);
    if (mVal === 'All') {
      resetFilters();
      return;
    }
    const monthNum = parseInt(mVal);
    const yr = localYear === 'All' ? '2024' : localYear; // fallback to 2024 if All
    const firstDay = `${yr}-${String(monthNum).padStart(2, '0')}-01`;
    const lastDayNum = new Date(parseInt(yr), monthNum, 0).getDate();
    const lastDay = `${yr}-${String(monthNum).padStart(2, '0')}-${String(lastDayNum).padStart(2, '0')}`;
    setStartDateStr(firstDay);
    setEndDateStr(lastDay);
  };

  const resetFilters = () => {
    setLocalYear(selectedYear || 'All');
    setLocalMonth('All');
    if (vessels.length > 0) {
      const dates = vessels.map(v => parseVesselDate(v.ata)).filter(Boolean).sort((a, b) => a - b);
      if (dates.length > 0) {
        const minDate = dates[0];
        const maxDate = dates[dates.length - 1];
        const start = minDate;
        const end = new Date(minDate.getTime() + 30 * 24 * 60 * 60 * 1000) < maxDate 
          ? new Date(minDate.getTime() + 30 * 24 * 60 * 60 * 1000) 
          : maxDate;
        setStartDateStr(start.toISOString().split('T')[0]);
        setEndDateStr(end.toISOString().split('T')[0]);
      }
    }
  };

  const hasValidRange = isValidDate(startDateStr) && isValidDate(endDateStr);
  const timelineStart = hasValidRange ? parseLocalDate(startDateStr) : null;
  const timelineEnd = hasValidRange ? parseLocalDate(endDateStr) : null;

  const yearMin = localYear !== 'All' ? `${localYear}-01-01` : '2016-01-01';
  const yearMax = localYear !== 'All' ? `${localYear}-12-31` : '2025-12-31';

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

  // Get distinct berths to create swimlanes
  const berths = [...new Set(vessels.map(v => v.berth))].sort();

  // Helper to check if a vessel overlaps with the current timeline window and calculate positions
  const getTimelineOverlap = (v) => {
    if (!timelineStart || !timelineEnd) return null;
    const vStart = parseVesselDate(v.ata).getTime();
    const vEnd = parseVesselDate(v.departure).getTime();
    const tStart = timelineStart.getTime();
    const tEnd = timelineEnd.getTime();

    // Check if overlap exists
    if (vEnd < tStart || vStart > tEnd) return null;

    // Calculate percentage offsets
    const totalDuration = tEnd - tStart;
    const leftMs = Math.max(vStart, tStart) - tStart;
    const durationMs = Math.min(vEnd, tEnd) - Math.max(vStart, tStart);

    const leftPercent = (leftMs / totalDuration) * 100;
    const widthPercent = (durationMs / totalDuration) * 100;

    return {
      left: `${leftPercent.toFixed(2)}%`,
      width: `${Math.max(2.0, widthPercent).toFixed(2)}%` // Ensure at least 2% visible width
    };
  };

  // Lane stacking algorithm to prevent vessel overlays in a swimlane
  const stackVesselsInLanes = (berthVessels) => {
    const sorted = [...berthVessels].sort((a, b) => parseVesselDate(a.ata) - parseVesselDate(b.ata));
    const lanes = []; // array of lanes, each is array of vessels
    
    sorted.forEach(v => {
      const vStart = parseVesselDate(v.ata).getTime();
      let placed = false;
      
      for (let i = 0; i < lanes.length; i++) {
        const lastInLane = lanes[i][lanes[i].length - 1];
        const lastEnd = parseVesselDate(lastInLane.departure).getTime();
        
        // Non-overlapping if start is after last departure (plus 2 hour buffer)
        if (vStart >= lastEnd + 2 * 60 * 60 * 1000) {
          lanes[i].push(v);
          v.laneIndex = i;
          placed = true;
          break;
        }
      }
      
      if (!placed) {
        lanes.push([v]);
        v.laneIndex = lanes.length - 1;
        placed = true;
      }
    });
    
    return { stackedVessels: sorted, laneCount: Math.max(1, lanes.length) };
  };

  // Color code based on Vessel Type
  const getVesselStyleClass = (type) => {
    const t = String(type).toLowerCase();
    if (t.includes('tanker') || t.includes('liquid')) {
      return 'bg-red-500/25 text-red-400 border border-red-500/40 hover:bg-red-500/35 hover:shadow-[0_0_15px_rgba(239,68,68,0.15)]';
    }
    if (t.includes('container') || t.includes('cargo')) {
      return 'bg-blue-500/25 text-blue-400 border border-blue-500/40 hover:bg-blue-500/35 hover:shadow-[0_0_15px_rgba(59,130,246,0.15)]';
    }
    if (t.includes('cruise') || t.includes('passenger')) {
      return 'bg-purple-500/25 text-purple-400 border border-purple-500/40 hover:bg-purple-500/35 hover:shadow-[0_0_15px_rgba(168,85,247,0.15)]';
    }
    return 'bg-emerald-500/20 text-emerald-400 border border-emerald-600/30 hover:bg-emerald-500/30';
  };

  // Generate date markers for the timeline columns (e.g. 10 intervals)
  const columnsCount = 10;
  const colMarkers = [];
  if (timelineStart && timelineEnd) {
    const totalMs = timelineEnd.getTime() - timelineStart.getTime();
    const stepMs = totalMs / columnsCount;
    for (let i = 0; i <= columnsCount; i++) {
      const d = new Date(timelineStart.getTime() + i * stepMs);
      colMarkers.push(d);
    }
  }

  // Filter vessels currently displayed in the window
  const activeVesselsInWindow = timelineStart && timelineEnd ? vessels.filter(v => {
    const vStart = parseVesselDate(v.ata).getTime();
    const vEnd = parseVesselDate(v.departure).getTime();
    const tStart = timelineStart.getTime();
    const tEnd = timelineEnd.getTime();
    return !(vEnd < tStart || vStart > tEnd);
  }) : [];

  return (
    <div class="space-y-8 animate-fade-in">
      {/* Header & Filters Panel */}
      <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 class="text-3xl font-extrabold text-white tracking-tight">Berth Timeline (Gantt)</h2>
          <p class="text-slate-400 text-sm mt-1">Real-time occupancy timeline. Tracks docks availability, ship turnaround estimates, and schedules.</p>
        </div>

        {/* Safe and user-friendly filters */}
        <div class="flex flex-wrap items-center gap-4 bg-slate-900/80 p-4 rounded-2xl border border-slate-800 self-start text-xs text-slate-300 w-full lg:w-auto">
          
          {/* Year Dropdown */}
          <div class="flex flex-col">
            <span class="text-[9px] text-slate-500 font-bold uppercase mb-1">Year</span>
            <select
              value={localYear}
              onChange={(e) => {
                setLocalYear(e.target.value);
                setLocalMonth('All');
              }}
              class="bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-xs text-slate-300 focus:outline-none focus:border-blue-500"
            >
              <option value="All">All Years</option>
              <option value="2016">2016</option>
              <option value="2017">2017</option>
              <option value="2018">2018</option>
              <option value="2019">2019</option>
              <option value="2020">2020</option>
              <option value="2021">2021</option>
              <option value="2022">2022</option>
              <option value="2023">2023</option>
              <option value="2024">2024</option>
              <option value="2025">2025</option>
            </select>
          </div>

          {/* Month Dropdown */}
          <div class="flex flex-col">
            <span class="text-[9px] text-slate-500 font-bold uppercase mb-1">Month</span>
            <select
              value={localMonth}
              onChange={(e) => handleMonthChange(e.target.value)}
              class="bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-xs text-slate-300 focus:outline-none focus:border-blue-500"
            >
              {months.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>

          {/* Date range picker */}
          <div class="flex items-center gap-2">
            <div class="flex flex-col">
              <span class="text-[9px] text-slate-500 font-bold uppercase mb-1">From Date</span>
              <input 
                type="date" 
                min={yearMin}
                max={yearMax}
                value={startDateStr} 
                onChange={(e) => setStartDateStr(e.target.value)}
                class="bg-slate-950 border border-slate-800 rounded px-2.5 py-0.5 text-xs text-slate-300 focus:outline-none"
              />
            </div>
            <span class="text-slate-600 mt-3">—</span>
            <div class="flex flex-col">
              <span class="text-[9px] text-slate-500 font-bold uppercase mb-1">To Date</span>
              <input 
                type="date" 
                min={yearMin}
                max={yearMax}
                value={endDateStr} 
                onChange={(e) => setEndDateStr(e.target.value)}
                class="bg-slate-950 border border-slate-800 rounded px-2.5 py-0.5 text-xs text-slate-300 focus:outline-none"
              />
            </div>
          </div>

          {/* Reset Filter Button */}
          <button
            onClick={resetFilters}
            class="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-slate-600 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all focus:outline-none self-end"
          >
            Reset
          </button>

        </div>
      </div>

      {/* Main Gantt Timeline Panel */}
      <div class="p-6 rounded-2xl glass-panel space-y-6 glow-blue overflow-hidden">
        {!hasValidRange ? (
          <div class="p-12 text-center text-slate-400">
            <Calendar class="h-8 w-8 text-yellow-500 mx-auto mb-3 animate-pulse" />
            <p class="font-semibold text-sm">Invalid date input. Please check your range entries.</p>
          </div>
        ) : vessels.length === 0 || activeVesselsInWindow.length === 0 ? (
          <div class="p-12 text-center text-slate-400">
            <Info class="h-8 w-8 text-blue-400 mx-auto mb-3" />
            <p class="font-semibold text-sm">No data available for selected filter</p>
          </div>
        ) : (
          <>
            {/* Timeline Header Row (Labels for Columns) */}
            <div class="relative flex border-b border-slate-800 pb-3 pl-24">
              <div class="w-full relative h-6 text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
                {colMarkers.map((date, idx) => {
                  const leftPercent = (idx / columnsCount) * 100;
                  return (
                    <div 
                      key={idx} 
                      class="absolute -translate-x-1/2 flex flex-col items-center" 
                      style={{ left: `${leftPercent}%` }}
                    >
                      <Calendar class="h-3 w-3 mb-0.5 text-slate-600" />
                      <span>{date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Timeline Swimlanes Container */}
            <div class="space-y-4 relative">
              {berths.map((berth) => {
                // Filter vessels on this berth
                const berthVessels = vessels.filter(v => v.berth === berth);
                const { stackedVessels, laneCount } = stackVesselsInLanes(berthVessels);

                return (
                  <div key={berth} class="flex items-stretch group relative">
                    {/* Berth swimlane label */}
                    <div class="w-24 shrink-0 flex items-center gap-1.5 text-xs font-bold text-slate-300 pr-2">
                      <Anchor class="h-3.5 w-3.5 text-blue-400" />
                      <span>{berth}</span>
                    </div>

                    {/* Grid backdrop and vessel occupancy bars */}
                    <div 
                      class="w-full bg-slate-950/40 border border-slate-900 rounded-lg relative overflow-hidden gantt-swimlane shadow-inner transition-all duration-300"
                      style={{ height: `${laneCount * 36 + 10}px` }}
                    >
                      {stackedVessels.map((v) => {
                        const pos = getTimelineOverlap(v);
                        if (!pos) return null; // Outside window

                        return (
                          <div
                            key={v.vcn}
                            class={`absolute h-8 rounded px-2.5 text-[10px] font-bold flex items-center justify-between cursor-pointer transition-all ${getVesselStyleClass(
                              v.vesselType
                            )}`}
                            style={{ left: pos.left, width: pos.width, top: `${v.laneIndex * 36 + 5}px` }}
                            title={`Vessel: ${v.vesselName} (${v.vesselType})\nArrival: ${v.ata}\nDeparture: ${v.departure}\nGRT: ${v.grt.toLocaleString()} Tons`}
                          >
                            <span class="truncate block w-full text-left">{v.vesselName}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Legend */}
        <div class="border-t border-slate-800/60 pt-4 flex flex-wrap gap-4 items-center justify-between text-[10px] text-slate-500 font-semibold">
          <div class="flex gap-4">
            <div class="flex items-center gap-1.5">
              <span class="h-2 w-2 rounded bg-red-500/25 border border-red-500/50"></span>
              <span>Tankers / Liquid Cargo</span>
            </div>
            <div class="flex items-center gap-1.5">
              <span class="h-2 w-2 rounded bg-blue-500/25 border border-blue-500/50"></span>
              <span>Container Cargo / Liners</span>
            </div>
            <div class="flex items-center gap-1.5">
              <span class="h-2 w-2 rounded bg-purple-500/25 border border-purple-500/50"></span>
              <span>Cruises / Passengers</span>
            </div>
            <div class="flex items-center gap-1.5">
              <span class="h-2 w-2 rounded bg-emerald-500/20 border border-emerald-500/40"></span>
              <span>Bulk / Dry Cargo</span>
            </div>
          </div>
          <div class="flex items-center gap-1">
            <HelpCircle class="h-3.5 w-3.5 text-slate-600" />
            <span>Hover over vessel block for voyage info</span>
          </div>
        </div>
      </div>

      {/* Details Table */}
      <div class="p-6 rounded-2xl glass-panel space-y-4 shadow-lg">
        <h4 class="text-base font-bold text-white">Occupancy & Turnaround Log ({activeVesselsInWindow.length} Ships)</h4>
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs border-collapse">
            <thead>
              <tr class="border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider">
                <th class="py-3 px-4">VCN</th>
                <th class="py-3 px-4">Vessel Name</th>
                <th class="py-3 px-4">Type</th>
                <th class="py-3 px-4">Berth</th>
                <th class="py-3 px-4">Arrival (ATA)</th>
                <th class="py-3 px-4">Departure</th>
                <th class="py-3 px-4">GRT (Tons)</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-800/40 text-slate-300">
              {activeVesselsInWindow.map((v) => (
                <tr key={v.vcn} class="hover:bg-slate-900/40 transition-colors">
                  <td class="py-2.5 px-4 font-mono text-blue-400 font-semibold">{v.vcn}</td>
                  <td class="py-2.5 px-4 font-bold text-white">{v.vesselName}</td>
                  <td class="py-2.5 px-4">{v.vesselType}</td>
                  <td class="py-2.5 px-4 font-semibold text-emerald-400">{v.berth}</td>
                  <td class="py-2.5 px-4">{parseVesselDate(v.ata).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                  <td class="py-2.5 px-4">{parseVesselDate(v.departure).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                  <td class="py-2.5 px-4">{v.grt.toLocaleString()}</td>
                </tr>
              ))}
              {activeVesselsInWindow.length === 0 && (
                <tr>
                  <td colspan="7" class="text-center py-8 text-slate-500 font-medium">No data available for selected filter</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
