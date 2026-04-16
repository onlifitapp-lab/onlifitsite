const fs = require("fs");
let content = fs.readFileSync("login.html", "utf8");
console.log(content.substring(content.indexOf("async function handleAuth"), content.indexOf("async function handleAuth") + 1500));
