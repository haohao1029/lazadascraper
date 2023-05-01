const puppeteer = require("puppeteer");
const xlsx = require("xlsx");
const fs = require("fs");
let existedJSONData = {};
try {
  existedJSONData = require("./items.json");
} catch (err) {}

async function startBrowser() {
  let browser;
  try {
    console.log("Opening the browser......");
    browser = await puppeteer.launch({
      headless: false, //change this to true to make browser invisible
      args: ["--disable-setuid-sandbox"],
      ignoreHTTPSErrors: true,
    });
  } catch (err) {
    console.log("Could not create a browser instance => : ", err);
  }
  return browser;
}

async function scrapeAll(browserInstance) {
  let browser;
  try {
    browser = await browserInstance;
    await scraperObject.scraper(browser);
  } catch (err) {
    console.log("Could not resolve the browser instance => ", err);
  }
}

// insert DOCshop product productItemUrls here to scrape
const scraperObject = {
  //logging in via keyword magic tool page is an easier process than the login button at the top right. ask Daniel for more information.
  // queries
  // q = All-Products
  // from = wangpu
  // pageTypeId == 1 == store mainpage,
  // pageTypeId == 2 == product page,
  // pageTypeId == 3 == profile page
  async scraper(browser) {
    //initializing empty arrays to push into
    const JSONDataListPath = "./items.json";
    const excelPath = "./items.xlsx";
    let totalData = [];
    let JSONDataList = existedJSONData;

    //opening browser & going to url & get total page count
    let page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 768 }); //setting wider viewport to load all products
    console.log("start scraping");
    totalData = await this.scrapePage(page, browser, totalData, JSONDataList);
    console.log("scraping done");
    console.log("import into files");

    //importing into files
    await this.importToFile(JSONDataList, totalData, JSONDataListPath, excelPath);
    console.log("end program");

  },
  async getProductDetails(browser, page, totalData, JSONDataList) {
    // waiter not exceed 10 pages
    console.log((await browser.pages()).length);
    while ((await browser.pages()).length >= 10) {
      await this.sleep(5000);
    }
    await page.goto(itemLink, { waitUntil: "networkidle0", timeout: 0 });

    while (await this.isCaptcha(page)) {
      console.log("captcha detected");
      await page.reload({ waitUntil: "networkidle0", timeout: 0 });
    }
    const dataItem = await page.evaluate(() => {
      let itemArrayData = [];
      let itemJSONData = {};
      const title = document.querySelector(
        ".pdp-mod-product-badge-title"
      ).innerText;
      let rating = document
        .querySelector(".pdp-review-summary__link")
        .innerText.split(" ")[0];
      if (rating == "No") {
        rating = 0;
      }
      let price = document.querySelector(".pdp-price").innerText;
      let modelName = "";
      if (document.querySelector(".sku-name")) {
        modelName = document.querySelector(".sku-name").innerText;
      }
      data = {
        title,
        rating,
        price,
        modelName,
      };
      itemJSONData = {
        title,
        rating,
        models: [{ price, modelName }],
      };
      itemArrayData.push(data);
      const modelBtns = document.querySelectorAll(".sku-variable-img-wrap");
      const modelLength = modelBtns.length;
      for (let i = 0; i < modelLength; i++) {
        const modelBtn = modelBtns[i];
        modelBtn.click();
        const modelName = document.querySelector(".sku-name").innerText;
        const price = document.querySelector(".pdp-price").innerText;
        data = {
          title,
          rating,
          price,
          modelName,
        };
        itemJSONData.models.push({ price, modelName });
        itemArrayData.push(data);
      }
      return [itemArrayData, itemJSONData];
    });
    console.log(dataItem[1])
    page.close();
    JSONDataList[dataItem[1]["title"]] = dataItem[1];
    totalData.push(...dataItem[0]);
  },
  async scrapePage(page, browser, totalData, JSONDataList) {
    // start scrapping itemsssss
    let lastPage = (currentPage = 1);
    for (currentPage; currentPage <= lastPage; currentPage++) {
      await page.goto(
        `https://www.lazada.com.my/lucky-pharmacy-malaysia/?from=wangpu&langFlag=en&page=${currentPage}&pageTypeId=2&q=All-Products`,
        { waitUntil: "domcontentloaded", timeout: 0 }
      );
      // get the last page
      if (currentPage == 1) {
        lastPage = await page.evaluate(() => {
          paginationBtns = document.querySelectorAll(".ant-pagination-item");
          return paginationBtns[paginationBtns.length - 1].innerText; // last page
        });
      }

      itemListPagination = await page.evaluate(() => {
        const itemAttribute = Array.from(
          document.querySelectorAll(".Bm3ON .Ms6aG .qmXQo .RfADt a"),
          (element) => [element.href, element.innerText]
        );
        return itemAttribute;
      });

      for (i = 0; i < itemListPagination.length; i++) {
        // for (i = 0; i < 2; i++) {
        if (itemListPagination[i][1] in existedJSONData) {
          console.log("exist");
          continue;
        }
        itemLink = itemListPagination[i][0];
        itemPage = await browser.newPage();
        await itemPage.setViewport({ width: 1366, height: 768 }); //setting wider viewport to load all products
        console.log(`Navigating to ` + itemLink);
        try {
          this.getProductDetails(browser, itemPage, totalData, JSONDataList);
          await this.sleep(5000);
        } catch (err) {
          console.log(err)
        }
      }
    }
    return totalData;
  },
  async importToFile(JSONDataList, totalData, JSONDataListPath, excelPath) {
    fs.writeFile(JSONDataListPath, JSON.stringify(JSONDataList), (err) => {
      if (err) {
        throw err;
      }
    });

    if (fs.existsSync(excelPath)) {
      wb = xlsx.readFile(excelPath);
      sheetName = wb.SheetNames[0];
      ws = wb.Sheets[sheetName];
      const startRow = parseInt(
        Object.keys(ws)[Object.keys(ws).length - 2].match(/\d+/g)[0]
      );
      sheetName[0] = xlsx.utils.sheet_add_json(ws, totalData, {
        skipHeader: true,
        origin: startRow,
      });
      console.log(ws);
      xlsx.writeFile(wb, excelPath);
    } else {
      const wb = xlsx.utils.book_new();
      const ws = xlsx.utils.json_to_sheet(totalData);
      xlsx.utils.book_append_sheet(wb, ws);
      xlsx.writeFile(wb, excelPath);
    }
  },
  randomIntFromInterval(min, max) {
    // min and max included
    return Math.floor(Math.random() * (max - min + 1) + min);
  },
  async sleep(ms) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  },
  async isCaptcha(page) {
    const isCaptcha = await page.evaluate(() => {
      return document.getElementById("nocaptcha");
    });
    if (isCaptcha != null) {
      return true;
    }
    return false;
  },
};

scrapeAll(startBrowser());
