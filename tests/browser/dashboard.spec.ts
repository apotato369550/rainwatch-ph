import { expect,test } from "@playwright/test";
test("legacy rainfall API rejects invalid locations",async({request})=>{
  expect((await request.get("/api/weather?location=invalid")).status()).toBe(400);
});
test("environment endpoints reject absent, sea and outside-Cebu coordinates",async({request})=>{
  for(const route of ["environment","outlook","climate-profile"])
    for(const query of ["","?lat=NaN&lon=123","?lat=10&lon=124.5","?lat=14.6&lon=121"]){
      expect((await request.get("/api/"+route+query)).status()).toBe(400);
    }
});
test("live environment request is valid or explicitly unavailable",async({request})=>{
  test.skip(!process.env.TANOM_LIVE_TESTS,"Opt-in live-provider smoke test");
  const response=await request.get("/api/environment?lat=9.85&lon=123.45");
  expect(response.status()).toBe(200);
  const data=await response.json();expect(data.days).toHaveLength(7);expect(data.latitude).toBe(9.85);
});
