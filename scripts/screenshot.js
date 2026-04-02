const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  });
  const page = await context.newPage();

  const outputDir = path.join(__dirname, '..', 'screenshots');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
  }

  console.log('Navigating to local dev server...');
  await page.goto('http://localhost:5173');
  
  // Wait for map to load (wait for the map container and missing loading state)
  await page.waitForSelector('#map-container');
  // Wait to ensure GIS data is fully loaded and rendered
  await page.waitForTimeout(3000); 

  console.log('Taking full country screenshot...');
  await page.screenshot({ path: path.join(outputDir, '00_Whole_Country.png') });

  // Get list of provinces from the select dropdown
  const provinces = await page.$$eval('#province-select option', options => {
    return options.map(o => o.value).filter(v => v !== '');
  });

  console.log(`Found ${provinces.length} provinces. Starting screenshots...`);

  for (let i = 0; i < provinces.length; i++) {
    const province = provinces[i];
    console.log(`[${i+1}/${provinces.length}] Screenshotting ${province}...`);
    
    // Select the province
    await page.selectOption('#province-select', province);
    
    // Wait for the map to zoom and render smoothly (Leaflet bounds animate takes 1s)
    await page.waitForTimeout(2000);
    
    // Screenshot
    await page.screenshot({ 
      path: path.join(outputDir, `${(i+1).toString().padStart(2, '0')}_${province}.png`) 
    });
  }

  console.log('All 35 screenshots captured successfully in /screenshots folder.');
  await browser.close();
  process.exit(0);
})();
