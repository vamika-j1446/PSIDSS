import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Anchor, Calendar, Info, AlertCircle, HelpCircle } from 'lucide-react';

export default function Gantt({ token }) {
  const [vessels, setVessels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [validationError, setValidationError] = useState('');

  // Input states for calendar selectors (Date objects)
  const [inputStartDate, setInputStartDate] = useState(null);
  const [inputEndDate, setInputEndDate] = useState(null);

  // Applied date filters used for rendering the timeline (string formatted yyyy-MM-dd)
  const [startDateStr, setStartDateStr] = useState('');
  const [endDateStr, setEndDateStr] = useState('');

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

  const isValidDate = (dStr) => {
    if (!dStr) return false;
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(dStr)) return false;
    const d = new Date(dStr);
    return !isNaN(d.getTime());
  };

  const formatDateString = (date) => {
    if (!date) return '';
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const fetchGanttData = async (start = '', end = '') => {
    setLoading(true);
    setError('');
    try {
      const config = { headers: { Authorization: `Bearer ${token}` } };
      let url = `/api/berth-timeline`;
      if (start && end) {
        url += `?startDate=${start}&endDate=${end}`;
      }
      const response = await axios.get(url, config);
      const data = response.data;
      setVessels(data);

      if (!start || !end) {
        if (data.length > 0) {
          const dates = data.map(v => parseVesselDate(v.ata)).filter(Boolean).sort((a, b) => a - b);
          const minDate = dates[0] || new Date();
          const maxDate = dates[dates.length - 1] || new Date();
          
          const defaultStart = minDate;
          const defaultEnd = new Date(minDate.getTime() + 30 * 24 * 60 * 60 * 1000) < maxDate 
            ? new Date(minDate.getTime() + 30 * 24 * 60 * 60 * 1000) 
            : maxDate;
          
          const sStr = defaultStart.toISOString().split('T')[0];
          const eStr = defaultEnd.toISOString().split('T')[0];
          setStartDateStr(sStr);
          setEndDateStr(eStr);
          setInputStartDate(parseLocalDate(sStr));
          setInputEndDate(parseLocalDate(eStr));
        } else {
          setStartDateStr('');
          setEndDateStr('');
          setInputStartDate(null);
          setInputEndDate(null);
        }
      }
    } catch (err) {
      console.error(err);
      setError('Failed to load berth timeline Gantt data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGanttData();
  }, [token]);

  const handleStartDateChange = (val) => {
    if (!val) return;
    setStartDateStr(val);
    const dateObj = parseLocalDate(val);
    setInputStartDate(dateObj);
    
    if (inputEndDate && dateObj > inputEndDate) {
      setValidationError("End date cannot be earlier than start date.");
      return;
    }
    setValidationError('');
    fetchGanttData(val, endDateStr);
  };

  const handleEndDateChange = (val) => {
    if (!val) return;
    setEndDateStr(val);
    const dateObj = parseLocalDate(val);
    setInputEndDate(dateObj);

    if (inputStartDate && dateObj < inputStartDate) {
      setValidationError("End date cannot be earlier than start date.");
      return;
    }
    setValidationError('');
    fetchGanttData(startDateStr, val);
  };

  const hasValidRange = isValidDate(startDateStr) && isValidDate(endDateStr);
  const timelineStart = hasValidRange ? parseLocalDate(startDateStr) : null;
  const timelineEnd = hasValidRange ? parseLocalDate(endDateStr) : null;


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
    return 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 hover:shadow-[0_0_15px_rgba(16,185,129,0.15)]';
  };

  return (
    <div class="space-y-8 animate-fade-in pb-12">
      {/* Header & Local Inline Date Selectors */}
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-900 pb-5">
        <div>
          <h2 class="text-3xl font-extrabold text-white tracking-tight">Berth Timeline (Gantt)</h2>
          <p class="text-slate-400 text-sm mt-1">Real-time terminal lane occupancy tracking, overlaps, and turnaround audits.</p>
        </div>

        <div class="flex flex-col gap-1.5 self-start md:self-center">
          <div class="flex items-center gap-4 text-xs font-semibold text-slate-300">
            {/* Start Date picker */}
            <div class="flex items-center gap-2">
              <span class="text-slate-500 uppercase tracking-wider text-[10px]">Start Date:</span>
              <input 
                type="date"
                value={startDateStr}
                onChange={(e) => handleStartDateChange(e.target.value)}
                class="bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-xs text-slate-300 focus:outline-none focus:border-blue-500 cursor-pointer w-36"
              />
            </div>

            {/* End Date picker */}
            <div class="flex items-center gap-2">
              <span class="text-slate-500 uppercase tracking-wider text-[10px]">End Date:</span>
              <input 
                type="date"
                value={endDateStr}
                onChange={(e) => handleEndDateChange(e.target.value)}
                class="bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-xs text-slate-300 focus:outline-none focus:border-blue-500 cursor-pointer w-36"
              />
            </div>
          </div>

          {/* Validation Error Banner */}
          {validationError && (
            <div class="text-rose-400 text-[10px] font-semibold flex items-center gap-1.5 self-end">
              <AlertCircle class="h-3.5 w-3.5 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}
        </div>
      </div>

      {/* Main Gantt Timeline Panel */}
      <div class="p-6 rounded-2xl glass-panel space-y-6 glow-blue overflow-hidden">
        {loading ? (
          <div class="flex items-center justify-center py-20">
            <div class="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : error ? (
          <div class="p-4 bg-red-950/30 border border-red-900/40 rounded-xl text-red-300 flex items-center gap-2 max-w-xl mx-auto my-12">
            <AlertCircle class="h-5 w-5" />
            <span>{error}</span>
          </div>
        ) : !hasValidRange ? (
          <div class="p-12 text-center text-slate-400">
            <Calendar class="h-8 w-8 text-yellow-500 mx-auto mb-3 animate-pulse" />
            <p class="font-semibold text-sm">Please select a valid date range to display the timeline.</p>
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
                  const leftPercent = (idx / (columnsCount - 1)) * 100;
                  return (
                    <div 
                      key={idx} 
                      class="absolute -translate-x-1/2 flex flex-col items-center animate-fade-in" 
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
            <div class="space-y-4 relative animate-fade-in">
              {berths.map((berth) => {
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
