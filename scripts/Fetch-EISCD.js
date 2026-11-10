await page.goto("https://paymentservices.bacs.co.uk/", {
  waitUntil: "networkidle2",
});
await page.type("#contactId", "Hughes732693");
await page.type("#password", "BlackGolf184!");
await page.$eval("#password", (e) => e.blur());
await page.waitForSelector("button[type=submit]");
await page.evaluate(() => {
  document.querySelector("button[type=submit]").click();
});

//console.log("Logged in!")
await page.waitForSelector("nav");
await page.evaluate(() => {
  document.querySelectorAll("nav ibm-sidenav-item li a")[1].click();
});
await page.waitForSelector(".alnk");
await page.evaluate(() => {
  document.querySelector(".alnk").click();
});

console.log("Found reports page!");
await page.waitForSelector("input[role=searchbox]");
await page.evaluate(() => {
  document.querySelector("input[role=searchbox]").click();
});
await page.waitForSelector("li[role=option]");
await page.evaluate(() => {
  document.querySelectorAll("li[role=option]")[0].click();
});

console.log("Found report!");

await page.waitForSelector("table");
await page.evaluate(() => {
  document.querySelectorAll("ibm-icon-download")[1].click();
});

// Download XML report
await page.waitForSelector("input[role=searchbox]");
await page.evaluate(() => {
  document.querySelector("input[role=searchbox]").click();
});
await page.waitForSelector("li[role=option]");
await page.evaluate(() => {
  document.querySelectorAll("li[role=option]")[1].click();
});
await page.waitForSelector("table");
await page.evaluate(() => {
  document.querySelectorAll("ibm-icon-download")[1].click();
});
