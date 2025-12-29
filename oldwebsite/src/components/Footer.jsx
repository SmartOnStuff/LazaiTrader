import React from 'react';

const Footer = () => {
  // Simplified footer links
  const footerLinks = [
    {
      title: "Navigation",
      links: [
        { name: "Features", link: "#features" },
        { name: "Competition", link: "#hyperhack" },
        { name: "Get Started", link: "#get-started" }
      ]
    },
    {
      title: "Support",
      links: [
        { name: "Documentation", link: "https://docs.lazaitrader.com" },
        { name: "AI Support Bot", link: "https://t.me/LazaiTrader_alithbot" },
        { name: "Trading Bot", link: "https://t.me/LazaiTrader_bot" }
      ]
    },
    {
      title: "Partners",
      links: [
        { name: "HyperHack", link: "https://hyperion.metis.io/#HyperHack-Hackathon" },
        { name: "Hyperion Network", link: "https://hyperion.metis.io/" },
        { name: "Metis", link: "https://metis.io" },
        { name: "LAzAI Network", link: "https://lazai.network" }
      ]
    }
  ];

  // Updated social media with X logo
  const socialMedia = [
    {
      id: "x",
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
        </svg>
      ),
      link: "https://x.com/lazaitrader"
    },
    {
      id: "telegram",
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
        </svg>
      ),
      link: "https://t.me/LazaiTrader_bot"
    }
  ];

  return (
    <section className="flex justify-center py-16 flex-col px-6 sm:px-16">
      <div className="flex justify-start md:flex-row flex-col mb-8 w-full">
        <div className="flex-1 flex flex-col justify-start mr-10">
          <div className="flex items-center mb-4">
            <div className="w-18 h-18 bg-cyan-400 rounded-full mr-4 flex items-center justify-center">
              <span className="text-gray-900 font-bold text-2xl">L</span>
            </div>
            <span className="font-bold text-3xl text-white">LazaiTrader</span>
          </div>
          <p className="font-normal text-gray-300 text-lg leading-8 mt-4 max-w-sm">
            AI-powered trading on Telegram. Your funds, your control.
          </p>
        </div>
        
        <div className="flex-1 w-full flex flex-row justify-between flex-wrap md:mt-0 mt-10">
          {footerLinks.map((linkGroup) => (
            <div key={linkGroup.title} className="flex flex-col my-4 min-w-[150px]">
              <h4 className="font-medium text-lg leading-7 text-white">
                {linkGroup.title}
              </h4>
              <ul className="list-none mt-4">
                {linkGroup.links.map((item, index) => (
                  <li 
                    key={item.name} 
                    className={`font-normal text-base leading-6 text-gray-300 hover:text-cyan-400 cursor-pointer transition-colors ${
                      index !== linkGroup.links.length - 1 ? 'mb-4' : 'mb-0'
                    }`}
                  >
                    <a 
                      href={item.link} 
                      target={item.link.startsWith('http') ? "_blank" : "_self"}
                      rel={item.link.startsWith('http') ? "noopener noreferrer" : undefined}
                    >
                      {item.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      
      <div className="w-full flex justify-between items-center md:flex-row flex-col pt-6 border-t border-gray-700">
        <p className="font-normal text-center text-lg leading-7 text-white">
          2025 LazaiTrader. All Rights Reserved.
        </p>  
        <div className="flex flex-row md:mt-0 mt-6">
          {socialMedia.map((social, index) => (
            <a 
              key={social.id} 
              href={social.link} 
              target="_blank" 
              rel="noopener noreferrer"
              className={`text-gray-300 hover:text-cyan-400 transition-colors ${
                index !== socialMedia.length - 1 ? 'mr-6' : 'mr-0'
              }`}
            >
              {social.icon}
            </a>
          ))}
        </div>    
      </div>
    </section>
  );
};

export default Footer;
