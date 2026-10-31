import { expect,test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { environmentFixture,climateFixture,outlookFixture } from "./tanom-fixtures";
test.beforeEach(async({page})=>{
  await page.route("**/api/environment?*",r=>r.fulfill({json:environmentFixture()}));
  await page.route("**/api/climate-profile?*",r=>r.fulfill({json:climateFixture}));
  await page.route("**/api/outlook?*",r=>r.fulfill({json:outlookFixture}));
});
test("TANOM live-data layout, map, matching, language, planning and accessible responsive states",async({page})=>{
  const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
  await page.setViewportSize({width:1440,height:1000});await page.goto("/");
  await expect(page.getByRole("heading",{name:"Dalaguete",exact:true})).toBeVisible();
  await expect(page.locator(".cebu-map .leaflet-interactive").first()).toBeVisible();
  await expect(page.locator(".condition-card")).toHaveCount(3);
  await expect(page.locator(".language")).toHaveAttribute("aria-checked","false");
  await page.getByRole("heading",{name:"Crops to explore"}).scrollIntoViewIfNeeded();
  await expect(page.locator(".crop-card").first()).toBeVisible();
  await page.getByRole("button",{name:"Annual climate profile",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Historical climate profile—not a forecast"})).toBeVisible();
  await expect(page.locator(".monthly-summaries>div")).toHaveCount(12);
  await page.getByRole("button",{name:"6 months",exact:true}).click();
  await expect(page.locator(".monthly-summaries>div")).toHaveCount(6);
  await page.locator(".language").click();
  await expect(page.locator("html")).toHaveAttribute("lang","ceb");
  await expect(page.locator(".heat .card-label")).toContainText("KAINIT");
  await page.locator(".language").click();
  await page.getByLabel("Find a municipality").fill("Bogo");
  await page.getByLabel("Municipality / city", {exact:true}).selectOption({label:"City of Bogo"});
  await expect(page.locator(".location-heading h2")).toHaveText("City of Bogo");
  await page.getByLabel("Find a municipality").fill("");
  await page.getByLabel("Municipality / city",{exact:true}).selectOption({label:"Dalaguete"});
  await page.evaluate(()=>document.fonts.ready);
  for(const width of [1440,768,390,320]){
    await page.setViewportSize({width,height:1000});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    const axe=await new AxeBuilder({page}).analyze();expect(axe.violations).toEqual([]);
    await page.screenshot({path:`test-results/tanom-${width}.png`,fullPage:true});
  }
  expect(errors).toEqual([]);
});
for(const [name,code] of [["cloudy",3],["rain",61],["storm",95]] as const){
 test(name+" conditions and missing soil do not become zero",async({page})=>{
   await page.route("**/api/environment?*",r=>r.fulfill({json:environmentFixture(code,true)}));
   await page.goto("/");await expect(page.locator(".soil .card-value")).toContainText("Unavailable");
   await expect(page.locator(".heat h3")).toHaveText(code===3?"Cloudy skies":code===61?"Rainfall":"Thunderstorm");
 });
}
test("weather and seasonal failures show retry without fabricated guidance",async({page})=>{
 await page.route("**/api/environment?*",r=>r.fulfill({status:502,json:{error:"Unavailable"}}));
 await page.route("**/api/outlook?*",r=>r.fulfill({status:502,json:{error:"Unavailable"}}));
 await page.goto("/");await expect(page.getByRole("alert").first()).toContainText("Weather is unavailable");
 await expect(page.locator(".heat .card-value")).toContainText("Unavailable");
 await page.locator(".season").scrollIntoViewIfNeeded();
 await expect(page.getByText("Planning data is unavailable. Current weather is unaffected.")).toBeVisible();
});
test("GPS rejection leaves manual selection usable",async({page,context})=>{
 await context.clearPermissions();await page.goto("/");
 await page.evaluate(()=>Object.defineProperty(navigator,"geolocation",{configurable:true,value:{getCurrentPosition:(_ok:unknown,fail:(e:{code:number})=>void)=>fail({code:1})}}));
 await page.getByRole("button",{name:"Use my location"}).click();
 await expect(page.getByText("Location permission denied. Choose a place on the map or list.")).toBeVisible();
 await page.getByLabel("Municipality / city",{exact:true}).selectOption({label:"Argao"});
 await expect(page.locator(".location-heading h2")).toHaveText("Argao");
});
test("GPS accepts Cebu, rejects out-of-region points, and reports timeout",async({page,context})=>{
 await context.grantPermissions(["geolocation"]);await context.setGeolocation({latitude:10.3157,longitude:123.8854,accuracy:20});
 await page.goto("/");await page.getByRole("button",{name:"Use my location"}).click();
 await expect(page.locator(".location-heading h2")).toHaveText("Cebu City");
 await expect(page.locator(".location-heading")).toContainText("±20 m");
 await context.setGeolocation({latitude:14.6,longitude:121});await page.getByRole("button",{name:"Use my location"}).click();
 await expect(page.getByText("This location is outside Cebu land boundaries. Choose your farm on the map.")).toBeVisible();
 await page.evaluate(()=>Object.defineProperty(navigator,"geolocation",{configurable:true,value:{getCurrentPosition:(_ok:unknown,fail:(e:{code:number})=>void)=>fail({code:3})}}));
 await page.getByRole("button",{name:"Use my location"}).click();
 await expect(page.getByText("GPS timed out. You can still select a location manually.")).toBeVisible();
});
