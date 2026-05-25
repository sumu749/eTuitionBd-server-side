// encode.js
import fs from "fs";
const key = fs.readFileSync("./firebase/firebase-admin-key.json", "utf8");
const base64 = Buffer.from(key).toString("base64");
console.log(base64);
