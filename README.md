# Color Match Card Game

A console card game (similar to UNO) written in Python for a Data Structures course.
Every game rule is handled by a data structure built from scratch.

## How to play

```
python card_game.py
```

- 2–4 players, 5 cards each.
- Play a card that matches the **color** or the **value** of the top card.
- Can't play? Enter `0` to draw a card (your turn ends).
- Special cards: **Skip**, **Reverse**, **Draw Two**.
- First player with no cards left wins.

No extra packages needed.

## Data structures

| Game part | Data structure | Class |
|---|---|---|
| Turn order | Circular doubly linked list | `PlayerCircle`, `Player` |
| Draw pile / discard pile | Stack | `CardStack` |
| Player's hand | Singly linked list | `Hand` |

- **Reverse** just switches the circle between following `next` and `prev`.
- **Skip** moves the turn two steps around the circle.
- When the draw pile is empty, the discard pile (except its top card) is shuffled back in.

## Complexity

| Operation | Time |
|---|---|
| Push / pop / peek a card | O(1) |
| Move to next player, reverse | O(1) |
| Add a card to a hand | O(1) |
| Find / remove a card in a hand | O(n) |

## Planned

- Browser version (JavaScript) with clickable cards.
