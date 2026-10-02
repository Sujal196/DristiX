export function extractAndStripImageUrls(rawText) {
  let text = rawText;
  let extractedUrl;

  // 1. Markdown image syntax: ![alt](url)
  const mdImgMatch = /!\[([^\]]*)\]\(((?:https?:\/\/|data:image\/|\/)[^\s)]+)\)/i.exec(text);
  if (mdImgMatch) {
    if (!extractedUrl) extractedUrl = mdImgMatch[2];
    text = text.replace(mdImgMatch[0], ' ');
  }

  // 2. HTML image syntax: <img src="url" ... />
  const htmlImgMatch = /<img\b[^>]*src=["']((?:https?:\/\/|data:image\/|\/)[^"']+)["'][^>]*\/?>/i.exec(text);
  if (htmlImgMatch) {
    if (!extractedUrl) extractedUrl = htmlImgMatch[1];
    text = text.replace(htmlImgMatch[0], ' ');
  }

  // 3. Explicit Image / Diagram / Chart / Graph URL or Link label:
  // e.g. "Image URL: https://...", "Diagram: https://...", "[Image URL: https://...]"
  const labeledUrlRegex = /(?:\[|\()?\s*(?:image|diagram|figure|fig|chart|graph|asset|visual|illustration|चित्र|आरेख|ग्राफ)\s*(?:url|link|source|src|ref)?\s*[:=\-–]?\s*[:=\-–]?\s*(https?:\/\/[^\s"'<>)\]]+(?:\s+[a-zA-Z0-9_\-]{6,30})?)(?:\]|\))?/gi;

  let match;
  while ((match = labeledUrlRegex.exec(text))) {
    let url = match[1];
    const parts = url.split(/\s+/);
    if (parts.length > 1) {
      const first = parts[0];
      const second = parts[1];
      const isEnglishWord = /^(?:what|which|how|who|where|when|why|if|the|find|calculate|in|for|from|to|select|choose|consider|according|based)\b/i.test(second);
      if (!isEnglishWord && /^[a-zA-Z0-9_\-]{6,}$/.test(second)) {
        url = (first.endsWith('/') || first.includes('/artifact/')) ? first + second : first + '/' + second;
      } else {
        url = first;
      }
    }

    if (!extractedUrl) {
      extractedUrl = url.replace(/[.,;:)\]]+$/, '');
    }
    text = text.replace(match[0], ' ');
  }

  // 4. Standalone Image URLs in brackets: [https://...] or (https://...)
  const bracketedUrlRegex = /[\[(]\s*(https?:\/\/[^\s)\]]+(?:\.(?:png|jpe?g|webp|svg|gif)|claude\.ai\/artifact\/\S+))\s*[\])]/gi;
  while ((match = bracketedUrlRegex.exec(text))) {
    if (!extractedUrl) {
      extractedUrl = match[1];
    }
    text = text.replace(match[0], ' ');
  }

  // 5. Raw URL ending in image extension or claude artifact:
  const rawImgUrlRegex = /(https?:\/\/[^\s"'<>]+\.(?:png|jpe?g|webp|svg|gif)(?:\?[^\s"'<>]*)?)/gi;
  while ((match = rawImgUrlRegex.exec(text))) {
    if (!extractedUrl) {
      extractedUrl = match[1];
    }
    text = text.replace(match[0], ' ');
  }

  // Clean up any double spaces, dangling punctuation, or empty brackets left by removal
  let cleanText = text
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,!?:;])/g, '$1')
    .replace(/\(\s*\)/g, '')
    .replace(/\[\s*\]/g, '')
    .trim();

  return { cleanText, imageUrl: extractedUrl };
}

const tests = [
  'Study the bar graph and answer the question. Image URL: https://claude.ai/artifact/VsVbHef315Akc YedwpwcQf What is the average number of cars sold per year during the period 2019–2023?',
  'Study the pie chart and answer the question. Image URL: https://claude.ai/artifact/LtrkgWzP73kUtmCJrEHupM How much money is spent on Food and Transport together?',
  'Q2. Study the pie chart and answer the question. Image URL: https://claude.ai/artifact/LtrkgWzP73kUtmCJrEHupM How much money is spent on Food and Transport together?',
  '1. In the following right triangle, calculate hypotenuse: [Image: https://example.com/triangle.png]',
  '2. Refer to the figure: ![Chart](https://example.com/bar.png) Which product sold most?'
];

for (const t of tests) {
  const res = extractAndStripImageUrls(t);
  console.log('INPUT: ', t);
  console.log('CLEAN: ', res.cleanText);
  console.log('URL:   ', res.imageUrl);
  console.log('---');
}
