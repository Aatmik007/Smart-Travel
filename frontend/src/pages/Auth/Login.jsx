import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { KeyRound, Mail, AlertTriangle, ArrowRight, Bus } from 'lucide-react';

const Login = () => {
  const { login, error, clearError } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');
    clearError();

    if (!email || !password) {
      setLocalError('Please enter both email and password.');
      return;
    }

    try {
      setLoading(true);
      await login(email, password);
      navigate('/');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex justify-center items-center py-10 md:py-20">
      <div className="glass-panel w-full max-w-md p-8 rounded-2xl shadow-2xl relative overflow-hidden">
        {/* Glow effect */}
        <div className="absolute -top-10 -left-10 h-32 w-32 bg-brand-500/20 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-10 -right-10 h-32 w-32 bg-accent-teal/20 rounded-full blur-3xl"></div>

        {/* Brand header */}
        <div className="text-center mb-8 relative">
          <div className="inline-flex bg-brand-500/10 text-brand-400 p-3 rounded-2xl mb-3 border border-brand-500/20">
            <Bus className="h-8 w-8" />
          </div>
          <h2 className="text-2xl font-extrabold text-white">Welcome Back</h2>
          <p className="text-xs text-slate-400 mt-1.5">Sign in to JammuMove smart public transport networks</p>
        </div>

        {/* Errors */}
        {(error || localError) && (
          <div className="bg-accent-rose/10 border border-accent-rose/20 text-accent-rose text-xs p-3 rounded-xl mb-6 flex items-start space-x-2 animate-pulse-slow">
            <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span>{localError || error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Email input */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300 block">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-3.5 h-4 w-4 text-slate-500" />
              <input
                type="email"
                placeholder="you@jammumove.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full glass-input pl-10 pr-4 py-3 rounded-xl text-sm"
                required
              />
            </div>
          </div>

          {/* Password input */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300 block">Password</label>
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

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-500 hover:bg-brand-600 text-white py-3 px-4 rounded-xl font-semibold text-sm flex items-center justify-center space-x-2 transition shadow-[0_4px_20px_rgba(59,108,253,0.3)] disabled:opacity-50"
          >
            {loading ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
            ) : (
              <>
                <span>Sign In</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>

        <div className="text-center mt-6 text-xs text-slate-400">
          New to JammuMove?{' '}
          <Link to="/register" className="text-brand-400 hover:text-brand-300 font-semibold hover:underline">
            Create an Account
          </Link>
        </div>

        {/* Demo Credentials Box */}
        <div className="mt-8 pt-6 border-t border-slate-800/80 text-left">
          <div className="text-[10px] font-bold uppercase tracking-wider text-brand-400 mb-2">Quick Demo Accounts</div>
          <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-400">
            <div className="bg-slate-900/50 p-2 rounded-lg border border-slate-800/50">
              <span className="font-bold text-slate-300">Passenger:</span><br/>
              passenger1@jammumove.com<br/>
              pass123
            </div>
            <div className="bg-slate-900/50 p-2 rounded-lg border border-slate-800/50">
              <span className="font-bold text-slate-300">Driver:</span><br/>
              driver1@jammumove.com<br/>
              driver123
            </div>
            <div className="bg-slate-900/50 p-2 rounded-lg border border-slate-800/50 col-span-2">
              <span className="font-bold text-slate-300">Administrator:</span><br/>
              admin@jammumove.com | admin123
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
