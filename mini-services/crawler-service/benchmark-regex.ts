const LIB_PATTERNS = [
  "react", "vue", "angular", "jquery", "bootstrap", "tailwind", "next", "nuxt",
  "svelte", "gatsby", "remix", "astro", "webpack", "vite", "rollup", "esbuild",
  "three\\.js", "d3", "chart\\.js", "lodash", "moment", "axios", "algolia",
  "gtm", "ga\\.", "google-analytics", "fontawesome", "material-ui", "ant-design",
  "chakra", "tailwindcss", "styled-components", "emotion", "redux", "mobx",
  "pinia", "zustand", "firebase", "supabase", "wordpress", "drupal",
  "shopify", "squarespace", "wix",
];

const urls = Array.from({ length: 100 }, (_, i) => `https://example.com/assets/js/app-${i}.js?lib=react&v=${i}`);

function testOriginal() {
  const start = performance.now();
  let count = 0;
  for (let i = 0; i < 1000; i++) {
    for (const url of urls) {
      const lower = url.toLowerCase();
      for (const lib of LIB_PATTERNS) {
        if (new RegExp(lib, "i").test(lower)) {
          count++;
        }
      }
    }
  }
  const end = performance.now();
  console.log(`Original: ${end - start}ms (matches: ${count})`);
}

const LIB_REGEXPS = LIB_PATTERNS.map(lib => ({ lib, regex: new RegExp(lib, "i") }));

function testOptimized() {
  const start = performance.now();
  let count = 0;
  for (let i = 0; i < 1000; i++) {
    for (const url of urls) {
      const lower = url.toLowerCase();
      for (const { regex } of LIB_REGEXPS) {
        if (regex.test(lower)) {
          count++;
        }
      }
    }
  }
  const end = performance.now();
  console.log(`Optimized: ${end - start}ms (matches: ${count})`);
}

testOriginal();
testOptimized();
