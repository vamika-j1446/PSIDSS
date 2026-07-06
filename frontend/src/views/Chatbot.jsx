import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { 
  MessageSquare, Send, X, Bot, User, Loader2, AlertCircle, 
  Plus, History, Trash2, Calendar 
} from 'lucide-react';

const frontendDictionary = {
  cagr: "CAGR means Compound Annual Growth Rate. It shows the average yearly growth rate over a period. In PSIDSS, it helps understand how port revenue has grown across financial years after smoothing year-to-year fluctuations.",
  hhi: "HHI measures concentration. In this project, it can show whether revenue depends too much on a few customers, berths, or commodity groups. Higher HHI means higher dependency risk.",
  'tariff simulation': "Tariff Simulation is a what-if calculation. It estimates how revenue may change if tariffs increase or decrease. In this project, it applies the selected percentage change to historical billing revenue.",
  yoy: "YoY stands for Year-over-Year growth. It compares the revenue of one financial year directly with the previous financial year to show short-term growth dynamics.",
  revenue: "Revenue represents the total billing amount generated from port services and cargo-related activities. It indicates the gross financial intake before subtracting operational costs.",
  'invoice amount': "Invoice Amount is the specific billing value recorded for an individual port transaction, serving as the base data for all revenue aggregations.",
  vcn: "VCN stands for Vessel Call Number. It is a unique identifier assigned to each vessel visit or call at the port, allowing precise tracking of ship operations and billing.",
  grt: "GRT stands for Gross Registered Tonnage. It measures a vessel's total internal volume, which is often used as the basis for calculating port dues and pilotage charges.",
  berth: "A berth is a designated location in the port where vessels dock to load, unload, or receive services. Berth performance is key to terminal efficiency.",
  commodity: "A commodity refers to the specific cargo type handled, such as cement, petroleum, or fertilizer raw materials. Tracking commodities helps optimize handling infrastructure.",
  'commodity group': "A commodity group is a broader category of related cargo types (e.g., Petroleum, Containers, or Dry Bulk), simplifying high-level trade analysis.",
  'charge name': "Charge Name refers to the specific billing head or service type invoiced, such as Pilotage, Port Dues, Berth Hire, or Wharfage.",
  'party name': "Party Name represents the customer, shipping agent, or billing partner responsible for the port transactions, used to analyze client revenue concentration.",
  'port dues': "Port Dues are fees charged on incoming vessels for entering port limits and utilizing basic port navigation and security infrastructure.",
  pilotage: "Pilotage charges cover services where a licensed port pilot guides a vessel safely through the harbor channel to and from the berths.",
  wharfage: "Wharfage is the fee charged for cargo passing over the port's wharves or docks, calculated based on weight, volume, or package type.",
  anchorage: "Anchorage fees are charged to vessels anchored in designated harbor waters outside active berths while waiting for clearance or cargo availability."
};

