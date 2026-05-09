"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function Login() {
  const router = useRouter();
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [isLocked, setIsLocked] = useState(false);

  const MAX_LOGIN_ATTEMPTS = 5;
  const LOCKOUT_TIME = 300000; // 5 minutes in milliseconds

  // Enhanced username validation
  const validateUsername = (username) => {
    return username.length >= 3 && username.length <= 50 && /^[a-zA-Z0-9_.-]+$/.test(username);
  };

  // Check for common SQL injection patterns
  const containsSQLInjection = (input) => {
    const sqlPatterns = [
      /(\bOR\b|\bAND\b).*=/i,
      /union.*select/i,
      /insert.*into/i,
      /delete.*from/i,
      /drop.*table/i,
      /--/,
      /;.*--/,
      /\/\*/,
      /xp_/i,
      /exec\s*\(/i
    ];
    return sqlPatterns.some(pattern => pattern.test(input));
  };

  // Check for XSS patterns
  const containsXSS = (input) => {
    const xssPatterns = [
      /<script/i,
      /javascript:/i,
      /onerror=/i,
      /onload=/i,
      /<iframe/i,
      /<object/i,
      /<embed/i
    ];
    return xssPatterns.some(pattern => pattern.test(input));
  };

  // Sanitize input
  const sanitizeInput = (input) => {
    return input
      .trim()
      .replace(/[<>]/g, '') // Remove angle brackets
      .slice(0, 255); // Limit length
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // Check if account is locked
    if (isLocked) {
      setError("Account temporarily locked due to multiple failed attempts. Please try again later.");
      return;
    }

    // Sanitize inputs
    const sanitizedUsername = sanitizeInput(username);
    const sanitizedPassword = sanitizeInput(password);

    // Security validations
    if (containsSQLInjection(sanitizedUsername) || containsSQLInjection(sanitizedPassword)) {
      setError("Invalid input detected. Please enter valid credentials.");
      setLoginAttempts(prev => prev + 1);
      return;
    }

    if (containsXSS(sanitizedUsername) || containsXSS(sanitizedPassword)) {
      setError("Invalid input detected. Please enter valid credentials.");
      setLoginAttempts(prev => prev + 1);
      return;
    }

    // Username validation
    if (!validateUsername(sanitizedUsername)) {
      setError("Please enter a valid username (3-50 characters, alphanumeric, dots, dashes, underscores)");
      return;
    }

    // Password validation
    if (sanitizedPassword.length < 8) {
      setError("Password must be at least 8 characters long");
      return;
    }

    if (sanitizedPassword.length > 128) {
      setError("Password is too long");
      return;
    }

    setIsLoading(true);

    try {
      // Call login via AuthContext so React state is updated immediately
      const result = await login(sanitizedUsername, sanitizedPassword);

      // Reset login attempts on success
      setLoginAttempts(0);

      console.log("Login successful");

      // Redirect based on role — admins go to dashboard, regular users go to /rag
      const permissions = result?.user?.permissions || [];
      const isAdmin = permissions.includes('admin') || permissions.includes('admin_full');
      router.push(isAdmin ? "/dashboard" : "/rag");

    } catch (err) {
      const newAttempts = loginAttempts + 1;
      setLoginAttempts(newAttempts);

      // Lock account after max attempts
      if (newAttempts >= MAX_LOGIN_ATTEMPTS) {
        setIsLocked(true);
        setError(`Too many failed login attempts. Account locked for 5 minutes.`);

        // Unlock after timeout
        setTimeout(() => {
          setIsLocked(false);
          setLoginAttempts(0);
        }, LOCKOUT_TIME);
      } else {
        setError(
          err.message || `Invalid username or password. ${MAX_LOGIN_ATTEMPTS - newAttempts} attempts remaining.`
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#060a13] flex items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Ambient Background Glows */}
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-blue-600/10 blur-[150px] pointer-events-none"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-indigo-600/10 blur-[150px] pointer-events-none"></div>

      <div className="w-full max-w-[480px] relative z-10 flex flex-col">
        {/* Logo and Title */}
        <div className="flex items-center justify-center gap-4 mb-10">
          {/* Custom ZEROSEC Hexagon Logo */}
          <svg className="w-14 h-14 text-white" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M 60 10 L 103 35 L 103 52 M 103 68 L 103 85 L 60 110 L 17 85 L 17 35 Z" stroke="currentColor" strokeWidth="8" strokeLinejoin="round" />
            <path d="M 50 38 L 70 38 L 82 50 L 82 70 L 70 82 L 50 82 L 38 70 L 38 50 Z" stroke="currentColor" strokeWidth="8" strokeLinejoin="round" />
            <circle cx="85" cy="30" r="8" fill="currentColor" />
            <circle cx="35" cy="90" r="8" fill="currentColor" />
            <line x1="75" y1="40" x2="85" y2="30" stroke="currentColor" strokeWidth="8" />
            <line x1="45" y1="80" x2="35" y2="90" stroke="currentColor" strokeWidth="8" />
            <line x1="82" y1="60" x2="110" y2="60" stroke="currentColor" strokeWidth="8" />
          </svg>
          <h1 className="text-3xl font-bold tracking-widest text-white uppercase mt-1" style={{ letterSpacing: '0.15em' }}>
            ZEROSEC
          </h1>
        </div>

        {/* Login Card */}
        <div className="bg-[#111827]/70 backdrop-blur-xl border border-gray-800 rounded-[2rem] p-8 sm:p-10 shadow-2xl relative overflow-hidden group">
          {/* Top Gradient Accent */}
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500"></div>

          <h2 className="text-2xl font-semibold text-white mb-2">
            Sign In
          </h2>
          <p className="text-sm text-gray-400 mb-8">
            Security Tool For RAG Applications

          </p>

          {/* Security Badge */}
          <div className="mb-6 p-3 bg-blue-900/20 border border-blue-500/20 text-blue-400 rounded-xl text-xs flex items-center font-medium backdrop-blur-md">
            <svg className="w-4 h-4 mr-2 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            Secured with end-to-end encryption
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl text-sm backdrop-blur-md animate-pulse">
              {error}
            </div>
          )}

          {/* Login Attempts Warning */}
          {loginAttempts > 0 && loginAttempts < MAX_LOGIN_ATTEMPTS && !isLocked && (
            <div className="mb-6 p-3 bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 rounded-xl text-xs backdrop-blur-md">
              Warning: {loginAttempts} failed attempt{loginAttempts > 1 ? 's' : ''} detected
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-5" autoComplete="off">
            {/* Floating Label Username Input */}
            <div className="relative group/input">
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="username"
                maxLength={50}
                className="w-full px-4 pt-6 pb-2 bg-[#0b1120]/50 text-white rounded-xl border border-gray-700/60
                         focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500 focus:bg-[#0b1120]
                         transition-all peer placeholder-transparent"
                placeholder="Username"
                disabled={isLoading || isLocked}
              />
              <label
                htmlFor="username"
                className="absolute left-4 top-2 text-[11px] font-medium text-gray-500 transition-all 
                           peer-placeholder-shown:top-4 peer-placeholder-shown:text-sm peer-placeholder-shown:text-gray-400
                           peer-focus:top-2 peer-focus:text-[11px] peer-focus:text-blue-400
                           pointer-events-none uppercase tracking-wider"
              >
                Username
              </label>
              {username && (
                <p className={`absolute -bottom-5 left-1 text-[10px] ${validateUsername(username) ? 'text-emerald-400/80' : 'text-gray-500'
                  }`}>
                  {validateUsername(username) ? '✓ Valid format' : '3-50 chars (alphanumeric, ., -, _)'}
                </p>
              )}
            </div>

            {/* Floating Label Password Input */}
            <div className="relative group/input pt-2">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                minLength={8}
                maxLength={128}
                className="w-full px-4 pt-6 pb-2 bg-[#0b1120]/50 text-white rounded-xl border border-gray-700/60
                         focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500 focus:bg-[#0b1120]
                         transition-all peer placeholder-transparent pr-12"
                placeholder="Password"
                disabled={isLoading || isLocked}
              />
              <label
                htmlFor="password"
                className="absolute left-4 top-4 text-[11px] font-medium text-gray-500 transition-all 
                           peer-placeholder-shown:top-6 peer-placeholder-shown:text-sm peer-placeholder-shown:text-gray-400
                           peer-focus:top-4 peer-focus:text-[11px] peer-focus:text-blue-400
                           pointer-events-none uppercase tracking-wider"
              >
                Password
              </label>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-[1.35rem] text-black hover:text-gray-800 transition-colors p-1"
                disabled={isLoading || isLocked}
              >
                {showPassword ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>

            {/* Remember Me & Forgot Password */}
            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center">
                <input
                  id="remember"
                  type="checkbox"
                  className="h-4 w-4 bg-[#0b1120] border-gray-700 rounded text-blue-600 focus:ring-blue-500 focus:ring-offset-gray-900 cursor-pointer"
                  disabled={isLoading || isLocked}
                />
                <label
                  htmlFor="remember"
                  className="ml-2 block text-xs text-gray-400 cursor-pointer hover:text-gray-300 transition-colors"
                >
                  Remember me
                </label>
              </div>
              <a
                href="#"
                className="text-xs text-blue-400 hover:text-blue-300 transition-colors font-medium"
              >
                Forgot password?
              </a>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading || isLocked}
              className="w-full py-3.5 px-4 mt-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 
                       text-white font-semibold rounded-xl shadow-lg hover:shadow-blue-500/25 
                       transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed
                       transform active:scale-[0.98] flex items-center justify-center relative overflow-hidden group/btn"
            >
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover/btn:translate-y-0 transition-transform duration-300 ease-out"></div>
              <span className="relative z-10 flex items-center">
                {isLoading ? (
                  <>
                    <svg
                      className="animate-spin h-5 w-5 mr-2"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Authenticating...
                  </>
                ) : isLocked ? (
                  "Account Locked"
                ) : (
                  "Sign In"
                )}
              </span>
            </button>
          </form>

          {/* Sign Up Link */}
          <div className="mt-8 text-center pt-6 border-t border-gray-800/80">
            <p className="text-sm text-gray-400">
              Don&apos;t have an account?{" "}
              <a
                href="/signup"
                className="text-blue-400 hover:text-blue-300 font-medium transition-colors"
              >
                Sign up
              </a>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-xs text-gray-600 font-medium tracking-wide">
          <p>© {new Date().getFullYear()} ZEROSEC SECURITY. ALL RIGHTS RESERVED.</p>
        </div>
      </div>
    </div>
  );
}
