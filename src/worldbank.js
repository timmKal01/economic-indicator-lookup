// Some public APIs refuse requests that identify themselves only as Node's default "node" user agent (data.cms.gov
// started doing so in October 2026), so every request says which tool is asking and where to find it.
const USER_AGENT = 'economic-indicator-lookup/0.1 (+https://apify.com/m_ctim/economic-indicator-lookup)';

const BASE_URL = 'https://api.worldbank.org/v2/country';
const REQUEST_TIMEOUT_MS = 30_000;

/** The World Bank API is occasionally slow or 429s/5xxs under load — retry with backoff
 *  rather than ever treating a throttle or timeout as "no data." */
async function fetchWithRetry(url, { retries = 4, baseDelayMs = 1500 } = {}) {
    let lastErr;
    for (let attempt = 0; attempt <= retries; attempt++) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
        try {
            const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Connection: 'close' }, signal: controller.signal });
            if (res.ok) return res;
            if (![429, 500, 502, 503, 504].includes(res.status)) {
                throw new Error(`World Bank API request failed: ${res.status} ${res.statusText}`);
            }
            lastErr = new Error(`World Bank API returned ${res.status}`);
        } catch (err) {
            lastErr = err.name === 'AbortError' ? new Error('World Bank API request timed out') : err;
        } finally {
            clearTimeout(timeout);
        }
        if (attempt < retries) {
            await new Promise((r) => setTimeout(r, baseDelayMs * 2 ** attempt));
        }
    }
    throw lastErr;
}

export async function fetchIndicator({ countries, indicatorCode, mostRecentYears }) {
    const countryPath = countries.map((c) => c.trim().toUpperCase()).join(';');
    const url = new URL(`${BASE_URL}/${encodeURIComponent(countryPath)}/indicator/${encodeURIComponent(indicatorCode)}`);
    url.searchParams.set('format', 'json');
    url.searchParams.set('per_page', '2000');
    // Without a date range, the API returns full history (~65 years) per country grouped
    // country-by-country rather than interleaved — with 2+ countries and the default
    // per_page=100 that silently cuts off later-alphabetical countries entirely (confirmed
    // live: USA vanished when queried alongside GBR/JPN). A generous date window keeps every
    // requested country's recent data on one page regardless of how many countries are asked for.
    const currentYear = new Date().getFullYear();
    const startYear = currentYear - mostRecentYears - 5;
    url.searchParams.set('date', `${startYear}:${currentYear}`);

    const res = await fetchWithRetry(url);
    const body = await res.json();

    // On a bad country or indicator code the API still returns 200, but with a single-element
    // array containing a { message: [...] } error object instead of the usual [meta, data] pair.
    if (!Array.isArray(body) || body.length < 2 || !Array.isArray(body[1])) {
        const reason = body?.[0]?.message?.[0]?.value ?? 'unrecognized response shape';
        throw new Error(`World Bank API rejected the request (check countries/indicatorCode): ${reason}`);
    }

    const [, rows] = body;

    // Keep only the N most recent years per country (rows arrive newest-first per country, but
    // countries are grouped, not interleaved by year, so track a per-country counter).
    const seenPerCountry = {};
    const results = [];
    for (const row of rows) {
        try {
            if (row.value === null) continue; // skip years with no reported data
            const code = row.countryiso3code;
            seenPerCountry[code] = (seenPerCountry[code] ?? 0) + 1;
            if (seenPerCountry[code] > mostRecentYears) continue;

            results.push({
                countryCode: code,
                countryName: row.country?.value ?? null,
                indicatorCode: row.indicator?.id ?? indicatorCode,
                indicatorName: row.indicator?.value ?? null,
                year: row.date,
                value: row.value,
            });
        } catch (err) {
            // Skip a malformed row rather than losing the whole indicator lookup.
        }
    }
    return results;
}
