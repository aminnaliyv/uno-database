// Color Match Card Game - browser UI.
// All game rules live in game.js; this file only draws the state and handles clicks.

const $ = (sel) => document.querySelector(sel);

const BOT_DELAY = 900;   // ms a computer player "thinks"
const SYMBOLS = { "Skip": "⊘", "Reverse": "⇄", "Draw Two": "+2" };

let game = null;
let lastConfigs = null;
let viewer = null;       // the human whose hand is shown at the bottom
let humanCount = 0;
let busy = false;        // true while a bot is moving or an overlay is open
let playerCount = 3;


// ---------------- SETUP SCREEN ----------------
function renderSetupRows() {
  const rows = $("#player-rows");
  const old = [...rows.querySelectorAll(".player-row")].map(r => ({
    name: r.querySelector("input").value,
    isBot: r.querySelector("select").value === "bot",
  }));
  rows.innerHTML = "";
  for (let i = 0; i < playerCount; i++) {
    const prev = old[i] || { name: i === 0 ? "You" : `Bot ${i}`, isBot: i !== 0 };
    const row = document.createElement("div");
    row.className = "player-row";
    row.innerHTML = `
      <span class="seat">${i + 1}</span>
      <input type="text" maxlength="14" aria-label="Name of player ${i + 1}">
      <select aria-label="Player ${i + 1} type">
        <option value="human">Human</option>
        <option value="bot">Computer</option>
      </select>`;
    row.querySelector("input").value = prev.name;
    row.querySelector("select").value = prev.isBot ? "bot" : "human";
    rows.appendChild(row);
  }
}

function readConfigs() {
  return [...document.querySelectorAll(".player-row")].map((r, i) => ({
    name: r.querySelector("input").value.trim() || `Player${i + 1}`,
    isBot: r.querySelector("select").value === "bot",
  }));
}

$("#count-buttons").addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-count]");
  if (!btn) return;
  playerCount = Number(btn.dataset.count);
  document.querySelectorAll("#count-buttons button").forEach(b => b.classList.toggle("active", b === btn));
  renderSetupRows();
});

$("#start-btn").addEventListener("click", () => startGame(readConfigs()));
$("#quit-btn").addEventListener("click", showSetup);


// ---------------- GAME FLOW ----------------
function startGame(configs) {
  lastConfigs = configs;
  $("#log").innerHTML = "";
  game = new Game(configs, addLog);
  humanCount = configs.filter(c => !c.isBot).length;
  viewer = humanCount === 1 ? game.players.toArray().find(p => !p.isBot) : null;
  addLog(`Game start! Top card: ${game.topCard}.`);
  hideOverlay();
  $("#setup").classList.add("hidden");
  $("#game").classList.remove("hidden");
  nextTurn();
}

function showSetup() {
  game = null;
  hideOverlay();
  $("#game").classList.add("hidden");
  $("#setup").classList.remove("hidden");
}

function nextTurn() {
  if (!game) return;
  if (game.winner) {
    busy = true;
    render();
    showWinner(game.winner);
    return;
  }

  const player = game.current;
  if (player.isBot) {
    busy = true;
    render();
    const thisGame = game;
    setTimeout(() => { if (game === thisGame) botTurn(); }, BOT_DELAY);
  } else if (humanCount > 1 && viewer !== player) {
    // Hide the previous player's cards before handing the device over
    viewer = null;
    busy = true;
    render();
    showOverlay(`${player.name}'s turn`, `Pass the device to ${player.name}.`, `Show my cards`, () => {
      viewer = player;
      busy = false;
      hideOverlay();
      render();
    });
  } else {
    viewer = player;
    busy = false;
    render();
  }
}

function botTurn() {
  const position = game.chooseBotMove();
  if (position === 0) game.drawAndPass();
  else game.playCard(position);
  nextTurn();
}

function onHandClick(position, el) {
  if (busy || !game || game.current !== viewer) return;
  const result = game.playCard(position);
  if (!result.ok) {
    flashStatus(result.reason);
    el.classList.remove("shake");
    void el.offsetWidth;          // restart the animation
    el.classList.add("shake");
    return;
  }
  nextTurn();
}

$("#draw-pile").addEventListener("click", () => {
  if (busy || !game || game.current !== viewer) return;
  game.drawAndPass();
  nextTurn();
});


// ---------------- RENDERING ----------------
function cardEl(card, extraClass = "") {
  const el = document.createElement("div");
  const label = SYMBOLS[card.value] || String(card.value);
  el.className = `card c-${card.color.toLowerCase()} ${extraClass}`;
  el.title = card.toString();
  el.innerHTML = `
    <span class="corner tl">${label}</span>
    <span class="oval"><span class="value">${label}</span></span>
    <span class="corner br">${label}</span>`;
  return el;
}

