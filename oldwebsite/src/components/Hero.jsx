import React from 'react';

const Hero = () => {
  const handleLearnMore = (e) => {
    e.preventDefault();
    const featuresSection = document.getElementById('features');
    if (featuresSection) {
      featuresSection.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    } else {
      // Optional: fallback for mobile browsers that may not scroll correctly
      window.location.hash = '#features';
    }
  };

  return (
    <section id="home" className="flex md:flex-row flex-col py-16 px-6 sm:px-16">
      <div className="flex-1 flex flex-col xl:px-0">
        <div className="flex flex-row justify-between items-center w-full">
          <h1 className="flex-1 font-semibold text-4xl sm:text-6xl lg:text-7xl text-white leading-tight">
            LazaiTrader <br className="sm:block hidden" />{" "}
            <span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">AI-Powered</span>{" "}
            Trading on Telegram.
          </h1>
        </div>
        <p className="font-normal text-gray-300 text-lg leading-8 max-w-md mt-5">
          AI-powered trading strategies meet professional-grade tools. Live on Metis Andromeda mainnet using Hercules.exchange infrastructure, all accessible through simple Telegram conversations.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 mt-8">
          <a
            href="https://t.me/LazaiTrader_bot"
            target="_blank"
            rel="noopener noreferrer"
            className="py-4 px-6 bg-gradient-to-r from-cyan-400 to-blue-500 font-medium text-lg text-gray-900 rounded-xl hover:opacity-90 transition-opacity text-center"
          >
            Start Trading Now
          </a>
          <button
            onClick={handleLearnMore}
            className="py-4 px-6 font-medium text-lg text-cyan-400 border border-cyan-400 rounded-xl hover:bg-cyan-400 hover:text-gray-900 transition-all duration-300 text-center hidden sm:inline-block"
          >
            Learn More
          </button>
        </div>
      </div>
      
      <div className="flex-1 flex justify-center items-center md:my-0 my-10 relative">
        <div className="w-80 h-80 rounded-full bg-gradient-to-r from-cyan-400/20 to-purple-400/20 flex items-center justify-center relative">
          <div className="w-64 h-64 rounded-full bg-gradient-to-r from-cyan-400/30 to-blue-500/30 flex items-center justify-center">
            <div className="w-48 h-48 rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 flex items-center justify-center">
              <svg className="w-24 h-24 text-gray-900" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
            </div>
          </div>
          <div className="absolute z-0 w-40 h-32 top-0 bg-gradient-to-r from-pink-400/30 to-purple-400/30 rounded-full blur-3xl" />
          <div className="absolute z-0 w-80 h-80 rounded-full bg-white/10 blur-3xl bottom-40" />
          <div className="absolute z-0 w-48 h-48 right-20 bottom-20 bg-gradient-to-r from-blue-400/20 to-cyan-400/20 rounded-full blur-3xl"/>
        </div>
      </div>
    </section>
  );
};

export default Hero;