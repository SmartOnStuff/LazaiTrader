import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

const config: Config = {
  title: 'LazaiTrader',
  tagline: 'Automated Crypto Trading via Telegram',
  favicon: 'img/favicon.ico',

  // Future flags, see https://docusaurus.io/docs/api/docusaurus-config#future
  future: {
    v4: true, // Improve compatibility with the upcoming Docusaurus v4
  },

  // Set the production url of your site here
  url: 'https://smartonstuff.github.io',
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: '/LazaiTrader/',

  // GitHub pages deployment config.
  // If you aren't using GitHub pages, you don't need these.
  organizationName: 'SmartOnStuff', // Usually your GitHub org/user name.
  projectName: 'LazaiTrader', // Usually your repo name.

  onBrokenLinks: 'throw',

  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang. For example, if your site is Chinese, you
  // may want to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          routeBasePath: '/', // Serve docs at the site's root
          // Please change this to your repo.
          // Remove this to remove the "edit this page" links.
          editUrl:
            'https://github.com/SmartOnStuff/LazaiTrader/tree/main/website/',
        },
        blog: false, // Disable blog
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    // Replace with your project's social card
    image: 'img/docusaurus-social-card.jpg',
    colorMode: {
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'LazaiTrader',
      logo: {
        alt: 'LazaiTrader Logo',
        src: 'img/logo.svg',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'docsSidebar',
          position: 'left',
          label: 'Documentation',
        },
        {
          href: 'https://t.me/lazaitrader_bot',
          label: 'Telegram Bot',
          position: 'right',
        },
        {
          href: 'https://github.com/SmartOnStuff/LazaiTrader',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Documentation',
          items: [
            {
              label: 'Getting Started',
              to: '/introduction/getting-started',
            },
            {
              label: 'User Guide',
              to: '/user-guide/registration',
            },
            {
              label: 'Technical Docs',
              to: '/technical/architecture-overview',
            },
          ],
        },
        {
          title: 'Community',
          items: [
            {
              label: 'Telegram Bot',
              href: 'https://t.me/lazaitrader_bot',
            },
          ],
        },
        {
          title: 'Legal',
          items: [
            {
              label: 'Terms of Service',
              to: '/legal/TERMS_OF_SERVICE',
            },
            {
              label: 'Privacy Policy',
              to: '/legal/PRIVACY_POLICY',
            },
            {
              label: 'Disclaimer',
              to: '/legal/DISCLAIMER',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} LazaiTrader. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