export default function Chatbot({ token, selectedYear, pageContext }) {
  const [isOpen, setIsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(true);
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [thinkingText, setThinkingText] = useState('Thinking...');
  const [error, setError] = useState('');
  const messagesEndRef = useRef(null);

  const suggestedQuestions = [
    'Explain total port revenue',
    'What is CAGR?',
    'What is HHI?',
    'Which berth has the highest revenue?',
    'Who is the top customer?',
    'What is VCN?',
    'What is GRT?',
    'Explain tariff simulation',
    'What is commodity group?',
    'Is revenue increasing?'
  ];

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const now = new Date();
    const diffTime = Math.abs(now - d);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (d.toDateString() === now.toDateString()) {
      return `Today, ${timeStr}`;
    } else if (diffDays === 1) {
      return `Yesterday, ${timeStr}`;
    } else {
      return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${timeStr}`;
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Fetch all sessions in the background
  const fetchSessions = async () => {
    try {
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const response = await axios.get('/api/chatbot/sessions', config);
      setSessions(response.data);
    } catch (err) {
      console.error('Error fetching sessions:', err);
    }
  };

  // Create/Start a brand new chat
  const createNewChat = async () => {
    setError('');
    const newGreeting = {
      role: 'assistant',
      message: 'Hello! I am your Port DSS Assistant. Ask me about revenue, berths, customers, commodities, tariff simulation, or port terms.',
      source: 'system',
      type: 'explanation'
    };
    // Update local messages instantly
    setMessages([newGreeting]);
    setActiveSessionId(null);

    try {
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const response = await axios.post('/api/chatbot/sessions', { title: 'New Chat' }, config);
      const newSessionId = response.data.id;
      setActiveSessionId(newSessionId);
      await fetchSessions();
    } catch (err) {
      console.error(err);
      setError('Failed to start a new chat session in the background.');
    }
  };

  // Load selected session messages
  const loadSession = async (sessionId) => {
    setError('');
    try {
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const response = await axios.get(`/api/chatbot/sessions/${sessionId}/messages`, config);
      
      if (response.data.length === 0) {
        setMessages([
          {
            role: 'assistant',
            message: 'Hello! I am your Port DSS Assistant. Ask me about revenue, berths, customers, commodities, tariff simulation, or port terms.',
            source: 'system',
            type: 'explanation'
          }
        ]);
      } else {
        setMessages(response.data);
      }
      setActiveSessionId(sessionId);
    } catch (err) {
      console.error(err);
      setError('Failed to load chat history.');
    }
  };

  // Delete specific session
  const deleteSession = async (e, sessionId) => {
    e.stopPropagation();
    try {
      const config = { headers: { Authorization: `Bearer ${token}` } };
      await axios.delete(`/api/chatbot/sessions/${sessionId}`, config);
      await fetchSessions();
      if (activeSessionId === sessionId) {
        createNewChat();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Clear all history
  const clearAllHistory = async () => {
    if (!window.confirm('Are you sure you want to clear all chat history?')) return;
    try {
      const config = { headers: { Authorization: `Bearer ${token}` } };
      await axios.delete('/api/chatbot/sessions', config);
      createNewChat();
    } catch (err) {
      console.error(err);
    }
  };

  // Match local dictionary entries for instant responses
  const getLocalDictionaryAnswer = (text) => {
    const cleanMsg = text.toLowerCase().trim().replace(/[?.,\/#!$%\^&\*;:{}=\-_`~()]/g, "");
    const prefixes = ['what is ', 'what does ', 'define ', 'explain ', 'meaning of ', 'what is a ', 'what is an '];
    let term = cleanMsg;
    for (const prefix of prefixes) {
      if (cleanMsg.startsWith(prefix)) {
        term = cleanMsg.substring(prefix.length).trim();
        break;
      }
    }

    if (term.endsWith(" mean")) {
      term = term.substring(0, term.length - 5).trim();
    }
    if (term.endsWith(" stands for")) {
      term = term.substring(0, term.length - 11).trim();
    }

    if (frontendDictionary[term]) {
      return frontendDictionary[term];
    }
    return null;
  };

  // Send message
  const handleSend = async (textToSend) => {
    // 1. Prevent duplicate requests
    if (loading) return;

    const text = textToSend || inputText;
    if (!text.trim()) return;

    // Stage user message instantly
    const userMsg = { role: 'user', message: text };
    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setError('');

    // 2. Client-Side instant dictionary matching
    const localAnswer = getLocalDictionaryAnswer(text);
    if (localAnswer) {
      // Return instant local answer with NO thinking state shown
      setMessages(prev => [...prev, {
        role: 'assistant',
        message: localAnswer,
        source: 'dictionary',
        type: 'dictionary'
      }]);

      // Log in database asynchronously in the background
      const config = { headers: { Authorization: `Bearer ${token}` } };
      axios.post('/api/chatbot/ask', {
        message: text,
        sessionId: activeSessionId,
        year: selectedYear,
        pageContext: pageContext
      }, config).then(res => {
        if (res.data.sessionId && res.data.sessionId !== activeSessionId) {
          setActiveSessionId(res.data.sessionId);
        }
        fetchSessions();
      }).catch(err => console.error("Async background save failed:", err));
      
      return;
    }

    // 3. Setup dynamic thinking status
    const cleanMsg = text.toLowerCase().trim();
    const isSqlKeyword = cleanMsg.includes('revenue') || cleanMsg.includes('trend') || 
                         cleanMsg.includes('berth') || cleanMsg.includes('customer') || 
                         cleanMsg.includes('party') || cleanMsg.includes('commodity') || 
                         cleanMsg.includes('cargo') || cleanMsg.includes('increasing') || 
                         cleanMsg.includes('growing') || cleanMsg.includes('decreasing') || 
                         cleanMsg.includes('concentration') || cleanMsg.includes('dependent') ||
                         cleanMsg.includes('how much') || cleanMsg.includes('highest') ||
                         cleanMsg.includes('who is') || cleanMsg.includes('which') ||
                         cleanMsg.includes('vessel') || cleanMsg.includes('arrival') ||
                         cleanMsg.includes('ship');
    
    setThinkingText(isSqlKeyword ? "Checking records..." : "Thinking...");
    setLoading(true);

    try {
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const response = await axios.post('/api/chatbot/ask', {
        message: text,
        sessionId: activeSessionId,
        year: selectedYear,
        pageContext: pageContext
      }, config);

      const botAnswer = response.data.answer;
      const type = response.data.type;
      const source = response.data.source;
      const returnedSessionId = response.data.sessionId;

      if (type === 'chat_control' && response.data.action === 'clear_current_chat') {
        setMessages([
          {
            role: 'assistant',
            message: botAnswer,
            source: 'system',
            type: 'chat_control'
          }
        ]);
      } else {
        setMessages(prev => [...prev, {
          role: 'assistant',
          message: botAnswer,
          source: source,
          type: type
        }]);
      }

      if (returnedSessionId && returnedSessionId !== activeSessionId) {
        setActiveSessionId(returnedSessionId);
      }
      
      await fetchSessions();
    } catch (err) {
      console.error(err);
      setError('Connection failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  // Open chatbot panel instantly, showing greeting immediately, and loading history in background
  useEffect(() => {
    if (isOpen && token) {
      // Set default initial greeting instantly
      if (messages.length === 0) {
        setMessages([
          {
            role: 'assistant',
            message: 'Hello! I am your Port DSS Assistant. Ask me about revenue, berths, customers, commodities, tariff simulation, or port terms.',
            source: 'system',
            type: 'explanation'
          }
        ]);
      }

      // Load sessions and history asynchronously in background
      fetchSessions().then(() => {
        if (!activeSessionId) {
          axios.get('/api/chatbot/sessions', { headers: { Authorization: `Bearer ${token}` } })
            .then(res => {
              if (res.data.length > 0) {
                loadSession(res.data[0].id);
              } else {
                createNewChat();
              }
            });
        }
      });
    }
  }, [isOpen]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  return (
    <div class="fixed bottom-6 right-6 z-50 font-sans flex items-end justify-end">
      {/* Floating Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          class="relative h-14 w-14 rounded-full flex items-center justify-center bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-2xl hover:scale-105 active:scale-95 transition-all duration-300 group border border-blue-500/30 shrink-0"
        >
          <div class="absolute inset-0 rounded-full bg-blue-550 animate-ping opacity-20"></div>
          <MessageSquare class="h-6 w-6 filter drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]" />
        </button>
      )}

      {/* Chat Window Panel */}
      {isOpen && (
        <div 
          class={`h-[540px] rounded-2xl border border-slate-800 bg-slate-950/95 backdrop-blur-md shadow-2xl flex overflow-hidden animate-slide-in glow-blue transition-all duration-300 ${
            historyOpen ? 'w-[720px]' : 'w-[420px]'
          }`}
        >
          {/* 1. Chat History Sidebar Section */}
          {historyOpen && (
            <div class="w-64 border-r border-slate-850 bg-slate-950 flex flex-col justify-between shrink-0">
              {/* Sidebar Header */}
              <div class="p-4 border-b border-slate-900 flex items-center justify-between">
                <span class="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <History class="h-3.5 w-3.5 text-blue-500" /> Chat History
                </span>
                {sessions.length > 0 && (
                  <button 
                    onClick={clearAllHistory}
                    class="text-[9px] font-bold text-red-500 hover:text-red-400 uppercase tracking-wider transition-colors"
                  >
                    Clear All
                  </button>
                )}
              </div>

              {/* Sidebar Session List */}
              <div class="flex-1 overflow-y-auto p-2.5 space-y-1.5 scrollbar-thin">
                {sessions.length === 0 ? (
                  <div class="text-[10px] font-semibold text-slate-600 text-center mt-12">
                    No previous chats yet.
                  </div>
                ) : (
                  sessions.map((s) => {
                    const isActive = s.id === activeSessionId;
                    return (
                      <div
                        key={s.id}
                        onClick={() => loadSession(s.id)}
                        class={`w-full group p-2.5 rounded-xl border text-left cursor-pointer transition-all flex items-start justify-between gap-2.5 ${
                          isActive 
                            ? 'bg-blue-600/10 border-blue-500/20 text-slate-100 shadow-sm'
                            : 'bg-slate-900/30 border-transparent hover:bg-slate-900/60 hover:border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <div class="truncate flex-1 space-y-1">
                          <h4 class="text-[11px] font-bold truncate leading-snug">
                            {s.title || 'New Chat'}
                          </h4>
                          {s.lastMessage && (
                            <p class="text-[9px] truncate text-slate-555 leading-normal">
                              {s.lastMessage}
                            </p>
                          )}
                          <span class="text-[8px] font-mono text-slate-600 block">
                            {formatTime(s.updatedAt)}
                          </span>
                        </div>
                        <button
                          onClick={(e) => deleteSession(e, s.id)}
                          class="opacity-0 group-hover:opacity-100 p-1 text-slate-600 hover:text-red-400 hover:bg-slate-800/80 rounded-md transition-all shrink-0 self-center"
                        >
                          <Trash2 class="h-3 w-3" />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* 2. Main Current Chat Section */}
          <div class="flex-1 flex flex-col justify-between overflow-hidden bg-slate-950/40">
            {/* Header */}
            <div class="bg-slate-900 border-b border-slate-800/80 p-4 flex items-center justify-between shrink-0">
              <div class="flex items-center gap-3">
                <div class="h-9 w-9 rounded-lg bg-blue-600/15 flex items-center justify-center border border-blue-500/20 text-blue-400">
                  <Bot class="h-5 w-5" />
                </div>
                <div>
                  <h3 class="text-xs font-bold text-white tracking-wide uppercase">Port DSS Assistant</h3>
                  <span class="text-[9px] font-semibold text-slate-400 block -mt-0.5 font-mono">Active Assistant</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div class="flex items-center gap-1">
                <button
                  onClick={createNewChat}
                  title="New Chat"
                  class="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-1"
                >
                  <Plus class="h-4 w-4" />
                  <span class="text-[10px] font-bold uppercase tracking-wider hidden md:inline">New Chat</span>
                </button>
                <button
                  onClick={() => setHistoryOpen(!historyOpen)}
                  title="Toggle History"
                  class={`p-2 rounded-lg transition-colors ${
                    historyOpen ? 'text-blue-400 bg-blue-650/10' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <History class="h-4.5 w-4.5" />
                </button>
                <button 
                  onClick={() => setIsOpen(false)}
                  class="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition-colors"
                >
                  <X class="h-4.5 w-4.5" />
                </button>
              </div>
            </div>

            {/* Subtitle */}
            <div class="bg-slate-900/40 px-4 py-1.5 border-b border-slate-900/60 text-[9px] text-slate-500 font-bold uppercase tracking-wider shrink-0">
              Ask about revenue, berths, customers, commodities, or port terms
            </div>

            {/* Messages Area */}
            <div class="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
              {messages.map((m, idx) => {
                const isBot = m.role === 'assistant' || m.role === 'system';
                return (
                  <div key={idx} class={`flex items-start gap-2.5 ${!isBot ? 'justify-end' : ''}`}>
                    {isBot && (
                      <div class="h-7 w-7 rounded-md bg-blue-600/10 flex items-center justify-center border border-blue-500/10 text-blue-400 shrink-0">
                        <Bot class="h-4 w-4" />
                      </div>
                    )}
                    <div class={`max-w-[78%] rounded-xl p-3 leading-relaxed ${
                      isBot 
                        ? 'bg-slate-900/60 border border-slate-800 text-slate-200' 
                        : 'bg-blue-600 text-white font-medium'
                    }`}>
                      <p class="whitespace-pre-line">{m.message}</p>
                      {isBot && m.source && (
                        <span class="text-[8px] font-bold text-slate-500 block uppercase mt-1.5 border-t border-slate-850 pt-1 font-mono">
                          Source: {m.source}
                        </span>
                      )}
                    </div>
                    {!isBot && (
                      <div class="h-7 w-7 rounded-md bg-slate-900 flex items-center justify-center border border-slate-800 text-slate-400 shrink-0">
                        <User class="h-4 w-4" />
                      </div>
                    )}
                  </div>
                );
              })}
              {loading && (
                <div class="flex items-start gap-2.5">
                  <div class="h-7 w-7 rounded-md bg-blue-600/10 flex items-center justify-center border border-blue-500/10 text-blue-400 shrink-0">
                    <Bot class="h-4 w-4" />
                  </div>
                  <div class="bg-slate-900/60 border border-slate-800 rounded-xl p-3 flex items-center gap-2">
                    <Loader2 class="h-4 w-4 text-blue-400 animate-spin" />
                    <span class="text-slate-400 font-medium">{thinkingText}</span>
                  </div>
                </div>
              )}
              {error && (
                <div class="p-3 bg-red-950/20 border border-red-900/30 rounded-xl text-red-400 flex items-center gap-2">
                  <AlertCircle class="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Suggested Questions */}
            <div class="px-4 py-2 border-t border-slate-900/60 shrink-0 bg-slate-950">
              <span class="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">Suggested Questions</span>
              <div class="flex gap-2 overflow-x-auto pb-1.5 pr-2 scrollbar-thin">
                {suggestedQuestions.map((q) => (
                  <button
                    key={q}
                    disabled={loading}
                    onClick={() => handleSend(q)}
                    class="bg-slate-900 hover:bg-slate-800/80 border border-slate-800 text-[10px] font-semibold text-slate-300 hover:text-white px-2.5 py-1 rounded-lg transition-all shrink-0 whitespace-nowrap disabled:opacity-50"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>

            {/* Input Panel */}
            <form 
              onSubmit={(e) => { e.preventDefault(); handleSend(); }}
              class="bg-slate-900/80 border-t border-slate-800/80 p-3 flex items-center gap-2 shrink-0"
            >
              <input
                type="text"
                disabled={loading}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={loading ? "Waiting for response..." : "Ask a question..."}
                class="flex-1 bg-slate-950 border border-slate-800 focus:border-blue-500/50 rounded-xl px-3.5 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none transition-colors disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={loading || !inputText.trim()}
                class="h-9 w-9 bg-blue-600 hover:bg-blue-500 text-white rounded-xl flex items-center justify-center transition-all disabled:opacity-50 disabled:hover:bg-blue-600 focus:outline-none shrink-0"
              >
                <Send class="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
