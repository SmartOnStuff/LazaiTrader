import React from 'react';

// Mock icons - in real implementation, these would be imported from assets
const StarIcon = () => (
  <svg className="w-full h-full" fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
  </svg>
);

const ShieldIcon = () => (
  <svg className="w-full h-full" fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3z"/>
  </svg>
);

const SendIcon = () => (
  <svg className="w-full h-full" fill="currentColor" viewBox="0 0 24 24">
    <path d="m2 21 21-9L2 3v7l15 2-15 2v7z"/>
  </svg>
);

const Features = () => {
  const features = [
    {
      id: "feature-1",
      icon: <StarIcon />,
      title: "Strategy Vault",
      content: "Secure knowledge sharing where trading data is contributed anonymously to build collective intelligence and AI-powered recommendations."
    },
    {
      id: "feature-2", 
      icon: <ShieldIcon />,
      title: "Trading Analytics",
      content: "View trading charts and real-time PnL tracking directly in Telegram with comprehensive performance analytics and strategy insights."
    },
    {
      id: "feature-3",
      icon: <SendIcon />,
      title: "Telegram Trading",
      content: "Execute trades through simple Telegram commands. No complex interfaces - just direct trading with automated strategy execution."
    }
  ];

  return (
    <section id="features" className="flex flex-col py-16 px-6 sm:px-16">
      <div className="text-center mb-16">
        <h2 className="font-semibold text-4xl sm:text-5xl text-white leading-tight mb-6">
          Why Choose LazaiTrader
        </h2>
        <p className="font-normal text-gray-300 text-lg leading-8 max-w-2xl mx-auto">
          Built on robust Alith framework infrastructure, LazaiTrader is live on Metis Andromeda mainnet using Hercules.exchange for trade execution. Our platform adapts to market conditions while maintaining your trading philosophy, bringing institutional-grade strategies to everyone through a familiar messaging interface.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        {features.map((feature) => (
          <div 
            key={feature.id} 
            className="flex flex-col items-start p-6 rounded-2xl bg-transparent hover:bg-gray-800 transition-all duration-300 hover:shadow-2xl group"
          >
            <div className="w-16 h-16 rounded-full flex items-center justify-center bg-gradient-to-r from-cyan-400 to-blue-500 text-gray-900 mb-4 group-hover:scale-110 transition-transform">
              {feature.icon}
            </div>
            <h3 className="font-semibold text-xl text-white mb-3">
              {feature.title}
            </h3>
            <p className="font-normal text-gray-300 text-base leading-6">
              {feature.content}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
};

export default Features;