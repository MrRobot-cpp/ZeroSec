'use client';

import { useState } from 'react';
import Button from '@/app/common/Button';

export default function OrganizationSetup({ initialValue, onSubmit }) {
  const [organizationName, setOrganizationName] = useState(initialValue || '');
  const [error, setError] = useState('');

  const validateOrganizationName = (name) => {
    if (!name || name.trim().length === 0) {
      return 'Organization name is required';
    }
    if (name.trim().length < 2) {
      return 'Organization name must be at least 2 characters';
    }
    if (name.length > 100) {
      return 'Organization name must be less than 100 characters';
    }
    // Check for SQL injection patterns
    const sqlPattern = /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|UNION|DECLARE)\b)/i;
    if (sqlPattern.test(name)) {
      return 'Invalid characters detected';
    }
    return '';
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const validationError = validateOrganizationName(organizationName);

    if (validationError) {
      setError(validationError);
      return;
    }

    onSubmit(organizationName.trim());
  };

  const handleChange = (e) => {
    const value = e.target.value;
    setOrganizationName(value);
    if (error) {
      setError('');
    }
  };

  return (
    <div className="bg-gray-800/50 backdrop-blur-lg border border-gray-700 rounded-2xl p-8 md:p-12 shadow-2xl">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-500/20 rounded-full mb-4">
          <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">
          Create Your Workspace
        </h1>
        <p className="text-gray-400 text-lg">
          Let&apos;s start by naming your organization. You can always change this later.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="organizationName" className="block text-sm font-medium text-gray-300 mb-2">
            Organization Name <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            id="organizationName"
            value={organizationName}
            onChange={handleChange}
            placeholder="e.g., Acme Corporation"
            className={`w-full px-4 py-3 bg-gray-900/50 border ${
              error ? 'border-red-500' : 'border-gray-600'
            } rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all`}
            autoFocus
          />
          {error && (
            <p className="mt-2 text-sm text-red-400 flex items-center gap-1">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              {error}
            </p>
          )}
          <p className="mt-2 text-xs text-gray-500">
            This will be the name of your workspace where your team collaborates securely.
          </p>
        </div>

        <div className="pt-4">
          <Button
            type="submit"
            variant="primary"
            className="w-full py-3 text-lg font-semibold"
          >
            Continue
            <svg className="w-5 h-5 ml-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Button>
        </div>
      </form>

      <div className="mt-8 pt-8 border-t border-gray-700">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-blue-400 mb-1">1000+</div>
            <div className="text-sm text-gray-400">Organizations Trust Us</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-blue-400 mb-1">99.9%</div>
            <div className="text-sm text-gray-400">Uptime Guaranteed</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-blue-400 mb-1">24/7</div>
            <div className="text-sm text-gray-400">Security Monitoring</div>
          </div>
        </div>
      </div>
    </div>
  );
}
