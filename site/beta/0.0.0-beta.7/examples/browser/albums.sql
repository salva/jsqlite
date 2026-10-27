SELECT a.AlbumId, a.Title, t.TrackId, t.Name AS track
FROM Album AS a JOIN Track AS t ON t.AlbumId = a.AlbumId
ORDER BY a.AlbumId, t.TrackId
LIMIT 3;
