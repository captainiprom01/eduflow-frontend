const { chromium, firefox, webkit } = require('playwright');

const baseURL = process.env.EDUFLOW_URL || 'https://eduflow-cip.onrender.com';
const browsers = [
  ['chromium', chromium, {}],
  ['firefox', firefox, {}],
  ['webkit', webkit, {}],
];
if (process.env.PLAYWRIGHT_EDGE === '1') browsers.push(['edge', chromium, { channel: 'msedge' }]);
const viewports = [
  ['phone-portrait', 390, 844, true],
  ['phone-landscape', 844, 390, true],
  ['tablet-portrait', 768, 1024, true],
  ['tablet-landscape', 1024, 768, true],
  ['desktop', 1440, 900, false],
];
const expected = {
  metaTheme: '#11195A',
  blue: '#315BEA',
  teal: '#159E93',
  paper: '#F7F9FC',
};
const localAudit = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(baseURL);

function unique(items) {
  return [...new Set(items)];
}

async function checkBrowser(name, engine, launchOptions) {
  const browser = await engine.launch({ headless: true, ...launchOptions });
  const results = [];
  try {
    for (const [viewportName, width, height, touch] of viewports) {
      const context = await browser.newContext({
        viewport: { width, height },
        isMobile: touch && name !== 'webkit' ? true : false,
        hasTouch: touch && name !== 'webkit',
        deviceScaleFactor: 1,
      });
      const page = await context.newPage();
      const consoleErrors = [];
      const pageErrors = [];
      const failedRequests = [];
      page.on('console', message => {
        const text = message.text();
        const knownReportOnlyCspDiagnostic = text.includes('Content-Security-Policy: (Report-Only policy)');
        const localGoogleOriginDiagnostic = localAudit && (text.includes('[GSI_LOGGER]') || text.includes('Failed to load resource'));
        if (message.type() === 'error' && !knownReportOnlyCspDiagnostic && !localGoogleOriginDiagnostic) consoleErrors.push(text);
      });
      page.on('pageerror', error => pageErrors.push(String(error)));
      page.on('requestfailed', request => {
        failedRequests.push(`${request.url()} :: ${request.failure()?.errorText || 'failed'}`);
      });

      let navigationError = null;
      try {
        await page.goto(`${baseURL}/?browser-audit=${name}-${viewportName}`, {
          waitUntil: 'networkidle',
          timeout: 90000,
        });
        await page.waitForTimeout(1000);
      } catch (error) {
        navigationError = String(error);
      }

      const snapshot = navigationError ? null : await page.evaluate(({ expectedTheme }) => {
        const root = getComputedStyle(document.documentElement);
        const body = document.body;
        const shell = document.querySelector('#appShell');
        const visible = element => Boolean(element) && getComputedStyle(element).display !== 'none' && getComputedStyle(element).visibility !== 'hidden';
        const firstPartyScripts = [...document.scripts]
          .map(script => script.src)
          .filter(src => src.includes('/assets/'));
        return {
          title: document.title,
          theme: {
            meta: document.querySelector('meta[name="theme-color"]')?.content || null,
            blue: root.getPropertyValue('--eduflow-blue').trim(),
            teal: root.getPropertyValue('--eduflow-teal').trim(),
            paper: root.getPropertyValue('--eduflow-paper').trim(),
            bodyBackground: getComputedStyle(body).backgroundColor,
          },
          shell: {
            present: Boolean(shell),
            visible: visible(shell),
            sidebarPresent: Boolean(document.querySelector('#sidebar')),
            mainPresent: Boolean(document.querySelector('main')),
          },
          layout: {
            viewportWidth: window.innerWidth,
            viewportHeight: window.innerHeight,
            documentWidth: document.documentElement.scrollWidth,
            horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
          },
          compatibility: {
            backdropFilter: CSS.supports('backdrop-filter: blur(1px)'),
            webkitBackdropFilter: CSS.supports('-webkit-backdrop-filter: blur(1px)'),
            sticky: CSS.supports('position: sticky'),
            safeArea: CSS.supports('padding-bottom: env(safe-area-inset-bottom)'),
            clamp: CSS.supports('font-size: clamp(1rem, 2vw, 2rem)'),
          },
          stylesheetCount: [...document.styleSheets].length,
          firstPartyScripts,
          expectedTheme,
        };
      }, { expectedTheme: expected });

      const failures = [];
      if (navigationError) failures.push(`navigation: ${navigationError}`);
      if (!snapshot) failures.push('no browser snapshot');
      if (snapshot) {
        for (const [key, value] of Object.entries(expected)) {
          const actual = key === 'metaTheme' ? snapshot.theme.meta : snapshot.theme[key === 'paper' ? 'paper' : key];
          if (actual !== value) failures.push(`theme ${key}: expected ${value}, got ${actual}`);
        }
        if (!snapshot.shell.present || !snapshot.shell.sidebarPresent || !snapshot.shell.mainPresent) failures.push('application shell structure incomplete');
        if (snapshot.layout.horizontalOverflow) failures.push(`horizontal overflow: ${snapshot.layout.documentWidth}px > ${snapshot.layout.viewportWidth}px`);
      }
      if (consoleErrors.length) failures.push(`${consoleErrors.length} console error(s)`);
      if (pageErrors.length) failures.push(`${pageErrors.length} page error(s)`);
      if (failedRequests.length) failures.push(`${failedRequests.length} failed request(s)`);

      results.push({ browser: name, viewport: viewportName, width, height, failures, consoleErrors, pageErrors, failedRequests, snapshot });
      await context.close();
    }
  } finally {
    await browser.close();
  }
  return results;
}

(async () => {
  const allResults = [];
  for (const [name, engine, launchOptions] of browsers) {
    allResults.push(...await checkBrowser(name, engine, launchOptions));
  }
  const failures = allResults.filter(result => result.failures.length);
  console.log(JSON.stringify({ baseURL, browsers: browsers.map(([name]) => name), viewports: viewports.map(([name]) => name), results: allResults }, null, 2));
  if (failures.length) {
    console.error(`Cross-browser regression failed in ${failures.length} viewport(s).`);
    process.exit(1);
  }
  console.log(`Cross-browser regression passed: ${allResults.length} browser/viewport checks.`);
})().catch(error => {
  console.error(error.stack || error);
  process.exit(1);
});
