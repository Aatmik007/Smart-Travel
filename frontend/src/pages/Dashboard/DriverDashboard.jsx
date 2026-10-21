import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { PlusCircle, Car, AlertTriangle, ShieldCheck, Play, StopCircle, Compass, Users, ChevronDown, ChevronUp, Check, X } from 'lucide-react';
import { API_BASE } from '../../utils/apiClient';

const DriverDashboard = () => {
  const { token, user, driverDetails, vehicleDetails } = useAuth();
  const navigate = useNavigate();

  // Create trip form state
  const [startName, setStartName] = useState('Janipur');
  const [endName, setEndName] = useState('Gandhi Nagar');
  const [price, setPrice] = useState('80');
  const [availableSeats, setAvailableSeats] = useState('3');
  const [departureTime, setDepartureTime] = useState('');
  const [stopsText, setStopsText] = useState('Jewel Chowk');

  const [trips, setTrips] = useState([]);
  const [tripsLoading, setTripsLoading] = useState(false);
  const [submitStatus, setSubmitStatus] = useState('');

  // Passenger manifest & request states
  const [expandedTripId, setExpandedTripId] = useState(null);
  const [manifestMap, setManifestMap] = useState({});
  const [loadingManifestId, setLoadingManifestId] = useState(null);
  const [respondingBookingId, setRespondingBookingId] = useState(null);
  const [manifestFeedback, setManifestFeedback] = useState(null);

  const jammuLocations = {
    'Janipur': { lat: 32.7533, lng: 74.8461 },
    'Jewel Chowk': { lat: 32.7291, lng: 74.8617 },
    'Gandhi Nagar': { lat: 32.7096, lng: 74.8732 },
    'Jammu University': { lat: 32.7163, lng: 74.8647 },
    'Jammu Tawi Railway Station': { lat: 32.7056, lng: 74.8794 },
    'Channi Himmat': { lat: 32.6953, lng: 74.8967 },
    'Satwari Chowk (Airport)': { lat: 32.6888, lng: 74.8622 },
    'Talab Tillo': { lat: 32.7275, lng: 74.8317 },
    'Panjtirthi': { lat: 32.7431, lng: 74.8719 },
    'Parade Ground': { lat: 32.7358, lng: 74.8672 }
  };

  useEffect(() => {
    if (token && driverDetails && driverDetails.isApproved) {
      fetchMyTrips();
    }
  }, [token, driverDetails]);

  // Set default datetime to tomorrow
  useEffect(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    // Format to local ISO-like for input datetime-local
    const pad = (n) => n.toString().padStart(2, '0');
    const localDateTime = `${tomorrow.getFullYear()}-${pad(tomorrow.getMonth()+1)}-${pad(tomorrow.getDate())}T${pad(tomorrow.getHours())}:${pad(tomorrow.getMinutes())}`;
    setDepartureTime(localDateTime);
  }, []);

  const fetchMyTrips = async () => {
    try {
      setTripsLoading(true);
      const res = await fetch(`${API_BASE}/trips/my-trips`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setTrips(data.trips || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setTripsLoading(false);
    }
  };

  const handlePublishRide = async (e) => {
    e.preventDefault();
    if (!departureTime) return;

    setSubmitStatus('Publishing...');

    const startLoc = {
      name: startName,
      ...jammuLocations[startName]
    };

    const endLoc = {
      name: endName,
      ...jammuLocations[endName]
    };

    const stops = stopsText.split(',').map(s => s.trim()).filter(s => s.length > 0);

    try {
      const res = await fetch(`${API_BASE}/trips`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          startLocation: startLoc,
          endLocation: endLoc,
          price: parseFloat(price),
          departureTime: new Date(departureTime).toISOString(),
          availableSeats: parseInt(availableSeats),
          stops,
          type: 'carpool'
        })
      });

      const data = await res.json();

      if (res.ok) {
        setSubmitStatus('RIDE PUBLISHED!');
        setStopsText('');
        fetchMyTrips();
        setTimeout(() => setSubmitStatus(''), 2500);
      } else {
        setSubmitStatus(`Error: ${data.message}`);
      }
    } catch (err) {
      console.error(err);
      setSubmitStatus('Publication failed.');
    }
  };

  const updateTripStatus = async (tripId, status) => {
    try {
      const res = await fetch(`${API_BASE}/trips/${tripId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        fetchMyTrips();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchTripBookings = async (tripId) => {
    try {
      setLoadingManifestId(tripId);
      const res = await fetch(`${API_BASE}/trips/${tripId}/bookings`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setManifestMap(prev => ({ ...prev, [tripId]: data.bookings || [] }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingManifestId(null);
    }
  };

  const toggleTripManifest = (tripId) => {
    if (expandedTripId === tripId) {
      setExpandedTripId(null);
    } else {
      setExpandedTripId(tripId);
      fetchTripBookings(tripId);
    }
  };

  const handleBookingResponse = async (tripId, bookingId, action) => {
    try {
      setRespondingBookingId(bookingId);
      const res = await fetch(`${API_BASE}/trips/bookings/${bookingId}/respond`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ action })
      });
      const data = await res.json();
      if (res.ok) {
        setManifestFeedback({
          tripId,
          bookingId,
          type: 'success',
          text: action === 'accept' ? 'Booking Accepted!' : 'Booking Rejected.'
        });
        fetchTripBookings(tripId);
        fetchMyTrips();
      } else {
        setManifestFeedback({
          tripId,
          bookingId,
          type: 'error',
          text: data.message || 'Action failed.'
        });
      }
    } catch (err) {
      console.error(err);
      setManifestFeedback({
        tripId,
        bookingId,
        type: 'error',
        text: 'Network error responding to booking.'
      });
    } finally {
      setRespondingBookingId(null);
      setTimeout(() => setManifestFeedback(null), 3500);
    }
  };

  // Check Approval state
  const isApproved = driverDetails && driverDetails.isApproved;

  if (!isApproved) {
    return (
      <div className="max-w-xl mx-auto py-10 md:py-20 text-center">
        <div className="glass-panel p-8 rounded-2xl border border-slate-800 shadow-2xl relative">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-amber-500/10 text-amber-500 p-4 rounded-full border border-amber-500/20">
            <AlertTriangle className="h-10 w-10 animate-pulse" />
          </div>
          <h2 className="text-xl font-extrabold text-white mt-6">Driver Profile Pending Approval</h2>
          <p className="text-xs text-slate-400 mt-3 leading-relaxed">
            Welcome to the JammuMove Partner Program, <span className="text-slate-200 font-bold">{user ? user.name : 'Partner'}</span>. 
            Your submitted license details are currently undergoing verification.
          </p>
          <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800 text-left mt-6 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">License Number:</span>
              <span className="text-slate-300 font-semibold">{driverDetails ? driverDetails.licenseNumber : 'Loading...'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Vehicle Model:</span>
              <span className="text-slate-300 font-semibold">{vehicleDetails ? `${vehicleDetails.model} (${vehicleDetails.plateNumber})` : 'Loading...'}</span>
            </div>
          </div>
          <p className="text-[10px] text-amber-400/80 bg-amber-400/5 py-2 px-4 rounded-lg mt-6 border border-amber-400/10">
            Tip: You can log in to the Admin Dashboard (admin@jammumove.com) to instantly approve this driver!
          </p>
        </div>
      </div>
    );
  }

  // Calculate earnings
  const completedTrips = trips.filter(t => t.status === 'completed');
  const estimatedEarnings = completedTrips.length * 240; // mock estimate

  return (
    <div className="space-y-6">
      
      {/* Top Header Card */}
      <div className="glass-panel p-6 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center shadow-lg border border-slate-800/80">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-xl font-extrabold text-white">Driver Workspace: {user ? user.name : 'Driver'}</h2>
            <span className="bg-accent-emerald/10 text-accent-emerald text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center space-x-1 border border-accent-emerald/20">
              <ShieldCheck className="h-3 w-3" />
              <span>VERIFIED</span>
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">Publish new carpool legs and coordinate boarding passengers.</p>
        </div>
        
        {/* Earnings Stats Widget */}
        <div className="mt-4 md:mt-0 bg-brand-900/40 border border-slate-800 p-4 rounded-xl flex items-center space-x-4 text-xs">
          <div className="text-left">
            <span className="text-slate-500 block uppercase font-bold text-[9px]">Mock Earnings</span>
            <span className="text-sm font-black text-white">₹{estimatedEarnings}</span>
          </div>
          <div className="h-8 w-px bg-slate-800"></div>
          <div className="text-left">
            <span className="text-slate-500 block uppercase font-bold text-[9px]">Rides Done</span>
            <span className="text-sm font-black text-white">{completedTrips.length}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Publish Carpool Form */}
        <div className="glass-panel p-6 rounded-2xl border border-slate-800/80 shadow-md">
          <h3 className="font-bold text-xs uppercase tracking-wider text-brand-400 mb-4 flex items-center">
            <PlusCircle className="h-4 w-4 mr-2" /> Offer Carpool Route
          </h3>
          
          <form onSubmit={handlePublishRide} className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-slate-300 block">From Location (Jammu)</label>
              <select
                value={startName}
                onChange={(e) => setStartName(e.target.value)}
                className="w-full glass-input px-3 py-2.5 rounded-lg text-xs"
              >
                {Object.keys(jammuLocations).map(name => (
                  <option key={name} value={name} className="bg-brand-900 text-white">{name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-slate-300 block">To Location (Jammu)</label>
              <select
                value={endName}
                onChange={(e) => setEndName(e.target.value)}
                className="w-full glass-input px-3 py-2.5 rounded-lg text-xs"
              >
                {Object.keys(jammuLocations).map(name => (
                  <option key={name} value={name} className="bg-brand-900 text-white">{name}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-slate-300 block">Price (₹ per seat)</label>
                <input
                  type="number"
                  placeholder="80"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="w-full glass-input px-3 py-2.5 rounded-lg text-xs"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-slate-300 block">Available Seats</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={availableSeats}
                  onChange={(e) => setAvailableSeats(e.target.value)}
                  className="w-full glass-input px-3 py-2.5 rounded-lg text-xs"
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-slate-300 block">Departure Date & Time</label>
              <input
                type="datetime-local"
                value={departureTime}
                onChange={(e) => setDepartureTime(e.target.value)}
                className="w-full glass-input px-3 py-2.5 rounded-lg text-xs"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-slate-300 block">Intermediate Stops (Comma separated)</label>
              <input
                type="text"
                placeholder="E.g. Jewel Chowk, Gandhi Nagar"
                value={stopsText}
                onChange={(e) => setStopsText(e.target.value)}
                className="w-full glass-input px-3 py-2.5 rounded-lg text-xs"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-brand-500 hover:bg-brand-600 text-white font-bold py-2.5 rounded-lg text-xs transition shadow-md"
            >
              {submitStatus || 'Publish Active Trip'}
            </button>
          </form>
        </div>

        {/* My Rides List */}
        <div className="lg:col-span-2 glass-panel p-6 rounded-2xl border border-slate-800 shadow-md flex flex-col min-h-0">
          <h3 className="font-bold text-xs uppercase tracking-wider text-brand-400 mb-4 flex items-center">
            <Car className="h-4 w-4 mr-2" /> Your Published Rides
          </h3>

          <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 flex-1">
            {tripsLoading ? (
              <div className="text-slate-500 text-xs italic">Loading trips...</div>
            ) : trips.length === 0 ? (
              <div className="text-center text-slate-500 text-xs py-10">You have not published any rides yet.</div>
            ) : (
              trips.map((trip) => (
                <div key={trip._id} className="bg-brand-900/50 p-4 rounded-xl border border-slate-800 flex flex-col space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                          trip.status === 'active' 
                            ? 'bg-accent-teal/15 text-accent-teal animate-pulse' 
                            : trip.status === 'completed'
                            ? 'bg-accent-emerald/15 text-accent-emerald'
                            : 'bg-slate-800 text-slate-400'
                        }`}>
                          {trip.status}
                        </span>

                        {trip.pendingRequestsCount > 0 && (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse">
                            ⚡ {trip.pendingRequestsCount} Request{trip.pendingRequestsCount > 1 ? 's' : ''} Pending
                          </span>
                        )}

                        {trip.confirmedBookingsCount > 0 && (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            ✓ {trip.confirmedBookingsCount} Confirmed
                          </span>
                        )}

                        <span className="text-[10px] text-slate-500">Departure: {new Date(trip.departureTime).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
                      </div>
                      <h4 className="font-bold text-sm text-slate-200">{trip.routeName}</h4>
                      <p className="text-[10px] text-slate-400 mt-1">Stops: {trip.stops.join(', ') || 'Direct'}</p>
                    </div>
                    <div className="text-right text-xs">
                      <span className="font-black text-slate-200">₹{trip.price}</span>
                      <span className="text-[9px] text-slate-500 block uppercase font-bold">Price</span>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex flex-wrap items-center justify-between border-t border-slate-800/80 pt-3 mt-1.5 gap-2">
                    <div className="flex items-center space-x-3">
                      <span className="text-[10px] text-slate-400 font-semibold">Available seats: {trip.availableSeats}</span>
                      <button
                        onClick={() => toggleTripManifest(trip._id)}
                        className="text-[10px] font-bold text-brand-400 hover:text-brand-300 flex items-center space-x-1 px-2.5 py-1 rounded-lg border border-slate-700/80 hover:border-brand-500/40 bg-brand-900/40 transition"
                      >
                        <Users className="h-3 w-3" />
                        <span>Passengers ({trip.bookingsCount || 0})</span>
                        {expandedTripId === trip._id ? <ChevronUp className="h-3 w-3 ml-0.5" /> : <ChevronDown className="h-3 w-3 ml-0.5" />}
                      </button>
                    </div>

                    <div className="flex space-x-2">
                      
                      {/* Start Trip */}
                      {trip.status === 'scheduled' && (
                        <button
                          onClick={() => updateTripStatus(trip._id, 'active')}
                          className="bg-brand-500 hover:bg-brand-600 text-white font-bold text-[10px] px-3 py-1.5 rounded-lg flex items-center space-x-1 transition shadow"
                        >
                          <Play className="h-3 w-3" />
                          <span>Start Trip</span>
                        </button>
                      )}

                      {/* Complete Trip */}
                      {trip.status === 'active' && (
                        <>
                          <button
                            onClick={() => navigate(`/track/${trip._id}`)}
                            className="bg-accent-teal hover:bg-cyan-600 text-white font-bold text-[10px] px-3 py-1.5 rounded-lg flex items-center space-x-1 transition shadow"
                          >
                            <Compass className="h-3 w-3" />
                            <span>Go Live / Map</span>
                          </button>
                          <button
                            onClick={() => updateTripStatus(trip._id, 'completed')}
                            className="bg-accent-emerald hover:bg-emerald-600 text-white font-bold text-[10px] px-3 py-1.5 rounded-lg flex items-center space-x-1 transition shadow"
                          >
                            <StopCircle className="h-3 w-3" />
                            <span>End Ride</span>
                          </button>
                        </>
                      )}

                      {/* Cancel Ride */}
                      {trip.status !== 'completed' && trip.status !== 'cancelled' && (
                        <button
                          onClick={() => updateTripStatus(trip._id, 'cancelled')}
                          className="text-slate-500 hover:text-accent-rose font-bold text-[10px] px-2 py-1.5 transition"
                        >
                          Cancel
                        </button>
                      )}

                    </div>
                  </div>

                  {/* Expanded Passenger Manifest & Request Approval Drawer */}
                  {expandedTripId === trip._id && (
                    <div className="mt-3 pt-3 border-t border-slate-800 space-y-2 bg-slate-950/40 p-3 rounded-xl border border-slate-850">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[11px] font-bold text-slate-300 flex items-center">
                          <Users className="h-3.5 w-3.5 text-brand-400 mr-1.5" /> Passenger Manifest & Requests
                        </span>
                        <span className="text-[9px] text-slate-500 uppercase font-semibold">Seat capacity: {trip.availableSeats} open</span>
                      </div>

                      {loadingManifestId === trip._id ? (
                        <div className="text-slate-500 text-xs py-2">Loading manifest...</div>
                      ) : !manifestMap[trip._id] || manifestMap[trip._id].length === 0 ? (
                        <div className="text-slate-500 text-xs py-3 text-center italic">
                          No passenger booking requests or reservations yet for this ride.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {manifestMap[trip._id].map((b) => (
                            <div key={b._id} className="bg-brand-900/60 p-2.5 rounded-lg border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-2">
                              <div>
                                <div className="flex items-center space-x-2">
                                  <span className="font-bold text-xs text-white">{b.passenger ? b.passenger.name : 'Commuter'}</span>
                                  <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase ${
                                    b.status === 'pending'
                                      ? 'bg-amber-500/20 text-amber-400'
                                      : b.status === 'confirmed'
                                      ? 'bg-emerald-500/20 text-emerald-400'
                                      : 'bg-slate-800 text-slate-400'
                                  }`}>
                                    {b.status === 'pending' ? 'Pending Approval' : b.status}
                                  </span>
                                </div>
                                <div className="text-[10px] text-slate-400 mt-0.5 flex flex-wrap gap-x-3">
                                  <span>Seats: <strong className="text-slate-200">{b.seatsBooked}</strong></span>
                                  <span>Total: <strong className="text-slate-200">₹{b.totalPrice}</strong></span>
                                  {b.passenger && b.passenger.phone && (
                                    <span>Contact: <strong className="text-slate-300">{b.passenger.phone}</strong></span>
                                  )}
                                </div>
                                {manifestFeedback && manifestFeedback.bookingId === b._id && (
                                  <div className={`mt-1 text-[9px] font-bold ${
                                    manifestFeedback.type === 'success' ? 'text-emerald-400' : 'text-rose-400'
                                  }`}>
                                    {manifestFeedback.text}
                                  </div>
                                )}
                              </div>

                              {/* Respond Actions for Pending Bookings */}
                              {b.status === 'pending' && trip.status === 'scheduled' && (
                                <div className="flex items-center space-x-2">
                                  <button
                                    onClick={() => handleBookingResponse(trip._id, b._id, 'accept')}
                                    disabled={respondingBookingId === b._id}
                                    className="bg-accent-emerald hover:bg-emerald-600 text-white font-bold text-[10px] px-2.5 py-1 rounded-lg flex items-center space-x-1 transition disabled:opacity-50"
                                  >
                                    <Check className="h-3 w-3" />
                                    <span>Accept</span>
                                  </button>
                                  <button
                                    onClick={() => handleBookingResponse(trip._id, b._id, 'reject')}
                                    disabled={respondingBookingId === b._id}
                                    className="bg-slate-800 hover:bg-rose-950/60 text-slate-300 hover:text-rose-400 border border-slate-700 font-bold text-[10px] px-2.5 py-1 rounded-lg flex items-center space-x-1 transition disabled:opacity-50"
                                  >
                                    <X className="h-3 w-3" />
                                    <span>Decline</span>
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
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default DriverDashboard;
