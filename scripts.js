// URL de la API de ThingSpeak
const channelID = '2733672'; // Reemplaza con tu ID de canal
const readAPIKey = 'ORQ5UJZGWK3ABPQ6'; // Reemplaza con tu clave de API de solo lectura

// Variables para almacenar datos históricos
const historicalData = {
    labels: [],
    solarValues: [],
    windValues: []
};

// Set para rastrear los timestamps y evitar duplicados
const fetchedTimestamps = new Set();

// Configuración de gráficas en tiempo real
const ctxSolarReal = document.getElementById('realTimeChart').getContext('2d');
const realTimeChart = new Chart(ctxSolarReal, {
    type: 'line',
    data: {
        labels: [],
        datasets: [{
            label: 'Radiación Solar (W/m²)',
            data: [],
            borderColor: 'rgba(255, 99, 132, 1)',
            borderWidth: 2,
            fill: false
        }]
    },
    options: {
        responsive: true,
        scales: {
            x: { title: { display: true, text: 'Tiempo' } },
            y: { title: { display: true, text: 'Radiación Solar (W/m²)' } }
        }
    }
});

const ctxWindReal = document.getElementById('windSpeedChart').getContext('2d');
const windSpeedChart = new Chart(ctxWindReal, {
    type: 'line',
    data: {
        labels: [],
        datasets: [{
            label: 'Velocidad del Viento (m/s)',
            data: [],
            borderColor: 'rgba(54, 162, 235, 1)',
            borderWidth: 2,
            fill: false
        }]
    },
    options: {
        responsive: true,
        scales: {
            x: { title: { display: true, text: 'Tiempo' } },
            y: { title: { display: true, text: 'Velocidad del Viento (m/s)' } }
        }
    }
});

// Función para obtener datos de ThingSpeak
async function fetchThingSpeakData() {
    const solarResponse = await fetch(`https://api.thingspeak.com/channels/${channelID}/fields/1.json?api_key=${readAPIKey}&results=10`);
    const windResponse = await fetch(`https://api.thingspeak.com/channels/${channelID}/fields/2.json?api_key=${readAPIKey}&results=10`);
    
    const solarData = await solarResponse.json();
    const windData = await windResponse.json();

    // Verificar si los datos están vacíos
    if (solarData.feeds.length === 0 || windData.feeds.length === 0) {
        return null; // No hay datos
    }

    const labels = solarData.feeds.map(feed => feed.created_at);
    const solarValues = solarData.feeds.map(feed => parseFloat(feed.field1));
    const windValues = windData.feeds.map(feed => parseFloat(feed.field2));
    
    return { labels, solarValues, windValues };
}


// Función para actualizar los datos en tiempo real y el estado del botón
async function updateRealTimeChart() {
    try {
        const { labels, solarValues, windValues } = await fetchThingSpeakData();
        const latestLabel = labels[labels.length - 1];
        const latestSolar = solarValues[solarValues.length - 1];
        const latestWind = windValues[windValues.length - 1];

        // Actualizar elementos HTML con los valores más recientes
        document.getElementById('solar-radiation').textContent = latestSolar.toFixed(2);
        document.getElementById('wind-speed').textContent = latestWind.toFixed(2);

        // Verificar las condiciones para el estado (verde)
        if (latestWind >= 2 && latestWind <= 15 && latestSolar >= 100 && latestSolar <= 1000) {
            if (status !== 1) {  // Si el estado no es ya verde
                status = 1; // Cambiar a verde
                toggleStatus(); // Actualizar el botón a verde
            }
        } else {
            if (status !== 0) {  // Si el estado no es ya rojo
                status = 0; // Cambiar a rojo
                toggleStatus(); // Actualizar el botón a rojo
            }
        }

        // Actualizar gráficas en tiempo real
        realTimeChart.data.labels = labels;
        realTimeChart.data.datasets[0].data = solarValues;

        windSpeedChart.data.labels = labels;
        windSpeedChart.data.datasets[0].data = windValues;

        realTimeChart.update();
        windSpeedChart.update();
    } catch (error) {
        console.error("Error al obtener los datos de ThingSpeak", error);
    }
}




