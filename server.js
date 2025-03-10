// server.js
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Database initialization
const db = new sqlite3.Database('.temp_app.db', (err) => {
  if (err) {
    console.error('Error opening database', err);
  } else {
    console.log('Connected to SQLite database');
    createTables();
  }
});

function createTables() {
  // Create tables if they don't exist
  db.run(`CREATE TABLE IF NOT EXISTS raw_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    value REAL NOT NULL,
    timestamp TEXT NOT NULL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS avg_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    avg_temperature REAL,
    avg_humidity REAL,
    timestamp TEXT NOT NULL
  )`);
  
  calculateAndStoreAverages();
}

let latestTemp = null;
let latestHumidity = null;
let lastAverageTime = null;
let currentInterval = 5; // Default interval in minutes

app.post('/api/weather/data', (req, res) => {
  const { type, value, timestamp } = req.body;
  
  if (!type || value === undefined || !timestamp) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  if (type === 'temperature') {
    latestTemp = value;
  } else if (type === 'humidity') {
    latestHumidity = value;
  }
  
  db.run(
    'INSERT INTO raw_data (type, value, timestamp) VALUES (?, ?, ?)',
    [type, value, timestamp],
    function(err) {
      if (err) {
        console.error('Error storing data:', err);
        return res.status(500).json({ error: 'Failed to store data' });
      }
      
      res.status(201).json({ 
        message: 'Data stored successfully',
        id: this.lastID
      });
    }
  );
});

app.post('/api/weather/interval', (req, res) => {
  const { interval } = req.body;
  
  if (![5, 10, 30].includes(interval)) {
    return res.status(400).json({ error: 'Invalid interval' });
  }
  
  currentInterval = interval;
  res.status(200).json({ message: 'Interval updated successfully' });
});

function calculateAndStoreAverages() {
  const currentTime = new Date();
  
  // If we've already calculated averages in the last (currentInterval - 1) minutes, don't recalculate
  if (lastAverageTime && (currentTime - lastAverageTime < (currentInterval - 1) * 60 * 1000)) {
    return;
  }
  
  const intervalAgo = new Date(currentTime - currentInterval * 60 * 1000).toISOString();
  const currentTimeISO = currentTime.toISOString();
  
  // Calculate average temperature
  db.get(
    `SELECT AVG(value) as avg_value 
     FROM raw_data 
     WHERE type = 'temperature' AND timestamp > ? AND timestamp <= ?`,
    [intervalAgo, currentTimeISO],
    (err, tempResult) => {
      if (err) {
        return console.error('Error calculating average temperature:', err);
      }
      
      // Calculate average humidity
      db.get(
        `SELECT AVG(value) as avg_value 
         FROM raw_data 
         WHERE type = 'humidity' AND timestamp > ? AND timestamp <= ?`,
        [intervalAgo, currentTimeISO],
        (err, humidityResult) => {
          if (err) {
            return console.error('Error calculating average humidity:', err);
          }
          
          // Use latest values if no data in the time range
          const avgTemp = tempResult && tempResult.avg_value ? tempResult.avg_value : latestTemp;
          const avgHumidity = humidityResult && humidityResult.avg_value ? humidityResult.avg_value : latestHumidity;
          
          // Only store if we have data
          if (avgTemp !== null || avgHumidity !== null) {
            db.run(
              'INSERT INTO avg_data (avg_temperature, avg_humidity, timestamp) VALUES (?, ?, ?)',
              [avgTemp, avgHumidity, currentTimeISO],
              function(err) {
                if (err) {
                  console.error('Error storing average data:', err);
                } else {
                  console.log(`Stored ${currentInterval}-minute averages successfully at`, new Date().toLocaleTimeString());
                  lastAverageTime = currentTime;
                }
              }
            );
          }
        }
      );
    }
  );
}

// Get historical averaged data for the chart
app.get('/api/weather/history', (req, res) => {
  // Get the last entries based on the current interval
  const limit = 60 / currentInterval;
  db.all(
    `SELECT avg_temperature, avg_humidity, timestamp 
     FROM avg_data 
     ORDER BY timestamp DESC 
     LIMIT ?`,
    [limit],
    (err, rows) => {
      if (err) {
        console.error('Error fetching historical data:', err);
        return res.status(500).json({ error: 'Failed to fetch historical data' });
      }
      
      // Return the data in chronological order
      res.json(rows.reverse());
    }
  );
});

