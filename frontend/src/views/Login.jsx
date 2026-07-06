import React, { useState } from 'react';
import axios from 'axios';
import { Shield, Lock, User as UserIcon, AlertTriangle } from 'lucide-react';

export default function Login({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginType, setLoginType] = useState('staff'); // 'staff', 'party', 'vcn'
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      setError(`Please enter both ${loginType === 'staff' ? 'username' : loginType === 'party' ? 'party name' : 'VCN number'} and ${loginType === 'staff' ? 'password' : 'PIN'}.`);
      return;
    }
    setError('');
    setLoading(true);

    try {
      const response = await axios.post('/api/auth/login', { username, password, loginType });
      const { token, user } = response.data;
      onLoginSuccess(token, user);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Invalid credentials or connection error.');
    } finally {
      setLoading(false);
    }
  };

  const fillCredentials = (user, pass) => {
    setLoginType('staff');
    setUsername(user);
    setPassword(pass);
    setError('');
  };

  return (
    <div class="min-h-screen flex flex-col items-center justify-center p-4 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black animate-fade-in">
      {/* Port Title Header */}
      <div class="mb-8 text-center max-w-md">
        <h1 class="text-4xl font-display font-extrabold tracking-tight bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent mb-2">
          PSIDSS
        </h1>
        <p class="text-slate-400 text-xs font-semibold tracking-wider uppercase">
          Port Strategic Intelligence Decision Support System
        </p>
      </div>

      {/* Glassmorphic Login Form Card */}
      <div class="w-full max-w-md p-8 rounded-2xl glass-panel glow-blue relative overflow-hidden">
        
        {/* Toggle Login Mode Tabs */}
        <div class="flex bg-slate-900/60 p-1 rounded-xl border border-slate-800/80 mb-6">
          {['staff', 'party', 'vcn'].map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => {
                setLoginType(mode);
                setUsername('');
                setPassword('');
                setError('');
              }}
              class={`flex-1 py-2 text-xs font-bold rounded-lg capitalize tracking-wide transition-all ${
                loginType === mode
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {mode === 'vcn' ? 'Vessel (VCN)' : mode === 'party' ? 'Shipping Party' : 'Staff Login'}
            </button>
          ))}
        </div>

        <h2 class="text-xl font-bold text-white mb-6">
          {loginType === 'staff' ? 'Staff Portal Login' : loginType === 'party' ? 'Shipping Party Portal' : 'Vessel VCN Portal'}
        </h2>
        
        {error && (
          <div class="mb-5 p-3 bg-red-950/40 border border-red-800/40 text-red-300 text-xs rounded-lg flex items-center gap-2">
            <AlertTriangle class="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} class="space-y-5">
          <div>
            <label class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              {loginType === 'staff' ? 'Username' : loginType === 'party' ? 'Shipping Party Name' : 'Vessel VCN Number'}
            </label>
            <div class="relative">
              <UserIcon class="absolute left-3 top-3.5 h-4 w-4 text-slate-500" />
              <input 
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={loginType === 'staff' ? 'Enter username' : loginType === 'party' ? 'e.g. ATLANTIC GLOBAL SHIPPING' : 'e.g. 20210405'} 
                class="w-full pl-10 pr-4 py-3 bg-slate-900/60 border border-slate-800 rounded-lg text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
          </div>

          <div>
            <label class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              {loginType === 'staff' ? 'Password' : '6-Digit Security PIN'}
            </label>
            <div class="relative">
              <Lock class="absolute left-3 top-3.5 h-4 w-4 text-slate-500" />
              <input 
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                maxLength={loginType === 'staff' ? 30 : 6}
                placeholder={loginType === 'staff' ? 'Enter password' : 'Enter 6-digit PIN'} 
                class="w-full pl-10 pr-4 py-3 bg-slate-900/60 border border-slate-800 rounded-lg text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors font-mono tracking-widest"
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            class="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-bold text-sm hover:from-blue-500 hover:to-indigo-500 transition-all shadow-lg hover:shadow-blue-500/20 disabled:opacity-50 mt-2"
          >
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        {/* Staff Demo Quick Fill */}
        {loginType === 'staff' && (
          <div class="mt-8 border-t border-slate-800/50 pt-6">
            <span class="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-3 text-center">
              Demo Staff Accounts
            </span>
            <div class="grid grid-cols-3 gap-2">
              <button 
                onClick={() => fillCredentials('viewer', 'viewer123')}
                class="px-2 py-2 bg-slate-900/80 border border-slate-800 rounded-lg text-[10px] text-slate-400 hover:text-white hover:border-slate-700 transition-colors font-semibold flex items-center justify-center gap-1"
              >
                <Shield class="h-3 w-3" /> Viewer
              </button>
              <button 
                onClick={() => fillCredentials('analyst', 'analyst123')}
                class="px-2 py-2 bg-slate-900/80 border border-slate-800 rounded-lg text-[10px] text-slate-400 hover:text-white hover:border-slate-700 transition-colors font-semibold flex items-center justify-center gap-1"
              >
                <Shield class="h-3 w-3 text-indigo-400" /> Analyst
              </button>
              <button 
                onClick={() => fillCredentials('admin', 'admin123')}
                class="px-2 py-2 bg-slate-900/80 border border-slate-800 rounded-lg text-[10px] text-slate-400 hover:text-white hover:border-slate-700 transition-colors font-semibold flex items-center justify-center gap-1"
              >
                <Shield class="h-3 w-3 text-purple-400" /> Admin
              </button>
            </div>
          </div>
        )}

        {/* Instructions for Portal logins */}
        {loginType !== 'staff' && (
          <div class="mt-6 border-t border-slate-800/50 pt-4 text-[10px] text-slate-500 leading-relaxed text-center">
            Security PINs are distributed by the Port Administration. Staff can manage and view portal PINs in the Admin Report Manager.
          </div>
        )}
      </div>
    </div>
  );
}
