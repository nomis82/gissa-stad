// === Firebase – ERSÄTT MED DIN CONFIG ===
const firebaseConfig = {
  apiKey: "DIN_API_KEY",
  databaseURL: "https://din-app-default-rtdb.europe-west1.firebasedatabase.app"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// === Speldata ===
let map, marker, roomId, playerId, currentCity;
let round = 1, totalRounds = 3, timeLeft = 15;
let scores = {}, timerInterval;
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
  { name: "Luleå", lat: 65.5848, lng: 22.1567 }
];

// === Rumhantering ===
function createRoom() {
  roomId = Math.random().toString(36).substr(2, 6).toUpperCase();
  playerId = "Värd";
  alert(`Rum skapat! Kod: ${roomId}`);
  startLobby();
}

function joinRoom() {
  roomId = document.getElementById("roomCode").value.trim().toUpperCase();
  if (!roomId) return alert("Skriv in en rumskod!");
  playerId = prompt("Ditt namn?", "Spelare") || "Spelare";
  startLobby();
}

function startLobby() {
  document.getElementById("lobby").style.display = "none";
  document.getElementById("gameArea").style.display = "block";
  document.getElementById("currentRoomCode").innerText = roomId;
  initMap();
  listenForPlayers();
  db.ref("rooms/" + roomId + "/players/" + playerId).set({ name: playerId });
  if (playerId === "Värd") {
    document.getElementById("startGameBtn").style.display = "block";
  }
}

function startGameByHost() {
  if (playerId !== "Värd") return;
  db.ref("rooms/" + roomId + "/gameStarted").set(true);
  document.getElementById("startGameBtn").style.display = "none";
  startRound();
}

// === Lyssna på spelare ===
function listenForPlayers() {
  db.ref("rooms/" + roomId + "/players").on("value", snap => {
    const players = snap.val() || {};
    scores = {};
    Object.keys(players).forEach(p => scores[p] = 0);
    // Uppdatera UI om så behövs
  });
}

// === Kartan – TOM med OpenStreetMap ===
function initMap() {
  map = L.map('map', { zoomControl: false }).setView([62.0, 15.0], 4);
  
  // Tom karta: OpenStreetMap utan etiketter (custom style)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: ''
  }).addTo(map);

  // Dölj attribution
  map.attributionControl.setPrefix('');
  
  // Dölj etiketter med CSS (som tidigare)
  
  map.on('click', function(e) {
    if (marker) marker.setLatLng(e.latlng);
    else marker = L.marker(e.latlng).addTo(map);
    document.getElementById("guessBtn").disabled = false;
  });
}

// === Lyssna på spelet ===
function listenForGame() {
  const roomRef = db.ref("rooms/" + roomId);

  roomRef.on("value", snapshot => {
    const data = snapshot.val();
    if (!data) return;

    if (data.gameStarted && !data.started) {
      startRound();
    }

    // Ny runda
    if (data.started && data.round === round && currentCity?.name !== data.city) {
      currentCity = cities.find(c => c.name === data.city);
      document.getElementById("cityName").innerText = data.city || '';
      document.getElementById("roundInfo").innerText = `Runda ${round} av ${totalRounds}`;
      resetRound();
      startTimer();
    }

    // Timer synk
    if (data.timeLeft !== undefined) {
      timeLeft = data.timeLeft;
      document.getElementById("timer").innerText = timeLeft;
    }

    // Resultat
    if (data.result && data.result.round === round) {
      showRoundResult(data.result);
    }

    // Slutresultat
    if (data.finalWinner) {
      showFinalWinner(data.finalWinner);
    }
  });
}

// === Starta runda (bara värd) ===
function startRound() {
  if (playerId !== "Värd") return;
  const city = cities[Math.floor(Math.random() * cities.length)];
  db.ref("rooms/" + roomId).update({
    started: true,
    round: round,
    city: city.name,
    guesses: {},
    result: null,
    timeLeft: 15
  });
  currentCity = city;
  startTimer();
}

function resetRound() {
  if (marker) map.removeLayer(marker);
  marker = null;
  document.getElementById("guessBtn").disabled = true;
  document.getElementById("guessBtn").innerText = "Skicka gissning";
  document.getElementById("result").innerHTML = "";
  timeLeft = 15;
  document.getElementById("timer").innerText = timeLeft;
}

