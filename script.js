// === Firebase – ERSÄTT MED DIN CONFIG ===
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
let round = 1, totalRounds = 3, timeLeft = 15;
let scores = {}, gameInterval, timerInterval;
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
  document.getElementById("currentRoomCode").innerText = roomId;
  initMap();
  initScores();
  listenForGame();
  if (playerId === "Värd") setTimeout(startRound, 1000);
}

// === Poäng ===
function initScores() {
  scores = {};
  db.ref("rooms/" + roomId + "/players").once("value", snap => {
    const players = snap.val() || {};
    Object.keys(players).forEach(p => scores[p] = 0);
  });
}

// === Kartan – TOM! ===
function initMap() {
  map = L.map('map', { zoomControl: false }).setView([62.0, 15.0], 4);
  
  // Tom karta: Använd grå tiles utan etiketter
  L.tileLayer('https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png', {
    maxZoom: 18,
    attribution: ''
  }).addTo(map);

  // Dölj alla kontroller
  map.attributionControl.setPrefix('');
  
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
    if (!data || !data.started) return;

    // Ny runda
    if (data.round !== round) {
      round = data.round;
      currentCity = cities.find(c => c.name === data.city);
      document.getElementById("cityName").innerText = currentCity.name;
      document.getElementById("roundInfo").innerText = `Runda ${round} av ${totalRounds}`;
      resetRound();
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

  // Lägg till spelare
  db.ref("rooms/" + roomId + "/players/" + playerId).set({ name: playerId });
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
    result: null
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
  if (playerId === "Värd") startTimer();
}

function startTimer() {
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    timeLeft--;
    document.getElementById("timer").innerText = timeLeft;
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
  if (playerId !== "Värd") return;
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
    scores[r.name] = (scores[r.name] || 0) + (3 - i); // 3, 2, 1 poäng
  });

  // Visa rätt plats
  L.marker([real.lat, real.lng], {
    icon: L.divIcon({ className: 'correct', html: 'City', iconSize: [30, 30] })
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

function updateScoreboard(scores) {
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const html = sorted.map(([name, pts], i) => 
    `${i===0 ? 'First place' : i===1 ? 'Second place' : 'Third place'} <strong>${name}</strong>: ${pts} poäng`
  ).join("<br>");
  document.getElementById("scoreboard").innerHTML = `<div style="margin-top:15px;"><strong>Poäng:</strong><br>${html}</div>`;
}

function endGame() {
  const winner = Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0];
  db.ref("rooms/" + roomId + "/finalWinner").set(winner);
}

function showFinalWinner(winner) {
  clearInterval(timerInterval);
  document.getElementById("result").innerHTML = `
    <h2>Game over!</h2>
    <h1>First place ${winner} vinner spelet!</h1>
    <button onclick="location.reload()">Spela igen</button>
  `;
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
