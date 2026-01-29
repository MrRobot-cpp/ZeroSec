import OnboardingWizard from '@/components/OnboardingWizard';

export const metadata = {
  title: 'Get Started - ZeroSec',
  description: 'Create your organization and start securing your RAG applications',
};

export default function OnboardingPage() {
  return <OnboardingWizard />;
}
