'use client';

import { useState, useEffect } from 'react';
import Button from '@/app/common/Button';

export default function AdminSetup({ organizationData, onBack, onSuccess }) {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState({
    score: 0,
    label: '',
    color: ''
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
      .replace(/[<>]/g, '')
      .slice(0, 255);
  };

  // Password strength calculator
  const calculatePasswordStrength = (password) => {
    let score = 0;

    if (!password) {
      return { score: 0, label: '', color: '' };
    }

    // Length check
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (password.length >= 16) score++;

    // Character variety checks
    if (/[a-z]/.test(password)) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^a-zA-Z0-9]/.test(password)) score++;

    // Penalize common patterns
    if (/^[a-zA-Z]+$/.test(password)) score--;
    if (/^[0-9]+$/.test(password)) score--;
    if (/(.)\1{2,}/.test(password)) score--;
    if (/(012|123|234|345|456|567|678|789|890|abc|bcd|cde|def)/.test(password.toLowerCase())) score--;

    // Common passwords check
    const commonPasswords = ['password', '12345678', 'qwerty', 'abc123', 'letmein', 'welcome', 'admin'];
    if (commonPasswords.some(common => password.toLowerCase().includes(common))) {
      score = 0;
    }

    // Determine strength label and color
    if (score <= 2) {
      return { score, label: 'Weak', color: 'bg-red-500' };
    } else if (score <= 4) {
      return { score, label: 'Fair', color: 'bg-yellow-500' };
    } else if (score <= 6) {
      return { score, label: 'Good', color: 'bg-blue-500' };
    } else {
      return { score, label: 'Strong', color: 'bg-green-500' };
    }
  };

  // Update password strength when password changes
  useEffect(() => {
    setPasswordStrength(calculatePasswordStrength(formData.password));
  }, [formData.password]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Sanitize all inputs
    const sanitizedUsername = sanitizeInput(formData.username);
    const sanitizedEmail = sanitizeInput(formData.email);
    const sanitizedPassword = sanitizeInput(formData.password);
    const sanitizedConfirmPassword = sanitizeInput(formData.confirmPassword);

    // Security validations
    if (containsSQLInjection(sanitizedUsername) ||
        containsSQLInjection(sanitizedEmail) || containsSQLInjection(sanitizedPassword)) {
      setError('Invalid input detected. Please enter valid information.');
      return;
    }

    if (containsXSS(sanitizedUsername) ||
        containsXSS(sanitizedEmail) || containsXSS(sanitizedPassword)) {
      setError('Invalid input detected. Please enter valid information.');
      return;
    }

    // Username validation
    if (sanitizedUsername.length < 3) {
      setError('Username must be at least 3 characters long');
      return;
    }

    if (sanitizedUsername.length > 50) {
      setError('Username is too long (max 50 characters)');
      return;
    }

    if (!/^[a-zA-Z0-9_.-]+$/.test(sanitizedUsername)) {
      setError('Username can only contain letters, numbers, dots, hyphens, and underscores');
      return;
    }

    // Email validation
    if (!validateEmail(sanitizedEmail)) {
      setError('Please enter a valid email address');
      return;
    }

    // Password validation
    if (sanitizedPassword.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    if (sanitizedPassword.length > 128) {
      setError('Password is too long (max 128 characters)');
      return;
    }

    if (!/[A-Z]/.test(sanitizedPassword)) {
      setError('Password must contain at least one uppercase letter');
      return;
    }

    if (!/[^a-zA-Z0-9]/.test(sanitizedPassword)) {
      setError('Password must contain at least one special character (!@#$%^&*)');
      return;
    }

    // Check password strength
    if (passwordStrength.score < 2) {
      setError('Password is too weak. Please choose a stronger password.');
      return;
    }

    // Password match validation
    if (sanitizedPassword !== sanitizedConfirmPassword) {
      setError('Passwords do not match');
      return;
    }

    // All validations passed - move to payment step
    console.log('Form validation successful, moving to payment step');

    // Store the admin data for later registration (after payment)
    const adminData = {
      username: sanitizedUsername,
      email: sanitizedEmail,
      password: sanitizedPassword
    };

    // Move to payment step (no API call yet)
    onSuccess(adminData);
  };

  return (
    <div className="bg-gray-800/50 backdrop-blur-lg border border-gray-700 rounded-2xl p-8 md:p-12 shadow-2xl">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-500/20 rounded-full mb-4">
          <svg className="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">
          Create Root Administrator
        </h1>
        <p className="text-gray-400 text-lg mb-4">
          Set up your administrator account with the highest security clearance
        </p>

        {/* Summary Card */}
        <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4 mt-6">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="text-left">
              <span className="text-gray-400">Organization:</span>
              <p className="text-white font-semibold">{organizationData.organizationName}</p>
            </div>
            <div className="text-right">
              <span className="text-gray-400">Plan:</span>
              <p className="text-white font-semibold">{organizationData.planName}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-900/50 border border-red-700 text-red-300 rounded-lg text-sm flex items-start gap-2">
          <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {error}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Username */}
        <div>
          <label htmlFor="username" className="block text-sm font-medium text-gray-300 mb-2">
            Username <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            id="username"
            name="username"
            value={formData.username}
            onChange={handleChange}
            placeholder="admin_user"
            required
            className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
          />
          <p className="mt-1 text-xs text-gray-500">
            Unique identifier for login (3-50 characters, letters, numbers, dots, hyphens, underscores)
          </p>
        </div>

        {/* Email */}
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
            Email Address <span className="text-red-400">*</span>
          </label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="admin@example.com"
            required
            className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
          />
          {formData.email && (
            <p className={`mt-1 text-xs ${validateEmail(formData.email) ? 'text-green-400' : 'text-gray-500'}`}>
              {validateEmail(formData.email) ? '✓ Valid email format' : 'Please enter a valid email address'}
            </p>
          )}
        </div>

        {/* Password */}
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
            Password <span className="text-red-400">*</span>
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="••••••••"
              required
              className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all pr-12"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
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

        {/* Confirm Password */}
        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300 mb-2">
            Confirm Password <span className="text-red-400">*</span>
          </label>
          <div className="relative">
            <input
              type={showConfirmPassword ? 'text' : 'password'}
              id="confirmPassword"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              placeholder="••••••••"
              required
              className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all pr-12"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
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
              {formData.password === formData.confirmPassword ? '✓ Passwords match' : 'Passwords do not match'}
            </p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-4 pt-6">
          <Button
            type="button"
            variant="secondary"
            onClick={onBack}
            className="flex-1 py-3"
          >
            <svg className="w-5 h-5 mr-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 17l-5-5m0 0l5-5m-5 5h12" />
            </svg>
            Back
          </Button>

          <Button
            type="submit"
            variant="primary"
            className="flex-1 py-3"
          >
            Continue to Payment
            <svg className="w-5 h-5 ml-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Button>
        </div>
      </form>

      {/* Security Badge */}
      <div className="mt-8 pt-8 border-t border-gray-700">
        <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
          <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <span>Your data is encrypted with bank-level security</span>
        </div>
      </div>
    </div>
  );
}
