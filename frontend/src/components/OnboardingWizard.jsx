'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import OrganizationSetup from './onboarding/OrganizationSetup';
import PlanSelection from './onboarding/PlanSelection';
import AdminSetup from './onboarding/AdminSetup';
import PaymentSetup from './onboarding/PaymentSetup';

export default function OnboardingWizard() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [organizationData, setOrganizationData] = useState({
    organizationName: '',
    planId: null,
    planName: '',
    adminData: null
  });

  const totalSteps = 4;

  const handleOrganizationSubmit = (name) => {
    setOrganizationData(prev => ({
      ...prev,
      organizationName: name
    }));
    setCurrentStep(2);
  };

  const handlePlanSelect = (planId, planName) => {
    setOrganizationData(prev => ({
      ...prev,
      planId,
      planName
    }));
    setCurrentStep(3);
  };

  const handleAdminSetup = (adminData) => {
    // Store admin data for registration after payment
    setOrganizationData(prev => ({
      ...prev,
      adminData
    }));
    // Move to payment step
    setCurrentStep(4);
  };

  const handlePaymentComplete = async (paymentResult) => {
    // Payment completed successfully (frontend only)
    console.log('Payment completed:', paymentResult);

    // Now register the user with all collected data
    try {
      const { register, login } = await import('@/services/authService');

      console.log('Creating account with data:', {
        username: organizationData.adminData.username,
        email: organizationData.adminData.email,
        organization_name: organizationData.organizationName,
        planId: organizationData.planId
      });

      // Register the user
      await register({
        username: organizationData.adminData.username,
        email: organizationData.adminData.email,
        password: organizationData.adminData.password,
        organization_name: organizationData.organizationName,
        planId: organizationData.planId
      }, false); // Don't auto-login yet

      // Now login the user
      await login(organizationData.adminData.username, organizationData.adminData.password);

      // Redirect to dashboard
      router.push('/dashboard');
    } catch (error) {
      console.error('Registration/Login failed:', error);
      // Show error - maybe add a modal or redirect to login with error
      alert('Account creation failed: ' + error.message);
      router.push('/login');
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 flex flex-col">
      {/* Progress Bar */}
      <div className="w-full bg-gray-800/50 backdrop-blur-sm border-b border-gray-700">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold text-white">
              {currentStep === 1 && 'Workspace Identity'}
              {currentStep === 2 && 'Choose Your Plan'}
              {currentStep === 3 && 'Create Root Administrator'}
              {currentStep === 4 && 'Payment Information'}
            </h2>
            <span className="text-sm text-gray-400">
              Step {currentStep} of {totalSteps}
            </span>
          </div>

          {/* Progress Steps */}
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4].map((step) => (
              <div key={step} className="flex-1">
                <div className={`h-2 rounded-full transition-all duration-300 ${
                  step < currentStep
                    ? 'bg-green-500'
                    : step === currentStep
                    ? 'bg-blue-500'
                    : 'bg-gray-700'
                }`} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-4xl">
          {currentStep === 1 && (
            <OrganizationSetup
              initialValue={organizationData.organizationName}
              onSubmit={handleOrganizationSubmit}
            />
          )}

          {currentStep === 2 && (
            <PlanSelection
              selectedPlanId={organizationData.planId}
              onSelectPlan={handlePlanSelect}
              onBack={handleBack}
            />
          )}

          {currentStep === 3 && (
            <AdminSetup
              organizationData={organizationData}
              onBack={handleBack}
              onSuccess={handleAdminSetup}
            />
          )}

          {currentStep === 4 && (
            <PaymentSetup
              organizationData={organizationData}
              onBack={handleBack}
              onComplete={handlePaymentComplete}
            />
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="bg-gray-800/50 backdrop-blur-sm border-t border-gray-700 py-4">
        <div className="max-w-4xl mx-auto px-4 text-center text-sm text-gray-400">
          <p>Secure your organization with ZeroSec&apos;s enterprise security platform</p>
        </div>
      </div>
    </div>
  );
}
