import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

const sidebars: SidebarsConfig = {
  docsSidebar: [
    {
      type: 'doc',
      id: 'index',
      label: 'LazaiTrader',
    },
    {
      type: 'category',
      label: 'Introduction',
      items: [
        'introduction/what-is-lazaitrader',
        'introduction/how-it-works',
        'introduction/getting-started',
      ],
    },
    {
      type: 'category',
      label: 'User Guide',
      items: [
        'user-guide/registration',
        'user-guide/wallet-setup',
        'user-guide/checking-balances',
        'user-guide/configuring-strategies',
        'user-guide/managing-strategies',
        'user-guide/withdrawing-funds',
        'user-guide/viewing-performance',
        'user-guide/commands-reference',
      ],
    },
    {
      type: 'category',
      label: 'Security',
      items: [
        'security/non-custodial-wallets',
        'security/deterministic-addresses',
        'security/dex-whitelist',
        'security/how-funds-are-protected',
      ],
    },
    {
      type: 'category',
      label: 'Supported Networks',
      items: [
        'supported-networks/chains',
        'supported-networks/tokens',
        'supported-networks/trading-pairs',
      ],
    },
    {
      type: 'category',
      label: 'Decentralized Exchanges',
      items: [
        'decentralized-exchanges/overview',
        'decentralized-exchanges/hercules-dex',
        'decentralized-exchanges/lazaiswap',
      ],
    },
    {
      type: 'category',
      label: 'Project Infrastructure',
      items: [
        'project-infrastructure/contract-addresses',
        'project-infrastructure/project-wallets',
      ],
    },
    {
      type: 'category',
      label: 'Roadmap',
      items: [
        'roadmap/current-features',
        'roadmap/cross-chain-expansion',
        'roadmap/ai-strategy-engine',
        'roadmap/strategy-vault',
        'roadmap/security-enhancements',
      ],
    },
    {
      type: 'category',
      label: 'Technical Documentation',
      items: [
        'technical/architecture-overview',
        'technical/database-schema',
        {
          type: 'category',
          label: 'For Developers',
          link: {
            type: 'doc',
            id: 'technical/for-developers/index',
          },
          items: [
            'technical/for-developers/contributing',
            'technical/for-developers/local-development',
            'technical/for-developers/workers-reference',
            'technical/for-developers/smart-contracts',
          ],
        },
      ],
    },
    {
      type: 'category',
      label: 'Legal',
      items: [
        'legal/DISCLAIMER',
        'legal/TERMS_OF_SERVICE',
        'legal/PRIVACY_POLICY',
        'legal/RESTRICTED_JURISDICTIONS',
      ],
    },
        {
      type: 'category',
      label: 'Branding',
      items: [
        'branding/branding-principles',
      ],
    },
  ],
};

export default sidebars;
