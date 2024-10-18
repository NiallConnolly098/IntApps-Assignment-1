new Vue({
    el: '#app',
    data: {
        city: '',
        forecast: [],
        umbrella: false,
        weatherType: '',
        error: null,
        apiKey: '6b073e13fa8ad12d7385c76f5311aee7',
        latitude: null,
        longitude: null,
        airQualityWarning: null,
        map: null,
        marker: null
    },
    methods: {
        getWeather() {
            this.forecast = [];
            this.umbrella = false;
            this.weatherType = '';
            this.error = null;
            this.airQualityWarning = null;

            if (!this.city) {
                this.error = "Please enter a city name.";
                return;
            }

            const apiUrl = `https://api.openweathermap.org/data/2.5/forecast?q=${this.city}&units=metric&appid=${this.apiKey}`;

            fetch(apiUrl)
                .then(response => response.json())
                .then(data => {
                    if(data.cod === "200") {
                        this.processForecast(data);
                        this.latitude = data.city.coord.lat;
                        this.longitude = data.city.coord.lon;
                        this.getAirPollution();
                        this.updateMap(this.latitude, this.longitude);
                    } else {
                        console.error("City not found or no coordinates available.")
                    }
                })
                .catch(error => {
                    this.error = "Failed to fetch weather data.";
                });
        },
        updateMap(lat, lon){
            this.$nextTick(() => {   
                this.map = L.map('map').setView([lat,lon],5);
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
                    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                }).addTo(this.map);
                
                this.map.setView([lat, lon], 5);
                this.marker = L.marker([lat, lon]).addTo(this.map);
            });
        },
        processForecast(data) {
            let forecastList = data.list.slice(0, 24);
            let rainDetected = false;
            let minTemp = Infinity;
            let maxTemp = -Infinity;

            forecastList.forEach(forecast => {
                let temp = forecast.main.temp;
                let rain = forecast.rain ? forecast.rain['3h'] || 0 : 0;
                let wind = forecast.wind.speed;

                this.forecast.push({
                    date: new Date(forecast.dt * 1000).toLocaleString(),
                    temp: temp,
                    wind: wind,
                    rain: rain
                });

                if (rain > 0) {
                    rainDetected = true;
                }

                if (temp < minTemp) {
                    minTemp = temp;
                }
                if (temp > maxTemp) {
                    maxTemp = temp;
                }
            });

            this.umbrella = rainDetected;

            if (maxTemp < 8) {
                this.weatherType = 'Cold';
            } else if (maxTemp <= 24) {
                this.weatherType = 'Mild';
            } else {
                this.weatherType = 'Hot';
            }
        },
        getAirPollution() {

            const airPollutionApiUrl = `https://api.openweathermap.org/data/2.5/air_pollution?lat=${this.latitude}&lon=${this.longitude}&appid=${this.apiKey}`;
            fetch(airPollutionApiUrl)
                .then(response => response.json())
                .then(data => {
                    if (data.list && data.list.length > 0){
                        this.checkAirQuality(data.list[0].components);
                    }
                })
                .catch((error) => {
                    console.error("Failed to catch air pollution data.");
                    
                });
        },
        checkAirQuality(components) {
            const thresholds = {
                pm2_5: 10,   // Fine particles (2.5 micrometers or smaller)
                pm10: 20,    // Coarse particles (between 2.5 and 10 micrometers)
                no2: 40,     // Nitrogen dioxide
                so2: 20,     // Sulfur dioxide
                o3: 60,      // Ozone
                co: 4400     // Carbon monoxide
            };

            let warningMessages = [];
            for(let pollutant in components){
                let level = components[pollutant];
                if (pollutant in thresholds && level > thresholds[pollutant]) {
                    let riskMessage = this.getHealthRiskMessage(pollutant, level, thresholds[pollutant]);
                    warningMessages.push(riskMessage);
                }
            }

            if(warningMessages.length > 0) {
                this.airQualityWarning = warningMessages.join(" ");
            } else {
                this.airQualityWarning = "The air quality here is good!"
            }
        },
        getHealthRiskMessage(pollutant, level, threshold) {
            const pollutantNames = {
                pm2_5: "Fine particles (PM2.5)",
                pm10: "Coarse particles (PM10)",
                no2: "Nitrogen dioxide (NO2)",
                so2: "Sulfur dioxide (SO2)",
                o3: "Ozone (O3)",
                co: "Carbon monoxide (CO)"
            };

            const healthRisks = {
                pm2_5: "Exposure to fine particles can cause respiratory issues and aggravate lung and heart conditions.",
                pm10: "Elevated PM10 levels can lead to irritation of the eyes, nose, and throat, as well as respiratory problems.",
                no2: "There is an association between nitrogen dioxide concentrations in the air and increases in mortality and hospital admissions for respiratory disease. Nitrogen dioxide can decrease the lungs' defences against bacteria making them more susceptible to infections. It can also aggravate asthma.",
                so2: "Sulfur dioxide is severely irritating to the eyes, mucous membranes, skin, and respiratory tract. Bronchospasm, pulmonary edema, pneumonitis, and acute airway obstruction can occur. Inhalation exposure to very low concentrations of sulfur dioxide can aggravate chronic pulmonary diseases, such as asthma and emphysema.",
                o3: "Ozone can damage the tissues of the respiratory tract, causing inflammation and irritation, and result in symptoms such as coughing, chest tightness and worsening of asthma symptoms.",
                co: "When you breathe in carbon monoxide, it enters your bloodstream. It mixes with haemoglobin to form carboxyhaemoglobin. Haemoglobin is the part of red blood cells that carry oxygen around your body. When this happens, the blood can no longer carry oxygen. This lack of oxygen causes the body's cells and tissue to fail and die."
            };
            let elevatedBy = (level - threshold).toFixed(2);
            let risk = healthRisks[pollutant];

            return `${pollutantNames[pollutant]} is elevated by ${elevatedBy} µg/m³. ${risk}`;
        }
    }
});