function render() {
  if (!game) return;
  const top = game.topCard;
  const current = game.current;
  const myTurn = !busy && current === viewer && !game.winner;

  // Turn order (walk the circular list once, starting at head)
  const circle = $("#circle");
  circle.innerHTML = "";
  for (const p of game.players.toArray()) {
    const li = document.createElement("li");
    li.className = "seat-chip" + (p === current ? " active" : "") + (p === viewer ? " me" : "");
    const backs = Math.min(p.hand.size, 10);
    li.innerHTML = `
      <div class="chip-name">${escapeHtml(p.name)}${p.isBot ? ' <span class="tag">BOT</span>' : ""}</div>
      <div class="mini-hand">${'<i></i>'.repeat(backs)}</div>
      <div class="chip-count">${p.hand.size} card${p.hand.size === 1 ? "" : "s"}${p.hand.size === 1 ? ' <span class="last">LAST CARD</span>' : ""}</div>`;
    circle.appendChild(li);
  }
  circle.classList.toggle("ccw", !game.players.clockwise);
  $("#direction").textContent = game.players.clockwise ? "↻ Clockwise" : "↺ Counter-clockwise";

  // Piles
  const discard = $("#discard");
  discard.innerHTML = "";
  discard.appendChild(cardEl(top, "big"));
  $("#draw-count").textContent = `Draw pile · ${game.drawPile.size}`;
  $("#draw-pile").classList.toggle("can-draw", myTurn);
  $("#draw-pile").disabled = !myTurn;

  // Status line
  let status;
  if (game.winner) status = `${game.winner.name} wins!`;
  else if (current.isBot) status = `${current.name} is thinking…`;
  else if (myTurn) status = viewer.hand.hasPlayable(top)
    ? "Your turn — play a matching card, or draw."
    : "No matching card — click the draw pile.";
  else status = `Waiting for ${current.name}…`;
  setStatus(status);

  // Viewer's hand (walk the singly linked list)
  const hand = $("#hand");
  hand.innerHTML = "";
  if (!viewer) {
    $("#hand-title").textContent = "Cards hidden";
    return;
  }
  $("#hand-title").textContent = `${viewer.name}'s hand · ${viewer.hand.size}`;
  viewer.hand.toArray().forEach((card, i) => {
    const playable = card.matches(top);
    const cls = [
      myTurn ? (playable ? "playable" : "dim") : "",
      card === game.lastDrawn && current !== viewer ? "new" : "",
    ].join(" ");
    const el = cardEl(card, cls);
    el.setAttribute("role", "button");
    el.tabIndex = myTurn ? 0 : -1;
    el.addEventListener("click", () => onHandClick(i + 1, el));
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onHandClick(i + 1, el); }
    });
    hand.appendChild(el);
  });
}

let statusTimer = null;
function setStatus(text) {
  if (statusTimer) return;   // keep an error message visible for a moment
  $("#status").textContent = text;
  $("#status").classList.remove("error");
}

function flashStatus(text) {
  clearTimeout(statusTimer);
  $("#status").textContent = text;
  $("#status").classList.add("error");
  statusTimer = setTimeout(() => { statusTimer = null; render(); }, 2200);
}

function addLog(message) {
  const li = document.createElement("li");
  li.textContent = message;
  if (/WINS!/.test(message)) li.className = "win";
  else if (/skipped|reversed|draws 2/.test(message)) li.className = "effect";
  const log = $("#log");
  log.prepend(li);
  while (log.children.length > 60) log.lastChild.remove();
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
}


// ---------------- OVERLAY ----------------
function showOverlay(title, text, buttonText, onClick, button2Text, onClick2) {
  $("#overlay-title").textContent = title;
  $("#overlay-text").textContent = text;
  const b1 = $("#overlay-btn");
  const b2 = $("#overlay-btn2");
  b1.textContent = buttonText;
  b1.onclick = onClick;
  b2.classList.toggle("hidden", !button2Text);
  if (button2Text) {
    b2.textContent = button2Text;
    b2.onclick = onClick2;
  }
  $("#overlay").classList.remove("hidden");
  b1.focus();
}

function hideOverlay() {
  $("#overlay").classList.add("hidden");
}

function showWinner(winner) {
  const text = winner.isBot && humanCount > 0
    ? "Better luck next time."
    : "No cards left — well played!";
  showOverlay(`${winner.name} wins!`, text,
    "Play again", () => startGame(lastConfigs),
    "Change players", showSetup);
}


// ---------------- START ----------------
renderSetupRows();
