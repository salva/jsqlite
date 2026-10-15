// Music-store questions over the bundled Chinook snapshot. Exact SQL/results
// are checked against pinned SQLite by test/browser/public-site.test.mjs.
export const examples = [
  {
    id: 'albums', group: 'Browse the catalog', label: 'Albums & tracks · join',
    description: 'Start with three tracks and their album titles. A simple join connects the album catalog to its tracks.',
    sql: `SELECT a.AlbumId, a.Title, t.TrackId,
       t.Name AS track
FROM Album AS a JOIN Track AS t
  ON t.AlbumId = a.AlbumId
ORDER BY a.AlbumId, t.TrackId
LIMIT 3`,
  },
  {
    id: 'artists', group: 'Browse the catalog', label: 'Browse artists · sorting',
    description: 'Browse the first twenty artist names alphabetically. Edit the limit or add a WHERE clause to explore the catalog.',
    sql: 'SELECT ArtistId, Name\nFROM Artist\nORDER BY Name\nLIMIT 20',
  },
  {
    id: 'long-tracks', group: 'Browse the catalog', label: 'Long listens · filtering & arithmetic',
    description: 'Find the ten longest audio tracks lasting at least ten minutes. Video files are excluded so this is a listening list, not a list of TV episodes.',
    sql: `SELECT Name AS track,
       ROUND(Milliseconds / 60000.0, 1) AS minutes,
       Composer
FROM Track
WHERE Milliseconds >= 600000
  AND MediaTypeId <> 3
ORDER BY Milliseconds DESC, TrackId
LIMIT 10`,
  },
  {
    id: 'classical', group: 'Browse the catalog', label: 'Classical playlist · three-table join',
    description: 'Explore twenty tracks in the Classical playlist. The playlist-to-track linking table connects a curated list to the music catalog.',
    sql: `SELECT p.Name AS playlist, t.Name AS track,
       ROUND(t.Milliseconds / 60000.0, 1) AS minutes
FROM Playlist AS p
JOIN PlaylistTrack AS pt ON pt.PlaylistId = p.PlaylistId
JOIN Track AS t ON t.TrackId = pt.TrackId
WHERE p.Name = 'Classical'
ORDER BY t.Name, t.TrackId
LIMIT 20`,
  },
  {
    id: 'genres', group: 'Store reports', label: 'Catalog by genre · grouped aggregates',
    description: 'See which genres have the most tracks, with their total listening hours. This measures catalog size, not sales or popularity.',
    sql: `SELECT g.Name AS genre, COUNT(*) AS tracks,
       ROUND(SUM(t.Milliseconds) / 3600000.0, 1) AS hours
FROM Genre AS g
JOIN Track AS t ON t.GenreId = g.GenreId
GROUP BY g.GenreId, g.Name
ORDER BY tracks DESC, genre
LIMIT 10`,
  },
  {
    id: 'countries', group: 'Store reports', label: 'Sales by billing country · totals',
    description: 'Compare the ten largest billing markets by recorded invoice total, alongside invoice counts and average order value. Amounts use the sample database’s currency units.',
    sql: `SELECT BillingCountry AS country,
       COUNT(*) AS invoices,
       ROUND(SUM(Total), 2) AS sales,
       ROUND(AVG(Total), 2) AS average_order
FROM Invoice
GROUP BY BillingCountry
ORDER BY sales DESC, country
LIMIT 10`,
  },
  {
    id: 'customers', group: 'Store reports', label: 'Top customers · join & aggregation',
    description: 'Identify the ten customers with the highest recorded spending. Customer IDs make ties deterministic; names and countries provide useful context.',
    sql: `SELECT c.CustomerId, c.FirstName, c.LastName, c.Country,
       COUNT(*) AS orders,
       ROUND(SUM(i.Total), 2) AS spending
FROM Customer AS c
JOIN Invoice AS i ON i.CustomerId = c.CustomerId
GROUP BY c.CustomerId, c.FirstName, c.LastName, c.Country
ORDER BY spending DESC, c.CustomerId
LIMIT 10`,
  },
  {
    id: 'monthly', group: 'Store reports', label: 'Recent monthly sales · date grouping',
    description: 'Review the last twelve months represented in the snapshot, not the current calendar year. Group invoice dates by year and month to compare order volume and sales.',
    sql: `SELECT strftime('%Y-%m', InvoiceDate) AS month,
       COUNT(*) AS invoices,
       ROUND(SUM(Total), 2) AS sales
FROM Invoice
GROUP BY strftime('%Y-%m', InvoiceDate)
ORDER BY month DESC
LIMIT 12`,
  },
  {
    id: 'album-insights', group: 'Deeper analysis', label: 'Album listening guide · HAVING & CASE',
    description: 'Among the first twenty catalog albums, compare albums with at least five tracks: total duration, average track price, and how many songs exceed five minutes. The album-ID range bounds the demo workload.',
    sql: `SELECT a.Title AS album, COUNT(*) AS tracks,
       ROUND(SUM(t.Milliseconds) / 60000.0, 1) AS total_minutes,
       ROUND(AVG(t.UnitPrice), 2) AS average_price,
       SUM(CASE WHEN t.Milliseconds > 300000
                THEN 1 ELSE 0 END) AS tracks_over_5_minutes
FROM Album AS a
JOIN Track AS t ON t.AlbumId = a.AlbumId
WHERE a.AlbumId BETWEEN 1 AND 20
GROUP BY a.AlbumId, a.Title
HAVING COUNT(*) >= 5
ORDER BY total_minutes DESC, album
LIMIT 10`,
  },
  {
    id: 'unsold', group: 'Deeper analysis', label: 'Tracks never purchased · NOT EXISTS',
    description: 'Find ten catalog tracks with no purchase recorded in InvoiceLine. A correlated NOT EXISTS checks each track against sales history; absence here says nothing about demand outside this snapshot.',
    sql: `SELECT t.TrackId, t.Name AS track
FROM Track AS t
WHERE NOT EXISTS (
  SELECT 1 FROM InvoiceLine AS il
  WHERE il.TrackId = t.TrackId
)
ORDER BY t.TrackId
LIMIT 10`,
  },
  {
    id: 'invoice-ranking', group: 'Deeper analysis', label: 'Invoice ranking within countries · window',
    description: 'Rank invoices from largest to smallest within each billing country, retaining individual invoices rather than collapsing them into totals. The first twenty rows are shown in country/rank order; invoice ID breaks equal-total ties.',
    sql: `SELECT BillingCountry AS country, InvoiceId, Total,
       ROW_NUMBER() OVER (
         PARTITION BY BillingCountry
         ORDER BY Total DESC, InvoiceId
       ) AS country_rank
FROM Invoice
ORDER BY country, country_rank
LIMIT 20`,
  },
  {
    id: 'types', group: 'Value reference', label: 'SQLite value types',
    description: 'A small reference for the result renderer: exact INTEGER, REAL, NULL, and BLOB values. Hover over cells to inspect their SQLite storage classes.',
    sql: "SELECT 42 AS integer_value,\n       3.5 AS real_value,\n       NULL AS null_value,\n       X'CAFE' AS blob_value",
  },
];
