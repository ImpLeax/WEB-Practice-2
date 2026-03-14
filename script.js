document.addEventListener('DOMContentLoaded', () => {
    const btnUpdate = document.getElementById('updateBtn');
    const btnAuto = document.getElementById('autoUpdateBtn');
    const statusAuto = document.getElementById('autoStatus');
    const timeDisplay = document.getElementById('lastUpdate');
    
    const config = {
        wind:  { id: 'wind',  min: 0, max: 25, normMin: 5, normMax: 15 },
        rpm:   { id: 'rpm',   min: 0, max: 20, normMin: 8, normMax: 18 },
        power: { id: 'power', min: 0, max: 2000, normMin: 500, normMax: 1800 },
        angle: { id: 'angle', min: 0, max: 90, normMin: 0, normMax: 30 } 
    };

    let autoInterval = null;
    let isAutoEnabled = false;
    let currentWindSpeed = 12; 
    let currentWindDir = 0;
    
    const historyData = []; 
    let isCriticallyAlarming = false; 
    const alarmSound = new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg');

    const ctx = document.getElementById('powerChart').getContext('2d');
    const powerChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Потужність (кВт)',
                data: [],
                borderColor: '#0d6efd',
                backgroundColor: 'rgba(13, 110, 253, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { y: { min: 0, max: 2200 } }
        }
    });

    function generateLogicalData() {

        let windChange = (Math.random() - 0.5) * 1.2; 

        if (currentWindSpeed < 8) {
            windChange += 0.3; 
        } else if (currentWindSpeed > 15) {
            windChange -= 0.3; 
        }
        
        currentWindSpeed += windChange;
        
        currentWindSpeed = Math.max(3.5, Math.min(24.5, currentWindSpeed));
        
        currentWindDir += (Math.random() - 0.5) * 10;
        currentWindDir = (currentWindDir + 360) % 360;

        let isBraking = currentWindSpeed > 20; 
        let isCritical = currentWindSpeed >= 23;

        let rpm = 0, power = 0, angle = 0;

        if (!isBraking) {
            rpm = Math.min(20, currentWindSpeed * 1.15);
            power = Math.min(2000, Math.pow(currentWindSpeed, 3) * 0.55);
            angle = currentWindSpeed > 15 ? (currentWindSpeed - 15) * 5 : 0;
        } else {
            angle = 90; 
        }

        return {
            wind: currentWindSpeed.toFixed(1),
            rpm: rpm.toFixed(1),
            power: power.toFixed(1),
            angle: angle.toFixed(1),
            direction: Math.round(currentWindDir),
            isBraking: isBraking,
            isCritical: isCritical
        };
    }

    function checkStatus(value, paramConfig) {
        const v = parseFloat(value);
        if (v >= paramConfig.normMin && v <= paramConfig.normMax) return 'success';
        if (v >= paramConfig.min && v <= paramConfig.max) return 'warning';
        return 'danger';
    }

    function updateDashboard() {
        const data = generateLogicalData();
        timeDisplay.textContent = new Date().toLocaleTimeString('uk-UA');

        ['wind', 'rpm', 'power', 'angle'].forEach(key => {
            const val = data[key];
            const stat = checkStatus(val, config[key]);
            
            document.getElementById(`param-${key}`).textContent = val;
            const badge = document.getElementById(`status-${key}`);
            
            badge.className = `badge rounded-pill w-100 bg-${stat}`;
            badge.textContent = stat === 'success' ? 'Норма' : (stat === 'warning' ? 'Попередження' : 'Критично');
        });

        document.getElementById('windDirectionValue').textContent = data.direction;
        document.getElementById('windDirectionIcon').style.transform = `rotate(${data.direction}deg)`;

        const brakeAlert = document.getElementById('brakeAlert');
        const brakeStatus = document.getElementById('brakeStatus');
        const brakeIcon = document.getElementById('brakeIcon');
        if (data.isBraking) {
            brakeAlert.className = 'alert alert-warning d-flex align-items-center h-100 shadow-sm mb-0';
            brakeStatus.textContent = 'УВІМКНЕНО (Захист)';
            brakeIcon.className = 'bi bi-shield-fill-exclamation fs-2 me-3 text-danger';
        } else {
            brakeAlert.className = 'alert alert-success d-flex align-items-center h-100 shadow-sm mb-0';
            brakeStatus.textContent = 'Вимкнена';
            brakeIcon.className = 'bi bi-shield-check fs-2 me-3';
        }

        const critAlert = document.getElementById('criticalWindAlert');
        const critStatus = document.getElementById('criticalStatus');
        if (data.isCritical) {
            critAlert.className = 'alert alert-danger d-flex align-items-center h-100 shadow-sm mb-0 critical-pulse';
            critStatus.textContent = 'КРИТИЧНА ШВИДКІСТЬ!';
            if (!isCriticallyAlarming) {
                alarmSound.play().catch(e => console.log('Браузер заблокував автовідтворення звуку'));
                isCriticallyAlarming = true;
            }
        } else {
            critAlert.className = 'alert alert-success d-flex align-items-center h-100 shadow-sm mb-0';
            critStatus.textContent = 'Норма';
            isCriticallyAlarming = false;
        }

        const timeNow = new Date().toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        historyData.push({
            time: timeNow,
            wind: data.wind,
            rpm: data.rpm,
            power: data.power,
            angle: data.angle,
            status: data.isCritical ? 'Критично' : (data.isBraking ? 'Гальмування' : 'Норма')
        });

        if (historyData.length > 100) {
            historyData.shift();
        }

        powerChart.data.labels.push(timeNow);
        powerChart.data.datasets[0].data.push(data.power);
        
        if (powerChart.data.labels.length > 15) {
            powerChart.data.labels.shift();
            powerChart.data.datasets[0].data.shift();
        }
        powerChart.update();
    }

    function toggleAuto() {
        if (!isAutoEnabled) {
            autoInterval = setInterval(updateDashboard, 2000);
            isAutoEnabled = true;
            btnAuto.innerHTML = '<i class="bi bi-stop-fill"></i> Зупинити';
            btnAuto.classList.replace('btn-success', 'btn-danger');
            statusAuto.textContent = 'Увімкнено (2с)';
            statusAuto.classList.replace('bg-secondary', 'bg-success');
        } else {
            clearInterval(autoInterval);
            isAutoEnabled = false;
            btnAuto.innerHTML = '<i class="bi bi-play-fill"></i> Автооновлення';
            btnAuto.classList.replace('btn-danger', 'btn-success');
            statusAuto.textContent = 'Вимкнено';
            statusAuto.classList.replace('bg-success', 'bg-secondary');
        }
    }

    btnUpdate.addEventListener('click', updateDashboard);
    btnAuto.addEventListener('click', toggleAuto);
    
    const btnTestWind = document.getElementById('testWindBtn');
    btnTestWind.addEventListener('click', () => {
        currentWindSpeed += 5; 
        updateDashboard();     
    });

    const btnTestWindDown = document.getElementById('testWindDownBtn');
    btnTestWindDown.addEventListener('click', () => {
        currentWindSpeed -= 5; 
        if (currentWindSpeed < 0) {
            currentWindSpeed = 0;
        }
        updateDashboard();     
    });

    function exportToCSV() {
        if (historyData.length === 0) {
            alert("Немає даних для експорту!");
            return;
        }

        let csvContent = "data:text/csv;charset=utf-8,\uFEFF";

        csvContent += "Час,Швидкість вітру (м/с),Оберти (об/хв),Потужність (кВт),Кут нахилу (°),Статус\n";

        historyData.forEach(row => {
            csvContent += `${row.time},${row.wind},${row.rpm},${row.power},${row.angle},${row.status}\n`;
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `wind_station_report_${new Date().toISOString().slice(0,10)}.csv`);
        
        document.body.appendChild(link); 
        link.click(); 
        document.body.removeChild(link); 
    }

    document.getElementById('exportBtn').addEventListener('click', exportToCSV);

    updateDashboard();
});