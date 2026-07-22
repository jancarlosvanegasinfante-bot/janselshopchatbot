const axios = require('axios');

const targetUrl = 'https://http2.mlstatic.com/D_NQ_NP_812931-MCO74291823912_012024-O.webp';
const proxyUrl = `http://localhost:3000/api/image-proxy?url=${encodeURIComponent(targetUrl)}`;

console.log('Fetching proxy URL:', proxyUrl);

axios.get(proxyUrl, { responseType: 'arraybuffer' })
  .then(res => {
    console.log('Status:', res.status);
    console.log('Content-Type:', res.headers['content-type']);
    console.log('Length:', res.data.length);
  })
  .catch(err => {
    console.error('Error fetching image from proxy:', err.message);
    if (err.response) {
      console.error('Response Status:', err.response.status);
      console.error('Response Body:', err.response.data.toString());
    }
  });
