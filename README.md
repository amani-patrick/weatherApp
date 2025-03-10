# Weather Station Dashboard

This project is a real-time MQTT Weather Station Dashboard that displays temperature and humidity data. The data is collected from sensors and displayed on a web interface using charts and metrics. The dashboard allows users to select different intervals (5, 10, 30 minutes) for viewing average data.

## Features

- Real-time temperature and humidity data display
- Historical data visualization using Chart.js
- Adjustable time intervals for average data (5, 10, 30 minutes)
- Live indicators for real-time data updates
- Responsive design for various screen sizes

## Technologies Used

- HTML, CSS, JavaScript
- MQTT.js for real-time data communication
- Chart.js for data visualization
- Axios for HTTP requests
- Express.js for the server
- SQLite for data storage

## Installation

1. Clone the repository:
    ```sh
    git clone https://github.com/amani-patrick/weather-station-dashboard.git
    cd weather-station-dashboard
    ```

2. Install the dependencies:
    ```sh
    npm install
    ```

3. Start the server:
    ```sh
    node server.js
    ```

4. Open your browser and navigate to `http://localhost:3000` to view the dashboard.

## API Endpoints

- `POST /api/weather/data`: Store temperature or humidity data.
    - Request body:
        ```json
        {
            "type": "temperature" | "humidity",
            "value": number,
            "timestamp": "ISO 8601 string"
        }
        ```

- `POST /api/weather/interval`: Update the interval for calculating averages.
    - Request body:
        ```json
        {
            "interval": 5 | 10 | 30
        }
        ```

- `GET /api/weather/history`: Get historical averaged data for the chart.

## Usage

1. Open the dashboard in your browser.
2. Select the desired interval from the dropdown menu to view average data for the selected time frame.
3. The dashboard will automatically update with real-time data and historical averages.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Acknowledgements

- [MQTT.js](https://github.com/mqttjs/MQTT.js) for real-time data communication
- [Chart.js](https://www.chartjs.org/) for data visualization
- [Axios](https://github.com/axios/axios) for HTTP requests
- [Express.js](https://expressjs.com/) for the server framework
- [SQLite](https://www.sqlite.org/) for data storage

## Contributing

Contributions are welcome! Please open an issue or submit a pull request for any improvements or bug fixes.
