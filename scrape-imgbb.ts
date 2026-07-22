import axios from "axios";
import * as fs from "fs";
import * as path from "path";

const links = [
  "https://ibb.co/HfS9Lspb",
  "https://ibb.co/0j4YGxNK",
  "https://ibb.co/N2pYxT70",
  "https://ibb.co/F4cf7HQ7",
  "https://ibb.co/DHLrNGJQ",
  "https://ibb.co/93rH9pHB",
  "https://ibb.co/PZ2jNhdY",
  "https://ibb.co/jPxt744v",
  "https://ibb.co/hxY7SXWv",
  "https://ibb.co/9k8h6ZtF",
  "https://ibb.co/xt0HMfxG",
  "https://ibb.co/XfCn2W5s",
  "https://ibb.co/xS42H6wZ",
  "https://ibb.co/xSSbcwyD",
  "https://ibb.co/KcqLQ3Gm",
  "https://ibb.co/PGBg5gtY",
  "https://ibb.co/HD8DkVrL",
  "https://ibb.co/fP05Bkf",
  "https://ibb.co/9mn75c9V",
  "https://ibb.co/Pz6h6Cj9",
  "https://ibb.co/wF0PW9QD",
  "https://ibb.co/k643J2np",
  "https://ibb.co/C3YCcm5X"
];

async function run() {
  console.log("Starting scraping of ImgBB links...");
  const results = [];

  for (const url of links) {
    try {
      console.log(`Fetching ${url}...`);
      const resp = await axios.get(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        },
        timeout: 10000
      });

      const html = resp.data;
      
      // Extract og:title
      const titleMatch = html.match(/<meta property="og:title" content="([^"]+)"/i) || html.match(/<title>([^<]+)<\/title>/i);
      const title = titleMatch ? titleMatch[1] : "Unknown";

      // Extract og:description
      const descMatch = html.match(/<meta property="og:description" content="([^"]+)"/i);
      const desc = descMatch ? descMatch[1] : "";

      // Extract direct image url
      const imgMatch = html.match(/<meta property="og:image" content="([^"]+)"/i) || html.match(/link rel="image_src" href="([^"]+)"/i);
      const directUrl = imgMatch ? imgMatch[1] : "";

      console.log(`- Title: ${title}`);
      console.log(`- Direct URL: ${directUrl}`);

      results.push({
        url,
        title,
        desc,
        directUrl
      });
    } catch (err: any) {
      console.error(`Error scraping ${url}:`, err.message);
      results.push({
        url,
        title: "Error",
        desc: "",
        directUrl: "",
        error: err.message
      });
    }
  }

  fs.writeFileSync("scraped-images.json", JSON.stringify(results, null, 2), "utf8");
  console.log("Scraping finished. Results written to scraped-images.json.");
}

run();