// Función para actualizar datos históricos
async function updateHistoricalData() {
    try {
        const data = await fetchThingSpeakData();

        if (data === null) {
            // No hay datos, mostrar mensaje en la tabla
            document.getElementById('historical-table-body').innerHTML = `<tr><td colspan="3">No hay datos históricos disponibles.</td></tr>`;
            return;
        }

        const { labels, solarValues, windValues } = data;

        // Agregar solo los datos nuevos que no se hayan procesado antes
        labels.forEach((label, index) => {
            if (!fetchedTimestamps.has(label)) {
                // Agregar timestamp al set
                fetchedTimestamps.add(label);

                // Agregar datos a las listas históricas
                historicalData.labels.push(label);
                historicalData.solarValues.push(solarValues[index]);
                historicalData.windValues.push(windValues[index]);

                // Actualizar tabla histórica
                const tableBody = document.getElementById('historical-table-body');
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${label}</td>
                    <td>${solarValues[index].toFixed(2)}</td>
                    <td>${windValues[index].toFixed(2)}</td>
                `;
                tableBody.appendChild(row);
            }
        });

        // Actualizar gráficas históricas
        solarGraph.data.labels = historicalData.labels;
        solarGraph.data.datasets[0].data = historicalData.solarValues;

        windGraph.data.labels = historicalData.labels;
        windGraph.data.datasets[0].data = historicalData.windValues;

        solarGraph.update();
        windGraph.update();
    } catch (error) {
        console.error("Error al obtener los datos históricos", error);
    }
}


// Función para cambiar el estado del botón
let status = 0; // 0: no aptas, 1: aptas

function updateButtonState() {
    const button = document.getElementById('evaluationButton');
    if (status === 1) {
        button.style.backgroundColor = 'green';
        button.textContent = 'Condiciones óptimas para generación de electricidad';
    } else {
        button.style.backgroundColor = 'red';
        button.textContent = 'Condiciones no aptas para generación de electricidad';
    }
}



// Llamar a updateButtonState al cargar la página para que se muestre el estado correcto desde el principio
updateButtonState();


// Funciones para descargar archivos
function downloadAsCSV() {
    const csvData = [];
    const labels = historicalData.labels;
    const solarValues = historicalData.solarValues;
    const windValues = historicalData.windValues;

    // Encabezados CSV
    csvData.push('Fecha y Hora, Radiación Solar (W/m²), Velocidad del Viento (m/s)');

    // Datos
    labels.forEach((label, index) => {
        csvData.push(`${label}, ${solarValues[index].toFixed(2)}, ${windValues[index].toFixed(2)}`);
    });

    // Crear un blob con los datos CSV
    const csvBlob = new Blob([csvData.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(csvBlob);
    
    // Crear un enlace de descarga
    const a = document.createElement('a');
    a.href = url;
    a.download = 'datos_históricos.csv';
    a.click();
    URL.revokeObjectURL(url);
}

function downloadAsPNG() {
    const canvas = document.getElementById('solarGraph');
    const image = canvas.toDataURL("image/png");
    const a = document.createElement('a');
    a.href = image;
    a.download = 'grafico_solar.png';
    a.click();
}

function downloadAsPDF() {
    const doc = new jsPDF();
    const canvas = document.getElementById('solarGraph');
    const imgData = canvas.toDataURL("image/png");
    doc.addImage(imgData, 'PNG', 10, 10, 180, 160);
    doc.save('grafico_solar.pdf');
}

// Función para mostrar el dropdown
document.getElementById('dropdownButton').addEventListener('click', function() {
    const dropdownMenu = document.getElementById('dropdownMenu');
    dropdownMenu.style.display = dropdownMenu.style.display === 'block' ? 'none' : 'block';
});

// Función para cambiar el estado del botón
function toggleStatus() {
    const button = document.getElementById('evaluationButton');
    if (status === 1) {
        button.style.backgroundColor = 'green';
        button.textContent = 'Condiciones óptimas para generación de electricidad';
    } else {
        button.style.backgroundColor = 'red';
        button.textContent = 'Condiciones no aptas para generación de electricidad';
    }
}




// Actualizar ambas secciones periódicamente
setInterval(updateRealTimeChart, 5000); // Tiempo real cada 5 segundos
setInterval(updateHistoricalData, 30000); // Históricos cada 30 segundos
