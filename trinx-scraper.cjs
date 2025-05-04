const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");
const path = require("path");

// URL of the Trinx page that lists bike-related articles/images
const pageUrl = "http://www.trinx.com/index.php?ac=article&at=list&tid=116";

// Function to download a single image given its URL and a filepath to save to
async function downloadImage(url, filepath) {
  const response = await axios({
    url,
    method: "GET",
    responseType: "stream",
  });
  return new Promise((resolve, reject) => {
    response.data
      .pipe(fs.createWriteStream(filepath))
      .on("finish", resolve)
      .on("error", reject);
  });
}

async function scrapeTrinxImages() {
  try {
    // Fetch the HTML content of the page
    const { data: html } = await axios.get(pageUrl);
    
    // Load the HTML into Cheerio
    const $ = cheerio.load(html);
    const imageUrls = [];
    
    // Extract all image URLs from <img> tags
    $("img").each((index, element) => {
      let src = $(element).attr("src");
      
      // Check if there's a data-original attribute (sometimes used for lazy loading)
      if (!src && $(element).attr("data-original")) {
        src = $(element).attr("data-original");
      }
      
      if (src) {
        // Convert relative URLs to absolute URLs using the page URL as base
        if (!src.startsWith("http")) {
          src = new URL(src, pageUrl).href;
        }
        imageUrls.push(src);
      }
    });
    
    console.log(`Found ${imageUrls.length} images.`);
    
    // Create a downloads folder if it doesn't exist
    const downloadDir = path.join(__dirname, "downloads");
    if (!fs.existsSync(downloadDir)) {
      fs.mkdirSync(downloadDir);
    }
    
    // Download each image
    for (let i = 0; i < imageUrls.length; i++) {
      const imgUrl = imageUrls[i];
      // Extract file extension (default to .jpg if not found)
      const ext = path.extname(new URL(imgUrl).pathname) || ".jpg";
      const filename = path.join(downloadDir, `ebikes-trinx_${i + 1}${ext}`);
      console.log(`Downloading image ${i + 1}: ${imgUrl}`);
      try {
        await downloadImage(imgUrl, filename);
        console.log(`Saved image as ${filename}`);
      } catch (error) {
        console.error(`Error downloading image ${imgUrl}:`, error.message);
      }
    }
    
    console.log("All images downloaded.");
    
  } catch (error) {
    console.error("Error scraping images:", error);
  }
}

scrapeTrinxImages();
