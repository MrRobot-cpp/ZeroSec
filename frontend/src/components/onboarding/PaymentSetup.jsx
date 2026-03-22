'use client';

import { useState } from 'react';
import Button from '@/app/common/Button';

// Payment method options
const PAYMENT_METHODS = {
  CREDIT_CARD: 'credit_card',
  PAYPAL: 'paypal',
  BANK_TRANSFER: 'bank_transfer'
};

export default function PaymentSetup({ organizationData, onBack, onComplete }) {
  const [selectedMethod, setSelectedMethod] = useState(PAYMENT_METHODS.CREDIT_CARD);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [cardData, setCardData] = useState({
    cardNumber: '',
    cardName: '',
    expiryDate: '',
    cvv: '',
    billingZip: ''
  });

  // Get plan details
  const getPlanDetails = () => {
    const plans = {
      1: { name: 'Starter', price: 49, billing: 'monthly' },
      2: { name: 'Pro', price: 99, billing: 'monthly' },
      3: { name: 'Elite', price: 199, billing: 'monthly' }
    };
    return plans[organizationData.planId] || { name: 'Free', price: 0, billing: 'forever' };
  };

  const plan = getPlanDetails();
  const isFree = plan.price === 0;

  // Format card number with spaces
  const formatCardNumber = (value) => {
    const cleaned = value.replace(/\s/g, '');
    const chunks = cleaned.match(/.{1,4}/g);
    return chunks ? chunks.join(' ') : cleaned;
  };

  // Format expiry date as MM/YY
  const formatExpiryDate = (value) => {
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length >= 2) {
      return cleaned.slice(0, 2) + '/' + cleaned.slice(2, 4);
    }
    return cleaned;
  };

  const handleCardChange = (e) => {
    const { name, value } = e.target;
    let formattedValue = value;

    if (name === 'cardNumber') {
      const cleaned = value.replace(/\s/g, '');
      if (cleaned.length <= 16 && /^\d*$/.test(cleaned)) {
        formattedValue = formatCardNumber(cleaned);
      } else {
        return;
      }
    } else if (name === 'expiryDate') {
      const cleaned = value.replace(/\D/g, '');
      if (cleaned.length <= 4) {
        formattedValue = formatExpiryDate(cleaned);
      } else {
        return;
      }
    } else if (name === 'cvv') {
      if (value.length <= 4 && /^\d*$/.test(value)) {
        formattedValue = value;
      } else {
        return;
      }
    } else if (name === 'billingZip') {
      if (value.length <= 10) {
        formattedValue = value;
      } else {
        return;
      }
    }

    setCardData({
      ...cardData,
      [name]: formattedValue
    });

    if (error) setError('');
  };

  const validateCardData = () => {
    const cardNumber = cardData.cardNumber.replace(/\s/g, '');

    if (!cardData.cardName.trim()) {
      return 'Cardholder name is required';
    }

    if (cardNumber.length < 13 || cardNumber.length > 16) {
      return 'Invalid card number';
    }

    if (!cardData.expiryDate || cardData.expiryDate.length !== 5) {
      return 'Invalid expiry date (MM/YY)';
    }

    // Validate expiry date is in the future
    const [month, year] = cardData.expiryDate.split('/');
    const expiry = new Date(2000 + parseInt(year), parseInt(month) - 1);
    if (expiry < new Date()) {
      return 'Card has expired';
    }

    if (cardData.cvv.length < 3) {
      return 'Invalid CVV';
    }

    if (!cardData.billingZip.trim()) {
      return 'Billing ZIP/Postal code is required';
    }

    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // If free plan, skip payment
    if (isFree) {
      onComplete();
      return;
    }

    // Validate payment method
    if (selectedMethod === PAYMENT_METHODS.CREDIT_CARD) {
      const validationError = validateCardData();
      if (validationError) {
        setError(validationError);
        return;
      }
    }

    setIsLoading(true);

    try {
      // TODO: Integrate with actual payment gateway (Stripe, PayPal, etc.)
      // For now, simulate payment processing
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Mock successful payment
      const paymentResult = {
        success: true,
        transactionId: 'TXN_' + Date.now(),
        method: selectedMethod
      };

      // Call the completion handler
      onComplete(paymentResult);
    } catch (err) {
      setError(err.message || 'Payment processing failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkipPayment = () => {
    // For free plan or if user wants to pay later
    onComplete({ skipped: true });
  };

  return (
    <div className="bg-gray-800/50 backdrop-blur-lg border border-gray-700 rounded-2xl p-8 md:p-12 shadow-2xl max-w-4xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-green-500/20 rounded-full mb-4">
          <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">
          {isFree ? 'Complete Setup' : 'Payment Information'}
        </h1>
        <p className="text-gray-400 text-lg">
          {isFree
            ? 'You\'re all set! Click continue to access your dashboard.'
            : 'Secure your subscription and start protecting your applications'}
        </p>
      </div>

      {/* Plan Summary */}
      <div className="bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/30 rounded-xl p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-xl font-bold text-white mb-1">{plan.name} Plan</h3>
            <p className="text-sm text-gray-400">{organizationData.organizationName}</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-white">
              {isFree ? 'Free' : `$${plan.price}`}
            </div>
            {!isFree && <div className="text-sm text-gray-400">per month</div>}
          </div>
        </div>
        {!isFree && (
          <div className="pt-4 border-t border-gray-700">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-400">Billing cycle:</span>
              <span className="text-white">Monthly</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Next billing date:</span>
              <span className="text-white">
                {new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString()}
              </span>
            </div>
          </div>
        )}
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

      {!isFree ? (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Payment Method Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Payment Method
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setSelectedMethod(PAYMENT_METHODS.CREDIT_CARD)}
                className={`p-4 border-2 rounded-lg transition-all ${
                  selectedMethod === PAYMENT_METHODS.CREDIT_CARD
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-gray-600 bg-gray-900/50 hover:border-gray-500'
                }`}
              >
                <svg className="w-8 h-8 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
                <div className="text-sm font-medium text-white">Credit Card</div>
              </button>

              <button
                type="button"
                onClick={() => setSelectedMethod(PAYMENT_METHODS.PAYPAL)}
                className={`p-4 border-2 rounded-lg transition-all ${
                  selectedMethod === PAYMENT_METHODS.PAYPAL
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-gray-600 bg-gray-900/50 hover:border-gray-500'
                }`}
              >
                <svg className="w-8 h-8 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <div className="text-sm font-medium text-white">PayPal</div>
              </button>

              <button
                type="button"
                onClick={() => setSelectedMethod(PAYMENT_METHODS.BANK_TRANSFER)}
                className={`p-4 border-2 rounded-lg transition-all ${
                  selectedMethod === PAYMENT_METHODS.BANK_TRANSFER
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-gray-600 bg-gray-900/50 hover:border-gray-500'
                }`}
              >
                <svg className="w-8 h-8 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
                </svg>
                <div className="text-sm font-medium text-white">Bank Transfer</div>
              </button>
            </div>
          </div>

          {/* Credit Card Form */}
          {selectedMethod === PAYMENT_METHODS.CREDIT_CARD && (
            <div className="space-y-4">
              {/* Card Number */}
              <div>
                <label htmlFor="cardNumber" className="block text-sm font-medium text-gray-300 mb-2">
                  Card Number <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  id="cardNumber"
                  name="cardNumber"
                  value={cardData.cardNumber}
                  onChange={handleCardChange}
                  placeholder="1234 5678 9012 3456"
                  required
                  className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                />
              </div>

              {/* Cardholder Name */}
              <div>
                <label htmlFor="cardName" className="block text-sm font-medium text-gray-300 mb-2">
                  Cardholder Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  id="cardName"
                  name="cardName"
                  value={cardData.cardName}
                  onChange={handleCardChange}
                  placeholder="John Doe"
                  required
                  className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                />
              </div>

              {/* Expiry and CVV */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="expiryDate" className="block text-sm font-medium text-gray-300 mb-2">
                    Expiry Date <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    id="expiryDate"
                    name="expiryDate"
                    value={cardData.expiryDate}
                    onChange={handleCardChange}
                    placeholder="MM/YY"
                    required
                    className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                  />
                </div>
                <div>
                  <label htmlFor="cvv" className="block text-sm font-medium text-gray-300 mb-2">
                    CVV <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    id="cvv"
                    name="cvv"
                    value={cardData.cvv}
                    onChange={handleCardChange}
                    placeholder="123"
                    required
                    className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                  />
                </div>
              </div>

              {/* Billing ZIP */}
              <div>
                <label htmlFor="billingZip" className="block text-sm font-medium text-gray-300 mb-2">
                  Billing ZIP/Postal Code <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  id="billingZip"
                  name="billingZip"
                  value={cardData.billingZip}
                  onChange={handleCardChange}
                  placeholder="12345"
                  required
                  className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                />
              </div>
            </div>
          )}

          {/* PayPal */}
          {selectedMethod === PAYMENT_METHODS.PAYPAL && (
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-6 text-center">
              <svg className="w-16 h-16 mx-auto mb-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <p className="text-white mb-2 font-semibold">You&apos;ll be redirected to PayPal</p>
              <p className="text-sm text-gray-400">Click Continue to complete payment through PayPal</p>
            </div>
          )}

          {/* Bank Transfer */}
          {selectedMethod === PAYMENT_METHODS.BANK_TRANSFER && (
            <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-6">
              <h4 className="text-white font-semibold mb-3">Bank Transfer Instructions</h4>
              <div className="space-y-2 text-sm text-gray-300">
                <p><strong>Account Name:</strong> ZeroSec Technologies Inc.</p>
                <p><strong>Account Number:</strong> 1234567890</p>
                <p><strong>Routing Number:</strong> 021000021</p>
                <p><strong>Reference:</strong> ORG-{organizationData.organizationName.substring(0, 10).toUpperCase()}</p>
              </div>
              <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded text-xs text-yellow-300">
                <strong>Note:</strong> Your account will be activated once payment is received (1-3 business days)
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-4 pt-6">
            <Button
              type="button"
              variant="secondary"
              onClick={onBack}
              disabled={isLoading}
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
              disabled={isLoading}
              className="flex-1 py-3"
            >
              {isLoading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Processing...
                </span>
              ) : (
                <>
                  Continue
                  <svg className="w-5 h-5 ml-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </>
              )}
            </Button>
          </div>

          {selectedMethod === PAYMENT_METHODS.BANK_TRANSFER && (
            <button
              type="button"
              onClick={handleSkipPayment}
              className="w-full text-sm text-gray-400 hover:text-gray-300 transition-colors"
              disabled={isLoading}
            >
              I&apos;ll complete the payment later
            </button>
          )}
        </form>
      ) : (
        // Free Plan - Just show continue button
        <div className="space-y-6">
          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-6 text-center">
            <svg className="w-16 h-16 mx-auto mb-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-white text-lg font-semibold mb-2">No payment required!</p>
            <p className="text-gray-400 text-sm">You&apos;re starting with our Free plan. You can upgrade anytime from your dashboard.</p>
          </div>

          <div className="flex items-center gap-4">
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
              type="button"
              variant="primary"
              onClick={handleSubmit}
              className="flex-1 py-3"
            >
              Complete Setup
              <svg className="w-5 h-5 ml-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </Button>
          </div>
        </div>
      )}

      {/* Security Badge */}
      <div className="mt-8 pt-8 border-t border-gray-700">
        <div className="flex items-center justify-center gap-6 text-xs text-gray-400">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <span>256-bit SSL Encryption</span>
          </div>
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <span>PCI DSS Compliant</span>
          </div>
        </div>
      </div>
    </div>
  );
}
