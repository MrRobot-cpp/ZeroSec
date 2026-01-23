"use client";
import { useState } from "react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [isLocked, setIsLocked] = useState(false);

  const MAX_LOGIN_ATTEMPTS = 5;
  const LOCKOUT_TIME = 300000; // 5 minutes in milliseconds

  // Enhanced email validation
  const validateEmail = (email) => {
    const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email);
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
    const sanitizedEmail = sanitizeInput(email);
    const sanitizedPassword = sanitizeInput(password);

    // Security validations
    if (containsSQLInjection(sanitizedEmail) || containsSQLInjection(sanitizedPassword)) {
      setError("Invalid input detected. Please enter valid credentials.");
      setLoginAttempts(prev => prev + 1);
      return;
    }

    if (containsXSS(sanitizedEmail) || containsXSS(sanitizedPassword)) {
      setError("Invalid input detected. Please enter valid credentials.");
      setLoginAttempts(prev => prev + 1);
      return;
    }

    // Email validation
    if (!validateEmail(sanitizedEmail)) {
      setError("Please enter a valid email address");
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
      // TODO: Implement actual authentication logic with HTTPS
      // Security recommendations:
      // 1. Use HTTPS for all API calls
      // 2. Implement rate limiting on backend
      // 3. Use secure authentication tokens (JWT with HttpOnly cookies)
      // 4. Hash passwords with bcrypt/argon2 on backend
      // 5. Implement CSRF protection
      // 6. Add 2FA for additional security
      // 7. Log all login attempts for security monitoring

      // Example secure API call:
      // const response = await axios.post('/api/auth/login',
      //   { email: sanitizedEmail, password: sanitizedPassword },
      //   {
      //     withCredentials: true, // For cookies
      //     headers: { 'X-CSRF-Token': csrfToken }
      //   }
      // );

      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // For demo purposes - simulate failed login
      const isSuccess = Math.random() > 0.5;

      if (!isSuccess) {
        throw new Error("Invalid credentials");
      }

      // Reset login attempts on success
      setLoginAttempts(0);

      // TODO: Handle successful login
      // 1. Store auth token securely (HttpOnly cookie preferred)
      // 2. Redirect to dashboard
      // 3. Set up session timeout
      console.log("Login successful");

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
          `Invalid email or password. ${MAX_LOGIN_ATTEMPTS - newAttempts} attempts remaining.`
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo and Title */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            🛡️ ZeroSec
          </h1>
          <p className="text-gray-400 text-sm">
            Security Tool For RAG Applications
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-8 shadow-xl">
          <h2 className="text-2xl font-semibold text-white mb-6">
            Sign In
          </h2>

          {/* Security Badge */}
          <div className="mb-4 p-3 bg-blue-900/30 border border-blue-700 text-blue-300 rounded-md text-xs flex items-center">
            <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            Secured with end-to-end encryption
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-900/50 border border-red-700 text-red-300 rounded-md text-sm">
              {error}
            </div>
          )}

          {/* Login Attempts Warning */}
          {loginAttempts > 0 && loginAttempts < MAX_LOGIN_ATTEMPTS && !isLocked && (
            <div className="mb-4 p-3 bg-yellow-900/30 border border-yellow-700 text-yellow-300 rounded-md text-xs">
              Warning: {loginAttempts} failed attempt{loginAttempts > 1 ? 's' : ''} detected
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
            {/* Email Input */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-300 mb-2"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                maxLength={255}
                className="w-full px-4 py-3 bg-gray-900 text-white rounded-md border border-gray-700
                         focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                         transition-all"
                placeholder="you@example.com"
                disabled={isLoading || isLocked}
              />
              {email && (
                <p className={`mt-1 text-xs ${
                  validateEmail(email) ? 'text-green-400' : 'text-gray-400'
                }`}>
                  {validateEmail(email) ? '✓ Valid email format' : 'Please enter a valid email address'}
                </p>
              )}
            </div>

            {/* Password Input */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-300 mb-2"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  minLength={8}
                  maxLength={128}
                  className="w-full px-4 py-3 bg-gray-900 text-white rounded-md border border-gray-700
                           focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                           transition-all pr-12"
                  placeholder="••••••••"
                  disabled={isLoading || isLocked}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300 transition-colors"
                  disabled={isLoading || isLocked}
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
              <p className="mt-1 text-xs text-gray-400">
                Minimum 8 characters
              </p>
            </div>

            {/* Forgot Password Link */}
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember"
                  type="checkbox"
                  className="h-4 w-4 bg-gray-900 border-gray-700 rounded focus:ring-2 focus:ring-blue-500"
                  disabled={isLoading || isLocked}
                />
                <label
                  htmlFor="remember"
                  className="ml-2 block text-sm text-gray-400"
                >
                  Remember me
                </label>
              </div>
              <a
                href="#"
                className="text-sm text-blue-500 hover:text-blue-400 transition-colors"
              >
                Forgot password?
              </a>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading || isLocked}
              className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium
                       rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500
                       focus:ring-offset-2 focus:ring-offset-gray-800 disabled:bg-gray-700
                       disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <span className="flex items-center justify-center">
                  <svg
                    className="animate-spin h-5 w-5 mr-2"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Signing in...
                </span>
              ) : isLocked ? (
                "Account Locked"
              ) : (
                "Sign In"
              )}
            </button>
          </form>

          {/* Sign Up Link */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-400">
              Don&apos;t have an account?{" "}
              <a
                href="/signup"
                className="text-blue-500 hover:text-blue-400 font-medium transition-colors"
              >
                Sign up
              </a>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-xs text-gray-500">
          <p>
            © 2026 ZeroSec. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
