const url = "https://1drv.ms/x/c/d8aec7050ea1dcab/IQD_7Xk9C5rsRIpu9npHZwtNAc4PmTLUvkcWpXFjemvagX0?e=MKzttc";
const base64Value = Buffer.from(url).toString('base64').replace(/=/g, '').replace(/\//g, '_').replace(/\+/g, '-');
const encodedUrl = "u!" + base64Value;
console.log("Encoded:", encodedUrl);
