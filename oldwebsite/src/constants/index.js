export const navLinks = [
  {
    id: "home",
    title: "Home",
  },
  {
    id: "features", 
    title: "Features",
  },
  {
    id: "documentation",
    title: "Documentation",
    link: "https://docs.lazaitrader.com",
  },
  {
    id: "get-started", // Updated to match the section id
    title: "Get Started",
    link: "https://docs.lazaitrader.com/introduction/getting-started",
  },
];

// Simplified features - no duplicates
export const features = [
  {
    id: "feature-1",
    icon: "star",
    title: "Strategy Vault",
    content: "Secure knowledge sharing where trading data is contributed anonymously to build collective intelligence and AI-powered recommendations."
  },
  {
    id: "feature-2", 
    icon: "shield",
    title: "Trading Analytics",
    content: "View trading charts and real-time PnL tracking directly in Telegram with comprehensive performance analytics and strategy insights."
  },
  {
    id: "feature-3",
    icon: "send",
    title: "Telegram Trading",
    content: "Execute trades through simple Telegram commands. No complex interfaces - just direct trading with automated strategy execution."
  }
];

export const feedback = [
  {
    id: "feedback-1",
    content: "The Strategy Vault is game-changing! Getting AI recommendations based on anonymous community data has improved my trading performance significantly.",
    name: "Alex Chen",
    title: "Active Trader", 
  },
  {
    id: "feedback-2",
    content: "I love the trading charts in Telegram. Seeing my PnL and performance analytics without leaving the chat makes strategy optimization so much easier.",
    name: "Maria Rodriguez",
    title: "DeFi Enthusiast",
  },
  {
    id: "feedback-3",
    content: "Finally, a trading platform that feels natural. Just tell it what you want to trade, check your charts, and relax knowing your funds stay in your control.",
    name: "James Thompson",
    title: "Crypto Investor",
  },
];

export const stats = [
  {
    id: "stats-1",
    title: "Active Users",
    value: "110+",
  },
  {
    id: "stats-2", 
    title: "Trading Pairs",
    value: "2",
  },
  {
    id: "stats-3",
    title: "Transactions",
    value: "10K+",
  },
];

// Simplified footer links - no duplicates, cleaner structure
export const footerLinks = [
  {
    title: "Navigation",
    links: [
      { name: "Features", link: "#features" },
      { name: "Competition", link: "#hyperhack" },
      { name: "Get Started", link: "#get-started" }
    ],
  },
  {
    title: "Support",
    links: [
      { name: "Documentation", link: "https://docs.lazaitrader.com" },
      { name: "AI Support Bot", link: "https://t.me/LazaiTrader_alithbot" },
      { name: "Trading Bot", link: "https://t.me/LazaiTrader_bot" }
    ],
  },
  {
    title: "Partners",
    links: [
      { name: "HyperHack", link: "https://hyperion.metis.io/#HyperHack-Hackathon" },
      { name: "Hyperion Network", link: "https://hyperion.metis.io/" },
      { name: "Metis", link: "https://metis.io" },
      { name: "LAzAI Network", link: "https://lazai.network" }
    ],
  },
];

// Updated social media with X instead of Twitter
export const socialMedia = [
  {
    id: "social-media-1",
    icon: "x", // Updated from twitter to x
    link: "https://x.com/lazaitrader",
  },
  {
    id: "social-media-2",
    icon: "telegram",
    link: "https://t.me/LazaiTrader_bot",
  },
];

export const clients = [
  {
    id: "client-2", 
    logo: "binance",
  },
  {
    id: "client-3",
    logo: "coinbase",
  },
  {
    id: "client-4",
    logo: "dropbox",
  },
];