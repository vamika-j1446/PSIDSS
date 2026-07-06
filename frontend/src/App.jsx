import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  LayoutDashboard, BarChart3, ShieldAlert, Sparkles, Anchor, Briefcase, Sliders, Settings, LogOut, Shield, User as UserIcon
} from 'lucide-react';

// Views
import Login from './views/Login';
import Dashboard from './views/Dashboard';
import Historical from './views/Historical';
import Strategic from './views/Strategic';
import Predictive from './views/Predictive';
import Sandbox from './views/Sandbox';
import Gantt from './views/Gantt';
import Recommendations from './views/Recommendations';
import Admin from './views/Admin';
import Chatbot from './views/Chatbot';
axios.defaults.baseURL = 'http://localhost:5000';

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('psidss_token'));
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('psidss_user')));
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedYear, setSelectedYear] = useState('All');

  const handleLoginSuccess = (newToken, newUser) => {
    localStorage.setItem('psidss_token', newToken);
    localStorage.setItem('psidss_user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
    setActiveTab('dashboard');
  };

  const handleLogout = () => {
    localStorage.removeItem('psidss_token');
    localStorage.removeItem('psidss_user');
    setToken(null);
    setUser(null);
  };

  // Configure Axios defaults and response interceptor to handle token injection & auto-logout on expiration
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete axios.defaults.headers.common['Authorization'];
    }

    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response && (error.response.status === 401 || error.response.status === 403)) {
          // If we receive a 401 or 403 and had a token, it has expired/invalidated.
          // Clear credentials and force redirect to login view.
          if (localStorage.getItem('psidss_token')) {
            localStorage.removeItem('psidss_token');
            localStorage.removeItem('psidss_user');
            setToken(null);
            setUser(null);
          }
        }
        return Promise.reject(error);
      }
    );

    return () => {
      axios.interceptors.response.eject(interceptor);
    };
  }, [token]);

  if (!token) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  // Sidebar navigation options
  const navItems = [
    { id: 'dashboard', label: 'Overview Dashboard', icon: LayoutDashboard, roles: ['Viewer', 'Analyst', 'Admin', 'Party', 'VCN'] },
    { id: 'historical', label: 'Historical Perf', icon: BarChart3, roles: ['Viewer', 'Analyst', 'Admin', 'Party', 'VCN'] },
    { id: 'strategic', label: 'Strategic Risks', icon: ShieldAlert, roles: ['Viewer', 'Analyst', 'Admin'] },
    { id: 'predictive', label: 'Predictive Insights', icon: Sparkles, roles: ['Viewer', 'Analyst', 'Admin'] },
    { id: 'gantt', label: 'Berth Timeline', icon: Anchor, roles: ['Viewer', 'Analyst', 'Admin', 'Party', 'VCN'] },
    { id: 'sandbox', label: 'Simulation Sandbox', icon: Sliders, roles: ['Viewer', 'Analyst', 'Admin', 'Party', 'VCN'] },
    { id: 'recommendations', label: 'Advisory Briefs', icon: Briefcase, roles: ['Viewer', 'Analyst', 'Admin'] },
    { id: 'admin', label: 'Report Manager', icon: Settings, roles: ['Admin'] }
  ];

  // Filter nav items based on user role
  const visibleNavItems = navItems.filter(item => item.roles.includes(user?.role));

  // All views are persistent in DOM to support seamless transitions and tab animations

  return (
    <div class="min-h-screen flex bg-slate-950 text-slate-100 font-sans">
      
      {/* 1. Left Sidebar */}
      <aside class="w-64 border-r border-slate-900 bg-slate-950/80 backdrop-blur-md flex flex-col justify-between shrink-0 p-6">
        <div class="space-y-8">
          {/* Logo Branding */}
          <div class="flex items-center gap-3">
            <div class="relative h-10 w-10 flex items-center justify-center shrink-0">
              {/* Outer spinning glow ring */}
              <div class="absolute inset-0 rounded-xl bg-gradient-to-tr from-blue-500 via-cyan-400 to-indigo-500 animate-spin opacity-70 blur-[2px] shadow-[0_0_12px_rgba(59,130,246,0.3)]" style={{ animationDuration: '8s' }}></div>
              {/* Inner container */}
              <div class="absolute inset-[1.5px] bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Anchor class="h-5 w-5 text-blue-400 drop-shadow-[0_0_8px_rgba(96,165,250,0.5)]" />
              </div>
            </div>
            <div>
              <h1 class="text-xs font-black text-white tracking-widest font-display flex items-center gap-1 uppercase">
                Cochin Port
              </h1>
              <span class="text-[9px] font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400 block uppercase -mt-0.5">
                DSS Portal
              </span>
            </div>
          </div>

          {/* Navigation Menu */}
          <nav class="space-y-1">
            <span class="block text-[9px] font-bold text-slate-600 uppercase tracking-widest mb-2 px-3">Advisory Portal</span>
            {visibleNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  class={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold tracking-wide transition-all ${
                    isActive 
                      ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20 shadow-sm' 
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40 border border-transparent'
                  }`}
                >
                  <Icon class="h-4.5 w-4.5 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* User profile section at bottom of sidebar */}
        <div class="border-t border-slate-900/80 pt-4 space-y-4">
          <div class="flex items-center gap-3 px-1">
            <div class="h-9 w-9 bg-slate-900 border border-slate-800 rounded-lg flex items-center justify-center text-slate-400">
              <UserIcon class="h-4.5 w-4.5" />
            </div>
            <div class="truncate">
              <span class="text-xs font-bold text-slate-200 block truncate">{user?.username}</span>
              <span class="text-[9px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Shield class="h-2.5 w-2.5 text-blue-500" /> {user?.role}
              </span>
            </div>
          </div>

          <button 
            onClick={handleLogout}
            class="w-full flex items-center gap-3 px-3 py-2 bg-red-950/10 border border-red-900/10 rounded-lg text-xs font-semibold text-red-400 hover:bg-red-950/20 hover:text-red-300 transition-colors"
          >
            <LogOut class="h-4 w-4 shrink-0" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* 2. Main content container */}
      <div class="flex-1 flex flex-col min-w-0">
        
        {/* Top Header */}
        <header class="h-16 border-b border-slate-900 bg-slate-950/30 backdrop-blur-md flex items-center justify-between px-8">
          <div class="flex items-center gap-4">
            <div class="flex items-center gap-2">
              <span class="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-ping"></span>
              <span class="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Port DSS Operations Active</span>
            </div>
            
            {/* Global Year Filter Dropdown */}
            <div class="flex items-center gap-2 bg-slate-900/60 border border-slate-800/80 rounded-lg px-2.5 py-1 text-xs text-slate-300">
              <span class="font-bold text-slate-500 uppercase tracking-wide text-[9px]">Year:</span>
              <select 
                value={selectedYear} 
                onChange={(e) => setSelectedYear(e.target.value)}
                class="bg-transparent border-none text-slate-200 font-bold focus:outline-none cursor-pointer pr-1"
              >
                <option value="All" class="bg-slate-950 text-slate-200">All Fiscal Years</option>
                <option value="Recent4" class="bg-slate-950 text-slate-200">FY 2021–22 to FY 2024–25</option>
                <option value="2016" class="bg-slate-950 text-slate-200">FY 2016–17</option>
                <option value="2017" class="bg-slate-950 text-slate-200">FY 2017–18</option>
                <option value="2018" class="bg-slate-950 text-slate-200">FY 2018–19</option>
                <option value="2019" class="bg-slate-950 text-slate-200">FY 2019–20</option>
                <option value="2020" class="bg-slate-950 text-slate-200">FY 2020–21</option>
                <option value="2021" class="bg-slate-950 text-slate-200">FY 2021–22</option>
                <option value="2022" class="bg-slate-950 text-slate-200">FY 2022–23</option>
                <option value="2023" class="bg-slate-950 text-slate-200">FY 2023–24</option>
                <option value="2024" class="bg-slate-950 text-slate-200">FY 2024–25</option>
              </select>
            </div>
          </div>
          
          <div class="text-[10px] text-slate-500 font-semibold">
            System Date: {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </header>

        {/* View viewport */}
        <main class="flex-1 overflow-y-auto p-8 bg-slate-950/10">
          <div class="max-w-7xl mx-auto relative">
            {activeTab === 'dashboard' && (
              <Dashboard token={token} selectedYear={selectedYear} user={user} />
            )}
            {activeTab === 'historical' && (
              <Historical token={token} selectedYear={selectedYear} activeTab={activeTab} />
            )}
            {['Viewer', 'Analyst', 'Admin'].includes(user?.role) && activeTab === 'strategic' && (
              <Strategic token={token} selectedYear={selectedYear} activeTab={activeTab} />
            )}
            {['Viewer', 'Analyst', 'Admin'].includes(user?.role) && activeTab === 'predictive' && (
              <Predictive token={token} selectedYear={selectedYear} activeTab={activeTab} />
            )}
            {activeTab === 'gantt' && (
              <Gantt token={token} selectedYear={selectedYear} />
            )}
            {['Viewer', 'Analyst', 'Admin', 'Party', 'VCN'].includes(user?.role) && activeTab === 'sandbox' && (
              <Sandbox token={token} selectedYear={selectedYear} activeTab={activeTab} />
            )}
            {['Viewer', 'Analyst', 'Admin'].includes(user?.role) && activeTab === 'recommendations' && (
              <Recommendations token={token} selectedYear={selectedYear} />
            )}
            {user?.role === 'Admin' && activeTab === 'admin' && (
              <Admin token={token} user={user} />
            )}
          </div>
        </main>
      </div>
      <Chatbot token={token} selectedYear={selectedYear} pageContext={activeTab} />
    </div>
  );
}
