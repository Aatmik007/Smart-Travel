import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { 
  Users, ShieldAlert, Award, CheckCircle2, Trash2, Compass, 
  BarChart3, TrendingUp, MapPin, AlertCircle, Zap
} from 'lucide-react';
import { API_BASE } from '../../utils/apiClient';

const AdminDashboard = () => {
  const { token, user } = useAuth();
  
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);

  const [pendingDrivers, setPendingDrivers] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [allUsers, setAllUsers] = useState([]);

  // Analytics State
  const [analytics, setAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState('');

  const [activeSection, setActiveSection] = useState('analytics'); // analytics, drivers, users, complaints

  useEffect(() => {
    if (token) {
      fetchStats();
      fetchPendingDrivers();
      fetchComplaints();
      fetchAllUsers();
      fetchAnalytics();
    }
  }, [token]);

  const fetchStats = async () => {
    try {
      setStatsLoading(true);
      const res = await fetch(`${API_BASE}/admin/stats`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data.stats);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setStatsLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    try {
      setAnalyticsLoading(true);
      setAnalyticsError('');
      const res = await fetch(`${API_BASE}/analytics/demand`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAnalytics(data);
      } else {
        const errData = await res.json();
        setAnalyticsError(errData.message || 'Could not load transit analytics.');
      }
    } catch (err) {
      console.error(err);
      setAnalyticsError('Network error connecting to analytics service.');
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const fetchPendingDrivers = async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/drivers/pending`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setPendingDrivers(data.drivers || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchComplaints = async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/complaints`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setComplaints(data.complaints || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAllUsers = async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/users`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAllUsers(data.users || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleApproveDriver = async (driverId) => {
    try {
      const res = await fetch(`${API_BASE}/admin/drivers/${driverId}/approve`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        fetchPendingDrivers();
        fetchStats();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleResolveComplaint = async (complaintId) => {
    try {
      const res = await fetch(`${API_BASE}/admin/complaints/${complaintId}/resolve`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        fetchComplaints();
        fetchStats();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Are you sure you want to remove this user from JammuMove?')) return;
    try {
      const res = await fetch(`${API_BASE}/admin/users/${userId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        fetchAllUsers();
        fetchStats();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top Welcome Title */}
      <div className="glass-panel p-6 rounded-2xl shadow-lg border border-slate-800/80">
        <h2 className="text-xl font-extrabold text-white">Central Operations Center: {user ? user.name : 'Admin'}</h2>
        <p className="text-xs text-slate-400 mt-1">Audit transit analytics, verify driver credentials, and manage platform safety.</p>
      </div>

      {/* Stats Row Cards */}
      {statsLoading ? (
        <div className="text-slate-500 text-xs italic">Compiling system stats...</div>
      ) : stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="glass-panel p-5 rounded-2xl border border-slate-800 flex items-center justify-between shadow-md">
            <div>
              <span className="text-[10px] text-slate-500 uppercase font-bold">Total Platform Users</span>
              <div className="text-xl font-black text-white mt-1">{stats.totalUsers}</div>
              <span className="text-[9px] text-slate-400">P: {stats.passengers} | D: {stats.drivers}</span>
            </div>
            <div className="p-3 bg-brand-500/10 text-brand-400 rounded-xl">
              <Users className="h-5 w-5" />
            </div>
          </div>

          <div className="glass-panel p-5 rounded-2xl border border-slate-800 flex items-center justify-between shadow-md">
            <div>
              <span className="text-[10px] text-slate-500 uppercase font-bold">Active Carpools</span>
              <div className="text-xl font-black text-white mt-1">{stats.activeTrips}</div>
              <span className="text-[9px] text-slate-400">Total trips: {stats.totalTrips}</span>
            </div>
            <div className="p-3 bg-accent-teal/10 text-accent-teal rounded-xl">
              <Compass className="h-5 w-5" />
            </div>
          </div>

          <div className="glass-panel p-5 rounded-2xl border border-slate-800 flex items-center justify-between shadow-md">
            <div>
              <span className="text-[10px] text-slate-500 uppercase font-bold">Pending Driver Files</span>
              <div className="text-xl font-black text-white mt-1">{stats.pendingDrivers}</div>
              <span className="text-[9px] text-slate-400">Requires review</span>
            </div>
            <div className="p-3 bg-accent-amber/10 text-accent-amber rounded-xl">
              <Award className="h-5 w-5" />
            </div>
          </div>

          <div className="glass-panel p-5 rounded-2xl border border-slate-800 flex items-center justify-between shadow-md">
            <div>
              <span className="text-[10px] text-slate-500 uppercase font-bold">Open Tickets / Complaints</span>
              <div className="text-xl font-black text-white mt-1">{stats.pendingComplaints}</div>
              <span className="text-[9px] text-slate-400">Requires resolution</span>
            </div>
            <div className="p-3 bg-accent-rose/10 text-accent-rose rounded-xl">
              <ShieldAlert className="h-5 w-5" />
            </div>
          </div>
        </div>
      )}

      {/* Selector Subtabs */}
      <div className="flex border-b border-slate-800 space-x-6 text-sm font-semibold overflow-x-auto pb-1">
        <button 
          onClick={() => setActiveSection('analytics')}
          className={`pb-3 transition flex items-center space-x-1.5 flex-shrink-0 ${activeSection === 'analytics' ? 'border-b-2 border-brand-500 text-white' : 'text-slate-400 hover:text-white'}`}
        >
          <BarChart3 className="h-4 w-4" />
          <span>Transit Demand Analytics</span>
        </button>
        <button 
          onClick={() => setActiveSection('drivers')}
          className={`pb-3 transition flex items-center space-x-1.5 flex-shrink-0 ${activeSection === 'drivers' ? 'border-b-2 border-brand-500 text-white' : 'text-slate-400 hover:text-white'}`}
        >
          <Award className="h-4 w-4" />
          <span>Pending Approvals ({pendingDrivers.length})</span>
        </button>
        <button 
          onClick={() => setActiveSection('users')}
          className={`pb-3 transition flex items-center space-x-1.5 flex-shrink-0 ${activeSection === 'users' ? 'border-b-2 border-brand-500 text-white' : 'text-slate-400 hover:text-white'}`}
        >
          <Users className="h-4 w-4" />
          <span>Member Directory ({allUsers.length})</span>
        </button>
        <button 
          onClick={() => setActiveSection('complaints')}
          className={`pb-3 transition flex items-center space-x-1.5 flex-shrink-0 ${activeSection === 'complaints' ? 'border-b-2 border-brand-500 text-white' : 'text-slate-400 hover:text-white'}`}
        >
          <ShieldAlert className="h-4 w-4" />
          <span>Support Tickets ({complaints.filter(c => c.status === 'pending').length})</span>
        </button>
      </div>

      {/* Tab Panels */}
      <div className="mt-4">
        
        {/* Panel 1: Transit Demand Analytics */}
        {activeSection === 'analytics' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h3 className="text-sm font-extrabold text-white flex items-center space-x-2">
                  <TrendingUp className="h-4 w-4 text-brand-400" />
                  <span>Transit Demand & Corridor Analytics</span>
                </h3>
                <p className="text-[11px] text-slate-400">
                  Real database measurements separated from heuristic traffic models. Zero fabricated statistics.
                </p>
              </div>

              <button
                onClick={fetchAnalytics}
                className="bg-brand-900/60 hover:bg-brand-850 text-slate-300 border border-slate-800 text-xs px-3 py-1.5 rounded-lg transition"
              >
                Refresh Metrics
              </button>
            </div>

            {analyticsLoading ? (
              <div className="p-8 text-center text-slate-500 text-xs italic">Computing aggregation pipelines...</div>
            ) : analyticsError ? (
              <div className="p-4 bg-accent-rose/10 border border-accent-rose/30 rounded-xl text-accent-rose text-xs">
                {analyticsError}
              </div>
            ) : analytics && (
              <div className="space-y-6">
                
                {/* Data sufficiency banner or historical KPI cards */}
                {!analytics.hasSufficientData ? (
                  <div className="p-4 bg-accent-amber/10 border border-accent-amber/30 rounded-xl text-accent-amber text-xs flex items-start space-x-3">
                    <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold block">Insufficient Historical Data</span>
                      <p className="text-[11px] text-slate-300 mt-1">{analytics.message}</p>
                      <p className="text-[10px] text-slate-400 mt-1">Measured data points so far: {analytics.measuredDataPoints}. Displaying projected traffic heuristic below.</p>
                    </div>
                  </div>
                ) : analytics.measuredHistorical && (
                  <>
                    {/* Measurement KPIs */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="glass-panel p-4 rounded-xl border border-slate-800">
                        <span className="text-[10px] text-slate-500 font-bold uppercase">Measured Trips</span>
                        <div className="text-lg font-black text-white mt-1">
                          {analytics.measuredHistorical.totalTripsRecorded}
                        </div>
                        <span className="text-[10px] text-accent-emerald">Direct DB aggregation</span>
                      </div>

                      <div className="glass-panel p-4 rounded-xl border border-slate-800">
                        <span className="text-[10px] text-slate-500 font-bold uppercase">Passenger Bookings</span>
                        <div className="text-lg font-black text-brand-400 mt-1">
                          {analytics.measuredHistorical.totalBookingsRecorded}
                        </div>
                        <span className="text-[10px] text-slate-400">Total seat reservations</span>
                      </div>

                      <div className="glass-panel p-4 rounded-xl border border-slate-800">
                        <span className="text-[10px] text-slate-500 font-bold uppercase">Carpool Utilization</span>
                        <div className="text-lg font-black text-accent-teal mt-1">
                          {analytics.measuredHistorical.carpoolDemand.capacityUtilizationRate}
                        </div>
                        <span className="text-[10px] text-slate-400">
                          {analytics.measuredHistorical.carpoolDemand.seatsBooked} seats booked / {analytics.measuredHistorical.carpoolDemand.seatsAvailable} open
                        </span>
                      </div>

                      <div className="glass-panel p-4 rounded-xl border border-slate-800">
                        <span className="text-[10px] text-slate-500 font-bold uppercase">Dominant Peak Hour</span>
                        <div className="text-lg font-black text-accent-amber mt-1">
                          {analytics.measuredHistorical.peakPeriods.peakHour}
                        </div>
                        <span className="text-[10px] text-slate-400">Highest departure volume</span>
                      </div>
                    </div>

                    {/* Popular Hubs Breakdown */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="glass-panel p-5 rounded-xl border border-slate-800">
                        <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center space-x-1.5">
                          <MapPin className="h-3.5 w-3.5 text-brand-400" />
                          <span>Top Departure Hubs (Origins)</span>
                        </h4>
                        <div className="space-y-2.5">
                          {analytics.measuredHistorical.popularAreas.topOrigins.map((o, idx) => (
                            <div key={idx} className="space-y-1">
                              <div className="flex justify-between text-xs">
                                <span className="font-semibold text-slate-200">{o.hub}</span>
                                <span className="text-slate-400">{o.departureCount} departure(s)</span>
                              </div>
                              <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                <div 
                                  className="bg-brand-500 h-full rounded-full" 
                                  style={{ width: `${Math.min(100, o.departureCount * 25)}%` }}
                                ></div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="glass-panel p-5 rounded-xl border border-slate-800">
                        <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center space-x-1.5">
                          <MapPin className="h-3.5 w-3.5 text-accent-teal" />
                          <span>Top Arrival Hubs (Destinations)</span>
                        </h4>
                        <div className="space-y-2.5">
                          {analytics.measuredHistorical.popularAreas.topDestinations.map((d, idx) => (
                            <div key={idx} className="space-y-1">
                              <div className="flex justify-between text-xs">
                                <span className="font-semibold text-slate-200">{d.hub}</span>
                                <span className="text-slate-400">{d.arrivalCount} arrival(s)</span>
                              </div>
                              <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                <div 
                                  className="bg-accent-teal h-full rounded-full" 
                                  style={{ width: `${Math.min(100, d.arrivalCount * 25)}%` }}
                                ></div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Frequently Requested Corridors */}
                    <div className="glass-panel p-5 rounded-xl border border-slate-800">
                      <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">
                        Most Requested Transit Corridors
                      </h4>
                      <div className="space-y-2">
                        {analytics.measuredHistorical.frequentlyRequestedRoutes.map((r, idx) => (
                          <div key={idx} className="bg-brand-900/40 p-3 rounded-lg border border-slate-800/80 flex items-center justify-between text-xs flex-wrap gap-2">
                            <div>
                              <span className="font-bold text-white">{r.route}</span>
                              <div className="text-[10px] text-slate-400 mt-0.5">
                                Mode: <span className="uppercase text-brand-300">{r.type}</span> • Avg Seat: ₹{r.pricePerSeat}
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-brand-500/15 text-brand-300">
                                {r.tripsOffered} listing(s) offered
                              </span>
                              {r.bookingsCount > 0 && (
                                <span className="ml-2 text-[10px] text-accent-emerald font-semibold">
                                  {r.bookingsCount} seat(s) booked
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {/* Projected Congestion Model */}
                {analytics.projectedForecast && (
                  <div className="glass-panel p-5 rounded-xl border border-slate-800 bg-gradient-to-r from-brand-900/60 to-brand-850">
                    <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                      <div className="flex items-center space-x-2">
                        <Zap className="h-4 w-4 text-accent-amber" />
                        <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                          Projected Traffic & Rush-Hour Forecast
                        </h4>
                      </div>
                      <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded border border-slate-700">
                        Model: {analytics.projectedForecast.model}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                      <div className="bg-brand-900/80 p-3 rounded-lg border border-slate-800">
                        <span className="text-[10px] text-slate-500 uppercase font-bold">Current Period</span>
                        <div className="text-sm font-extrabold text-white mt-1">{analytics.projectedForecast.currentPeriod}</div>
                      </div>
                      <div className="bg-brand-900/80 p-3 rounded-lg border border-slate-800">
                        <span className="text-[10px] text-slate-500 uppercase font-bold">Congestion Level</span>
                        <div className="text-sm font-extrabold text-accent-amber mt-1">{analytics.projectedForecast.currentCongestionLevel}</div>
                      </div>
                      <div className="bg-brand-900/80 p-3 rounded-lg border border-slate-800">
                        <span className="text-[10px] text-slate-500 uppercase font-bold">Pricing Factor</span>
                        <div className="text-sm font-extrabold text-brand-400 mt-1">{analytics.projectedForecast.currentMultiplier}x</div>
                      </div>
                    </div>

                    <p className="text-xs text-slate-300 italic mb-3">"{analytics.projectedForecast.reason}"</p>

                    <div className="space-y-2">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Standard Rush Windows in Jammu</span>
                      {analytics.projectedForecast.forecastedRushHours.map((win, idx) => (
                        <div key={idx} className="bg-brand-900/40 p-2.5 rounded-lg border border-slate-800 text-xs flex justify-between items-center">
                          <div>
                            <span className="font-bold text-white">{win.window}</span>
                            <span className="text-slate-400 ml-2">({win.corridor})</span>
                          </div>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-accent-amber/15 text-accent-amber">
                            {win.expectedCongestion}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Panel 2: Pending drivers */}
        {activeSection === 'drivers' && (
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-brand-400">Awaiting Registration Approvals</h3>
            {pendingDrivers.length === 0 ? (
              <div className="glass-card p-8 rounded-xl text-center text-slate-500 text-xs">No pending driver profiles await verification.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pendingDrivers.map((driver) => (
                  <div key={driver._id} className="glass-panel p-5 rounded-2xl border border-slate-800 flex justify-between items-center shadow-md">
                    <div>
                      <h4 className="font-extrabold text-sm text-slate-200">{driver.driverName}</h4>
                      <p className="text-[10px] text-slate-400 mt-1">Email: {driver.driverEmail}</p>
                      <p className="text-[10px] text-slate-400">Phone: {driver.driverPhone}</p>
                      <div className="bg-brand-900/50 p-2 rounded-lg border border-slate-800 text-[10px] text-slate-400 mt-2.5">
                        License: <span className="font-semibold text-slate-300">{driver.licenseNumber}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleApproveDriver(driver._id)}
                      className="bg-accent-emerald hover:bg-emerald-600 text-white font-bold text-xs px-3.5 py-2 rounded-xl shadow-md transition flex items-center space-x-1"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Approve</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Panel 3: User list */}
        {activeSection === 'users' && (
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-brand-400">Platform Registered Accounts</h3>
            <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden shadow-md">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-brand-900/70 border-b border-slate-800 text-[10px] uppercase font-bold text-slate-400">
                    <tr>
                      <th className="p-3.5">Member Name</th>
                      <th className="p-3.5">Email</th>
                      <th className="p-3.5">Role</th>
                      <th className="p-3.5">Phone</th>
                      <th className="p-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {allUsers.map((u) => (
                      <tr key={u._id} className="hover:bg-brand-850/50 transition">
                        <td className="p-3.5 font-semibold text-slate-200">{u.name}</td>
                        <td className="p-3.5 text-slate-400">{u.email}</td>
                        <td className="p-3.5">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            u.role === 'admin' 
                              ? 'bg-purple-500/15 text-purple-300' 
                              : u.role === 'driver' 
                              ? 'bg-accent-teal/15 text-accent-teal' 
                              : 'bg-brand-500/15 text-brand-300'
                          }`}>
                            {u.role}
                          </span>
                        </td>
                        <td className="p-3.5 text-slate-400">{u.phone || 'N/A'}</td>
                        <td className="p-3.5 text-right">
                          {u.role !== 'admin' && (
                            <button
                              onClick={() => handleDeleteUser(u._id)}
                              className="text-accent-rose hover:text-rose-400 p-1.5 rounded-lg hover:bg-accent-rose/10 transition"
                              title="Delete user"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Panel 4: Support Complaints */}
        {activeSection === 'complaints' && (
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-brand-400">Passenger Grievances & Inquiries</h3>
            {complaints.length === 0 ? (
              <div className="glass-card p-8 rounded-xl text-center text-slate-500 text-xs">No support complaints filed.</div>
            ) : (
              <div className="space-y-3">
                {complaints.map((c) => (
                  <div key={c._id} className="glass-panel p-5 rounded-2xl border border-slate-800 text-xs space-y-2">
                    <div className="flex justify-between items-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        c.status === 'resolved' ? 'bg-accent-emerald/15 text-accent-emerald' : 'bg-accent-rose/15 text-accent-rose'
                      }`}>
                        {c.status.toUpperCase()}
                      </span>
                      <span className="text-[10px] text-slate-500">{new Date(c.createdAt).toLocaleDateString()}</span>
                    </div>
                    <h4 className="font-extrabold text-sm text-slate-200">{c.title}</h4>
                    <p className="text-slate-400 leading-relaxed">{c.description}</p>
                    
                    {c.status !== 'resolved' && (
                      <div className="pt-2 flex justify-end">
                        <button
                          onClick={() => handleResolveComplaint(c._id)}
                          className="bg-brand-500 hover:bg-brand-600 text-white font-bold text-xs px-3 py-1.5 rounded-lg transition"
                        >
                          Mark as Resolved
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>

    </div>
  );
};

export default AdminDashboard;
