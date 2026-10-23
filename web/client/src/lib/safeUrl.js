// Links that come from scraped data or model answers (a reel, a competitor's page, a Google Maps place):
// only http(s) becomes a link. Anything else (javascript:, data:…) gets no href, so a click runs nothing.
export const safeHref = (url) => (/^https?:\/\//i.test(String(url ?? "").trim()) ? url : undefined);
