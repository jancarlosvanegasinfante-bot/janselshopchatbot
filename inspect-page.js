import axios from "axios";

const redirectUrl = 'https://onedrive.live.com/:x:/g/personal/D8AEC7050EA1DCAB/IQCNwKa6rZTWQpqhBrklZexvAQHCZwE8NT6EZuxBgqfSyIY?resid=D8AEC7050EA1DCAB!sbaa6c08d94ad42d69aa106b92565ec6f&ithint=file%2cxlsx&e=C1X3qi&migratedtospo=true&redeem=aHR0cHM6Ly8xZHJ2Lm1zL3gvYy9kOGFlYzcwNTBlYTFkY2FiL0lRQ053S2E2clpUV1FwcWhCcmtsWmV4dkFRSENad0U4TlQ2RVp1eEJncWZTeUlZP2U9QzFYM3Fp';

async function run() {
  try {
    console.log("Fetching HTML page to find download link...");
    const response = await axios.get(redirectUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8"
      }
    });

    console.log("Response length:", response.data.length);
    const html = response.data;
    
    // Look for links or download URLs
    const matches = [];
    const downloadRegex = /https:\/\/onedrive\.live\.com\/download[^"'\s>]+/g;
    let match;
    while ((match = downloadRegex.exec(html)) !== null) {
      matches.push(match[0]);
    }
    
    console.log("Found download URL matches in HTML:", matches.slice(0, 5));

    // Also look for resid and authkey in the html
    const residRegex = /"resid"\s*:\s*"([^"]+)"/i;
    const authkeyRegex = /"authkey"\s*:\s*"([^"]+)"/i;
    
    const residMatch = html.match(residRegex);
    const authkeyMatch = html.match(authkeyRegex);
    
    console.log("Resid from regex:", residMatch ? residMatch[1] : "not found");
    console.log("Authkey from regex:", authkeyMatch ? authkeyMatch[1] : "not found");

    // Let's try constructing a standard direct download link with the resid and personal path
    // Format: https://onedrive.live.com/download?resid=D8AEC7050EA1DCAB!sbaa6c08d94ad42d69aa106b92565ec6f&authkey=... Wait, what if there's an authkey or similar in the sharing key?
    // Let's print out script tags or metadata
    const scriptTags = [];
    const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
    let sMatch;
    while ((sMatch = scriptRegex.exec(html)) !== null && scriptTags.length < 50) {
      if (sMatch[1].includes("D8AEC7050EA1DCAB") || sMatch[1].includes("sbaa6c08d94ad42d69aa106b92565ec6f")) {
        scriptTags.push(sMatch[1].slice(0, 300) + "...");
      }
    }
    console.log(`Found ${scriptTags.length} script tags with key terms.`);
    if (scriptTags.length > 0) {
      console.log("First script tag excerpt:", scriptTags[0]);
    }

  } catch (error) {
    console.error("Error:", error.message);
  }
}

run();
