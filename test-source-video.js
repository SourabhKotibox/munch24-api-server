const url = "https://manch24.com/uploads/123.mp4";
const domain = "https://manch24.com";
let relPath = url;
if (url.startsWith(domain)) {
  relPath = url.slice(domain.length);
}
console.log(relPath);
