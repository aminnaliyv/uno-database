import random

COLORS = ["Red", "Blue", "Green", "Yellow"]
SPECIALS = ["Skip", "Reverse", "Draw Two"]


# ---------------- CARD ----------------
class Card:
    def __init__(self, color, value):
        self.color = color      # "Red", "Blue", ...
        self.value = value      # 0-9 or "Skip" / "Reverse" / "Draw Two"

    def is_special(self):
        return self.value in SPECIALS

    # A card can be played if the color OR the value matches the top card
    def matches(self, other):
        return self.color == other.color or self.value == other.value

    def __str__(self):
        return f"{self.color} {self.value}"


# ---------------- GENERIC NODE (for Stack and Hand) ----------------
class Node:
    def __init__(self, data):
        self.data = data
        self.next = None


# ---------------- STACK: draw pile & discard pile (LIFO) ----------------
class CardStack:
    def __init__(self):
        self.top = None
        self.size = 0

    def is_empty(self):
        return self.top is None

    # Push: put a card on top -> O(1)
    def push(self, card):
        new_node = Node(card)
        new_node.next = self.top
        self.top = new_node
        self.size += 1

    # Pop: take the top card -> O(1)
    def pop(self):
        if self.is_empty():
            return None
        card = self.top.data
        self.top = self.top.next
        self.size -= 1
        return card

    # Peek: look at the top card without removing it -> O(1)
    def peek(self):
        return None if self.is_empty() else self.top.data


# ---------------- SINGLY LINKED LIST: a player's hand ----------------
class Hand:
    def __init__(self):
        self.head = None
        self.size = 0

    def is_empty(self):
        return self.head is None

    # Add a card to the front of the hand -> O(1)
    def add(self, card):
        new_node = Node(card)
        new_node.next = self.head
        self.head = new_node
        self.size += 1

    # Return the card at a position (1-based) without removing it
    def get(self, position):
        if position < 1 or position > self.size:
            return None
        temp = self.head
        for _ in range(position - 1):
            temp = temp.next
        return temp.data

    # Remove and return the card at a position (1-based) -> O(n)
    def remove(self, position):
        if position < 1 or position > self.size:
            return None
        if position == 1:
            card = self.head.data
            self.head = self.head.next
        else:
            prev = self.head
            for _ in range(position - 2):
                prev = prev.next
            card = prev.next.data
            prev.next = prev.next.next      # unlink the node
        self.size -= 1
        return card

    # Is there any card in the hand that can be played on top_card?
    def has_playable(self, top_card):
        temp = self.head
        while temp:
            if temp.data.matches(top_card):
                return True
            temp = temp.next
        return False

    def show(self):
        temp = self.head
        position = 1
        while temp:
            print(f"  {position}) {temp.data}")
            temp = temp.next
            position += 1


# ---------------- PLAYER (node of the circular doubly linked list) ----------------
class Player:
    def __init__(self, name):
        self.name = name
        self.hand = Hand()
        self.next = None
        self.prev = None


# ---------------- CIRCULAR DOUBLY LINKED LIST: turn order ----------------
class PlayerCircle:
    def __init__(self):
        self.head = None
        self.current = None
        self.clockwise = True       # True -> follow next, False -> follow prev
        self.size = 0

    # Add a player at the "end" (just before head) -> O(1)
    def add_player(self, name):
        new_player = Player(name)
        if self.head is None:
            new_player.next = new_player
            new_player.prev = new_player
            self.head = new_player
            self.current = new_player
        else:
            last = self.head.prev
            last.next = new_player
            new_player.prev = last
            new_player.next = self.head
            self.head.prev = new_player
        self.size += 1

    # Who plays after the current player (depends on direction)
    def peek_next(self):
        return self.current.next if self.clockwise else self.current.prev

    # Move the turn forward by some steps (2 steps = skip a player)
    def advance(self, steps=1):
        for _ in range(steps):
            self.current = self.peek_next()

    # Reverse: just switch which pointer we follow
    def reverse(self):
        self.clockwise = not self.clockwise

    def show(self):
        arrow = " -> " if self.clockwise else " <- "
        names = []
        temp = self.head
        for _ in range(self.size):
            mark = "*" if temp == self.current else ""
            names.append(mark + temp.name)
            temp = temp.next
        print("Turn order:", arrow.join(names), "(back to start)")


