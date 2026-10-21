import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { KeyRound, Mail, AlertTriangle, ArrowRight, User, Phone, Car, BookOpen } from 'lucide-react';

const Register = () => {
  const { register, error, clearError } = useAuth();
  const navigate = useNavigate();

  const [role, setRole] = useState('passenger'); // passenger or driver
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');

  // Driver fields
  const [licenseNumber, setLicenseNumber] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [plateNumber, setPlateNumber] = useState('');
  const [capacity, setCapacity] = useState('4');
  const [vehicleType, setVehicleType] = useState('car');

  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');
    clearError();

    if (!name || !email || !password) {
      setLocalError('Name, Email and Password are required.');
      return;
    }

    const payload = {
      name,
      email,
      phone,
      password,
      role
    };

    if (role === 'driver') {
      if (!licenseNumber || !vehicleModel || !plateNumber) {
        setLocalError('Please fill in license and vehicle details.');
        return;
      }
      payload.licenseNumber = licenseNumber;
      payload.vehicleModel = vehicleModel;
      payload.plateNumber = plateNumber;
      payload.capacity = capacity;
      payload.vehicleType = vehicleType;
    }

    try {
      setLoading(true);
      await register(payload);
      navigate('/');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex justify-center items-center py-6 md:py-12">
      <div className="glass-panel w-full max-w-xl p-8 rounded-2xl shadow-2xl relative">
        
        {/* Glow effect */}
        <div className="absolute top-10 right-10 h-32 w-32 bg-brand-500/10 rounded-full blur-3xl"></div>

        <div className="text-center mb-6">
          <h2 className="text-2xl font-extrabold text-white">Join JammuMove</h2>
          <p className="text-xs text-slate-400 mt-1">Create an account to book carpools or register as a transit partner</p>
        </div>

        {/* Role Toggle Selector */}
        <div className="grid grid-cols-2 gap-2 bg-brand-900/80 p-1.5 rounded-xl mb-6 border border-slate-800">
          <button
            type="button"
            onClick={() => { setRole('passenger'); setLocalError(''); }}
            className={`py-2 rounded-lg text-xs font-bold transition ${
              role === 'passenger' 
                ? 'bg-brand-500 text-white shadow' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Passenger
          </button>
          <button
            type="button"
            onClick={() => { setRole('driver'); setLocalError(''); }}
            className={`py-2 rounded-lg text-xs font-bold transition ${
              role === 'driver' 
                ? 'bg-brand-500 text-white shadow' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Driver / Partner
          </button>
        </div>

        {/* Errors */}
        {(error || localError) && (
          <div className="bg-accent-rose/10 border border-accent-rose/20 text-accent-rose text-xs p-3 rounded-xl mb-6 flex items-start space-x-2">
            <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span>{localError || error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Common fields */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Full Name</label>
              <div className="relative">
                <User className="absolute left-3 top-3.5 h-4 w-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Aarav Sharma"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full glass-input pl-10 pr-4 py-3 rounded-xl text-sm"
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-3.5 h-4 w-4 text-slate-500" />
                <input
                  type="email"
                  placeholder="aarav@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full glass-input pl-10 pr-4 py-3 rounded-xl text-sm"
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Phone Number</label>
              <div className="relative">
                <Phone className="absolute left-3 top-3.5 h-4 w-4 text-slate-500" />
                <input
                  type="tel"
                  placeholder="+91 9419X-XXXXX"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full glass-input pl-10 pr-4 py-3 rounded-xl text-sm"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Password</label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-3.5 h-4 w-4 text-slate-500" />
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full glass-input pl-10 pr-4 py-3 rounded-xl text-sm"
                  required
                />
              </div>
            </div>

          </div>

          {/* Driver specific fields */}
          {role === 'driver' && (
            <div className="border-t border-slate-800/80 pt-4 mt-4 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-brand-400">Driver & Vehicle Specifications</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">Driving License Number</label>
                  <div className="relative">
                    <BookOpen className="absolute left-3 top-3.5 h-4 w-4 text-slate-500" />
                    <input
                      type="text"
                      placeholder="JK02202600123"
                      value={licenseNumber}
                      onChange={(e) => setLicenseNumber(e.target.value)}
                      className="w-full glass-input pl-10 pr-4 py-3 rounded-xl text-sm"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">Vehicle Model Name</label>
                  <div className="relative">
                    <Car className="absolute left-3 top-3.5 h-4 w-4 text-slate-500" />
                    <input
                      type="text"
                      placeholder="Swift / Alto / Auto"
                      value={vehicleModel}
                      onChange={(e) => setVehicleModel(e.target.value)}
                      className="w-full glass-input pl-10 pr-4 py-3 rounded-xl text-sm"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">License Plate Number</label>
                  <div className="relative">
                    <Car className="absolute left-3 top-3.5 h-4 w-4 text-slate-500" />
                    <input
                      type="text"
                      placeholder="JK02AZ-1234"
                      value={plateNumber}
                      onChange={(e) => setPlateNumber(e.target.value)}
                      className="w-full glass-input pl-10 pr-4 py-3 rounded-xl text-sm"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300">Vehicle Type</label>
                    <select
                      value={vehicleType}
                      onChange={(e) => setVehicleType(e.target.value)}
                      className="w-full glass-input px-3 py-3 rounded-xl text-sm"
                    >
                      <option value="car" className="bg-brand-900 text-white">Car</option>
                      <option value="auto" className="bg-brand-900 text-white">Auto Rickshaw</option>
                      <option value="bike" className="bg-brand-900 text-white">Bike / Scooty</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300">Capacity (Seats)</label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={capacity}
                      onChange={(e) => setCapacity(e.target.value)}
                      className="w-full glass-input px-3 py-3 rounded-xl text-sm"
                      required
                    />
                  </div>
                </div>

              </div>
              
              <div className="text-[10px] text-amber-400 bg-amber-400/5 p-3 rounded-lg border border-amber-400/10">
                Note: Driver registrations must be verified and approved by the JammuMove Admin panel before publishing active carpool routes.
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-500 hover:bg-brand-600 text-white py-3 px-4 rounded-xl font-semibold text-sm flex items-center justify-center space-x-2 transition shadow-[0_4px_20px_rgba(59,108,253,0.3)] disabled:opacity-50 mt-4"
          >
            {loading ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
            ) : (
              <>
                <span>Sign Up</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>

        <div className="text-center mt-6 text-xs text-slate-400">
          Already have an account?{' '}
          <Link to="/login" className="text-brand-400 hover:text-brand-300 font-semibold hover:underline">
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Register;