// Calculate averages more frequently to ensure we have data
setInterval(calculateAndStoreAverages, 60 * 1000); // Check every minute

// Database Viewer Routes
app.get('/db-viewer', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>SQLite Database Viewer</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        h1, h2 { color: #333; }
        table { border-collapse: collapse; width: 100%; margin-bottom: 30px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        tr:nth-child(even) { background-color: #f9f9f9; }
        .container { max-width: 1200px; margin: 0 auto; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>SQLite Database Viewer</h1>
        <h2>Tables</h2>
        <ul>
          <li><a href="/db-viewer/raw-data">raw_data</a></li>
          <li><a href="/db-viewer/avg-data">avg_data</a></li>
        </ul>
        <p>Click on a table name to view its data.</p>
      </div>
    </body>
    </html>
  `);
});

// View raw_data table
app.get('/db-viewer/raw-data', (req, res) => {
  db.all('SELECT * FROM raw_data ORDER BY timestamp DESC LIMIT 100', (err, rows) => {
    if (err) {
      return res.status(500).send('Error fetching data: ' + err.message);
    }
    
    let html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>raw_data Table</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        h1, h2 { color: #333; }
        table { border-collapse: collapse; width: 100%; margin-bottom: 30px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        tr:nth-child(even) { background-color: #f9f9f9; }
        .container { max-width: 1200px; margin: 0 auto; }
        .nav { margin-bottom: 20px; }
      </style>
      <meta http-equiv="refresh" content="30"> <!-- Auto-refresh page every 30 seconds -->
    </head>
    <body>
      <div class="container">
        <div class="nav">
          <a href="/db-viewer">← Back to Tables</a>
        </div>
        <h1>raw_data Table</h1>
        <p>Showing latest 100 records (auto-refreshes every 30 seconds)</p>
    `;
    
    if (rows.length === 0) {
      html += '<p>No data found in this table.</p>';
    } else {
      html += '<table><tr>';
      
      // Table headers
      Object.keys(rows[0]).forEach(key => {
        html += `<th>${key}</th>`;
      });
      html += '</tr>';
      
      // Table data
      rows.forEach(row => {
        html += '<tr>';
        Object.values(row).forEach(value => {
          html += `<td>${value}</td>`;
        });
        html += '</tr>';
      });
      
      html += '</table>';
    }
    
    html += `
        <div class="nav">
          <a href="/db-viewer">← Back to Tables</a>
        </div>
      </div>
    </body>
    </html>
    `;
    
    res.send(html);
  });
});

// View avg_data table
app.get('/db-viewer/avg-data', (req, res) => {
  db.all('SELECT * FROM avg_data ORDER BY timestamp DESC LIMIT 100', (err, rows) => {
    if (err) {
      return res.status(500).send('Error fetching data: ' + err.message);
    }
    
    let html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>avg_data Table</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        h1, h2 { color: #333; }
        table { border-collapse: collapse; width: 100%; margin-bottom: 30px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        tr:nth-child(even) { background-color: #f9f9f9; }
        .container { max-width: 1200px; margin: 0 auto; }
        .nav { margin-bottom: 20px; }
      </style>
      <meta http-equiv="refresh" content="30"> <!-- Auto-refresh page every 30 seconds -->
    </head>
    <body>
      <div class="container">
        <div class="nav">
          <a href="/db-viewer">← Back to Tables</a>
        </div>
        <h1>avg_data Table</h1>
        <p>Showing latest 100 records (auto-refreshes every 30 seconds)</p>
    `;
    
    if (rows.length === 0) {
      html += '<p>No data found in this table.</p>';
    } else {
      html += '<table><tr>';
      
      // Table headers
      Object.keys(rows[0]).forEach(key => {
        html += `<th>${key}</th>`;
      });
      html += '</tr>';
      
      // Table data
      rows.forEach(row => {
        html += '<tr>';
        Object.values(row).forEach(value => {
          html += `<td>${value}</td>`;
        });
        html += '</tr>';
      });
      
      html += '</table>';
    }
    
    html += `
        <div class="nav">
          <a href="/db-viewer">← Back to Tables</a>
        </div>
      </div>
    </body>
    </html>
    `;
    
    res.send(html);
  });
});

// Serve index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});