# ---------------- GAME ----------------
class Game:
    START_CARDS = 5

    def __init__(self, names):
        self.players = PlayerCircle()
        for name in names:
            self.players.add_player(name)

        self.draw_pile = CardStack()
        self.discard_pile = CardStack()
        self.build_deck()
        self.deal()

    # Make all cards, shuffle them, put them on the draw stack
    def build_deck(self):
        cards = []
        for color in COLORS:
            for number in range(10):
                cards.append(Card(color, number))
            for special in SPECIALS:
                cards.append(Card(color, special))
                cards.append(Card(color, special))
        random.shuffle(cards)

        # Make sure the first card flipped (top of the stack) is a number card
        for i in range(len(cards) - 1, -1, -1):
            if not cards[i].is_special():
                cards[i], cards[-1] = cards[-1], cards[i]
                break

        for card in cards:
            self.draw_pile.push(card)

    def deal(self):
        first_card = self.draw_pile.pop()
        player = self.players.head
        for _ in range(self.players.size):
            for _ in range(self.START_CARDS):
                player.hand.add(self.draw_pile.pop())
            player = player.next
        self.discard_pile.push(first_card)

    # When the draw pile is empty, reuse the discard pile (except its top card)
    def refill_draw_pile(self):
        top = self.discard_pile.pop()
        temp = []
        while not self.discard_pile.is_empty():
            temp.append(self.discard_pile.pop())
        random.shuffle(temp)
        for card in temp:
            self.draw_pile.push(card)
        self.discard_pile.push(top)
        print("(Draw pile was empty - discard pile shuffled back in.)")

    def draw_card(self, player):
        if self.draw_pile.is_empty():
            self.refill_draw_pile()
        card = self.draw_pile.pop()
        if card:
            player.hand.add(card)
        return card

    # Apply a special card's effect and move the turn on
    def apply_effect(self, card):
        steps = 1
        if card.value == "Skip":
            print(f"{self.players.peek_next().name} is skipped!")
            steps = 2
        elif card.value == "Reverse":
            self.players.reverse()
            print("Direction reversed!")
            if self.players.size == 2:      # with 2 players, Reverse acts like Skip
                steps = 2
        elif card.value == "Draw Two":
            victim = self.players.peek_next()
            self.draw_card(victim)
            self.draw_card(victim)
            print(f"{victim.name} draws 2 cards and is skipped!")
            steps = 2
        self.players.advance(steps)

    def ask_choice(self, hand_size):
        while True:
            text = input(f"Choose a card (1-{hand_size}) or 0 to draw: ")
            if text.isdigit() and 0 <= int(text) <= hand_size:
                return int(text)
            print("Invalid input, try again.")

    # One turn; returns the winner or None
    def play_turn(self):
        player = self.players.current
        top = self.discard_pile.peek()

        print("\n" + "=" * 40)
        self.players.show()
        print(f"Top card: {top}")
        print(f"{player.name}'s hand:")
        player.hand.show()

        while True:
            choice = self.ask_choice(player.hand.size)

            if choice == 0:
                card = self.draw_card(player)
                print(f"{player.name} drew {card}.")
                self.players.advance()
                return None

            card = player.hand.get(choice)
            if card.matches(top):
                player.hand.remove(choice)
                self.discard_pile.push(card)
                print(f"{player.name} played {card}.")
                break
            print(f"You can't play {card} on {top}. Match the color or the value.")

        if player.hand.is_empty():
            return player

        if player.hand.size == 1:
            print(f"{player.name} has ONE card left!")

        if card.is_special():
            self.apply_effect(card)
        else:
            self.players.advance()
        return None

    def run(self):
        print("\nGame start! Match the top card by color or value.")
        while True:
            winner = self.play_turn()
            if winner:
                print("\n" + "=" * 40)
                print(f"{winner.name} has no cards left - {winner.name} WINS!")
                break


# ---------------- MAIN PROGRAM ----------------
if __name__ == "__main__":
    print("=== Color Match Card Game ===")
    while True:
        count = input("Number of players (2-4): ")
        if count in ("2", "3", "4"):
            break
        print("Please enter 2, 3 or 4.")

    names = []
    for i in range(int(count)):
        name = input(f"Name of player {i + 1}: ").strip()
        names.append(name if name else f"Player{i + 1}")

    Game(names).run()
