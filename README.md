# Economic Indicator Lookup — World Bank Data

Look up any World Bank economic indicator — GDP, inflation,
unemployment, population, life expectancy, and hundreds more — for
one or more countries over recent years, via the official [World Bank
Open Data API](https://data.worldbank.org/).

Built for market research, macro analysis, and country-risk teams
comparing countries without downloading World Bank's own CSV exports.

## Input

```json
{
  "countries": ["USA", "GBR", "JPN"],
  "indicatorCode": "FP.CPI.TOTL.ZG",
  "mostRecentYears": 5
}
```

| Field | Type | Description |
|---|---|---|
| `countries` | array of strings (required) | One or more ISO 3-letter country codes, e.g. `"USA"`, `"GBR"`, `"JPN"`, `"IND"`. |
| `indicatorCode` | string (required) | A World Bank indicator code. Common ones: `NY.GDP.MKTP.CD` (GDP, current US$), `NY.GDP.MKTP.KD.ZG` (GDP growth %), `FP.CPI.TOTL.ZG` (inflation %), `SL.UEM.TOTL.ZS` (unemployment %), `SP.POP.TOTL` (population), `SP.DYN.LE00.IN` (life expectancy). Browse the full catalog at [data.worldbank.org/indicator](https://data.worldbank.org/indicator). |
| `mostRecentYears` | number | How many of the most recent years (per country) to return. Default `5`, max `20`. |

## Output

One record per country per year:

```json
{
  "countryCode": "GBR",
  "countryName": "United Kingdom",
  "indicatorCode": "FP.CPI.TOTL.ZG",
  "indicatorName": "Inflation, consumer prices (annual %)",
  "year": "2025",
  "value": 3.88306881626
}
```

Years with no reported data for a country are skipped rather than
returned as a null row. An invalid country code or indicator code
returns a clear error instead of an empty result set — the World Bank
API returns HTTP 200 with an embedded error object in that case, which
this actor detects and surfaces properly.

## How it works

Direct calls to the official [World Bank Open Data
API](https://data.worldbank.org/) — no proxy, no key, no scraping.
Data is licensed CC-BY 4.0 and explicitly open for reuse, including
commercial use with attribution.

## Pricing note

Billed per **lookup** (one run), not per value returned — one charge
whether you request 1 country/1 year or 20 countries/20 years.

## Related products

- [WHO Health Data Lookup by Country](https://apify.com/m_ctim/global-health-indicator-lookup): the WHO health-data counterpart to this World Bank economic data
