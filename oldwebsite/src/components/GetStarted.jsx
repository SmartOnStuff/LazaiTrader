import React from 'react';

const GetStarted = () => {
  return (
    <section id="get-started" className="flex md:flex-row-reverse md:items-center flex-col py-16 px-6 sm:px-16">
      <div className="flex-1 flex justify-center items-center md:ml-10 ml-0 md:mt-0 mt-10 relative">
        <div className="w-full h-96 relative z-5 bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl flex items-center justify-center">
          <div className="text-center">
            <div className="w-24 h-24 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full mx-auto mb-4 flex items-center justify-center">
              <svg className="w-12 h-12 text-gray-900" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-5 2.5l-3 3-3-3h6zM4 6h16v2l-8 5L4 8V6z"/>
              </svg>
            </div>
            <p className="text-gray-300 font-medium">Telegram Trading Interface</p>
          </div>
        </div>
        <div className="absolute z-3 -left-1/4 top-0 w-1/2 h-1/2 rounded-full bg-white/20 blur-3xl"/>
        <div className="absolute z-0 -left-1/4 bottom-0 w-1/2 h-1/2 rounded-full bg-gradient-to-r from-pink-400/20 to-purple-400/20 blur-3xl"/>
      </div>
      
      <div className="flex-1 flex justify-start items-start flex-col">
        <h2 className="font-semibold text-4xl sm:text-5xl text-white leading-tight w-full">
          Start Trading in Seconds
        </h2>
        <p className="font-normal text-gray-300 text-lg leading-8 max-w-md mt-5">
          Start trading in seconds. Your keys, your funds, your control. Live on Metis Andromeda mainnet with Hercules.exchange infrastructure. Just open Telegram and begin.
        </p>
        
        <div className="mt-8 space-y-4">
          <div className="flex items-start space-x-3">
            <div className="w-2 h-2 bg-cyan-400 rounded-full mt-2 flex-shrink-0"></div>
            <div>
              <h4 className="font-semibold text-white text-base mb-1">
                Simple Commands
              </h4>
              <p className="font-normal text-gray-300 text-sm leading-5">
                Execute trades through straightforward Telegram messages - no complex interfaces needed.
              </p>
            </div>
          </div>
          
          <div className="flex items-start space-x-3">
            <div className="w-2 h-2 bg-cyan-400 rounded-full mt-2 flex-shrink-0"></div>
            <div>
              <h4 className="font-semibold text-white text-base mb-1">
                Real-time Analytics
              </h4>
              <p className="font-normal text-gray-300 text-sm leading-5">
                View your trading performance and charts directly in Telegram with instant updates.
              </p>
            </div>
          </div>
          
          <div className="flex items-start space-x-3">
            <div className="w-2 h-2 bg-cyan-400 rounded-full mt-2 flex-shrink-0"></div>
            <div>
              <h4 className="font-semibold text-white text-base mb-1">
                Your Keys, Your Funds
              </h4>
              <p className="font-normal text-gray-300 text-sm leading-5">
                Non-custodial design means complete control. Your wallet, your assets, always.
              </p>
            </div>
          </div>
        </div>
        
        <a 
          href="https://t.me/LazaiTrader_bot"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-10 py-4 px-6 bg-gradient-to-r from-cyan-400 to-blue-500 font-medium text-lg text-gray-900 rounded-xl hover:opacity-90 transition-opacity"
        >
          Launch Telegram Bot
        </a>
      </div>  
    </section>
  );
};

export default GetStarted;