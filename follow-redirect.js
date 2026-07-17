import axios from "axios";

const url = "https://1drv.ms/x/c/d8aec7050ea1dcab/IQCNwKa6rZTWQpqhBrklZexvAQHCZwE8NT6EZuxBgqfSyIY?e=C1X3qi";

async function run() {
  try {
    console.log("Fetching headers of OneDrive short URL to follow redirects...");
    const response = await axios.get(url, {
      maxRedirects: 0,
      validateStatus: (status) => status >= 200 && status < 400,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
      }
    });
    console.log("Status:", response.status);
    console.log("Headers:", response.headers);
  } catch (error) {
    if (error.response) {
      console.log("Redirected status:", error.response.status);
      console.log("Redirect location:", error.response.headers.location);
    } else {
      console.error("Error:", error.message);
    }
  }
}

run();
