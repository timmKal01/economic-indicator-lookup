const BASE_URL = 'https://api.worldbank.org/v2/country';

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

    const res = await fetch(url, { headers: { Connection: 'close' } });
    if (!res.ok) {
        throw new Error(`World Bank API request failed: ${res.status} ${res.statusText}`);
    }
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
    }
    return results;
}
