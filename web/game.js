// Color Match Card Game - game logic (browser version).
// Same data structures as card_game.py, written from scratch in JavaScript:
//   Turn order          -> circular doubly linked list (PlayerCircle, Player)
//   Draw / discard pile -> stack (CardStack)
//   Player's hand       -> singly linked list (Hand)

const COLORS = ["Red", "Blue", "Green", "Yellow"];
const SPECIALS = ["Skip", "Reverse", "Draw Two"];


// ---------------- CARD ----------------
class Card {
  constructor(color, value) {
    this.color = color;   // "Red", "Blue", ...
    this.value = value;   // 0-9 or "Skip" / "Reverse" / "Draw Two"
  }

  isSpecial() {
    return SPECIALS.includes(this.value);
  }

  // A card can be played if the color OR the value matches the top card
  matches(other) {
    return this.color === other.color || this.value === other.value;
  }

  toString() {
    return `${this.color} ${this.value}`;
  }
}


// ---------------- GENERIC NODE (for Stack and Hand) ----------------
class Node {
  constructor(data) {
    this.data = data;
    this.next = null;
  }
}


// ---------------- STACK: draw pile & discard pile (LIFO) ----------------
class CardStack {
  constructor() {
    this.top = null;
    this.size = 0;
  }

  isEmpty() {
    return this.top === null;
  }

  // Push: put a card on top -> O(1)
  push(card) {
    const node = new Node(card);
    node.next = this.top;
    this.top = node;
    this.size++;
  }

  // Pop: take the top card -> O(1)
  pop() {
    if (this.isEmpty()) return null;
    const card = this.top.data;
    this.top = this.top.next;
    this.size--;
    return card;
  }

  // Peek: look at the top card without removing it -> O(1)
  peek() {
    return this.isEmpty() ? null : this.top.data;
  }
}


// ---------------- SINGLY LINKED LIST: a player's hand ----------------
class Hand {
  constructor() {
    this.head = null;
    this.size = 0;
  }

  isEmpty() {
    return this.head === null;
  }

  // Add a card to the front of the hand -> O(1)
  add(card) {
    const node = new Node(card);
    node.next = this.head;
    this.head = node;
    this.size++;
  }

  // Return the card at a position (1-based) without removing it -> O(n)
  get(position) {
    if (position < 1 || position > this.size) return null;
    let temp = this.head;
    for (let i = 1; i < position; i++) temp = temp.next;
    return temp.data;
  }

  // Remove and return the card at a position (1-based) -> O(n)
  remove(position) {
    if (position < 1 || position > this.size) return null;
    let card;
    if (position === 1) {
      card = this.head.data;
      this.head = this.head.next;
    } else {
      let prev = this.head;
      for (let i = 1; i < position - 1; i++) prev = prev.next;
      card = prev.next.data;
      prev.next = prev.next.next;   // unlink the node
    }
    this.size--;
    return card;
  }

  // Is there any card in the hand that can be played on topCard?
  hasPlayable(topCard) {
    let temp = this.head;
    while (temp) {
      if (temp.data.matches(topCard)) return true;
      temp = temp.next;
    }
    return false;
  }

  // Walk the list front to back (used to draw the hand on screen)
  toArray() {
    const cards = [];
    let temp = this.head;
    while (temp) {
      cards.push(temp.data);
      temp = temp.next;
    }
    return cards;
  }
}


// ---------------- PLAYER (node of the circular doubly linked list) ----------------
class Player {
  constructor(name, isBot) {
    this.name = name;
    this.isBot = isBot;
    this.hand = new Hand();
    this.next = null;
    this.prev = null;
  }
}


// ---------------- CIRCULAR DOUBLY LINKED LIST: turn order ----------------
class PlayerCircle {
  constructor() {
    this.head = null;
    this.current = null;
    this.clockwise = true;   // true -> follow next, false -> follow prev
    this.size = 0;
  }

  // Add a player at the "end" (just before head) -> O(1)
  addPlayer(name, isBot) {
    const player = new Player(name, isBot);
    if (this.head === null) {
      player.next = player;
      player.prev = player;
      this.head = player;
      this.current = player;
    } else {
      const last = this.head.prev;
      last.next = player;
      player.prev = last;
      player.next = this.head;
      this.head.prev = player;
    }
    this.size++;
  }

  // Who plays after the current player (depends on direction)
  peekNext() {
    return this.clockwise ? this.current.next : this.current.prev;
  }

  // Move the turn forward by some steps (2 steps = skip a player)
  advance(steps = 1) {
    for (let i = 0; i < steps; i++) this.current = this.peekNext();
  }

  // Reverse: just switch which pointer we follow
  reverse() {
    this.clockwise = !this.clockwise;
  }

  // Walk once around the circle starting at head
  toArray() {
    const players = [];
    let temp = this.head;
    for (let i = 0; i < this.size; i++) {
      players.push(temp);
      temp = temp.next;
    }
    return players;
  }
}


// ---------------- GAME ----------------
class Game {
  static START_CARDS = 5;

  // configs: [{ name, isBot }, ...]; onLog(message) receives game messages
  constructor(configs, onLog) {
    this.onLog = onLog || (() => {});
    this.players = new PlayerCircle();
    for (const c of configs) this.players.addPlayer(c.name, c.isBot);

    this.drawPile = new CardStack();
    this.discardPile = new CardStack();
    this.winner = null;
    this.lastDrawn = null;   // so the UI can highlight a freshly drawn card
    this.buildDeck();
    this.deal();
  }

