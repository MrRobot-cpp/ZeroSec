"use client";
import { useState, useEffect } from "react";
import Link from "next/link";

export default function Landing() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [pricingMode, setPricingMode] = useState('monthly');

  // Handle scroll for navbar background
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const features = [
    {
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      ),
      title: "Real-time Protection",
      description: "Monitor and protect your RAG applications from prompt injection attacks and data leakage in real-time.",
    },
    {
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      title: "Advanced Analytics",
      description: "Comprehensive dashboards with detailed metrics, threat analysis, and security insights for your applications.",
    },
    {
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      ),
      title: "PII Detection",
      description: "Automatically detect and protect sensitive personal information from being exposed through AI responses.",
    },
    {
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
      title: "Instant Verdicts",
      description: "Get immediate allow or block decisions on every query with detailed explanations and threat classifications.",
    },
    {
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      title: "Document Management",
      description: "Securely upload, manage, and control access to documents used in your RAG knowledge base.",
    },
    {
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
      title: "Easy Integration",
      description: "Simple API integration with your existing RAG infrastructure. Get protected in minutes, not days.",
    },
  ];

  const stats = [
    { value: "99.9%", label: "Threat Detection Rate" },
    { value: "<50ms", label: "Average Response Time" },
    { value: "10M+", label: "Queries Protected" },
    { value: "24/7", label: "Monitoring & Support" },
  ];

  const steps = [
    {
      number: "01",
      title: "Connect Your RAG",
      description: "Integrate ZeroSec with your existing RAG application using our simple API or SDK.",
    },
    {
      number: "02",
      title: "Configure Policies",
      description: "Set up custom security rules and policies tailored to your application's needs.",
    },
    {
      number: "03",
      title: "Monitor & Protect",
      description: "Get real-time protection with comprehensive monitoring and instant threat response.",
    },
  ];

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Skip to main content link for accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-blue-600 text-white px-4 py-2 rounded-md z-50"
      >
        Skip to main content
      </a>

      {/* Navigation */}
      <nav
        className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${
          isScrolled ? "bg-gray-900/95 backdrop-blur-sm shadow-lg" : "bg-transparent"
        }`}
        role="navigation"
        aria-label="Main navigation"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-20">
            {/* Logo */}
            <Link
              href="/"
              className="flex items-center space-x-2 text-xl sm:text-2xl font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-md"
              aria-label="ZeroSec Home"
            >
              <span aria-hidden="true">🛡️</span>
              <span>ZeroSec</span>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-8">
              <a
                href="#features"
                className="text-gray-300 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-md px-2 py-1"
              >
                Features
              </a>
              <a
                href="#how-it-works"
                className="text-gray-300 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-md px-2 py-1"
              >
                How It Works
              </a>
              <a
                href="#stats"
                className="text-gray-300 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-md px-2 py-1"
              >
                Stats
              </a>
              <a
                href="#pricing"
                className="text-gray-300 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-md px-2 py-1"
              >
                Pricing
              </a>
              <Link
                href="/login"
                className="text-gray-300 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-md px-2 py-1"
              >
                Sign In
              </Link>
              <Link
                href="/signup"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900"
              >
                Get Started
              </Link>
            </div>

            {/* Mobile menu button */}
            <button
              type="button"
              className="md:hidden p-2 rounded-md text-gray-300 hover:text-white hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-menu"
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            >
              {mobileMenuOpen ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>

          {/* Mobile Navigation */}
          <div
            id="mobile-menu"
            className={`md:hidden transition-all duration-300 overflow-hidden ${
              mobileMenuOpen ? "max-h-96 pb-4" : "max-h-0"
            }`}
            aria-hidden={!mobileMenuOpen}
          >
            <div className="flex flex-col space-y-3 pt-2">
              <a
                href="#features"
                className="text-gray-300 hover:text-white transition-colors px-2 py-2 rounded-md hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                onClick={() => setMobileMenuOpen(false)}
              >
                Features
              </a>
              <a
                href="#how-it-works"
                className="text-gray-300 hover:text-white transition-colors px-2 py-2 rounded-md hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                onClick={() => setMobileMenuOpen(false)}
              >
                How It Works
              </a>
              <a
                href="#stats"
                className="text-gray-300 hover:text-white transition-colors px-2 py-2 rounded-md hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                onClick={() => setMobileMenuOpen(false)}
              >
                Stats
              </a>
              <a
                href="#pricing"
                className="text-gray-300 hover:text-white transition-colors px-2 py-2 rounded-md hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                onClick={() => setMobileMenuOpen(false)}
              >
                Pricing
              </a>
              <Link
                href="/login"
                className="text-gray-300 hover:text-white transition-colors px-2 py-2 rounded-md hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                onClick={() => setMobileMenuOpen(false)}
              >
                Sign In
              </Link>
              <Link
                href="/signup"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md font-medium text-center transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                onClick={() => setMobileMenuOpen(false)}
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main id="main-content">
        {/* Hero Section */}
        <section
          className="relative pt-32 sm:pt-40 pb-20 sm:pb-32 px-4 sm:px-6 lg:px-8 overflow-hidden"
          aria-labelledby="hero-heading"
        >
          {/* Background gradient */}
          <div
            className="absolute inset-0 bg-gradient-to-br from-blue-900/20 via-gray-900 to-gray-900"
            aria-hidden="true"
          />
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-blue-600/10 rounded-full blur-3xl"
            aria-hidden="true"
          />

          <div className="relative max-w-7xl mx-auto text-center">
            {/* Badge */}
            <div className="inline-flex items-center px-4 py-2 bg-blue-900/30 border border-blue-700 rounded-full text-blue-300 text-sm mb-8">
              <span className="relative flex h-2 w-2 mr-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
              </span>
              Enterprise-Grade Security for AI Applications
            </div>

            <h1
              id="hero-heading"
              className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6 leading-tight"
            >
              Secure Your{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-blue-600">
                RAG Applications
              </span>
              <br className="hidden sm:block" />
              Against AI Threats
            </h1>

            <p className="text-lg sm:text-xl text-gray-400 max-w-3xl mx-auto mb-10">
              ZeroSec provides real-time protection against prompt injection, data leakage,
              and other AI-specific vulnerabilities. Keep your applications and data safe
              with enterprise-grade security.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/signup"
                className="w-full sm:w-auto px-8 py-4 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold text-lg transition-all hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900"
              >
                Start Free Trial
              </Link>
              <a
                href="#how-it-works"
                className="w-full sm:w-auto px-8 py-4 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg font-semibold text-lg transition-all hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900"
              >
                See How It Works
              </a>
            </div>

            {/* Trust indicators */}
            <div className="mt-16 pt-8 border-t border-gray-800">
              <p className="text-sm text-gray-500 mb-4">Trusted by security-conscious teams worldwide</p>
              <div className="flex flex-wrap items-center justify-center gap-8 opacity-50">
                {["Enterprise", "Startup", "Government", "Healthcare", "Finance"].map((sector) => (
                  <span key={sector} className="text-gray-400 font-semibold text-lg">
                    {sector}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Stats Section */}
        <section
          id="stats"
          className="py-16 sm:py-20 px-4 sm:px-6 lg:px-8 bg-gray-800/50"
          aria-labelledby="stats-heading"
        >
          <h2 id="stats-heading" className="sr-only">Our Statistics</h2>
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
              {stats.map((stat, index) => (
                <div
                  key={index}
                  className="text-center p-6"
                >
                  <div className="text-3xl sm:text-4xl lg:text-5xl font-bold text-blue-500 mb-2">
                    {stat.value}
                  </div>
                  <div className="text-sm sm:text-base text-gray-400">
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section
          id="features"
          className="py-20 sm:py-32 px-4 sm:px-6 lg:px-8"
          aria-labelledby="features-heading"
        >
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2
                id="features-heading"
                className="text-3xl sm:text-4xl font-bold mb-4"
              >
                Comprehensive Security Features
              </h2>
              <p className="text-lg text-gray-400 max-w-2xl mx-auto">
                Everything you need to protect your RAG applications from modern AI threats.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
              {features.map((feature, index) => (
                <article
                  key={index}
                  className="group p-6 lg:p-8 bg-gray-800 border border-gray-700 rounded-xl hover:border-blue-600 transition-all duration-300 hover:shadow-lg hover:shadow-blue-900/20"
                >
                  <div className="w-14 h-14 bg-blue-900/30 border border-blue-700 rounded-lg flex items-center justify-center text-blue-400 mb-6 group-hover:scale-110 transition-transform">
                    {feature.icon}
                  </div>
                  <h3 className="text-xl font-semibold mb-3">
                    {feature.title}
                  </h3>
                  <p className="text-gray-400 leading-relaxed">
                    {feature.description}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section
          id="how-it-works"
          className="py-20 sm:py-32 px-4 sm:px-6 lg:px-8 bg-gray-800/30"
          aria-labelledby="how-it-works-heading"
        >
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2
                id="how-it-works-heading"
                className="text-3xl sm:text-4xl font-bold mb-4"
              >
                How It Works
              </h2>
              <p className="text-lg text-gray-400 max-w-2xl mx-auto">
                Get started with ZeroSec in three simple steps.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8 lg:gap-12">
              {steps.map((step, index) => (
                <div
                  key={index}
                  className="relative text-center md:text-left"
                >
                  {/* Connector line for desktop */}
                  {index < steps.length - 1 && (
                    <div
                      className="hidden md:block absolute top-8 left-[60%] w-full h-0.5 bg-gradient-to-r from-blue-600 to-transparent"
                      aria-hidden="true"
                    />
                  )}
                  <div className="relative inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-full text-2xl font-bold mb-6">
                    {step.number}
                  </div>
                  <h3 className="text-xl font-semibold mb-3">
                    {step.title}
                  </h3>
                  <p className="text-gray-400 leading-relaxed">
                    {step.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section
          className="py-20 sm:py-32 px-4 sm:px-6 lg:px-8"
          aria-labelledby="cta-heading"
        >
          <div className="max-w-4xl mx-auto text-center">
            <div className="p-8 sm:p-12 lg:p-16 bg-gradient-to-br from-blue-900/50 to-gray-800 border border-gray-700 rounded-2xl">
              <h2
                id="cta-heading"
                className="text-3xl sm:text-4xl font-bold mb-4"
              >
                Ready to Secure Your AI Applications?
              </h2>
              <p className="text-lg text-gray-400 mb-8 max-w-2xl mx-auto">
                Join thousands of developers who trust ZeroSec to protect their RAG applications.
                Start your free trial today.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link
                  href="/signup"
                  className="w-full sm:w-auto px-8 py-4 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold text-lg transition-all hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900"
                >
                  Get Started Free
                </Link>
                <Link
                  href="/login"
                  className="w-full sm:w-auto px-8 py-4 bg-transparent hover:bg-gray-700 border border-gray-600 rounded-lg font-semibold text-lg transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900"
                >
                  Sign In
                </Link>
              </div>
            </div>
          </div>
        </section>
        {/* Subscriptions & Plans Section */}
        <section
          id="pricing"
          className="py-24 px-4 sm:px-6 lg:px-8 bg-gray-900 border-t border-gray-800"
          aria-labelledby="pricing-heading"
        >
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-12">
              <h2 id="pricing-heading" className="text-3xl sm:text-4xl font-bold mb-4">
                Flexible Pricing for <span className="text-blue-400">Powerful AI Security</span>
              </h2>
              <p className="text-lg text-gray-400 max-w-2xl mx-auto">
                From protection to potential: Our multi-layered AI defense helps enterprises deploy with confidence, secure sensitive data, and scale without limits.
              </p>
            </div>
            <div className="flex justify-center mb-10">
              <div className="inline-flex bg-gray-800 rounded-full p-1 border border-gray-700">
                <button
                  className={`px-6 py-2 rounded-full font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${pricingMode === 'monthly' ? 'bg-blue-600 text-white' : 'text-gray-300'}`}
                  onClick={() => setPricingMode('monthly')}
                >
                  Monthly
                </button>
                <button
                  className={`px-6 py-2 rounded-full font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${pricingMode === 'annually' ? 'bg-blue-600 text-white' : 'text-gray-300'}`}
                  onClick={() => setPricingMode('annually')}
                >
                  Annually
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {pricingMode === 'monthly' ? (
                <>
                  {/* Enterprise Monthly */}
                  <div className="bg-gray-800 border border-gray-700 rounded-2xl p-8 flex flex-col shadow-lg hover:shadow-blue-900/20 transition-all">
                    <h3 className="text-xl font-semibold mb-2 text-white">Enterprise</h3>
                    <div className="text-4xl font-bold mb-2 text-blue-400">$929<span className="text-base font-medium text-gray-400">/per month</span></div>
                    <ul className="text-gray-300 text-sm space-y-3 mb-8 mt-4">
                      <li className="flex items-center gap-2"><span className="text-blue-400">●</span> Everything in Professional</li>
                      <li className="flex items-center gap-2"><span className="text-blue-400">●</span> Unlimited API calls</li>
                      <li className="flex items-center gap-2"><span className="text-blue-400">●</span> Dedicated account manager</li>
                    </ul>
                    <button className="mt-auto w-full py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-all">Get Started →</button>
                  </div>
                  {/* Starter Monthly */}
                  <div className="bg-gray-800 border border-gray-700 rounded-2xl p-8 flex flex-col shadow-lg hover:shadow-blue-900/20 transition-all">
                    <h3 className="text-xl font-semibold mb-2 text-white">Starter</h3>
                    <div className="text-4xl font-bold mb-2 text-blue-400">$529<span className="text-base font-medium text-gray-400">/per month</span></div>
                    <ul className="text-gray-300 text-sm space-y-3 mb-8 mt-4">
                      <li className="flex items-center gap-2"><span className="text-blue-400">●</span> Access to core AI tools</li>
                      <li className="flex items-center gap-2"><span className="text-blue-400">●</span> Up to 5,000 API calls/month</li>
                      <li className="flex items-center gap-2"><span className="text-blue-400">●</span> Basic analytics dashboard</li>
                    </ul>
                    <button className="mt-auto w-full py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-all">Get Started →</button>
                  </div>
                  {/* Professional Monthly */}
                  <div className="bg-gray-800 border border-gray-700 rounded-2xl p-8 flex flex-col shadow-lg hover:shadow-blue-900/20 transition-all">
                    <h3 className="text-xl font-semibold mb-2 text-white">Professional</h3>
                    <div className="text-4xl font-bold mb-2 text-blue-400">$729<span className="text-base font-medium text-gray-400">/per month</span></div>
                    <ul className="text-gray-300 text-sm space-y-3 mb-8 mt-4">
                      <li className="flex items-center gap-2"><span className="text-blue-400">●</span> Everything in Starter</li>
                      <li className="flex items-center gap-2"><span className="text-blue-400">●</span> Up to 50,000 API calls/month</li>
                      <li className="flex items-center gap-2"><span className="text-blue-400">●</span> Advanced analytics and reporting</li>
                    </ul>
                    <button className="mt-auto w-full py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-all">Get Started →</button>
                  </div>
                </>
              ) : (
                <>
                  {/* Enterprise Annually */}
                  <div className="bg-gray-800 border border-gray-700 rounded-2xl p-8 flex flex-col shadow-lg hover:shadow-blue-900/20 transition-all">
                    <h3 className="text-xl font-semibold mb-2 text-white">Enterprise</h3>
                    <div className="text-4xl font-bold mb-2 text-blue-400">$900<span className="text-base font-medium text-gray-400">/per month</span></div>
                    <ul className="text-gray-300 text-sm space-y-3 mb-8 mt-4">
                      <li className="flex items-center gap-2"><span className="text-blue-400">●</span> Everything in Professional</li>
                      <li className="flex items-center gap-2"><span className="text-blue-400">●</span> Unlimited API calls</li>
                      <li className="flex items-center gap-2"><span className="text-blue-400">●</span> Dedicated account manager</li>
                      <li className="flex items-center gap-2"><span className="text-blue-400">●</span> Custom integrations and SLA</li>
                      <li className="flex items-center gap-2"><span className="text-blue-400">●</span> 24/7 premium support</li>
                    </ul>
                    <button className="mt-auto w-full py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-all">Get Started →</button>
                  </div>
                  {/* Starter Annually */}
                  <div className="bg-gray-800 border border-gray-700 rounded-2xl p-8 flex flex-col shadow-lg hover:shadow-blue-900/20 transition-all">
                    <h3 className="text-xl font-semibold mb-2 text-white">Starter</h3>
                    <div className="text-4xl font-bold mb-2 text-blue-400">$329<span className="text-base font-medium text-gray-400">/per month</span></div>
                    <ul className="text-gray-300 text-sm space-y-3 mb-8 mt-4">
                      <li className="flex items-center gap-2"><span className="text-blue-400">●</span> Access to core AI tools</li>
                      <li className="flex items-center gap-2"><span className="text-blue-400">●</span> Up to 5,000 API calls/month</li>
                      <li className="flex items-center gap-2"><span className="text-blue-400">●</span> Basic analytics dashboard</li>
                      <li className="flex items-center gap-2"><span className="text-blue-400">●</span> Advanced analytics and reporting</li>
                      <li className="flex items-center gap-2"><span className="text-blue-400">●</span> Dedicated account manager</li>
                    </ul>
                    <button className="mt-auto w-full py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-all">Get Started →</button>
                  </div>
                  {/* Professional Annually */}
                  <div className="bg-gray-800 border border-gray-700 rounded-2xl p-8 flex flex-col shadow-lg hover:shadow-blue-900/20 transition-all">
                    <h3 className="text-xl font-semibold mb-2 text-white">Professional</h3>
                    <div className="text-4xl font-bold mb-2 text-blue-400">$529<span className="text-base font-medium text-gray-400">/per month</span></div>
                    <ul className="text-gray-300 text-sm space-y-3 mb-8 mt-4">
                      <li className="flex items-center gap-2"><span className="text-blue-400">●</span> Everything in Starter</li>
                      <li className="flex items-center gap-2"><span className="text-blue-400">●</span> Up to 50,000 API calls/month</li>
                      <li className="flex items-center gap-2"><span className="text-blue-400">●</span> Advanced analytics and reporting</li>
                      <li className="flex items-center gap-2"><span className="text-blue-400">●</span> Priority email and chat support</li>
                    </ul>
                    <button className="mt-auto w-full py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-all">Get Started →</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer
        className="py-12 px-4 sm:px-6 lg:px-8 border-t border-gray-800"
        role="contentinfo"
      >
        <div className="max-w-7xl mx-auto">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
            {/* Brand */}
            <div className="sm:col-span-2 lg:col-span-1">
              <Link
                href="/"
                className="flex items-center space-x-2 text-xl font-bold mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-md"
                aria-label="ZeroSec Home"
              >
                <span aria-hidden="true">🛡️</span>
                <span>ZeroSec</span>
              </Link>
              <p className="text-gray-400 text-sm leading-relaxed">
                Enterprise-grade security for RAG applications.
                Protect your AI from modern threats.
              </p>
            </div>

            {/* Product Links */}
            <div>
              <h3 className="font-semibold mb-4">Product</h3>
              <ul className="space-y-2">
                {["Features", "Pricing", "Documentation", "API Reference"].map((item) => (
                  <li key={item}>
                    <a
                      href="#"
                      className="text-gray-400 hover:text-white transition-colors text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
                    >
                      {item}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Company Links */}
            <div>
              <h3 className="font-semibold mb-4">Company</h3>
              <ul className="space-y-2">
                {["About", "Blog", "Careers", "Contact"].map((item) => (
                  <li key={item}>
                    <a
                      href="#"
                      className="text-gray-400 hover:text-white transition-colors text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
                    >
                      {item}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Legal Links */}
            <div>
              <h3 className="font-semibold mb-4">Legal</h3>
              <ul className="space-y-2">
                {["Privacy Policy", "Terms of Service", "Security", "Compliance"].map((item) => (
                  <li key={item}>
                    <a
                      href="#"
                      className="text-gray-400 hover:text-white transition-colors text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
                    >
                      {item}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Bottom Footer */}
          <div className="pt-8 border-t border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-gray-500 text-sm">
              © {new Date().getFullYear()} ZeroSec. All rights reserved.
            </p>
           



           
          </div>
        </div>
      </footer>
    </div>
  );
}
