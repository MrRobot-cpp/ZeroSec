"use client";
import { useState, useEffect } from "react";

export default function SignUp() {
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState({
    score: 0,
    label: "",
    color: "",
  });

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

  // Password strength calculator
  const calculatePasswordStrength = (password) => {
    let score = 0;

    if (!password) {
      return { score: 0, label: "", color: "" };
    }

    // Length check
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (password.length >= 16) score++;

    // Character variety checks
    if (/[a-z]/.test(password)) score++; // lowercase
    if (/[A-Z]/.test(password)) score++; // uppercase
    if (/[0-9]/.test(password)) score++; // numbers
    if (/[^a-zA-Z0-9]/.test(password)) score++; // special chars

    // Penalize common patterns
    if (/^[a-zA-Z]+$/.test(password)) score--; // only letters
    if (/^[0-9]+$/.test(password)) score--; // only numbers
    if (/(.)\1{2,}/.test(password)) score--; // repeated characters
    if (/(012|123|234|345|456|567|678|789|890|abc|bcd|cde|def)/.test(password.toLowerCase())) score--; // sequences

    // Common passwords check (simplified)
    const commonPasswords = ['password', '12345678', 'qwerty', 'abc123', 'letmein', 'welcome'];
    if (commonPasswords.some(common => password.toLowerCase().includes(common))) {
      score = 0;
    }

    // Determine strength label and color
    if (score <= 2) {
      return { score, label: "Weak", color: "bg-red-500" };
    } else if (score <= 4) {
      return { score, label: "Fair", color: "bg-yellow-500" };
    } else if (score <= 6) {
      return { score, label: "Good", color: "bg-blue-500" };
    } else {
      return { score, label: "Strong", color: "bg-green-500" };
    }
  };

  // Update password strength when password changes
  useEffect(() => {
    setPasswordStrength(calculatePasswordStrength(formData.password));
  }, [formData.password]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    // Sanitize all inputs
    const sanitizedFullName = sanitizeInput(formData.fullName);
    const sanitizedEmail = sanitizeInput(formData.email);
    const sanitizedPassword = sanitizeInput(formData.password);
    const sanitizedConfirmPassword = sanitizeInput(formData.confirmPassword);

    // Security validations
    if (containsSQLInjection(sanitizedFullName) || containsSQLInjection(sanitizedEmail) ||
        containsSQLInjection(sanitizedPassword)) {
      setError("Invalid input detected. Please enter valid information.");
      return;
    }

    if (containsXSS(sanitizedFullName) || containsXSS(sanitizedEmail) || containsXSS(sanitizedPassword)) {
      setError("Invalid input detected. Please enter valid information.");
      return;
    }

    // Name validation
    if (sanitizedFullName.length < 2) {
      setError("Name must be at least 2 characters long");
      return;
    }

    if (sanitizedFullName.length > 100) {
      setError("Name is too long");
      return;
    }

    if (!/^[a-zA-Z\s'-]+$/.test(sanitizedFullName)) {
      setError("Name can only contain letters, spaces, hyphens, and apostrophes");
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
      setError("Password is too long (max 128 characters)");
      return;
    }

    // Strong password requirements
    if (!/[A-Z]/.test(sanitizedPassword)) {
      setError("Password must contain at least one uppercase letter");
      return;
    }

    if (!/[^a-zA-Z0-9]/.test(sanitizedPassword)) {
      setError("Password must contain at least one special character (!@#$%^&*)");
      return;
    }

    // Check password strength
    if (passwordStrength.score < 2) {
      setError("Password is too weak. Please choose a stronger password.");
      return;
    }

    // Password match validation
    if (sanitizedPassword !== sanitizedConfirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setIsLoading(true);

    try {
      // TODO: Implement actual registration logic with HTTPS
      // Security recommendations:
      // 1. Use HTTPS for all API calls
      // 2. Implement rate limiting on backend
      // 3. Hash passwords with bcrypt/argon2 (never store plain text)
      // 4. Implement email verification
      // 5. Use CSRF protection
      // 6. Implement CAPTCHA for bot prevention
      // 7. Check password against breach databases (Have I Been Pwned API)
      // 8. Enforce strong password policy on backend as well
      // 9. Log all registration attempts
      // 10. Implement account lockout for suspicious activity

      // Example secure API call:
      // const response = await axios.post('/api/auth/register',
      //   {
      //     fullName: sanitizedFullName,
      //     email: sanitizedEmail,
      //     password: sanitizedPassword // Will be hashed on backend
      //   },
      //   {
      //     withCredentials: true,
      //     headers: { 'X-CSRF-Token': csrfToken }
      //   }
      // );

      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1500));

      setSuccess("Account created successfully! Redirecting to login...");

      // TODO: Redirect to login page or email verification page
      // setTimeout(() => window.location.href = '/login', 2000);

    } catch (err) {
      setError(err.response?.data?.message || "Registration failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4 py-8">
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

        {/* Sign Up Card */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-8 shadow-xl">
          <h2 className="text-2xl font-semibold text-white mb-6">
            Create Account
          </h2>

         
         
          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-900/50 border border-red-700 text-red-300 rounded-md text-sm">
              {error}
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="mb-4 p-3 bg-green-900/50 border border-green-700 text-green-300 rounded-md text-sm">
              {success}
            </div>
          )}

          {/* Sign Up Form */}
          <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
            {/* Full Name Input */}
            <div>
              <label
                htmlFor="fullName"
                className="block text-sm font-medium text-gray-300 mb-2"
              >
                Full Name
              </label>
              <input
                id="fullName"
                name="fullName"
                type="text"
                value={formData.fullName}
                onChange={handleChange}
                required
                autoComplete="name"
                maxLength={100}
                className="w-full px-4 py-3 bg-gray-900 text-white rounded-md border border-gray-700
                         focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                         transition-all"
                placeholder="John Doe"
                disabled={isLoading}
              />
              <p className="mt-1 text-xs text-gray-400">
                Your real name (2-100 characters)
              </p>
            </div>

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
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                required
                autoComplete="email"
                maxLength={255}
                className="w-full px-4 py-3 bg-gray-900 text-white rounded-md border border-gray-700
                         focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                         transition-all"
                placeholder="you@example.com"
                disabled={isLoading}
              />
              {formData.email && (
                <p className={`mt-1 text-xs ${
                  validateEmail(formData.email) ? 'text-green-400' : 'text-gray-400'
                }`}>
                  {validateEmail(formData.email) ? '✓ Valid email format' : 'Please enter a valid email address'}
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
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={handleChange}
                  required
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={128}
                  className="w-full px-4 py-3 bg-gray-900 text-white rounded-md border border-gray-700
                           focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                           transition-all pr-12"
                  placeholder="••••••••"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300 transition-colors"
                  disabled={isLoading}
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

              {/* Password Strength Indicator */}
              {formData.password && (
                <div className="mt-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-400">Password Strength:</span>
                    <span className={`text-xs font-medium ${
                      passwordStrength.label === 'Weak' ? 'text-red-400' :
                      passwordStrength.label === 'Fair' ? 'text-yellow-400' :
                      passwordStrength.label === 'Good' ? 'text-blue-400' :
                      'text-green-400'
                    }`}>
                      {passwordStrength.label}
                    </span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-300 ${passwordStrength.color}`}
                      style={{ width: `${(passwordStrength.score / 7) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="mt-2 text-xs text-gray-400 space-y-1">
                <p>Password must contain:</p>
                <ul className="list-disc list-inside space-y-0.5 ml-2">
                  <li className={formData.password.length >= 8 ? 'text-green-400' : ''}>
                    At least 8 characters
                  </li>
                  <li className={/[A-Z]/.test(formData.password) ? 'text-green-400' : ''}>
                    One uppercase letter
                  </li>
                  <li className={/[^a-zA-Z0-9]/.test(formData.password) ? 'text-green-400' : ''}>
                    One special character (!@#$%^&*)
                  </li>
                </ul>
              </div>
            </div>

            {/* Confirm Password Input */}
            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-sm font-medium text-gray-300 mb-2"
              >
                Confirm Password
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={128}
                  className="w-full px-4 py-3 bg-gray-900 text-white rounded-md border border-gray-700
                           focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                           transition-all pr-12"
                  placeholder="••••••••"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300 transition-colors"
                  disabled={isLoading}
                >
                  {showConfirmPassword ? (
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
              {formData.confirmPassword && (
                <p className={`mt-1 text-xs ${
                  formData.password === formData.confirmPassword ? 'text-green-400' : 'text-red-400'
                }`}>
                  {formData.password === formData.confirmPassword ? 'Passwords match' : 'Passwords do not match'}
                </p>
              )}
            </div>

            {/* Terms and Conditions */}
            <div className="flex items-start">
              <input
                id="terms"
                type="checkbox"
                required
                className="h-4 w-4 mt-1 bg-gray-900 border-gray-700 rounded focus:ring-2 focus:ring-blue-500"
                disabled={isLoading}
              />
              <label
                htmlFor="terms"
                className="ml-2 block text-sm text-gray-400"
              >
                I agree to the{" "}
                <a
                  href="#"
                  className="text-blue-500 hover:text-blue-400 transition-colors"
                >
                  Terms and Conditions
                </a>{" "}
                and{" "}
                <a
                  href="#"
                  className="text-blue-500 hover:text-blue-400 transition-colors"
                >
                  Privacy Policy
                </a>
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
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
                  Creating account...
                </span>
              ) : (
                "Create Account"
              )}
            </button>
          </form>

          {/* Login Link */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-400">
              Already have an account?{" "}
              <a
                href="/login"
                className="text-blue-500 hover:text-blue-400 font-medium transition-colors"
              >
                Sign in
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