  log(message) {
    this.onLog(message);
  }

  get current() {
    return this.players.current;
  }

  get topCard() {
    return this.discardPile.peek();
  }

  // Make all cards, shuffle them, put them on the draw stack
  buildDeck() {
    const cards = [];
    for (const color of COLORS) {
      for (let n = 0; n <= 9; n++) cards.push(new Card(color, n));
      for (const special of SPECIALS) {
        cards.push(new Card(color, special));
        cards.push(new Card(color, special));
      }
    }
    shuffle(cards);

    // Make sure the first card flipped (top of the stack) is a number card
    for (let i = cards.length - 1; i >= 0; i--) {
      if (!cards[i].isSpecial()) {
        [cards[i], cards[cards.length - 1]] = [cards[cards.length - 1], cards[i]];
        break;
      }
    }

    for (const card of cards) this.drawPile.push(card);
  }

  deal() {
    const firstCard = this.drawPile.pop();
    let player = this.players.head;
    for (let p = 0; p < this.players.size; p++) {
      for (let i = 0; i < Game.START_CARDS; i++) player.hand.add(this.drawPile.pop());
      player = player.next;
    }
    this.discardPile.push(firstCard);
  }

  // When the draw pile is empty, reuse the discard pile (except its top card)
  refillDrawPile() {
    const top = this.discardPile.pop();
    const temp = [];
    while (!this.discardPile.isEmpty()) temp.push(this.discardPile.pop());
    shuffle(temp);
    for (const card of temp) this.drawPile.push(card);
    this.discardPile.push(top);
    if (temp.length > 0) this.log("Draw pile was empty - discard pile shuffled back in.");
  }

  drawCard(player) {
    if (this.drawPile.isEmpty()) this.refillDrawPile();
    const card = this.drawPile.pop();
    if (card) player.hand.add(card);
    return card;
  }

  // Apply a special card's effect and move the turn on
  applyEffect(card) {
    let steps = 1;
    if (card.value === "Skip") {
      this.log(`${this.players.peekNext().name} is skipped!`);
      steps = 2;
    } else if (card.value === "Reverse") {
      this.players.reverse();
      this.log("Direction reversed!");
      if (this.players.size === 2) steps = 2;   // with 2 players, Reverse acts like Skip
    } else if (card.value === "Draw Two") {
      const victim = this.players.peekNext();
      this.drawCard(victim);
      this.drawCard(victim);
      this.log(`${victim.name} draws 2 cards and is skipped!`);
      steps = 2;
    }
    this.players.advance(steps);
  }

  // Current player plays the card at `position` (1-based).
  // Returns { ok: true, card } or { ok: false, reason }.
  playCard(position) {
    if (this.winner) return { ok: false, reason: "The game is over." };
    const player = this.current;
    const top = this.topCard;
    const card = player.hand.get(position);
    if (!card) return { ok: false, reason: "No card at that position." };
    if (!card.matches(top)) {
      return { ok: false, reason: `You can't play ${card} on ${top}. Match the color or the value.` };
    }

    player.hand.remove(position);
    this.discardPile.push(card);
    this.lastDrawn = null;
    this.log(`${player.name} played ${card}.`);

    if (player.hand.isEmpty()) {
      this.winner = player;
      this.log(`${player.name} has no cards left - ${player.name} WINS!`);
      return { ok: true, card };
    }
    if (player.hand.size === 1) this.log(`${player.name} has ONE card left!`);

    if (card.isSpecial()) this.applyEffect(card);
    else this.players.advance();
    return { ok: true, card };
  }

  // Current player draws one card; their turn ends (same rule as the console game)
  drawAndPass() {
    if (this.winner) return null;
    const player = this.current;
    const card = this.drawCard(player);
    this.lastDrawn = card;
    this.log(card ? `${player.name} drew a card.` : `${player.name} could not draw - no cards left.`);
    this.players.advance();
    return card;
  }

  // Simple computer player: returns a hand position to play, or 0 to draw.
  chooseBotMove() {
    const player = this.current;
    const top = this.topCard;
    const next = this.players.peekNext();
    const cards = player.hand.toArray();

    let best = 0;
    let bestScore = -Infinity;
    cards.forEach((card, i) => {
      if (!card.matches(top)) return;
      let score = 0;
      if (card.color === top.color) score += 2;         // keep the color flowing
      if (card.isSpecial()) score += next.hand.size <= 2 ? 5 : -1;  // save attacks for when they matter
      if (card.value === "Draw Two") score += 1;
      // prefer the color we hold most of
      score += cards.filter(c => c.color === card.color).length * 0.5;
      score += Math.random() * 0.5;                     // a bit of variety
      if (score > bestScore) {
        bestScore = score;
        best = i + 1;
      }
    });
    return best;
  }
}


// Fisher-Yates shuffle (in place)
function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}


// Allow `require` from Node.js for testing; in the browser these are globals.
if (typeof module !== "undefined") {
  module.exports = { COLORS, SPECIALS, Card, Node, CardStack, Hand, Player, PlayerCircle, Game };
}
