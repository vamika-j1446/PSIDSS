import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { UploadCloud, FileSpreadsheet, Trash2, RefreshCw, AlertTriangle, AlertCircle, CheckCircle, Search } from 'lucide-react';

export default function Admin({ token, user }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Portal PINs states
  const [parties, setParties] = useState([]);
  const [vcns, setVcns] = useState([]);
  const [pinTab, setPinTab] = useState('parties');
  const [searchQuery, setSearchQuery] = useState('');
  const [pinsLoading, setPinsLoading] = useState(false);
  const [subTab, setSubTab] = useState('reports'); // 'reports' or 'pins'

  useEffect(() => {
    fetchReports();
    fetchPins();
  }, [token]);

  const filteredParties = (parties || []).filter(p => 
    (p.party_name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredVcns = (vcns || []).filter(v => 
    (v.vcn || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const fetchReports = async () => {
    setLoading(true);
    try {
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const response = await axios.get('/api/reports', config);
      setReports(response.data);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch reports.');
    } finally {
      setLoading(false);
    }
  };

  const fetchPins = async () => {
    setPinsLoading(true);
    try {
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const [partyRes, vcnRes] = await Promise.all([
        axios.get('/api/admin/pins/parties', config),
        axios.get('/api/admin/pins/vcns', config)
      ]);
      setParties(partyRes.data);
      setVcns(vcnRes.data);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch portal PINs.');
    } finally {
      setPinsLoading(false);
    }
  };

  const handleRegeneratePartyPin = async (party_name) => {
    setError('');
    setSuccess('');
    try {
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const response = await axios.post('/api/admin/pins/parties/regenerate', { party_name }, config);
      setSuccess(`PIN regenerated for '${party_name}' successfully!`);
      setParties(parties.map(p => p.party_name === party_name ? response.data.record : p));
    } catch (err) {
      console.error(err);
      setError('Failed to regenerate PIN.');
    }
  };

  const handleRegenerateVcnPin = async (vcn) => {
    setError('');
    setSuccess('');
    try {
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const response = await axios.post('/api/admin/pins/vcns/regenerate', { vcn }, config);
      setSuccess(`PIN regenerated for VCN '${vcn}' successfully!`);
      setVcns(vcns.map(v => v.vcn === vcn ? response.data.record : v));
    } catch (err) {
      console.error(err);
      setError('Failed to regenerate PIN.');
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setError('');
    setSuccess('');
    setUploading(true);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const config = { 
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        } 
      };
      const response = await axios.post('/api/reports', formData, config);
      setSuccess(response.data.message);
      fetchReports();
      fetchPins();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Upload failed. Check file structure and size.');
    } finally {
      setUploading(false);
      e.target.value = ''; // Reset file input
    }
  };

  const handleDeleteReport = async (filename) => {
    if (!window.confirm(`Are you sure you want to delete '${filename}'? This will cascadingly remove all related vessel transaction records and update forecasting indices.`)) {
      return;
    }

    setError('');
    setSuccess('');

    try {
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const response = await axios.delete(`/api/reports/${filename}`, config);
      setSuccess(response.data.message);
      fetchReports();
      fetchPins();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Deletion failed.');
    }
  };

  const handleRegenerateForecasts = async () => {
    setError('');
    setSuccess('');
    setRegenerating(true);

    try {
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const response = await axios.post('/api/reports/regenerate-forecasts', {}, config);
      setSuccess(response.data.message);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Forecasting regeneration failed.');
    } finally {
      setRegenerating(false);
    }
  };

  if (user?.role !== 'Admin') {
    return (
      <div class="p-8 text-center text-red-400 my-12 border border-red-950/40 rounded-xl glass-panel max-w-lg mx-auto">
        <AlertTriangle class="h-8 w-8 text-red-400 mx-auto mb-3 animate-bounce" />
        <h3 class="text-lg font-bold text-white mb-2">Access Denied</h3>
        <p class="text-xs text-slate-400 leading-relaxed">
          Your account role is '{user?.role || 'Viewer'}'. Strategic Intelligence administrative capabilities (report uploading, deleting, and forecast regenerations) are strictly restricted to Admin accounts.
        </p>
      </div>
    );
  }

  return (
    <div class="space-y-8 animate-fade-in">
      {/* Header and Sync Status */}
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 class="text-3xl font-extrabold text-white tracking-tight">Report Manager</h2>
          <p class="text-slate-400 text-sm mt-1">Upload financial sheets, manage records, and trigger manual forecasting runs.</p>
        </div>

        {/* Forecast Regeneration Button */}
        <button
          onClick={handleRegenerateForecasts}
          disabled={regenerating || uploading || loading}
          class="flex items-center gap-2 px-4 py-2 bg-slate-900 border border-slate-800 text-slate-300 rounded-xl text-xs font-semibold hover:bg-slate-800 hover:text-white transition-colors disabled:opacity-40 self-start"
        >
          <RefreshCw class={`h-3.5 w-3.5 ${regenerating ? 'animate-spin' : ''}`} />
          <span>{regenerating ? 'Regenerating...' : 'Regenerate Forecasts'}</span>
        </button>
      </div>

      {/* Sub tabs navigation */}
      <div class="flex gap-6 border-b border-slate-900 pb-px">
        <button
          onClick={() => { setSubTab('reports'); setError(''); setSuccess(''); setSearchQuery(''); }}
          class={`pb-3 text-sm font-bold tracking-wide border-b-2 transition-all ${
            subTab === 'reports'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-300'
          }`}
        >
          Database & Reports
        </button>
        <button
          onClick={() => { setSubTab('pins'); setError(''); setSuccess(''); setSearchQuery(''); }}
          class={`pb-3 text-sm font-bold tracking-wide border-b-2 transition-all ${
            subTab === 'pins'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-300'
          }`}
        >
          Portal PIN Keys
        </button>
      </div>

      {/* Alerts */}
      {error && (
        <div class="p-4 bg-red-950/30 border border-red-900/40 rounded-xl text-red-300 flex items-center gap-2 max-w-xl text-xs">
          <AlertCircle class="h-4.5 w-4.5 text-red-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div class="p-4 bg-emerald-950/20 border border-emerald-900/30 rounded-xl text-emerald-400 flex items-center gap-2 max-w-xl text-xs">
          <CheckCircle class="h-4.5 w-4.5 text-emerald-400 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {subTab === 'reports' ? (
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Upload Container (Vite drag-drop styling) */}
          <div class="p-6 rounded-2xl glass-panel space-y-4 glow-blue h-fit">
            <h4 class="text-base font-bold text-white">Upload Financial Sheet</h4>
            
            <div class="relative border-2 border-dashed border-slate-800 hover:border-blue-500/50 rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-colors bg-slate-950/20 group">
              <input 
                type="file" 
                accept=".xlsx,.xls"
                onChange={handleFileUpload}
                disabled={uploading || regenerating}
                class="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed"
              />
              <UploadCloud class="h-10 w-10 text-slate-500 group-hover:text-blue-400 transition-colors mb-3" />
              <span class="text-xs font-bold text-slate-300 block mb-1">Click to select file</span>
              <span class="text-[10px] text-slate-500 block leading-normal">
                Accepts Excel sheets only (.xlsx)<br/>Auto-ingests data and updates forecasts.
              </span>

              {uploading && (
                <div class="absolute inset-0 bg-slate-950/95 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center p-6 text-center animate-fade-in z-20">
                  <RefreshCw class="h-7 w-7 text-blue-400 animate-spin mb-3" />
                  <span class="text-xs font-bold text-white block mb-1">Uploading, please wait...</span>
                  <p class="text-[9px] text-slate-400 leading-normal max-w-[200px]">
                    Ingesting Excel sheet, updating models, and preheating cache.
                  </p>
                </div>
              )}
            </div>
          </div>
          
          {/* Reports List table */}
          <div class="lg:col-span-2 p-6 rounded-2xl glass-panel space-y-4 glow-violet">
            <h4 class="text-base font-bold text-white">Ingested Sheet Database</h4>

            {loading ? (
              <div class="flex items-center justify-center py-12">
                <RefreshCw class="h-6 w-6 text-blue-400 animate-spin" />
              </div>
            ) : reports.length === 0 ? (
              <p class="text-slate-500 text-xs py-12 text-center border border-slate-900 rounded-xl">
                No reports uploaded yet.
              </p>
            ) : (
              <div class="overflow-x-auto text-xs">
                <table class="w-full text-left border-collapse">
                  <thead>
                    <tr class="border-b border-slate-800 text-slate-500 uppercase tracking-wider font-semibold">
                      <th class="py-2.5 px-3">Filename</th>
                      <th class="py-2.5 px-3">Records Count</th>
                      <th class="py-2.5 px-3 text-right">Size</th>
                      <th class="py-2.5 px-3 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-800/40 text-slate-300">
                    {reports.map((r) => (
                      <tr key={r.filename} class="hover:bg-slate-900/20">
                        <td class="py-3 px-3 font-medium text-slate-200 flex items-center gap-1.5 truncate max-w-xs">
                          <FileSpreadsheet class="h-4.5 w-4.5 text-emerald-500 shrink-0" />
                          <span class="truncate" title={r.filename}>{r.filename}</span>
                        </td>
                        <td class="py-3 px-3 text-blue-400 font-bold">{r.record_count.toLocaleString('en-IN')}</td>
                        <td class="py-3 px-3 text-right font-medium">{(r.file_size / (1024 * 1024)).toFixed(2)} MB</td>
                        <td class="py-3 px-3 text-center">
                          <button
                            onClick={() => handleDeleteReport(r.filename)}
                            disabled={uploading || regenerating}
                            class="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors focus:outline-none disabled:opacity-40"
                            title="Delete Report and cascading records"
                          >
                            <Trash2 class="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div class="p-6 rounded-2xl glass-panel space-y-6 glow-blue">
          <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Toggle buttons for pinTab */}
            <div class="flex bg-slate-950/60 p-1 border border-slate-900 rounded-xl w-fit">
              <button
                onClick={() => { setPinTab('parties'); setSearchQuery(''); }}
                class={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                  pinTab === 'parties'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Shipping Parties
              </button>
              <button
                onClick={() => { setPinTab('vcns'); setSearchQuery(''); }}
                class={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                  pinTab === 'vcns'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Vessel VCNs
              </button>
            </div>

            {/* Search Input */}
            <div class="relative w-full md:w-72">
              <Search class="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
              <input
                type="text"
                placeholder={pinTab === 'parties' ? 'Search party name...' : 'Search VCN...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                class="w-full pl-9 pr-4 py-2 bg-slate-950/60 border border-slate-900 rounded-xl text-xs text-slate-300 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
          </div>

          {/* Table Container */}
          {pinsLoading ? (
            <div class="flex items-center justify-center py-12">
              <RefreshCw class="h-6 w-6 text-blue-400 animate-spin" />
            </div>
          ) : (pinTab === 'parties' ? filteredParties : filteredVcns).length === 0 ? (
            <p class="text-slate-500 text-xs py-12 text-center border border-slate-900/60 rounded-xl">
              No portal credentials found matching your search.
            </p>
          ) : (
            <div class="overflow-x-auto text-xs">
              <table class="w-full text-left border-collapse">
                <thead>
                  <tr class="border-b border-slate-800 text-slate-500 uppercase tracking-wider font-semibold">
                    <th class="py-2.5 px-3">{pinTab === 'parties' ? 'Shipping Party Name' : 'VCN Number'}</th>
                    <th class="py-2.5 px-3">6-Digit Access PIN</th>
                    <th class="py-2.5 px-3 text-center animate-none">Actions</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-800/40 text-slate-300">
                  {pinTab === 'parties' ? (
                    filteredParties.map((p) => (
                      <tr key={p.party_name} class="hover:bg-slate-900/20">
                        <td class="py-3 px-3 font-semibold text-slate-200">{p.party_name}</td>
                        <td class="py-3 px-3">
                          <span class="font-mono text-blue-400 font-bold bg-blue-950/20 border border-blue-900/30 px-2.5 py-1 rounded-md tracking-wider text-sm">
                            {p.pin}
                          </span>
                        </td>
                        <td class="py-3 px-3 text-center">
                          <button
                            onClick={() => handleRegeneratePartyPin(p.party_name)}
                            class="flex items-center gap-1 mx-auto px-2.5 py-1 bg-slate-900 border border-slate-850 text-slate-400 hover:text-white hover:bg-slate-850 rounded-lg transition-colors focus:outline-none"
                            title="Regenerate unique 6-digit access PIN"
                          >
                            <RefreshCw class="h-3 w-3" />
                            <span>Regenerate</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    filteredVcns.map((v) => (
                      <tr key={v.vcn} class="hover:bg-slate-900/20">
                        <td class="py-3 px-3 font-semibold text-slate-200">{v.vcn}</td>
                        <td class="py-3 px-3">
                          <span class="font-mono text-blue-400 font-bold bg-blue-950/20 border border-blue-900/30 px-2.5 py-1 rounded-md tracking-wider text-sm">
                            {v.pin}
                          </span>
                        </td>
                        <td class="py-3 px-3 text-center">
                          <button
                            onClick={() => handleRegenerateVcnPin(v.vcn)}
                            class="flex items-center gap-1 mx-auto px-2.5 py-1 bg-slate-900 border border-slate-850 text-slate-400 hover:text-white hover:bg-slate-850 rounded-lg transition-colors focus:outline-none"
                            title="Regenerate unique 6-digit access PIN"
                          >
                            <RefreshCw class="h-3 w-3" />
                            <span>Regenerate</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
