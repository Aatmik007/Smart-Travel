import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { 
  Search, MapPin, Clock, CreditCard, 
  ShieldAlert, ArrowRight, Bus, Sparkles, CheckCircle2, 
  AlertCircle, X
} from 'lucide-react';
import { API_BASE } from '../../utils/apiClient';

const PassengerDashboard = () => {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('search');

  // Search rides state
  const [fromQuery, setFromQuery] = useState('');
  const [toQuery, setToQuery] = useState('');
  const [filterType, setFilterType] = useState(''); // carpool, bus or empty (all)
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Booking action state
  const [bookingSeats, setBookingSeats] = useState(1);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [bookingStatus, setBookingStatus] = useState('');

  // My bookings state
  const [bookings, setBookings] = useState([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [cancellingBookingId, setCancellingBookingId] = useState(null);
  const [bookingActionFeedback, setBookingActionFeedback] = useState(null);

  // Bus Schedules state
  const [busRoutes, setBusRoutes] = useState([]);

  // Lost & found state
  const [lostItems, setLostItems] = useState([]);
  const [newItemDesc, setNewItemDesc] = useState('');
  const [newItemContact, setNewItemContact] = useState('');
  const [lostReportType, setLostReportType] = useState('lost'); // lost | found
  const [lostCategory, setLostCategory] = useState('electronics');
  const [lostLocation, setLostLocation] = useState('');
  const [lostWarning, setLostWarning] = useState('');
  const [lostError, setLostError] = useState('');
  const [myMatches, setMyMatches] = useState([]);
  const [activeMatchModal, setActiveMatchModal] = useState(null);

  // Expense Tracker state
  const [expenses, setExpenses] = useState([]);
  const [expAmount, setExpAmount] = useState('');
  const [expCategory, setExpCategory] = useState('carpool');
  const [expDesc, setExpDesc] = useState('');

  // Notifications/SOS
  const [sosStatus, setSosStatus] = useState('');

  useEffect(() => {
    handleSearch();
    fetchBookings();
    fetchBusRoutes();
    fetchLostItems();
    fetchMyMatches();
    fetchExpenses();
  }, [token]);

  // API Call: Search Trips
  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    try {
      setSearchLoading(true);
      const url = `${API_BASE}/trips?from=${fromQuery}&to=${toQuery}&type=${filterType}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.trips || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSearchLoading(false);
    }
  };

  // API Call: Fetch My Bookings
  const fetchBookings = async () => {
    try {
      setBookingsLoading(true);
      const res = await fetch(`${API_BASE}/trips/my-bookings`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setBookings(data.bookings || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setBookingsLoading(false);
    }
  };

  // API Call: Book Trip
  const handleBookTrip = async (e) => {
    e.preventDefault();
    if (!selectedTrip) return;
    try {
      setBookingStatus('Booking...');
      const res = await fetch(`${API_BASE}/trips/book`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          tripId: selectedTrip._id,
          seatsBooked: parseInt(bookingSeats, 10)
        })
      });
      const data = await res.json();
      if (res.ok) {
        setBookingStatus('REQUEST SENT!');
        setSelectedTrip(null);
        fetchBookings();
        handleSearch(); // reload search bounds
        setTimeout(() => setBookingStatus(''), 2500);
      } else {
        setBookingStatus(`Failed: ${data.message || 'Error booking trip.'}`);
        setTimeout(() => setBookingStatus(''), 4000);
      }
    } catch (err) {
      console.error(err);
      setBookingStatus('Booking error');
      setTimeout(() => setBookingStatus(''), 3000);
    }
  };

  // API Call: Cancel Booking
  const handleCancelBooking = async (bookingId) => {
    if (!window.confirm('Are you sure you want to cancel this booking? This will release your reserved seats.')) {
      return;
    }
    try {
      setCancellingBookingId(bookingId);
      const res = await fetch(`${API_BASE}/trips/bookings/${bookingId}/cancel`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (res.ok) {
        setBookingActionFeedback({ id: bookingId, type: 'success', text: 'Booking cancelled and seats restored.' });
        fetchBookings();
        handleSearch();
      } else {
        setBookingActionFeedback({ id: bookingId, type: 'error', text: data.message || 'Failed to cancel booking.' });
      }
    } catch (err) {
      console.error(err);
      setBookingActionFeedback({ id: bookingId, type: 'error', text: 'Network error cancelling booking.' });
    } finally {
      setCancellingBookingId(null);
      setTimeout(() => setBookingActionFeedback(null), 3500);
    }
  };

  // API Call: Fetch Bus static routes
  const fetchBusRoutes = async () => {
    try {
      const res = await fetch(`${API_BASE}/trips?type=bus`);
      if (res.ok) {
        const data = await res.json();
        setBusRoutes(data.trips || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // API Call: Fetch Lost & Found Items
  const fetchLostItems = async () => {
    try {
      const res = await fetch(`${API_BASE}/utility/lost-found`);
      if (res.ok) {
        const data = await res.json();
        setLostItems(data.items || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // API Call: Fetch My Intelligent Matches
  const fetchMyMatches = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/utility/lost-found/my-matches`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMyMatches(data.itemMatches || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // API Call: Log new lost/found item
  const handleAddLostItem = async (e) => {
    e.preventDefault();
    if (!newItemDesc || !newItemContact) return;
    setLostWarning('');
    setLostError('');
    try {
      const res = await fetch(`${API_BASE}/utility/lost-found`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          itemDescription: newItemDesc,
          contactDetails: newItemContact,
          reportType: lostReportType,
          category: lostCategory,
          location: lostLocation
        })
      });
      const data = await res.json();
      if (res.ok) {
        setNewItemDesc('');
        setNewItemContact('');
        setLostLocation('');
        if (data.completenessWarning) {
          setLostWarning(data.completenessWarning);
        }
        fetchLostItems();
        fetchMyMatches();
      } else {
        setLostError(data.message || 'Error submitting report.');
      }
    } catch (err) {
      console.error(err);
      setLostError('Network error submitting report.');
    }
  };

  // API Call: Mark item as claimed/recovered
  const handleClaimItem = async (itemId) => {
    try {
      const res = await fetch(`${API_BASE}/utility/lost-found/${itemId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: 'claimed' })
      });
      if (res.ok) {
        fetchLostItems();
        fetchMyMatches();
        if (activeMatchModal && activeMatchModal.itemId === itemId) {
          setActiveMatchModal(null);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  // API Call: Check matches for a specific item
  const handleCheckMatches = async (itemId) => {
    try {
      const res = await fetch(`${API_BASE}/utility/lost-found/${itemId}/matches`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setActiveMatchModal(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // API Call: Fetch expenses
  const fetchExpenses = async () => {
    try {
      const res = await fetch(`${API_BASE}/utility/expenses`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setExpenses(data.expenses || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // API Call: Log expense
  const handleAddExpense = async (e) => {
    e.preventDefault();
    if (!expAmount) return;
    try {
      const res = await fetch(`${API_BASE}/utility/expenses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          amount: parseFloat(expAmount),
          category: expCategory,
          description: expDesc
        })
      });
      if (res.ok) {
        setExpAmount('');
        setExpDesc('');
        fetchExpenses();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Trigger Safety SOS
  const handleTriggerSOS = async () => {
    try {
      setSosStatus('Alerting...');
      const res = await fetch(`${API_BASE}/utility/sos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ currentCoords: null })
      });
      if (res.ok) {
        setSosStatus('SENT');
        setTimeout(() => setSosStatus(''), 4000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const totalExpense = expenses.reduce((acc, curr) => acc + curr.amount, 0);

  return (
    <div className="space-y-6">
      
      {/* Top Banner Dashboard */}
      <div className="glass-panel p-6 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center shadow-lg border border-slate-800/80">
        <div>
          <h2 className="text-xl font-extrabold text-white">Hello, {user ? user.name : 'Passenger'}</h2>
          <p className="text-xs text-slate-400 mt-1">Book local carpools, check bus routes, and manage transit logs across Jammu.</p>
        </div>
        <div className="mt-4 md:mt-0 flex items-center space-x-3">
          <button 
            onClick={handleTriggerSOS}
            className="bg-accent-rose hover:bg-red-600 text-white font-bold text-xs px-4 py-2 rounded-xl transition shadow-[0_4px_15px_rgba(244,63,94,0.3)] flex items-center space-x-2"
          >
            <ShieldAlert className="h-4 w-4" />
            <span>{sosStatus || 'Trigger Global SOS'}</span>
          </button>
        </div>
      </div>

      {/* Tab Selectors */}
      <div className="flex border-b border-slate-800 space-x-6 text-sm font-semibold">
        <button 
          onClick={() => setActiveTab('search')}
          className={`pb-3 transition ${activeTab === 'search' ? 'border-b-2 border-brand-500 text-white' : 'text-slate-400 hover:text-white'}`}
        >
          🗺️ Find Rides
        </button>
        <button 
          onClick={() => setActiveTab('bookings')}
          className={`pb-3 transition ${activeTab === 'bookings' ? 'border-b-2 border-brand-500 text-white' : 'text-slate-400 hover:text-white'}`}
        >
          🎫 My Bookings
        </button>
        <button 
          onClick={() => setActiveTab('buses')}
          className={`pb-3 transition ${activeTab === 'buses' ? 'border-b-2 border-brand-500 text-white' : 'text-slate-400 hover:text-white'}`}
        >
          🚌 Bus Schedules
        </button>
        <button 
          onClick={() => setActiveTab('lost')}
          className={`pb-3 transition ${activeTab === 'lost' ? 'border-b-2 border-brand-500 text-white' : 'text-slate-400 hover:text-white'}`}
        >
          🎒 Lost & Found
        </button>
        <button 
          onClick={() => setActiveTab('expenses')}
          className={`pb-3 transition ${activeTab === 'expenses' ? 'border-b-2 border-brand-500 text-white' : 'text-slate-400 hover:text-white'}`}
        >
          📊 Expense Tracker
        </button>
      </div>

      {/* Tab Contents */}
      <div className="mt-4">
        
        {/* Tab 1: Find Rides */}
        {activeTab === 'search' && (
          <div className="space-y-6">
            
            {/* Search Input Bar */}
            <form onSubmit={handleSearch} className="glass-panel p-5 rounded-2xl grid grid-cols-1 md:grid-cols-4 gap-3 items-end border border-slate-800/80 shadow-md">
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-400 flex items-center">
                  <MapPin className="h-3 w-3 text-brand-500 mr-1" /> From
                </label>
                <input
                  type="text"
                  placeholder="Pickup (e.g. Janipur)"
                  value={fromQuery}
                  onChange={(e) => setFromQuery(e.target.value)}
                  className="w-full glass-input px-3 py-2.5 rounded-lg text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-400 flex items-center">
                  <MapPin className="h-3 w-3 text-accent-rose mr-1" /> To
                </label>
                <input
                  type="text"
                  placeholder="Destination (e.g. Gandhi Nagar)"
                  value={toQuery}
                  onChange={(e) => setToQuery(e.target.value)}
                  className="w-full glass-input px-3 py-2.5 rounded-lg text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-400">Ride Type</label>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="w-full glass-input px-3 py-2.5 rounded-lg text-xs"
                >
                  <option value="" className="bg-brand-900 text-white">All Options</option>
                  <option value="carpool" className="bg-brand-900 text-white">Carpool Sharing</option>
                  <option value="bus" className="bg-brand-900 text-white">Public Buses</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={searchLoading}
                className="bg-brand-500 hover:bg-brand-600 text-white py-2.5 rounded-lg font-bold text-xs flex items-center justify-center space-x-1.5 transition"
              >
                <Search className="h-4 w-4" />
                <span>{searchLoading ? 'Searching...' : 'Find Matches'}</span>
              </button>
            </form>

            {/* Results Grid */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-slate-300">Available Transit Opportunities</h3>
              {searchResults.length === 0 ? (
                <div className="glass-card p-8 rounded-xl text-center text-slate-500 text-xs">
                  No matching active rides found. Try looking up Janipur or Jammu University.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {searchResults.map((trip) => (
                    <div key={trip._id} className="glass-panel p-5 rounded-2xl border border-slate-800 shadow-md flex flex-col justify-between space-y-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                            trip.type === 'bus' 
                              ? 'bg-accent-teal/15 text-accent-teal' 
                              : 'bg-brand-500/15 text-brand-400'
                          }`}>
                            {trip.type === 'bus' ? '🚌 Public Bus' : '🚗 Carpool'}
                          </span>
                          <h4 className="font-extrabold text-sm text-slate-100 mt-2">{trip.routeName}</h4>
                          <p className="text-[10px] text-slate-400 mt-1 flex items-center">
                            <Clock className="h-3 w-3 text-slate-500 mr-1" />
                            Departure: {new Date(trip.departureTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="text-base font-black text-white">₹{trip.price}</span>
                          <span className="text-[9px] text-slate-500 block uppercase font-bold">per seat</span>
                        </div>
                      </div>

                      {/* Stops */}
                      <div className="bg-brand-900/50 p-2.5 rounded-xl border border-slate-800/80 text-[10px] text-slate-400">
                        <span className="font-bold text-slate-300">Via stops:</span> {trip.stops.join(', ') || 'Direct Route'}
                      </div>

                      {/* Driver & Action */}
                      <div className="flex items-center justify-between border-t border-slate-850 pt-3">
                        <div className="flex items-center space-x-2 text-xs">
                          <div className="h-7 w-7 bg-brand-500/20 text-brand-300 font-bold text-xs rounded-full flex items-center justify-center border border-brand-500/30">
                            {trip.driverName.charAt(0)}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-200">{trip.driverName}</div>
                            <div className="text-[9px] text-accent-amber">⭐ {trip.driverRating}</div>
                          </div>
                        </div>

                        {/* Booking panel toggle or action */}
                        {selectedTrip && selectedTrip._id === trip._id ? (
                          <form onSubmit={handleBookTrip} className="flex items-center space-x-2">
                            <input
                              type="number"
                              min="1"
                              max={trip.availableSeats}
                              value={bookingSeats}
                              onChange={(e) => setBookingSeats(e.target.value)}
                              className="w-12 glass-input px-2 py-1 rounded text-center text-xs"
                              required
                            />
                            <button 
                              type="submit" 
                              className="bg-accent-emerald hover:bg-emerald-600 text-white font-bold text-[10px] px-3 py-1.5 rounded-lg transition"
                            >
                              {bookingStatus || 'Confirm'}
                            </button>
                            <button 
                              type="button" 
                              onClick={() => setSelectedTrip(null)}
                              className="text-slate-500 hover:text-white text-[10px]"
                            >
                              Cancel
                            </button>
                          </form>
                        ) : (
                          <button
                            onClick={() => { setSelectedTrip(trip); setBookingSeats(1); }}
                            disabled={trip.availableSeats === 0}
                            className="bg-brand-500 hover:bg-brand-600 text-white font-bold text-xs px-3.5 py-1.5 rounded-xl shadow transition disabled:opacity-40"
                          >
                            {trip.availableSeats === 0 ? 'Full' : `Book Ride (${trip.availableSeats} Left)`}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}

        {/* Tab 2: My Bookings */}
        {activeTab === 'bookings' && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-300">Your Booking Ledger</h3>
            {bookingsLoading ? (
              <div className="text-slate-500 text-xs">Fetching bookings...</div>
            ) : bookings.length === 0 ? (
              <div className="glass-card p-8 rounded-xl text-center text-slate-500 text-xs">
                You haven't booked any rides yet. Head to the Find Rides tab to search!
              </div>
            ) : (
              <div className="space-y-3">
                {bookings.map((booking) => (
                  <div key={booking._id} className="glass-panel p-5 rounded-2xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        {/* Booking Status Badge */}
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                          booking.status === 'pending'
                            ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                            : booking.status === 'confirmed'
                            ? 'bg-accent-emerald/15 text-accent-emerald border border-accent-emerald/30'
                            : booking.status === 'cancelled'
                            ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                            : 'bg-slate-800 text-slate-400'
                        }`}>
                          {booking.status === 'pending' ? '⏳ Request Pending' : booking.status || 'Confirmed'}
                        </span>

                        {/* Trip Status Badge */}
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                          booking.tripDetails.status === 'active' 
                            ? 'bg-accent-teal/15 text-accent-teal animate-pulse' 
                            : booking.tripDetails.status === 'completed'
                            ? 'bg-accent-emerald/15 text-accent-emerald'
                            : 'bg-slate-800 text-slate-400'
                        }`}>
                          Trip: {booking.tripDetails.status}
                        </span>

                        <span className="text-[10px] text-slate-400">Seats Booked: {booking.seatsBooked}</span>
                      </div>
                      <h4 className="font-extrabold text-sm text-slate-100">{booking.tripDetails.routeName}</h4>
                      <div className="text-[10px] text-slate-400 mt-1 flex flex-wrap gap-x-4">
                        <span>Vehicle: {booking.tripDetails.vehicleModel || 'Shared Transit'}</span>
                        <span>Plate: {booking.tripDetails.plateNumber || 'JK02-XXXX'}</span>
                        <span>Driver Contact: {booking.tripDetails.phone || 'System'}</span>
                      </div>

                      {/* Action Feedback Banner */}
                      {bookingActionFeedback && bookingActionFeedback.id === booking._id && (
                        <div className={`mt-2 text-[10px] font-bold px-2 py-1 rounded ${
                          bookingActionFeedback.type === 'success' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                        }`}>
                          {bookingActionFeedback.text}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between md:justify-end gap-3 border-t md:border-t-0 border-slate-850 pt-3 md:pt-0">
                      <div className="text-left md:text-right mr-2">
                        <span className="text-xs text-slate-400 font-medium">Charged Amount</span>
                        <div className="text-base font-black text-white">₹{booking.totalPrice}</div>
                      </div>

                      {/* Cancel Booking Action */}
                      {(booking.status === 'pending' || booking.status === 'confirmed') && booking.tripDetails.status !== 'completed' && booking.tripDetails.status !== 'cancelled' && (
                        <button
                          onClick={() => handleCancelBooking(booking._id)}
                          disabled={cancellingBookingId === booking._id}
                          className="bg-slate-800 hover:bg-rose-950/40 text-slate-300 hover:text-rose-400 border border-slate-700 hover:border-rose-500/40 font-bold text-xs px-3 py-2 rounded-xl transition disabled:opacity-50"
                        >
                          {cancellingBookingId === booking._id ? 'Cancelling...' : 'Cancel Booking'}
                        </button>
                      )}
                      
                      {/* Track Route Link */}
                      {(booking.tripDetails.status === 'active' || booking.tripDetails.status === 'scheduled') && booking.status !== 'cancelled' && (
                        <button
                          onClick={() => navigate(`/track/${booking.tripId}`)}
                          className="bg-brand-500 hover:bg-brand-600 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-md transition flex items-center space-x-1"
                        >
                          <span>Track Vehicle</span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Bus Schedules */}
        {activeTab === 'buses' && (
          <div className="space-y-4">
            <div className="glass-panel p-5 rounded-2xl border border-slate-800/80">
              <h3 className="font-extrabold text-sm text-white mb-2 flex items-center">
                <Bus className="h-4 w-4 text-brand-500 mr-2" /> Local E-Bus Schedules
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed mb-4">
                Jammu Smart Transit operates high-frequency electric bus lines on core routes. Fares are locked at ₹15-₹25 depending on stops. Tickets can be booked here or scanned at boarding.
              </p>
              
              <div className="space-y-3">
                {busRoutes.length === 0 ? (
                  <div className="text-slate-500 text-xs italic">Loading bus routes...</div>
                ) : (
                  busRoutes.map((bus, idx) => (
                    <div key={idx} className="bg-brand-900/50 p-4 rounded-xl border border-slate-800 text-xs flex justify-between items-center">
                      <div>
                        <span className="bg-brand-500/10 text-brand-400 font-bold px-2 py-0.5 rounded text-[10px] uppercase">Route {idx === 0 ? '1A' : '4'}</span>
                        <h4 className="font-bold text-slate-200 mt-2">{bus.routeName}</h4>
                        <p className="text-slate-400 text-[10px] mt-1">Stops: {bus.stops.join(' ➔ ')}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-slate-300 font-semibold block">Fare: ₹{bus.price}</span>
                        <button 
                          onClick={() => { setActiveTab('search'); setFilterType('bus'); handleSearch(); }}
                          className="mt-2 text-brand-400 hover:text-brand-300 font-bold text-[10px] hover:underline block"
                        >
                          Book Ticket
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Lost & Found */}
        {activeTab === 'lost' && (
          <div className="space-y-6">
            
            {/* Intelligent Match Radar: Top Alert if Matches Found */}
            {myMatches && myMatches.length > 0 && (
              <div className="glass-panel p-5 rounded-2xl border border-accent-emerald/40 bg-gradient-to-r from-emerald-950/30 via-brand-900/40 to-brand-850 shadow-lg">
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <div className="flex items-center space-x-2">
                    <Sparkles className="h-5 w-5 text-accent-emerald animate-pulse" />
                    <h3 className="font-extrabold text-sm text-white">
                      Intelligent Match Radar ({myMatches.length} item(s) matched)
                    </h3>
                  </div>
                  <span className="text-[10px] bg-accent-emerald/15 text-accent-emerald border border-accent-emerald/30 px-2 py-0.5 rounded-full font-bold">
                    Multi-signal AI Detection
                  </span>
                </div>
                <p className="text-xs text-slate-300 mb-4">
                  The similarity engine has detected complementary lost and found reports matching your registered items. Private contacts are masked for commuter safety.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {myMatches.map((mItem, idx) => (
                    <div key={idx} className="bg-brand-900/70 p-4 rounded-xl border border-slate-800 text-xs space-y-2.5">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-[10px] text-slate-400 uppercase font-bold">Your Reported Item:</span>
                          <p className="font-bold text-white text-xs mt-0.5 line-clamp-1">{mItem.item.itemDescription}</p>
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-accent-emerald/20 text-accent-emerald border border-accent-emerald/30">
                          {mItem.topMatch.matchScore}% Match
                        </span>
                      </div>

                      {/* Matched Candidate Details */}
                      <div className="bg-brand-850 p-3 rounded-lg border border-slate-800/90 space-y-1.5">
                        <div className="flex justify-between items-center text-[10px]">
                          <span className="text-accent-teal font-bold uppercase">{mItem.topMatch.reportType} Candidate</span>
                          <span className="text-slate-400">{mItem.topMatch.location}</span>
                        </div>
                        <p className="text-slate-200 font-semibold text-xs leading-relaxed">"{mItem.topMatch.itemDescription}"</p>
                        
                        {/* Signal tags */}
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {mItem.topMatch.matchSignals.map((sig, sIdx) => (
                            <span key={sIdx} className="text-[9px] bg-brand-900 px-2 py-0.5 rounded text-slate-300 border border-slate-700/60">
                              ✓ {sig.detail}
                            </span>
                          ))}
                        </div>

                        {/* Masked contact & safe workflow */}
                        <div className="pt-2 border-t border-slate-800 flex justify-between items-center flex-wrap gap-2 text-[10px]">
                          <span className="text-slate-400">Finder: <strong className="text-slate-300">{mItem.topMatch.maskedContact}</strong></span>
                          <button
                            onClick={() => handleClaimItem(mItem.item._id)}
                            className="bg-accent-emerald hover:bg-emerald-600 text-white font-bold px-2.5 py-1 rounded text-[10px] transition flex items-center space-x-1"
                          >
                            <CheckCircle2 className="h-3 w-3" />
                            <span>Mark Recovered</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Form to submit */}
              <div className="glass-panel p-5 rounded-2xl border border-slate-800/85 h-fit space-y-4">
                <div>
                  <h3 className="font-bold text-xs uppercase tracking-wider text-brand-400">Report Forgotten or Found Item</h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">Automated similarity matching analyzes keywords, routes, and timing.</p>
                </div>

                <form onSubmit={handleAddLostItem} className="space-y-3.5">
                  {/* Type Toggle */}
                  <div className="grid grid-cols-2 gap-1.5 bg-brand-900/80 p-1 rounded-xl border border-slate-800">
                    <button
                      type="button"
                      onClick={() => setLostReportType('lost')}
                      className={`py-1.5 rounded-lg text-xs font-bold transition ${
                        lostReportType === 'lost' 
                          ? 'bg-accent-amber/20 text-accent-amber border border-accent-amber/30' 
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      I Lost an Item
                    </button>
                    <button
                      type="button"
                      onClick={() => setLostReportType('found')}
                      className={`py-1.5 rounded-lg text-xs font-bold transition ${
                        lostReportType === 'found' 
                          ? 'bg-accent-teal/20 text-accent-teal border border-accent-teal/30' 
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      I Found an Item
                    </button>
                  </div>

                  {/* Category & Location */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-slate-300 block">Category</label>
                      <select
                        value={lostCategory}
                        onChange={(e) => setLostCategory(e.target.value)}
                        className="w-full glass-input px-2.5 py-2 rounded-lg text-xs"
                      >
                        <option value="electronics" className="bg-brand-900 text-white">Electronics</option>
                        <option value="documents" className="bg-brand-900 text-white">Documents & ID</option>
                        <option value="bags" className="bg-brand-900 text-white">Bags & Wallets</option>
                        <option value="keys" className="bg-brand-900 text-white">Keys</option>
                        <option value="clothing" className="bg-brand-900 text-white">Clothing & Gear</option>
                        <option value="other" className="bg-brand-900 text-white">Other</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-slate-300 block">Transit Route / Location</label>
                      <input
                        type="text"
                        placeholder="e.g. Route 1A Bus, Jewel"
                        value={lostLocation}
                        onChange={(e) => setLostLocation(e.target.value)}
                        className="w-full glass-input px-2.5 py-2 rounded-lg text-xs"
                      />
                    </div>
                  </div>

                  {/* Description */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-slate-300 block">Item Description & Marks</label>
                    <textarea
                      placeholder="E.g. Black Lenovo 65W Laptop USB-C Charger with thick power cable, forgotten near rear window seat"
                      value={newItemDesc}
                      onChange={(e) => setNewItemDesc(e.target.value)}
                      className="w-full glass-input px-3 py-2 rounded-lg text-xs h-20 resize-none"
                      required
                    />
                  </div>

                  {/* Contact Info */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-slate-300 block">Your Contact Details</label>
                    <input
                      type="text"
                      placeholder="Name - Phone Number (stored securely)"
                      value={newItemContact}
                      onChange={(e) => setNewItemContact(e.target.value)}
                      className="w-full glass-input px-3 py-2 rounded-lg text-xs"
                      required
                    />
                  </div>

                  {/* Warning / Error notices */}
                  {lostWarning && (
                    <div className="p-2.5 bg-accent-amber/10 border border-accent-amber/25 rounded-lg text-accent-amber text-[10px] flex items-start space-x-1.5">
                      <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                      <span>{lostWarning}</span>
                    </div>
                  )}

                  {lostError && (
                    <div className="p-2.5 bg-accent-rose/10 border border-accent-rose/25 rounded-lg text-accent-rose text-[10px] flex items-start space-x-1.5">
                      <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                      <span>{lostError}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    className="w-full bg-brand-500 hover:bg-brand-600 text-white font-bold py-2 rounded-lg text-xs transition shadow-md"
                  >
                    Submit Report & Run Matcher
                  </button>
                </form>
              </div>

              {/* Registry of Items */}
              <div className="lg:col-span-2 glass-panel p-5 rounded-2xl border border-slate-800 space-y-3">
                <div className="flex justify-between items-center">
                  <h3 className="font-bold text-xs uppercase tracking-wider text-brand-400">Registry of Reported Items</h3>
                  <span className="text-[10px] text-slate-500">{lostItems.length} total report(s)</span>
                </div>

                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                  {lostItems.length === 0 ? (
                    <div className="text-slate-500 text-xs text-center py-10">No items currently reported in registry.</div>
                  ) : (
                    lostItems.map((item) => {
                      const isOwner = user && item.reporterId && (item.reporterId.toString() === user._id.toString());
                      return (
                        <div key={item._id} className="bg-brand-900/40 p-4 rounded-xl border border-slate-800/80 text-xs space-y-2">
                          <div className="flex justify-between items-start flex-wrap gap-2">
                            <div className="flex items-center space-x-2">
                              <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase ${
                                (item.reportType || (item.status === 'found' ? 'found' : 'lost')) === 'found'
                                  ? 'bg-accent-teal/15 text-accent-teal border border-accent-teal/30'
                                  : 'bg-accent-amber/15 text-accent-amber border border-accent-amber/30'
                              }`}>
                                {item.reportType || (item.status === 'found' ? 'FOUND' : 'LOST')}
                              </span>
                              <span className="px-2 py-0.5 rounded text-[9px] bg-slate-800 text-slate-300 border border-slate-700 capitalize">
                                {item.category || 'Item'}
                              </span>
                              <span className="text-[10px] text-slate-500">{new Date(item.createdAt).toLocaleDateString()}</span>
                            </div>

                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                              item.status === 'claimed' 
                                ? 'bg-accent-emerald/20 text-accent-emerald' 
                                : item.status === 'found' 
                                ? 'bg-accent-teal/15 text-accent-teal' 
                                : 'bg-slate-700 text-slate-300'
                            }`}>
                              {item.status.toUpperCase()}
                            </span>
                          </div>

                          <p className="font-semibold text-slate-200 mt-1 leading-relaxed">{item.itemDescription}</p>
                          
                          <div className="flex justify-between items-center text-[10px] text-slate-400 pt-1.5 border-t border-slate-800/60 flex-wrap gap-2">
                            <span>Corridor / Transit: <strong className="text-slate-300">{item.location || item.tripId || 'Jammu Area'}</strong></span>
                            
                            <div className="flex items-center space-x-2">
                              {/* Ownership actions */}
                              {isOwner && item.status !== 'claimed' && (
                                <>
                                  <button
                                    onClick={() => handleCheckMatches(item._id)}
                                    className="bg-brand-500/15 hover:bg-brand-500/25 text-brand-300 border border-brand-500/30 px-2 py-0.5 rounded text-[10px] font-semibold transition"
                                  >
                                    Check Matches
                                  </button>
                                  <button
                                    onClick={() => handleClaimItem(item._id)}
                                    className="bg-accent-emerald/15 hover:bg-accent-emerald/25 text-accent-emerald border border-accent-emerald/30 px-2 py-0.5 rounded text-[10px] font-semibold transition"
                                  >
                                    Mark Claimed
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Candidate Match Inspector Modal */}
            {activeMatchModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
                <div className="glass-panel p-6 rounded-2xl border border-slate-700 max-w-lg w-full max-h-[85vh] overflow-y-auto space-y-4 shadow-2xl">
                  <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                    <div>
                      <h4 className="font-extrabold text-sm text-white flex items-center space-x-2">
                        <Sparkles className="h-4 w-4 text-accent-emerald" />
                        <span>Intelligent Candidate Matches</span>
                      </h4>
                      <p className="text-[10px] text-slate-400 mt-0.5">Found {activeMatchModal.matchesCount} complementary report(s)</p>
                    </div>
                    <button 
                      onClick={() => setActiveMatchModal(null)} 
                      className="text-slate-400 hover:text-white p-1 rounded-lg"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="bg-brand-900/60 p-3 rounded-xl border border-slate-800 text-xs">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Your Target Report</span>
                    <p className="font-bold text-slate-200 mt-1">{activeMatchModal.itemDescription}</p>
                  </div>

                  {activeMatchModal.matches.length === 0 ? (
                    <div className="p-6 text-center text-slate-500 text-xs italic">
                      No complementary reports currently exceed the 35% similarity threshold. As new reports are filed, matches will appear automatically.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {activeMatchModal.matches.map((m, idx) => (
                        <div key={idx} className="bg-brand-850 p-4 rounded-xl border border-slate-700/80 space-y-2 text-xs">
                          <div className="flex justify-between items-center">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-accent-emerald/20 text-accent-emerald border border-accent-emerald/40">
                              {m.matchScore}% Match ({m.confidenceLevel})
                            </span>
                            <span className="text-[10px] text-slate-400">{m.location}</span>
                          </div>

                          <p className="text-slate-200 font-semibold">{m.itemDescription}</p>

                          <div className="space-y-1 pt-1 border-t border-slate-800/80">
                            <span className="text-[10px] font-bold text-slate-400">Match Signals:</span>
                            {m.matchSignals.map((sig, sIdx) => (
                              <div key={sIdx} className="text-[10px] text-slate-300 flex items-center space-x-1.5">
                                <span className="text-accent-teal">✓</span>
                                <span>{sig.detail}</span>
                              </div>
                            ))}
                          </div>

                          <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-[10px] text-slate-400">
                            <span>Masked Contact: <strong className="text-slate-200">{m.maskedContact}</strong></span>
                            <button
                              onClick={() => handleClaimItem(activeMatchModal.itemId)}
                              className="bg-accent-emerald hover:bg-emerald-600 text-white font-bold px-2 py-1 rounded text-[10px] transition"
                            >
                              Confirm Claimed
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>
        )}

        {/* Tab 5: Expense Tracker */}
        {activeTab === 'expenses' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Form */}
            <div className="glass-panel p-5 rounded-2xl border border-slate-800 h-fit">
              <h3 className="font-bold text-xs uppercase tracking-wider text-brand-400 mb-4">Log Travel Cost</h3>
              <form onSubmit={handleAddExpense} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-slate-300 block">Amount (₹)</label>
                  <input
                    type="number"
                    placeholder="e.g. 80"
                    value={expAmount}
                    onChange={(e) => setExpAmount(e.target.value)}
                    className="w-full glass-input px-3 py-2 rounded-lg text-xs"
                    required
                  />
                </div>
                
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-slate-300 block">Category</label>
                  <select
                    value={expCategory}
                    onChange={(e) => setExpCategory(e.target.value)}
                    className="w-full glass-input px-3 py-2 rounded-lg text-xs"
                  >
                    <option value="carpool" className="bg-brand-900 text-white">Carpool Share</option>
                    <option value="bus" className="bg-brand-900 text-white">Bus Ticket</option>
                    <option value="auto" className="bg-brand-900 text-white">Auto Rickshaw</option>
                    <option value="other" className="bg-brand-900 text-white">Other</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-slate-300 block">Notes / Route</label>
                  <input
                    type="text"
                    placeholder="e.g. Raman swift ride from Janipur"
                    value={expDesc}
                    onChange={(e) => setExpDesc(e.target.value)}
                    className="w-full glass-input px-3 py-2 rounded-lg text-xs"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-brand-500 hover:bg-brand-600 text-white font-bold py-2 rounded-lg text-xs transition"
                >
                  Save Log
                </button>
              </form>
            </div>

            {/* List & Summaries */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Summary card */}
              <div className="bg-brand-500/10 border border-brand-500/25 p-5 rounded-2xl flex items-center justify-between">
                <div>
                  <h4 className="text-slate-400 font-semibold text-xs uppercase tracking-wide">Total Travel Spending</h4>
                  <div className="text-2xl font-black text-white mt-1">₹{totalExpense}</div>
                </div>
                <div className="p-3 bg-brand-500 text-white rounded-2xl shadow-lg shadow-brand-500/20">
                  <CreditCard className="h-6 w-6" />
                </div>
              </div>

              {/* Ledger list */}
              <div className="glass-panel p-5 rounded-2xl border border-slate-800">
                <h3 className="font-bold text-xs uppercase tracking-wider text-brand-400 mb-4">Commute Spendings Ledger</h3>
                <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
                  {expenses.length === 0 ? (
                    <div className="text-slate-500 text-xs text-center py-10">No expenses logged.</div>
                  ) : (
                    expenses.map((exp) => (
                      <div key={exp._id} className="bg-brand-900/50 p-3 rounded-xl border border-slate-800/80 text-xs flex justify-between items-center">
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-semibold text-slate-200 capitalize">{exp.category}</span>
                            <span className="text-[9px] text-slate-500">{new Date(exp.date).toLocaleDateString()}</span>
                          </div>
                          <p className="text-[10px] text-slate-400 mt-0.5">{exp.description || 'No description'}</p>
                        </div>
                        <span className="font-black text-slate-200 text-sm">₹{exp.amount}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>

          </div>
        )}

      </div>
    </div>
  );
};

export default PassengerDashboard;