function startTimer() {
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    timeLeft--;
    document.getElementById("timer").innerText = timeLeft;
    if (playerId === "Värd") {
      db.ref("rooms/" + roomId + "/timeLeft").set(timeLeft);
    }
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      if (playerId === "Värd") checkAllGuessed();
    }
  }, 1000);
}

// === Gissa ===
function submitGuess() {
  if (!marker) return;
  const latlng = marker.getLatLng();
  db.ref("rooms/" + roomId + "/guesses/" + playerId).set({
    lat: latlng.lat,
    lng: latlng.lng,
    name: playerId
  });
  document.getElementById("guessBtn").innerText = "Skickat!";
  document.getElementById("guessBtn").disabled = true;
}

// === Kolla om alla gissat ===
function checkAllGuessed() {
  db.ref("rooms/" + roomId + "/guesses").once("value", snapshot => {
    const guesses = snapshot.val() || {};
    const playerCount = Object.keys(guesses).length;
    const totalPlayers = Object.keys(scores).length;
    if (playerCount >= totalPlayers || timeLeft <= 0) {
      calculateRoundWinner(guesses);
    }
  });
}

// === Räkna vinnare per runda ===
function calculateRoundWinner(guesses) {
  const real = currentCity;
  const results = Object.values(guesses).map(g => {
    const dist = haversine(g.lat, g.lng, real.lat, real.lng);
    return { ...g, dist: Math.round(dist) };
  });

  results.sort((a, b) => a.dist - b.dist);
  const winner = results[0];

  // Uppdatera poäng
  results.forEach((r, i) => {
    scores[r.name] = (scores[r.name] || 0) + (results.length - i); // 3,2,1... beroende på antal
  });

  // Visa rätt plats
  L.marker([real.lat, real.lng], {
    icon: L.divIcon({ className: 'correct', html: '🏙️', iconSize: [30, 30] })
  }).addTo(map).bindPopup(`<strong>${real.name}</strong>`).openPopup();

  db.ref("rooms/" + roomId + "/result").set({
    round: round,
    winner: winner.name,
    distances: results.map(r => `${r.name}: ${r.dist} km`),
    scores: scores
  });

  // Nästa runda eller slut
  setTimeout(() => {
    if (round < totalRounds) {
      round++;
      startRound();
    } else {
      endGame();
    }
  }, 5000);
}

function showRoundResult(result) {
  const div = document.getElementById("result");
  div.innerHTML = `
    <h3>Runda ${round} klar!</h3>
    <p><strong>${result.winner} vann rundan!</strong></p>
    <p>${result.distances.join("<br>")}</p>
  `;
  updateScoreboard(result.scores);
}

function updateScoreboard(currentScores) {
  const sorted = Object.entries(currentScores).sort((a, b) => b[1] - a[1]);
  const html = sorted.map(([name, pts]) => `<strong>${name}</strong>: ${pts} poäng`).join("<br>");
  document.getElementById("scoreboard").innerHTML = `<div style="margin-top:15px;"><strong>Poäng:</strong><br>${html}</div>`;
}

function endGame() {
  if (playerId !== "Värd") return;
  const finalScores = {...scores};
  const winner = Object.entries(finalScores).sort((a, b) => b[1] - a[1])[0][0];
  db.ref("rooms/" + roomId + "/finalWinner").set(winner);
  db.ref("rooms/" + roomId + "/finalScores").set(finalScores);
}

function showFinalWinner(winner) {
  clearInterval(timerInterval);
  db.ref("rooms/" + roomId + "/finalScores").once("value", snap => {
    const finalScores = snap.val();
    const sorted = Object.entries(finalScores).sort((a, b) => b[1] - a[1]);
    const html = sorted.map(([name, pts]) => `<strong>${name}</strong>: ${pts} poäng`).join("<br>");
    document.getElementById("result").innerHTML = `
      <h2>Spelet är slut!</h2>
      <h1>🏆 ${winner} vinner!</h1>
      <p><strong>Slutpoäng:</strong><br>${html}</p>
      <button onclick="location.reload()">Spela igen</button>
    `;
  });
}

// === Haversine ===
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

// Initiera lyssnare
listenForGame();
