// === Firebase – Byt ut mot ditt eget projekt! ===
const firebaseConfig = {
  apiKey: "AIzaSyDzlhc2T1jcxHbNk-lPNcxMWiQpx5bBNnU",
  authDomain: "gissa-stad.firebaseapp.com",
  databaseURL: "https://gissa-stad-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "gissa-stad",
  storageBucket: "gissa-stad.firebasestorage.app",
  messagingSenderId: "422017865549",
  appId: "1:422017865549:web:642015d39ead35d9158904",
  measurementId: "G-T9LWMHG6Y3"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// === Speldata ===
let map, marker, roomId, playerId, currentCity;
const cities = [
  { name: "Stockholm", lat: 59.3293, lng: 18.0686 },
  { name: "Göteborg", lat: 57.7089, lng: 11.9746 },
  { name: "Malmö", lat: 55.6050, lng: 13.0038 },
  { name: "Uppsala", lat: 59.8586, lng: 17.6389 },
  { name: "Västerås", lat: 59.6099, lng: 16.5448 },
  { name: "Örebro", lat: 59.2753, lng: 15.2134 },
  { name: "Linköping", lat: 58.4108, lng: 15.6214 },
  { name: "Helsingborg", lat: 56.0467, lng: 12.6944 },
  { name: "Jönköping", lat: 57.7815, lng: 14.1562 },
  { name: "Norrköping", lat: 58.5877, lng: 16.1924 },
  { name: "Lund", lat: 55.7047, lng: 13.1910 },
  { name: "Umeå", lat: 63.8258, lng: 20.2630 },
  { name: "Gävle", lat: 60.6749, lng: 17.1413 },
  { name: "Borås", lat: 57.7210, lng: 12.9400 },
  { name: "Södertälje", lat: 59.1954, lng: 17.6253 },
  { name: "Eskilstuna", lat: 59.3700, lng: 16.5100 },
  { name: "Halmstad", lat: 56.6745, lng: 12.8571 },
  { name: "Växjö", lat: 56.8790, lng: 14.8059 },
  { name: "Karlstad", lat: 59.3793, lng: 13.5036 },
  { name: "Sundsvall", lat: 62.3908, lng: 17.3069 },
  { name: "Luleå", lat: 65.5848, lng: 22.1567 },
  { name: "Kiruna", lat: 67.8557, lng: 20.2253 }
];

// === Rumhantering ===
function createRoom() {
  roomId = Math.random().toString(36).substr(2, 6).toUpperCase();
  playerId = "Värd";
  alert(`Rum skapat! Kod: ${roomId}\nDela med dina vänner!`);
  startGame();
}

function joinRoom() {
  roomId = document.getElementById("roomCode").value.trim().toUpperCase();
  if (!roomId) return alert("Skriv in en rumskod!");
  playerId = prompt("Ditt namn?", "Spelare") || "Spelare";
  startGame();
}

function startGame() {
  document.getElementById("lobby").style.display = "none";
  document.getElementById("gameArea").style.display = "block";
  initMap();
  listenForGame();
}

// === Kartan ===
function initMap() {
  map = L.map('map').setView([62.0, 15.0], 4);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap',
    maxZoom: 18
  }).addTo(map);

  map.on('click', function(e) {
    if (marker) marker.setLatLng(e.latlng);
    else marker = L.marker(e.latlng, { draggable: false }).addTo(map);
    document.getElementById("guessBtn").disabled = false;
  });
}

// === Lyssna på spelet ===
function listenForGame() {
  const roomRef = db.ref("rooms/" + roomId);

  roomRef.on("value", snapshot => {
    const data = snapshot.val();
    if (!data) return;

    // Starta ny runda
    if (data.started && !currentCity) {
      currentCity = cities.find(c => c.name === data.city);
      document.getElementById("cityName").innerText = currentCity.name;
      document.getElementById("guessBtn").style.display = "block";
    }

    // Visa andras gissningar (valfritt: rita ut med annan färg)
    if (data.guesses) {
      Object.entries(data.guesses).forEach(([id, g]) => {
        if (id !== playerId && !map.getPane(id)) {
          L.marker([g.lat, g.lng], {
            icon: L.divIcon({ className: 'other-guess', html: '👤', iconSize: [20, 20] })
          }).addTo(map).bindTooltip(g.name);
        }
      });
    }

    // Visa resultat
    if (data.result) {
      showResult(data.result);
    }
  });

  // Värden startar automatiskt
  if (playerId === "Värd") {
    setTimeout(startNewRound, 1500);
  }
}

function startNewRound() {
  const city = cities[Math.floor(Math.random() * cities.length)];
  db.ref("rooms/" + roomId).set({
    started: true,
    city: city.name,
    guesses: {},
    result: null
  });
  currentCity = city;
}

// === Skicka gissning ===
function submitGuess() {
  if (!marker) return alert("Placera din pil först!");
  const latlng = marker.getLatLng();
  db.ref("rooms/" + roomId + "/guesses/" + playerId).set({
    lat: latlng.lat,
    lng: latlng.lng,
    name: playerId
  });
  document.getElementById("guessBtn").innerText = "Väntar på andra...";
  document.getElementById("guessBtn").disabled = true;

  if (playerId === "Värd") {
    setTimeout(checkAllGuessed, 2000);
  }
}

function checkAllGuessed() {
  db.ref("rooms/" + roomId + "/guesses").once("value", snapshot => {
    const guesses = snapshot.val();
    const playerCount = Object.keys(guesses || {}).length;
    if (playerCount >= 2) {
      calculateWinner(guesses);
    }
  });
}

function calculateWinner(guesses) {
  const real = currentCity;
  const results = Object.values(guesses).map(g => {
    const dist = haversine(g.lat, g.lng, real.lat, real.lng);
    return { ...g, dist: Math.round(dist) };
  });

  results.sort((a, b) => a.dist - b.dist);

  const message = results.map((r, i) => 
    i === 0 ? `🥇 <strong>${r.name}</strong>: ${r.dist} km` :
    `   ${r.name}: ${r.dist} km`
  ).join("<br>");

  // Rita rätt plats
  L.marker([real.lat, real.lng], {
    icon: L.divIcon({ className: 'correct', html: '🏙️', iconSize: [30, 30] })
  }).addTo(map).bindPopup(`<strong>${real.name}</strong>`).openPopup();

  db.ref("rooms/" + roomId + "/result").set({
    winner: results[0].name,
    distances: results.map(r => `${r.name}: ${r.dist} km`),
    correct: { lat: real.lat, lng: real.lng }
  });
}

function showResult(result) {
  const div = document.getElementById("result");
  div.innerHTML = `
    <h2>🎉 ${result.winner} vann!</h2>
    <p><strong>Avstånd:</strong><br>${result.distances.join("<br>")}</p>
    <button onclick="location.reload()">Ny runda</button>
  `;
}

// === Haversine-formel ===
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}