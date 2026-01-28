'use client';

import { useState, useEffect } from 'react';
import Button from '@/app/common/Button';

// Plan data based on the backend database structure
const PLANS = [
  {
    id: 1,
    name: 'Starter',
    price: 49,
    billing: 'per month',
    description: 'Perfect for small teams getting started',
    features: [
      'Up to 5 users',
      '30 documents',
      '200 MB storage',
      'Retrival Firewall',
      'Basic security policies',
      'Audit Logs & monitoring',
      'Email support'
    ],
    limits: {
      users: 5,
      documents: 30,
      storage_mb: 200
    },
    popular: false,
    color: 'gray'
  },
  {
    id: 2,
    name: 'Pro',
    price: 99,
    billing: 'per month',
    description: 'Advanced features for growing organizations',
    features: [
      'Up to 20 users',
      '100 documents',
      '1 GB storage',
      'Query Sanitization',
      'Retrival Firewall',
      'PII/PHI Redaction',
      'Audit Logs & monitoring (30 days)',
      'Email support',

      'API access' 
    ],
    limits: {
      users: 20,
      documents: 100,
      storage_mb: 1000
    },
    popular: true,
    color: 'blue'
  },
  {
    id: 3,
    name: 'Elite',
    price: 199,
    billing: 'Per month',
    description: 'Unlimited power for large enterprises',
    features: [
      'Unlimited users',
      'Unlimited documents',
      'Up to 50 GB storage',
'Query Sanitization',
      'Retrival Firewall',
      'PII/PHI Redaction',
      'Audit Logs & monitoring (unlimited)',
'24/7 phone & email support',
       'Custom roles & permissions',
       'Canary based Forensics',
      'Dedicated account manager',
      'Custom integrations',
    
    ],
    limits: {
      users: -1,
      documents: -1,
      storage_mb: -1
    },
    popular: false,
    color: 'purple'
  }
];

export default function PlanSelection({ selectedPlanId, onSelectPlan, onBack }) {
  const [selected, setSelected] = useState(selectedPlanId);
  const [hoveredPlan, setHoveredPlan] = useState(null);

  const handleSelectPlan = (planId, planName) => {
    setSelected(planId);
    onSelectPlan(planId, planName);
  };

  const getColorClasses = (color, isSelected, isHovered) => {
    const colors = {
      gray: {
        border: isSelected || isHovered ? 'border-gray-500' : 'border-gray-700',
        bg: 'bg-gray-500/10',
        text: 'text-gray-400',
        button: 'bg-gray-600 hover:bg-gray-500'
      },
      blue: {
        border: isSelected || isHovered ? 'border-blue-500' : 'border-gray-700',
        bg: 'bg-blue-500/10',
        text: 'text-blue-400',
        button: 'bg-blue-600 hover:bg-blue-500'
      },
      purple: {
        border: isSelected || isHovered ? 'border-purple-500' : 'border-gray-700',
        bg: 'bg-purple-500/10',
        text: 'text-purple-400',
        button: 'bg-purple-600 hover:bg-purple-500'
      }
    };
    return colors[color];
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">
          Choose Your Plan
        </h1>
        <p className="text-gray-400 text-lg">
          Select the plan that best fits your organization&apos;s needs
        </p>
      </div>

      {/* Pricing Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {PLANS.map((plan) => {
          const isSelected = selected === plan.id;
          const isHovered = hoveredPlan === plan.id;
          const colors = getColorClasses(plan.color, isSelected, isHovered);

          return (
            <div
              key={plan.id}
              className={`relative bg-gray-800/50 backdrop-blur-lg border-2 ${colors.border} rounded-2xl p-6 transition-all duration-300 ${
                isSelected ? 'scale-105 shadow-2xl' : 'hover:scale-102'
              } ${plan.popular ? 'ring-2 ring-blue-500/50' : ''}`}
              onMouseEnter={() => setHoveredPlan(plan.id)}
              onMouseLeave={() => setHoveredPlan(null)}
            >
              {/* Popular Badge */}
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <span className="bg-gradient-to-r from-blue-600 to-blue-400 text-white text-xs font-bold px-4 py-1 rounded-full shadow-lg">
                    MOST POPULAR
                  </span>
                </div>
              )}

              {/* Plan Header */}
              <div className="text-center mb-6">
                <h3 className="text-2xl font-bold text-white mb-2">{plan.name}</h3>
                <p className="text-gray-400 text-sm mb-4">{plan.description}</p>

                {/* Price */}
                <div className="mb-4">
                  {plan.price !== null ? (
                    <>
                      <div className="flex items-baseline justify-center">
                        <span className="text-5xl font-bold text-white">${plan.price}</span>
                        <span className="text-gray-400 ml-2">/{plan.billing}</span>
                      </div>
                    </>
                  ) : (
                    <div className="text-2xl font-bold text-white">{plan.billing}</div>
                  )}
                </div>
              </div>

              {/* Features */}
              <ul className="space-y-3 mb-6">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm">
                    <svg className={`w-5 h-5 ${colors.text} flex-shrink-0 mt-0.5`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-gray-300">{feature}</span>
                  </li>
                ))}
              </ul>

              {/* Select Button */}
              <button
                onClick={() => handleSelectPlan(plan.id, plan.name)}
                className={`w-full py-3 rounded-lg font-semibold transition-all duration-300 ${
                  isSelected
                    ? `${colors.button} text-white shadow-lg`
                    : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                }`}
              >
                {isSelected ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Selected
                  </span>
                ) : (
                  'Select Plan'
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between gap-4 pt-6">
        <Button
          variant="secondary"
          onClick={onBack}
          className="px-6 py-3"
        >
          <svg className="w-5 h-5 mr-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 17l-5-5m0 0l5-5m-5 5h12" />
          </svg>
          Back
        </Button>

        <Button
          variant="primary"
          onClick={() => {
            if (selected) {
              const plan = PLANS.find(p => p.id === selected);
              handleSelectPlan(plan.id, plan.name);
            }
          }}
          disabled={!selected}
          className="px-8 py-3"
        >
          Continue
          <svg className="w-5 h-5 ml-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </Button>
      </div>

      {/* Trust Indicators */}
      <div className="bg-gray-800/30 backdrop-blur-sm border border-gray-700 rounded-xl p-6 mt-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
          <div className="flex flex-col items-center">
            <svg className="w-10 h-10 text-green-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <div className="text-sm font-semibold text-white mb-1">30-Day Money Back</div>
            <div className="text-xs text-gray-400">Risk-free guarantee</div>
          </div>
          <div className="flex flex-col items-center">
            <svg className="w-10 h-10 text-blue-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
            </svg>
            <div className="text-sm font-semibold text-white mb-1">Easy to Upgrade</div>
            <div className="text-xs text-gray-400">Change plans anytime</div>
          </div>
          <div className="flex flex-col items-center">
            <svg className="w-10 h-10 text-purple-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <div className="text-sm font-semibold text-white mb-1">Secure Payment</div>
            <div className="text-xs text-gray-400">Bank-level encryption</div>
          </div>
        </div>
      </div>
    </div>
  );
}
