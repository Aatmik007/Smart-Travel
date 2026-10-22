import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Send, Bot, User, Calculator, Flame, AlertCircle, ShieldAlert, Sparkles, 
  ArrowRight, Clock, Navigation, Bus, Zap, Users, CheckCircle2, 
  RotateCcw, Compass
} from 'lucide-react';
import { API_BASE } from '../utils/apiClient';

const JAMMU_HUBS = [
  'Janipur',
  'Jewel Chowk',
  'Gandhi Nagar',
  'Jammu University',
  'Jammu Tawi Railway Station',
  'Channi Himmat',
  'Satwari Chowk (Airport)',
  'Talab Tillo',
  'Panjtirthi',
  'Parade Ground'
];

const RouteAssistant = () => {
  const { token: _token } = useAuth();
  
  // Navigation tab in main panel: 'chat' | 'planner'
  const [activeTab, setActiveTab] = useState('chat');

  // Chat state
  const [messages, setMessages] = useState([
    { 
      sender: 'ai', 
      text: 'Hello! I am your **JammuMove AI Route Assistant**. Ask me about the best bus routes, travel fare estimations, or multimodal journeys in Jammu! Try asking: *"How do I go from Janipur to Gandhi Nagar?"* or use the **Journey Planner** tab above.' 
    }
  ]);
  const [inputMsg, setInputMsg] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const messagesEndRef = useRef(null);

  // Multimodal Planner state
  const [originHub, setOriginHub] = useState('Janipur');
  const [destinationHub, setDestinationHub] = useState('Gandhi Nagar');
  const [preference, setPreference] = useState('duration'); // duration | cost | transfers
  const [plannerResult, setPlannerResult] = useState(null);
  const [selectedRouteIdx, setSelectedRouteIdx] = useState(0);
  const [plannerLoading, setPlannerLoading] = useState(false);
  const [plannerError, setPlannerError] = useState('');

  // Fare estimation state
  const [distance, setDistance] = useState('');
  const [estimatedFares, setEstimatedFares] = useState(null);
  const [fareLoading, setFareLoading] = useState(false);

  // Demand state
  const [selectedRoute, setSelectedRoute] = useState('Janipur-Satwari');
  const [demandResult, setDemandResult] = useState(null);
  const [demandLoading, setDemandLoading] = useState(false);

  // Spam checker state
  const [spamPrice, setSpamPrice] = useState('');
  const [spamSeats, setSpamSeats] = useState('3');
  const [spamFrom, setSpamFrom] = useState('');
  const [spamTo, setSpamTo] = useState('');
  const [spamResult, setSpamResult] = useState(null);
  const [spamLoading, setSpamLoading] = useState(false);

  useEffect(() => {
    scrollToBottom();
  }, [messages, activeTab]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // 1. Chat logic
  const handleSendChat = async (e) => {
    e.preventDefault();
    if (!inputMsg.trim()) return;

    const userText = inputMsg;
    setMessages(prev => [...prev, { sender: 'user', text: userText }]);
    setInputMsg('');
    setChatLoading(true);

    try {
      const res = await fetch(`${API_BASE}/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userText })
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(prev => [
          ...prev, 
          { 
            sender: 'ai', 
            text: data.reply,
            routeData: data.routeData || null
          }
        ]);
        if (data.routeData && data.routeData.routes && data.routeData.routes.length > 0) {
          setPlannerResult(data.routeData);
          setSelectedRouteIdx(0);
        }
      } else {
        setMessages(prev => [...prev, { sender: 'ai', text: 'Sorry, I am facing server issues at the moment.' }]);
      }
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { sender: 'ai', text: 'Error contacting AI services.' }]);
    } finally {
      setChatLoading(false);
    }
  };

  // 2. Multimodal Route Planning logic
  const handlePlanRoute = async (prefOverride) => {
    const currentPref = prefOverride || preference;
    if (prefOverride) {
      setPreference(prefOverride);
    }

    if (!originHub || !destinationHub) return;
    setPlannerLoading(true);
    setPlannerError('');
    setSelectedRouteIdx(0);

    try {
      const res = await fetch(`${API_BASE}/routes/multimodal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin: originHub,
          destination: destinationHub,
          preference: currentPref
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setPlannerResult(data);
      } else {
        setPlannerError(data.message || 'Could not calculate a connected transit route.');
        setPlannerResult(null);
      }
    } catch (err) {
      console.error(err);
      const isNetworkError = err instanceof TypeError && err.message.toLowerCase().includes('fetch');
      setPlannerError(
        isNetworkError
          ? 'Could not reach the routing service. Please ensure the server is running and try again.'
          : 'Failed to calculate route. Please check your inputs and try again.'
      );
      setPlannerResult(null);
    } finally {
      setPlannerLoading(false);
    }
  };

  // 3. Fare prediction logic
  const handleEstimateFare = async (e) => {
    e.preventDefault();
    if (!distance || isNaN(distance)) return;
    setFareLoading(true);
    try {
      const res = await fetch(`${API_BASE}/ai/predict-fare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ distance: parseFloat(distance) })
      });
      if (res.ok) {
        const data = await res.json();
        setEstimatedFares(data.fares);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setFareLoading(false);
    }
  };

  // 4. Demand Forecasting logic
  const handlePredictDemand = async () => {
    setDemandLoading(true);
    try {
      const res = await fetch(`${API_BASE}/ai/predict-demand`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ routeName: selectedRoute })
      });
      if (res.ok) {
        const data = await res.json();
        setDemandResult(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setDemandLoading(false);
    }
  };

  // 5. Spam analyzer logic
  const handleCheckSpam = async (e) => {
    e.preventDefault();
    setSpamLoading(true);
    setSpamResult(null);
    try {
      const res = await fetch(`${API_BASE}/ai/check-spam`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          price: parseFloat(spamPrice),
          startName: spamFrom,
          endName: spamTo,
          availableSeats: parseInt(spamSeats)
        })
      });
      if (res.ok) {
        const data = await res.json();
        setSpamResult(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSpamLoading(false);
    }
  };

  // Helper to render mode badge
  const renderModeBadge = (mode, line) => {
    switch (mode) {
      case 'bus':
        return (
          <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-brand-500/20 text-brand-300 border border-brand-500/30">
            <Bus className="h-3.5 w-3.5" />
            <span>{line || 'Smart Bus'}</span>
          </span>
        );
      case 'erickshaw':
        return (
          <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-accent-teal/20 text-accent-teal border border-accent-teal/30">
            <Zap className="h-3.5 w-3.5" />
            <span>{line || 'E-Rickshaw'}</span>
          </span>
        );
      case 'walking':
        return (
          <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-700/50 text-slate-300 border border-slate-600/40">
            <Navigation className="h-3.5 w-3.5" />
            <span>{line || 'Walk'}</span>
          </span>
        );
      case 'carpool':
        return (
          <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30">
            <Users className="h-3.5 w-3.5" />
            <span>{line || 'Carpool'}</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-800 text-slate-300">
            <Compass className="h-3.5 w-3.5" />
            <span>{mode}</span>
          </span>
        );
    }
  };

  const activeJourney = plannerResult && plannerResult.routes && plannerResult.routes[selectedRouteIdx]
    ? plannerResult.routes[selectedRouteIdx]
    : null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 py-4">
      {/* Column 1 & 2: Main Assistant & Multimodal Journey Planner */}
      <div className="lg:col-span-2 flex flex-col glass-panel rounded-2xl h-[680px] shadow-xl overflow-hidden border border-slate-800">
        
        {/* Panel Header & Tab Switcher */}
        <div className="bg-brand-850 px-6 py-3 border-b border-slate-800/80 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-brand-500/10 text-brand-400 rounded-xl border border-brand-500/20">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-100 flex items-center text-sm">
                Route Assistant <Sparkles className="h-3 w-3 text-accent-teal ml-1.5 animate-pulse" />
              </h3>
              <p className="text-[10px] text-slate-400 font-medium">Verified Jammu Transit & Multimodal Routing</p>
            </div>
          </div>

          {/* Tab buttons */}
          <div className="flex items-center bg-brand-900/80 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setActiveTab('chat')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'chat'
                  ? 'bg-brand-500 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Conversational Chat
            </button>
            <button
              onClick={() => {
                setActiveTab('planner');
                if (!plannerResult) handlePlanRoute();
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center space-x-1.5 ${
                activeTab === 'planner'
                  ? 'bg-brand-500 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Navigation className="h-3 w-3" />
              <span>Journey Planner</span>
            </button>
          </div>
        </div>

        {/* TAB 1: Conversational Chat */}
        {activeTab === 'chat' && (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Messages area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.map((m, idx) => (
                <div key={idx} className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`flex items-start space-x-2.5 max-w-[90%] ${m.sender === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}>
                    <div className={`h-8 w-8 rounded-xl flex items-center justify-center flex-shrink-0 border ${
                      m.sender === 'user' 
                        ? 'bg-brand-500/20 border-brand-500 text-brand-300' 
                        : 'bg-brand-850 border-slate-700 text-accent-teal'
                    }`}>
                      {m.sender === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                    </div>
                    <div className={`p-4 rounded-2xl text-xs sm:text-sm leading-relaxed ${
                      m.sender === 'user'
                        ? 'bg-brand-500 text-white rounded-tr-none'
                        : 'bg-brand-850 text-slate-200 rounded-tl-none border border-slate-800/80 shadow-md'
                    }`}>
                      <p className="whitespace-pre-line">{m.text}</p>

                      {/* If structured routeData is present, show direct breakdown button */}
                      {m.routeData && m.routeData.routes && m.routeData.routes.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-slate-700/60 flex items-center justify-between flex-wrap gap-2">
                          <div className="text-[11px] text-accent-teal font-medium flex items-center space-x-1">
                            <CheckCircle2 className="h-3.5 w-3.5 text-accent-teal" />
                            <span>{m.routeData.routes[0].summary} • ₹{m.routeData.routes[0].totalFare} • ~{m.routeData.routes[0].totalDurationMins}m</span>
                          </div>
                          <button
                            onClick={() => {
                              setPlannerResult(m.routeData);
                              setSelectedRouteIdx(0);
                              setActiveTab('planner');
                            }}
                            className="bg-brand-500/20 hover:bg-brand-500/30 text-brand-300 border border-brand-500/40 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition flex items-center space-x-1"
                          >
                            <span>Open in Journey Planner</span>
                            <ArrowRight className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="flex justify-start">
                  <div className="flex items-center space-x-2.5 bg-brand-850 p-4 rounded-2xl border border-slate-800/60 text-slate-400 text-xs">
                    <div className="h-2 w-2 bg-accent-teal rounded-full animate-bounce"></div>
                    <div className="h-2 w-2 bg-accent-teal rounded-full animate-bounce [animation-delay:0.2s]"></div>
                    <div className="h-2 w-2 bg-accent-teal rounded-full animate-bounce [animation-delay:0.4s]"></div>
                    <span>Assistant is verifying municipal transit legs...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Chat input */}
            <form onSubmit={handleSendChat} className="bg-brand-850 p-4 border-t border-slate-800/80 flex items-center space-x-3">
              <input
                type="text"
                placeholder="Ask e.g. 'How do I go from Janipur to Satwari Airport?' or 'Cheapest way to University'..."
                value={inputMsg}
                onChange={(e) => setInputMsg(e.target.value)}
                className="flex-1 glass-input px-4 py-3 rounded-xl text-xs sm:text-sm"
              />
              <button
                type="submit"
                className="bg-brand-500 hover:bg-brand-600 text-white p-3 rounded-xl transition shadow-[0_4px_12px_rgba(59,108,253,0.3)] flex-shrink-0"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        )}

        {/* TAB 2: Multimodal Journey Planner */}
        {activeTab === 'planner' && (
          <div className="flex-1 flex flex-col min-h-0 overflow-y-auto p-5 space-y-4">
            
            {/* Control Bar: Origin, Destination & Preference */}
            <div className="bg-brand-900/60 p-4 rounded-xl border border-slate-800 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">
                    Origin Station / Hub
                  </label>
                  <select
                    value={originHub}
                    onChange={(e) => setOriginHub(e.target.value)}
                    className="w-full glass-input px-3 py-2 rounded-lg text-xs"
                  >
                    {JAMMU_HUBS.map(hub => (
                      <option key={hub} value={hub} className="bg-brand-900 text-white">{hub}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">
                    Destination Station / Hub
                  </label>
                  <select
                    value={destinationHub}
                    onChange={(e) => setDestinationHub(e.target.value)}
                    className="w-full glass-input px-3 py-2 rounded-lg text-xs"
                  >
                    {JAMMU_HUBS.map(hub => (
                      <option key={hub} value={hub} className="bg-brand-900 text-white">{hub}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Preferences & Submit */}
              <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-slate-800/80">
                <div className="flex items-center space-x-1.5">
                  <span className="text-[10px] text-slate-400 font-bold mr-1">Optimize for:</span>
                  <button
                    onClick={() => handlePlanRoute('duration')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                      preference === 'duration' 
                        ? 'bg-brand-500 text-white shadow-sm' 
                        : 'bg-brand-850 text-slate-400 hover:text-slate-200 border border-slate-800'
                    }`}
                  >
                    ⚡ Fastest
                  </button>
                  <button
                    onClick={() => handlePlanRoute('cost')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                      preference === 'cost' 
                        ? 'bg-accent-emerald text-white shadow-sm' 
                        : 'bg-brand-850 text-slate-400 hover:text-slate-200 border border-slate-800'
                    }`}
                  >
                    💰 Cheapest
                  </button>
                  <button
                    onClick={() => handlePlanRoute('transfers')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                      preference === 'transfers' 
                        ? 'bg-purple-600 text-white shadow-sm' 
                        : 'bg-brand-850 text-slate-400 hover:text-slate-200 border border-slate-800'
                    }`}
                  >
                    🔄 Fewer Transfers
                  </button>
                </div>

                <button
                  onClick={() => handlePlanRoute()}
                  disabled={plannerLoading}
                  className="bg-brand-500 hover:bg-brand-600 text-white px-4 py-1.5 rounded-lg text-xs font-bold transition disabled:opacity-50 flex items-center space-x-1.5 shadow-md"
                >
                  {plannerLoading ? (
                    <span>Calculating...</span>
                  ) : (
                    <>
                      <span>Find Routes</span>
                      <ArrowRight className="h-3 w-3" />
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Error banner */}
            {plannerError && (
              <div className="p-3.5 bg-accent-rose/10 border border-accent-rose/30 rounded-xl text-accent-rose text-xs flex items-center space-x-2">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>{plannerError}</span>
              </div>
            )}

            {/* Alternative Route Selectors */}
            {plannerResult && plannerResult.routes && plannerResult.routes.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center space-x-2 overflow-x-auto pb-1">
                  {plannerResult.routes.map((r, idx) => (
                    <button
                      key={r.routeId}
                      onClick={() => setSelectedRouteIdx(idx)}
                      className={`px-3 py-2 rounded-xl text-xs font-bold transition border flex items-center space-x-2 flex-shrink-0 ${
                        selectedRouteIdx === idx
                          ? 'bg-brand-500 text-white border-brand-400 shadow-md'
                          : 'bg-brand-850 text-slate-300 border-slate-800 hover:bg-brand-800'
                      }`}
                    >
                      <span>{r.label}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                        selectedRouteIdx === idx ? 'bg-white/20' : 'bg-slate-700/60'
                      }`}>
                        ₹{r.totalFare} • ~{r.totalDurationMins}m
                      </span>
                    </button>
                  ))}
                </div>

                {/* Active Journey Summary Card */}
                {activeJourney && (
                  <div className="space-y-4">
                    <div className="bg-gradient-to-r from-brand-900 via-brand-850 to-brand-900 p-4 rounded-xl border border-slate-800 flex items-center justify-between flex-wrap gap-4">
                      <div>
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="text-sm font-extrabold text-white">{activeJourney.summary}</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-accent-emerald/15 text-accent-emerald border border-accent-emerald/30">
                            {activeJourney.confidence === 'verified' ? 'Verified Municipal Route' : 'Estimated Route'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400">
                          {activeJourney.transfers === 0 ? 'Direct connection with 0 transfers' : `${activeJourney.transfers} interchange transfer(s)`} • Total distance: ~{activeJourney.totalDistanceKm} km
                        </p>
                      </div>

                      <div className="flex items-center space-x-4">
                        <div className="text-right">
                          <div className="text-[10px] text-slate-400 uppercase font-bold">Estimated Fare</div>
                          <div className="text-base font-extrabold text-brand-400">₹{activeJourney.totalFare}</div>
                        </div>
                        <div className="text-right border-l border-slate-800 pl-4">
                          <div className="text-[10px] text-slate-400 uppercase font-bold">Total Time</div>
                          <div className="text-base font-extrabold text-accent-teal">~{activeJourney.totalDurationMins} mins</div>
                        </div>
                      </div>
                    </div>

                    {/* Step-by-step Route Legs */}
                    <div className="space-y-3">
                      <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        Step-by-Step Journey Legs ({activeJourney.legs.length})
                      </div>

                      {activeJourney.legs.map((leg, lIdx) => (
                        <div key={lIdx} className="space-y-2">
                          {/* Transfer Callout */}
                          {lIdx > 0 && (
                            <div className="flex items-center space-x-2 text-[11px] text-slate-400 py-1 px-4 bg-brand-900/40 rounded-lg border border-dashed border-slate-800">
                              <RotateCcw className="h-3 w-3 text-accent-amber" />
                              <span>Transfer interchange at <strong>{leg.from}</strong> (approx 4–5 min wait time)</span>
                            </div>
                          )}

                          {/* Leg Card */}
                          <div className="bg-brand-850 p-4 rounded-xl border border-slate-800/90 shadow-sm flex items-start space-x-3.5 hover:border-slate-700 transition">
                            <div className="flex flex-col items-center flex-shrink-0 mt-0.5">
                              <div className="h-7 w-7 rounded-lg bg-brand-900 border border-slate-700 flex items-center justify-center text-xs font-extrabold text-brand-300">
                                {leg.legIndex}
                              </div>
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between flex-wrap gap-2 mb-1.5">
                                <div className="flex items-center space-x-2">
                                  {renderModeBadge(leg.mode, leg.line)}
                                  <span className="text-xs font-bold text-white flex items-center">
                                    <span>{leg.from}</span>
                                    <ArrowRight className="h-3 w-3 mx-1.5 text-slate-500" />
                                    <span>{leg.to}</span>
                                  </span>
                                </div>

                                <div className="flex items-center space-x-2 text-[11px]">
                                  <span className="text-slate-400 flex items-center">
                                    <Clock className="h-3 w-3 mr-1 text-slate-500" />
                                    ~{leg.durationMins} mins
                                  </span>
                                  <span className="text-slate-300 font-bold bg-brand-900 px-2 py-0.5 rounded border border-slate-800">
                                    {leg.fare === 0 ? 'Free' : `₹${leg.fare}`}
                                  </span>
                                </div>
                              </div>

                              <p className="text-xs text-slate-300 leading-relaxed bg-brand-900/50 p-2.5 rounded-lg border border-slate-800/60">
                                {leg.instruction}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

      </div>

      {/* Column 3: AI Sidebar Modules (Fare Estimator, Demand Forecaster, Spam Analyzer) */}
      <div className="space-y-6">
        
        {/* Module A: Fare Estimator */}
        <div className="glass-panel p-6 rounded-2xl shadow-xl border border-slate-800">
          <h4 className="font-bold text-slate-100 flex items-center mb-3">
            <Calculator className="h-4 w-4 text-brand-400 mr-2" />
            AI Fare Estimator
          </h4>
          <p className="text-[10px] text-slate-400 mb-4">Input direct distance to query base-calculated fares for local transport modes.</p>
          <form onSubmit={handleEstimateFare} className="flex space-x-2 mb-4">
            <input
              type="text"
              placeholder="Distance (km)"
              value={distance}
              onChange={(e) => setDistance(e.target.value)}
              className="flex-1 glass-input px-3 py-2 rounded-lg text-xs"
              required
            />
            <button
              type="submit"
              disabled={fareLoading}
              className="bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-xs font-bold transition disabled:opacity-50"
            >
              Get Fares
            </button>
          </form>

          {estimatedFares && (
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="bg-brand-900/50 p-2.5 rounded-xl border border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase font-bold">Car Share</div>
                <div className="text-sm font-extrabold text-brand-400 mt-1">₹{estimatedFares.car}</div>
              </div>
              <div className="bg-brand-900/50 p-2.5 rounded-xl border border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase font-bold">Auto Pool</div>
                <div className="text-sm font-extrabold text-accent-teal mt-1">₹{estimatedFares.auto}</div>
              </div>
              <div className="bg-brand-900/50 p-2.5 rounded-xl border border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase font-bold">Bike Ride</div>
                <div className="text-sm font-extrabold text-accent-emerald mt-1">₹{estimatedFares.bike}</div>
              </div>
            </div>
          )}
        </div>

        {/* Module B: Demand forecaster */}
        <div className="glass-panel p-6 rounded-2xl shadow-xl border border-slate-800">
          <h4 className="font-bold text-slate-100 flex items-center mb-3">
            <Flame className="h-4 w-4 text-accent-amber mr-2" />
            Demand Forecaster
          </h4>
          <p className="text-[10px] text-slate-400 mb-4">Analyze peak congestion weights across standard transport lanes.</p>
          <div className="flex space-x-2 mb-4">
            <select
              value={selectedRoute}
              onChange={(e) => setSelectedRoute(e.target.value)}
              className="flex-1 glass-input px-3 py-2 rounded-lg text-xs"
            >
              <option value="Janipur-Satwari" className="bg-brand-900 text-white">Janipur ➔ Satwari</option>
              <option value="Panjtirthi-Railway" className="bg-brand-900 text-white">Panjtirthi ➔ Railway</option>
              <option value="University-Channi" className="bg-brand-900 text-white">University ➔ Channi Himmat</option>
            </select>
            <button
              onClick={handlePredictDemand}
              disabled={demandLoading}
              className="bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-xs font-bold transition disabled:opacity-50"
            >
              Check
            </button>
          </div>

          {demandResult && (
            <div className="bg-brand-900/50 p-3.5 rounded-xl border border-slate-800 text-xs">
              <div className="flex justify-between items-center mb-2">
                <span className="text-slate-400 font-medium">Passenger Demand:</span>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                  demandResult.level === 'High' 
                    ? 'bg-accent-rose/15 text-accent-rose' 
                    : demandResult.level === 'Low' 
                    ? 'bg-accent-emerald/15 text-accent-emerald' 
                    : 'bg-accent-amber/15 text-accent-amber'
                }`}>
                  {demandResult.level}
                </span>
              </div>
              <div className="text-slate-300 font-semibold mb-1 text-[11px]">Pricing Multiplier: {demandResult.factor}x</div>
              <p className="text-[10px] text-slate-400 italic">{demandResult.reason}</p>
            </div>
          )}
        </div>

        {/* Module C: Spam & Fake Ride Check */}
        <div className="glass-panel p-6 rounded-2xl shadow-xl border border-slate-800">
          <h4 className="font-bold text-slate-100 flex items-center mb-3">
            <ShieldAlert className="h-4 w-4 text-accent-rose mr-2" />
            Ride Spam Analyzer
          </h4>
          <p className="text-[10px] text-slate-400 mb-4">Submit pricing and capacity bounds to verify carpool credibility before bookings.</p>
          <form onSubmit={handleCheckSpam} className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="From (eg. Janipur)"
                value={spamFrom}
                onChange={(e) => setSpamFrom(e.target.value)}
                className="glass-input px-3 py-2 rounded-lg text-xs"
                required
              />
              <input
                type="text"
                placeholder="To (eg. Satwari)"
                value={spamTo}
                onChange={(e) => setSpamTo(e.target.value)}
                className="glass-input px-3 py-2 rounded-lg text-xs"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                placeholder="Price (₹)"
                value={spamPrice}
                onChange={(e) => setSpamPrice(e.target.value)}
                className="glass-input px-3 py-2 rounded-lg text-xs"
                required
              />
              <input
                type="number"
                placeholder="Seats"
                value={spamSeats}
                onChange={(e) => setSpamSeats(e.target.value)}
                className="glass-input px-3 py-2 rounded-lg text-xs"
                required
              />
            </div>
            <button
              type="submit"
              disabled={spamLoading}
              className="w-full bg-brand-500 hover:bg-brand-600 text-white py-2 rounded-lg text-xs font-bold transition disabled:opacity-50"
            >
              Analyze Listing
            </button>
          </form>

          {spamResult && (
            <div className={`mt-4 p-3 rounded-xl border text-[11px] flex items-start space-x-2 ${
              spamResult.isSpam 
                ? 'bg-accent-rose/10 border-accent-rose/25 text-accent-rose' 
                : 'bg-accent-emerald/10 border-accent-emerald/25 text-accent-emerald'
            }`}>
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">{spamResult.isSpam ? 'Flagged as Suspect / Spam' : 'Clear / Valid Listing'}</span>
                {spamResult.reasons.length > 0 && (
                  <ul className="list-disc pl-4 mt-1.5 space-y-1">
                    {spamResult.reasons.map((r, i) => <li key={i}>{r}</li>)}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default RouteAssistant;
