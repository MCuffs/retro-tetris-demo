const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  // Console message listener to see what the page logs
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));

  await page.goto('http://localhost:8787/client-test.html', { waitUntil: 'networkidle0' });

  const evaluation = await page.evaluate(() => {
    let result = {};
    result.hasWindowTaA = typeof window.ta_a !== 'undefined';
    result.hasWindowThinkingDataTaA = typeof window.thinkingdata.ta_a !== 'undefined';
    
    // Check type of window.ta_a
    result.typeOfWindowTaA = typeof window.ta_a;
    
    // Check if it has getDistinctId
    if (window.ta_a) {
        result.hasGetDist = typeof window.ta_a.getDistinctId === 'function';
    }
    
    // Check if it's on thinkingdata instead?
    result.thinkingDataKeys = Object.keys(window.thinkingdata);
    result.windowTaKeys = window.ta_a ? Object.keys(window.ta_a) : null;
    
    return result;
  });

  console.log("Evaluation result:", JSON.stringify(evaluation, null, 2));

  await browser.close();
})();
