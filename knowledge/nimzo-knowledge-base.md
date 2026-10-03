# NIMZO CHESS KNOWLEDGE BASE: A Complete Reference from First Move to 2000 Elo

Up to about 2000 Elo, most games are lost to tactical oversights, not to gaps in opening theory. So the most useful knowledge Nimzo can hold is an explicit, rating-tagged set of rules: a safety-check routine, a pattern library, a short list of endgames, and opening ideas (not move lists). It also needs a way to turn Stockfish numbers into those rules. This document is built for that purpose. Each section has a tag such as [100-600], [600-1200], [1200-1600] or [1600-2000], states its principles plainly and gives the "why" a coach can pass on to a student.

## TL;DR

- **Below roughly 1800, safety and tactics decide most games.** The best returns come from a blunder-check routine (checks, captures, threats, plus "is my move safe?"), drilling patterns on puzzle sets that repeat, and analysing your own games. Theory adds little at these levels. Opening study should teach ideas and traps, not long memorised lines.
- **Technique comes from a small core of endgames and middlegame concepts, not from volume.** The endgames: basic mates, opposition and key squares, rule of the square, Lucena, Philidor, Vančura, and queen vs pawn. The concepts: pawn structures (IQP, Carlsbad, Maroczy, hanging pawns), outposts, good vs bad bishops, open files, prophylaxis, and Silman-style imbalances.
- **Nimzo should explain, not just evaluate.** It should tie each engine finding to a named principle or pattern in this document, adjust advice to the student's rating band, and use human-likely move prediction (Maia) to explain why a mistake was tempting. It should never just recite centipawn numbers.

---

## 1. How to Use This Knowledge Base

### 1.1 Structure and tagging conventions
- **Rating tags** show the level at which a concept is first useful: [100-600] is absolute beginner, [600-1200] novice to club entry, [1200-1600] intermediate club player, [1600-2000] strong club player. A concept tagged lower is still relevant at higher levels; the tag marks when to *introduce* it.
- **Notation**: standard algebraic notation (SAN). K = king, Q = queen, R = rook, B = bishop, N = knight, no letter = pawn. "x" = capture, "+" = check, "#" = mate, "O-O" = kingside castling, "O-O-O" = queenside castling. Annotation marks: "!" good, "!!" brilliant, "?" mistake, "??" blunder, "!?" interesting, "?!" dubious.
- **FEN** is used where an exact position matters. The starting position is `rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1`.
- **Principle format**: each principle is stated as a rule, followed by **Why**, and where useful by **Exception** and **Coach line** (a sentence a coach can say to a student).

### 1.2 Guidance for the coaching engine (Nimzo-specific)
1. **Diagnose before you prescribe.** Sort every mistake into one category: (a) hung material / missed opponent threat, (b) missed own tactic, (c) wrong plan / strategic error, (d) endgame technique, (e) opening misunderstanding, (f) time or psychological error. Category (a) dominates below 1200 and stays the largest category up to about 1800.
2. **Translate centipawns into principles.** A swing of more than 2 pawns is almost always tactical: find the pattern in Section 4 or 5 and name it. A swing of 0.3–1.0 is usually positional: map it to Section 7 (e.g., "you let a knight onto an outpost", "you traded your good bishop").
3. **Use human-move prediction for the "why".** If Maia rated the student's blunder as a likely move at that rating, say so and explain the trap of plausibility ("this looks natural because it develops a piece, but…").
4. **Pitch the lesson to the band.** Don't teach minority attacks to a 500-rated player who hangs a knight every game. Use Section 11.
5. **One lesson per game.** Pick the single most instructive, repeated error. Students change behaviour from one clear lesson, not from twenty notes.
6. **Praise good process, not only good results.** Reinforce moves where the student clearly checked for safety, even if the game was lost.

---

## 2. Absolute Fundamentals [100-600]

### 2.1 The board
- The board has 64 squares in an 8×8 grid. **Files** are the columns a–h. **Ranks** are the rows 1–8, numbered from White's side. **Diagonals** are slanted lines of same-coloured squares.
- Set up so that **each player has a light square in the bottom-right corner** ("light on right"). The queen starts on her own colour: the white queen on d1 (light), the black queen on d8 (dark).
- White always moves first.

### 2.2 How the pieces move
| Piece | Movement | Approx. value | Notes |
|---|---|---|---|
| Pawn | 1 square forward (2 from its starting square); captures 1 square diagonally forward | 1 | Never moves backward; promotes on the last rank |
| Knight | "L-shape": 2 squares in one direction, then 1 to the side; **jumps** over pieces | 3 | Always lands on the opposite colour square |
| Bishop | Any distance diagonally | 3 (pair ≈ 6.5) | Stays on one colour forever |
| Rook | Any distance along ranks/files | 5 | Strongest on open files and the 7th rank |
| Queen | Any distance along ranks, files or diagonals | 9 | Rook + bishop combined |
| King | 1 square in any direction | Infinite (game ends if mated) | Fighting value about 3–4 in endgames |

**Why values matter**: they let you judge trades quickly. Giving a bishop (3) for a rook (5) "wins the exchange". The values are guidelines, not laws: a well-placed knight can beat a bad bishop, and two minor pieces usually beat a rook in the middlegame.

### 2.3 Special rules
- **Castling**: the king moves two squares toward a rook, and the rook jumps to the square the king crossed. Allowed only if (1) neither the king nor that rook has moved, (2) no pieces stand between them, (3) the king is not in check, (4) the king does not pass through or land on an attacked square. A rook may be attacked or pass over an attacked square (in queenside castling the b1/b8 square may be attacked). **Why castle**: it tucks the king behind pawns and brings a rook toward the centre in one move.
- **En passant**: if a pawn advances two squares and lands beside an enemy pawn on its 5th rank, the enemy pawn may capture it *as if it had moved only one square*. This is allowed **only on the very next move**. Example: White pawn on e5, Black plays ...d7-d5, White may play exd6.
- **Promotion**: a pawn reaching the last rank must become a queen, rook, bishop or knight of its own colour (almost always a queen). Choosing anything else is "underpromotion", sometimes used to avoid stalemate or to give a knight check.
- **Touch-move** (over-the-board): if you deliberately touch your own piece you must move it, if legal; if you touch an opponent's piece you must capture it, if legal. Say "I adjust" (or "j'adoube") before straightening a piece.

### 2.4 Check, checkmate, stalemate
- **Check**: the king is attacked. You must get out of check by (1) moving the king, (2) capturing the checking piece, or (3) blocking the line (impossible against a knight or pawn check). Mnemonic: **"Move, Capture, Block."**
- **Checkmate**: in check with no legal way out. The game ends immediately.
- **Stalemate**: the side to move is *not* in check but has *no legal moves*. The game is a **draw**. This is the most common way beginners throw away won games with an extra queen.

### 2.5 How games end
- **Win**: checkmate, resignation, opponent's flag falls (if you have mating material), or forfeit/abandonment.
- **Draw**: stalemate; agreement; **threefold repetition** (the same position, same side to move, same castling/en passant rights, occurring three times; under FIDE rules it must be *claimed*, though online sites usually apply it automatically); **fifty-move rule** (50 moves by each side with no pawn move and no capture; claimable); **fivefold repetition** and **seventy-five-move rule** (both automatic under FIDE, introduced in 2014); **dead position / insufficient material** (e.g., K vs K, K+B vs K, K+N vs K); timeout when the opponent cannot possibly mate.
- **Coach line**: the fifty-move rule is real even at the top. At the 2024 World Rapid Championship, Alexander Donchenko successfully claimed a fifty-move draw against Hikaru Nakamura, who was one move from delivering mate. Know the count in long endgames.

### 2.6 Notation and reading games
- Moves are numbered: `1.e4 e5 2.Nf3 Nc6`. "1...e5" means Black's first move.
- Old books (Capablanca, Lasker, Nimzowitsch) use **descriptive notation** (P-K4 = e4, Kt = knight, Q B 3 = c3 for White). Learn to read it if you want the classics in their original editions.
- **Why learn notation**: you cannot analyse your games, use books or follow coaching without it, and reading games in your head is the first visualisation training.

### 2.7 The first five ideas every beginner needs
1. **Don't leave pieces where they can be taken for free.** Before every move ask: "after my move, can any of my pieces be captured without me taking back?"
2. **Look at what your opponent's last move threatens.** Every move changes what is attacked.
3. **Get your pieces out** (knights and bishops) before moving any piece twice or bringing the queen out early.
4. **Castle early** to keep your king safe.
5. **Use your king in the endgame**: once queens are gone, the king becomes an attacking piece.

### 2.8 Elementary checkmates you must know [100-600]
Capablanca begins *Chess Fundamentals* (1921, public domain) with these. In his words, "The first thing a student should do, is to familiarise himself with the power of the pieces."

**King + Queen vs King** (should take under 10 moves from most positions, per Capablanca):
- Use the queen to shrink the king's "box". Placing your queen a knight's move away from the enemy king often works well.
- Push the king to the edge, bring your own king up, then mate.
- **Stalemate warning**: when the enemy king has only one or two squares, check after every queen move that the opponent still has a legal move.
- Typical final patterns: queen on the 7th rank protected by the king, or the queen giving check on the edge with your king facing the enemy king.

**King + Rook vs King** (under 20 moves per Capablanca):
- Principle (Capablanca): drive the king "to the last line on any side of the board", and keep your king "as much as possible on the same rank, or… file, as the opposing King."
- Method: the rook cuts off a rank or file; your king approaches until it faces the enemy king (opposition); the rook checks and pushes the box one row closer. When the kings do not face each other, make a "waiting" rook move along the cut-off line.
- Final mate: kings facing each other with one square between, rook checks along the edge.

**Two Bishops vs King** (under 30 moves per Capablanca): the bishops, side by side, form a barrier; drive the king to the edge *and into a corner*. Your king must help. Watch for stalemate.

**Bishop + Knight vs King** [1600-2000]: hard but forced within 50 moves from any position. Mate is only possible in a corner **of the bishop's colour**. Technique: (1) drive the king to the edge; (2) if it runs to the wrong corner, use the "W manoeuvre" of the knight (e.g., with a light-squared bishop, knight on f7–e5–d3–c5/b4 patterns) to herd it along the edge to the right corner; (3) bishop takes away squares; (4) final mate with bishop or knight. Practise against an engine until you can do it in under 50 moves. In practice it comes up rarely; schedule it last among the basic mates.

**Two Rooks (or Q+R) vs King — the "ladder" / "lawnmower"**: rooks alternate checks on adjacent ranks, walking the king to the edge without help from your own king. If the king attacks a rook, swing the rook to the far side of the board.

**Draws to know**: K+N vs K, K+B vs K, K+2N vs K (cannot be forced), and K+B vs K+B with same-coloured or opposite bishops and no pawns are draws.

---

## 3. Thinking Process and Blunder Prevention [all levels]

### 3.1 Why this section comes first
Dan Heisman, the US National Master whose long-running *Novice Nook* column became *A Guide to Chess Improvement*, reports a striking pattern in amateur games: lower-rated players give away basic tactics many times per game.\[1\] In his ChessCafe Novice Nook model, an 800-rated player allows basic tactics about sixteen times per game, a 1200-rated player about four times, a 1600-rated player about once, and a 2000-rated player about once every four games. Magnus Carlsen is quoted in a Chess.com forum thread, as a Twitter answer, making a similar point: games between players rated under 1800 "are decided on pieces being blundered on almost every move", so the most useful training is simple "which pieces can you capture in this position?" exercises (another forum poster says the quote came from a troll topic, so treat the attribution as disputed). **For Nimzo, the implication is clear: most coaching value below 1800 is in safety.**

### 3.2 "Hope chess" vs "real chess" (Heisman's concepts, paraphrased)
- **Hope chess**: making a move without checking whether the opponent can answer with a check, capture or threat you can't meet, and *hoping* they won't find it.
- **Real chess**: for every candidate move, at least briefly checking the opponent's forcing replies before playing it.
- **Coach line**: "You don't need to calculate everything. You need to check the opponent's forcing replies to the move you're about to play."

### 3.3 The core blunder-check routine (CCT / CCA)
GothamChess (Levy Rozman) builds his intermediate tactics teaching around a **Checks–Captures–Attacks** checklist. Reviewers single out that chapter of *How to Win at Chess* as its strongest.\[2\]\[3\] The same idea appears in many traditions as **Checks, Captures, Threats (CCT)**.

**Before choosing your move (look for opportunities):**
1. List all your **checks**.
2. List all your **captures**.
3. List all your **threats** (moves that attack something or threaten mate).
Forcing moves come first because they restrict the opponent's replies, which makes them the easiest to calculate and the most likely to win something.

**Before releasing your move (safety check):**
4. Imagine the position *after* your move. What are the opponent's checks, captures and threats now?
5. Is every piece you have defended enough? Did your move remove a defender (e.g., moving a pawn that guarded a knight)?
6. Is your back rank safe? Are your king and queen on the same line as an enemy rook or bishop?
7. Only then move. Online, keep "premove" and fast mouse-clicking for clearly forced positions.

### 3.4 Full thought process for a normal move [1200+]
A synthesis of Heisman, Kotov, Silman and practical GM advice:
1. **What changed?** What does the opponent's last move attack, defend, open or prepare? (Naroditsky stresses in his speedrun series that you don't always have to *react*. If the "threat" isn't real, continue with your plan.)
2. **Tactical scan**: CCT for both sides.
3. **Evaluate**: material, king safety, piece activity, pawn structure, space, imbalances (Section 7.10).
4. **Plan**: what does the position want? Improve your worst piece, target a weakness, or prepare a pawn break.
5. **Candidate moves**: 2–4 moves that serve the plan or exploit tactics.
6. **Calculate** the forcing lines precisely and the quiet lines briefly; compare final positions.
7. **Safety check** on the chosen move (step 3.3.4–6).
8. **Manage the clock**: spend time on critical moments (big decisions, tension, transitions to endgames) and play quickly when moves are obvious.

### 3.5 The most common blunder types (and fixes)
| Blunder type | Typical example | Fix |
|---|---|---|
| Hanging a piece outright | Moving a knight to a square attacked by a pawn | Ask "what attacks this square?" before moving |
| Removing a defender | Pushing a pawn that was protecting a piece | Before moving any piece, ask "what was it guarding?" |
| Missing a fork | Knight forks of king + queen / two rooks | Look at every enemy knight's possible jumps |
| Back-rank mate | King on g1 behind f2/g2/h2 pawns with no escape | Make "luft" (h3/h6) in time; keep a rook or minor piece covering the back rank |
| Pinned-piece illusion | Counting a pinned piece as a defender | Remember that a piece pinned to the king defends nothing along other lines |
| Queen trapped / chased | Early queen sorties, e.g., Qxb7 grabbing pawns | Count the queen's escape squares before grabbing |
| Miscounting exchanges | Starting a capture sequence on a square defended more times than attacked | Count attackers vs defenders, and note the *value* of the pieces involved |
| Missing a zwischenzug | Assuming the recapture is forced | Before any trade, check whether the opponent has an in-between check or threat |
| Stalemating | Taking the last free square of a lone king | When the enemy has only a king, check for stalemate before every move |
| Desperation on a lost position | Resigning too early / playing on aimlessly | Set traps and practical problems; resign only when there is truly nothing left |

### 3.6 Counting exchanges (static exchange evaluation, the human version)
1. Count the attackers and defenders of the square.
2. Order captures from least valuable to most valuable for each side.
3. Stop the sequence wherever one side would lose material by continuing.
Heisman warns that "always capture with the least valuable piece" is a myth: sometimes capturing with a more valuable piece keeps a better structure or opens a line. Use it as a default, not a law.

### 3.7 Blunder prevention habits
- **Sit on your hands**: decide on the move, then do a final 3–10 second safety check (scaled to the time control).
- **Write down your move first** (over-the-board, where rules allow) before playing it, as a last check.
- **Don't move instantly after the opponent blunders.** The "free" piece may be bait. Check twice.
- **Be careful when winning.** Most turnarounds happen when the leading player relaxes. Keep the CCT routine going until the opponent resigns.
- **Train board vision**: Heisman stresses the power of board vision. Simple drills (find every capture on the board; name every square each enemy piece attacks) carry over directly to fewer blunders.

---

## 4. Tactics Encyclopedia [600-1200 core; deeper at 1200+]

**General principle**: tactics follow from weaknesses. Look for **loose pieces** (undefended: "LPDO", loose pieces drop off, a well-known saying popularised by John Nunn), an **exposed king**, **pieces lined up** on a file, rank or diagonal, and **overworked defenders**.

### 4.1 Double attack and the fork
- **Definition**: one move attacks two (or more) targets at once. A fork is a double attack by one piece.
- **Knight fork**: the most common. Classic targets are king + queen or king + rook, e.g., ...Nc2+ forking Ke1 and Ra1. The "family fork" hits king, queen and rook.
- **Pawn fork**: a pawn attacking two pieces diagonally (e.g., e4-e5 hitting knights on d6 and f6).
- **The fork trick** (opening): 1.e4 e5 2.Nf3 Nc6 3.Nc3 Nf6 4.Bc4 Nxe4! 5.Nxe4 d5 forks bishop and knight and regains the piece.
- **Queen double attacks**: a queen check that also hits a loose piece (e.g., Qa4+ picking up a bishop on b4 or a knight on e4 after checking).
- **Why it works**: the opponent can only answer one threat per move.
- **Detection habit**: for every enemy piece that is undefended, ask "which of my pieces could attack it *and* something else?"

### 4.2 Pin
- **Absolute pin**: the pinned piece cannot legally move because the king is behind it (e.g., Bb5 pinning Nc6 to Ke8).
- **Relative pin**: moving the pinned piece is legal but loses a more valuable piece behind it (e.g., Bg5 pinning Nf6 to Qd8).
- **Exploiting pins**: attack the pinned piece again, ideally with a pawn ("pile on the pin"); a pinned piece does not really defend. Nimzowitsch's *My System* (1925) states that a pinned piece's defensive power is only imaginary.
- **Breaking pins**: interpose a piece, move the piece behind, counter-attack the pinning piece (...h6/...g5 against a bishop on g5 — note that ...g5 loosens the king), or counter-pin.
- **Légal's idea**: sometimes a "pinned" knight can move because the resulting attack is worth more than the queen (see 5.13).

### 4.3 Skewer
- **Definition**: a "reverse pin". A valuable piece in front is attacked; when it moves, the piece behind is taken. Example: Rook check on the 8th rank against Ke8 with a rook on a8 behind, or Bb5+ skewering Ke8 and Rh... Common in endgames: a rook check skewering king and rook (see Vančura, 8.8.3).

### 4.4 Discovered attack, discovered check, double check
- **Discovered attack**: moving one piece unmasks an attack by another piece behind it. The moving piece can make its own threat, so two threats arrive at once.
- **Discovered check**: the unmasked attack is a check, so the moving piece can go almost anywhere (even capture a queen) because the opponent must deal with the check first.
- **Double check**: both the moving piece and the unmasked piece give check. **The only defence is a king move.** This is the engine of many mating patterns (e.g., the Réti–Tartakower finish and Légal-type attacks).
- **Opening example (Petrov trap)**: 1.e4 e5 2.Nf3 Nf6 3.Nxe5 Nxe4? 4.Qe2 Nf6?? 5.Nc6+ (discovered check by the queen on the e-file) wins Black's queen on d8.

### 4.5 Deflection
- **Definition**: force (lure away) a defending piece from its duty, usually by sacrifice or a threat it must answer.
- **Example**: Black's queen guards the back rank against Rd8#; White plays Qxe... (an offer on another square) the black queen cannot accept without allowing mate, so White wins material.
- **Coach line**: "Every defender has a job. Give it a second job it can't do at the same time."

### 4.6 Decoy (attraction)
- **Definition**: force an enemy piece, often the king, *onto* a bad square, usually with a sacrifice. Example: Rh8+! Kxh8 drags the king into the corner for a knight fork or a queen check. Philidor's legacy (5.2) uses a decoy (Qg8+!! Rxg8) to set up smothered mate.

### 4.7 Overloading
- **Definition**: one defender has two duties, so it fails at one. Closely related to deflection; the difference is mostly in how you describe it. Identify any enemy piece that is the *only* defender of two or more things.

### 4.8 Interference
- **Definition**: placing a piece on a line between an enemy piece and what it defends, cutting the connection. Example: Black's rook on d8 defends d1; White plays Bd5 or Nd5 between them.

### 4.9 Zwischenzug (in-between move, intermezzo)
- **Definition**: instead of the "expected" move (usually a recapture), playing a forcing move first: a check, capture or threat that must be answered.
- **Why it matters**: amateur calculation assumes recaptures are automatic. Before entering any exchange, ask "does the opponent have something better than recapturing?"

### 4.10 X-ray
- **Definition**: a piece acts "through" another piece along a line. (1) Attack: a rook behind another rook adds force to the line. (2) Defence: a rook defends a square *through* an enemy piece that will soon be captured. Typical in queen and rook exchanges on files.

### 4.11 Removing the defender (undermining)
- **Definition**: capture or chase away the piece that guards a key square or piece. Example: Bxf6 (giving up the bishop for the f6 knight) so that the h7 pawn is no longer covered and Qxh7# follows.

### 4.12 Clearance
- **Definition**: moving a piece (often with tempo or as a sacrifice) to clear a line or square for another piece. Example: a pawn sacrifice e5-e6 that opens the b1–h7 diagonal for a bishop.

### 4.13 Desperado
- **Definition**: a piece that is doomed anyway (attacked and cannot be saved, or about to be captured in an exchange) captures as much as possible before being taken. Always ask "if my piece is lost anyway, what can it take on the way out?" — and, defensively, "what can his doomed piece take?"

### 4.14 Trapped pieces
- Pieces with no safe squares can be won. Classic cases: bishop on a7/h7 trapped by ...b6 (or b3) after "grabbing" a pawn; queen on b7/b2 after a pawn grab; knight on the rim (a/h files) with no exits. Tarrasch's well-known proverb "a knight on the rim is dim" carries the same warning.
- **Noah's Ark trap** (Ruy Lopez): 1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 4.Ba4 d6 5.d4 b5 6.Bb3 Nxd4 7.Nxd4 exd4 8.Qxd4?? c5 9.Qd5 Be6 10.Qc6+ Bd7 11.Qd5 c4 traps the bishop on b3.

### 4.15 Windmill (see-saw)
- **Definition**: repeated discovered checks, with the moving piece capturing material each time. The famous example is Torre vs Lasker, Moscow 1925, where a rook on the 7th rank alternated discovered checks with a bishop to collect material.

### 4.16 Perpetual check and stalemate tricks (defensive tactics)
- **Perpetual check**: if you can't win, a checking sequence the opponent can't escape draws by repetition. Always look for it when you are worse and the enemy king is exposed.
- **Stalemate tricks**: when behind, sacrifice your remaining mobile pieces so that your king has no legal moves ("desperado rook" offering itself with check).

### 4.17 Pawn tactics
- **Breakthrough**: White pawns a5, b5, c5 vs Black a7, b7, c7, White to move: 1.b6! axb6 (1...cxb6 2.a6!) 2.c6! bxc6 3.a6 and the a-pawn queens.
- **Promotion tactics**: deflecting the blocker, underpromotion to a knight with check, or "pawn on the 7th + rook check" combinations.
- **Pawn forks** and **pawn traps** (e.g., g4-g5 trapping a knight on h6/f6 squares).

### 4.18 Attraction to the king and mating-net themes
These are covered in Section 5. Tactically, look for: a king with no luft, pieces aimed at the squares around the king, and defenders that can be removed or deflected.

### 4.19 Combining motifs
Real tactics are usually two motifs joined: e.g., deflection + back-rank mate, decoy + fork, pin + piling up. Training should move from single-motif puzzles (labelled themes) to mixed, unlabelled puzzles (Section 11).

### 4.20 Tactics training methods
- **Themed puzzles** to learn each motif (Lichess "Puzzle themes", Chess.com lessons).
- **Mixed puzzles** for recognition under realistic conditions (Puzzle Storm/Rush for speed; standard rated puzzles for accuracy).
- **The Woodpecker Method** (Axel Smith and Hans Tikkanen, Quality Chess, 2018): solve a fixed set of puzzles, then solve the *same* set again and again in shorter cycles, so patterns move from calculation to instant recognition. The book has 1,128 exercises in three difficulty tiers (222 easy, 762 intermediate, 144 advanced). Tikkanen writes that after training this way in spring 2010 he achieved three GM norms and passed the 2500 barrier, all within a seven-week period that summer, and Smith used it while climbing as an adult from about 2100 to grandmaster. Practitioners stress that the method sharpens patterns you already half know; it does not teach new motifs from scratch.
- **Steps Method** workbooks (Brunia and van Wijgerden): a six-step Dutch curriculum heavy on tactics, developed in 1987 and adopted by the Royal Dutch Chess Federation. The official Chess-Steps curriculum links each step to a rating ceiling: Step 1 up to 800, Step 2 up to 1400, Step 3 up to 1600, Step 4 up to 1750, Step 5 up to 1900, Step 6 up to 2100. The ratings are said to be over-the-board. Some users suggest adding about 200 for online equivalents; treat that as a rough guide.\[4\]
- **Accuracy over speed** in early training: solve fully (including the opponent's best defence) before moving; speed comes later.

---

## 5. Checkmate Patterns Encyclopedia [600-1200 core; all by 1600]

**Why learn named patterns**: recognising the *final* picture tells you which sacrifices to look for. Most "brilliant" combinations are known mating patterns reached by force.

### 5.1 Back-rank mate [100-600]
- **Picture**: king on its back rank, blocked by its own pawns (f7/g7/h7); a rook or queen checks along the back rank.
- **FEN**: `6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1` — 1.Rd8#.
- **Prevention**: make luft (h3/h6 or g3/g6) at a calm moment; keep a rook or minor piece covering the back rank.
- **Tactical use**: combine with deflection of the back-rank defender.

### 5.2 Smothered mate and Philidor's legacy [600-1200]
- **Picture**: a knight mates a king completely surrounded by its own pieces (typically Kh8 with Rg8, pawns g7/h7).
- **Philidor's legacy sequence**: 1.Qc4+ (or a queen on the a2–g8 diagonal) Kh8 2.Nf7+ Kg8 3.Nh6++ (double check) Kh8 4.Qg8+!! Rxg8 5.Nf7#.
- **Opening example (Caro-Kann)**: 1.e4 c6 2.d4 d5 3.Nc3 dxe4 4.Nxe4 Nd7 5.Qe2 Ngf6?? 6.Nd6#.

### 5.3 Anastasia's mate [1200-1600]
- **Picture**: knight on e7 (covering g6 and g8), black king on h7 with a pawn on g7; rook or queen checks on the h-file (e.g., Rh5# or Qxh7+ followed by Rh...). Often reached by a queen sacrifice on h7 to open the h-file.

### 5.4 Arabian mate [600-1200]
- **Picture**: rook on h7 protected by a knight on f6, king on h8. The knight covers g8 and protects the rook. One of the oldest recorded mates.
- **FEN**: `7k/7R/5N2/8/8/8/8/6K1 b - - 0 1` (Black is mated).

### 5.5 Boden's mate [1200-1600]
- **Picture**: two bishops on crossing diagonals mate a king castled long (or stuck on c8/c1) whose escape squares (b8, d7, etc.) are blocked by its own pieces. Classic finish: a queen sacrifice on c6/c3 to open the diagonal, then Ba6# with the other bishop covering the escape diagonal. Named after Samuel Boden (Schulder vs Boden, 1853).

### 5.6 Greco's mate [1200-1600]
- **Picture**: bishop on c4 (covering g8) and a rook or queen giving check on the h-file against a king on h8 with a pawn on g7. Often prepared by a sacrifice that opens the h-file.

### 5.7 Lolli's mate [1200-1600]
- **Picture**: a pawn on f6 supports the queen mating on g7 against a castled king (Qg7#). The f6 pawn is the key: "a pawn on f6 (f3) in front of a castled king is a mating threat."

### 5.8 Damiano's mate [1200-1600]
- **Picture**: queen mates on h7 supported by a pawn on g6 (or a bishop on the b1–h7 diagonal: "Damiano's bishop mate"), often after a rook sacrifice on h8 to open the h-file. Published by Pedro Damiano in 1512, one of the oldest named mates.

### 5.9 Opera mate [600-1200]
- **Picture**: rook mates on the back rank (Rd8#) supported by a bishop (Bg5 covering d8), king on e8 with blocked escape squares.
- **Source game (Morphy vs Duke Karl of Brunswick & Count Isouard, Paris 1858, the "Opera Game")**: 1.e4 e5 2.Nf3 d6 3.d4 Bg4 4.dxe5 Bxf3 5.Qxf3 dxe5 6.Bc4 Nf6 7.Qb3 Qe7 8.Nc3 c6 9.Bg5 b5 10.Nxb5 cxb5 11.Bxb5+ Nbd7 12.O-O-O Rd8 13.Rxd7 Rxd7 14.Rd1 Qe6 15.Bxd7+ Nxd7 16.Qb8+!! Nxb8 17.Rd8#.
- **Lesson to relay**: development lead, open lines against an uncastled king, pins, and sacrificing material to keep the initiative. It is the single best teaching game for [600-1200].

### 5.10 Epaulette mate [1200-1600]
- **Picture**: king on the back rank flanked by its own rooks (Rd8, Ke8, Rf8); queen checks from e6 (with e7 empty), covering d7 and f7. The king's own "epaulettes" (shoulder pieces) block its escape.

### 5.11 Dovetail (Cozio's) mate and Swallow's tail [1200-1600]
- **Dovetail**: queen gives check diagonally adjacent to the king, protected; the king's two squares behind-and-beside are blocked by its own pieces, making a "dove's tail" shape.
- **Swallow's tail (Guéridon)**: queen checks directly in front of the king, protected (e.g., Qe7# vs Ke8? No — commonly the queen on e7 protected, king e8 with pieces on d8/f8 blocking). The king's two diagonal-rear squares are occupied by its own pieces.

### 5.12 Other named mates to recognise [1600-2000]
- **Hook mate**: rook + knight + pawn interlock near the king.
- **Morphy's mate**: bishop checks along the long diagonal against a cornered king while a rook covers the file.
- **Pillsbury's mate**: rook on the g-file + bishop on the long diagonal against a king on h8.
- **Mayet's mate**: rook mates on the back rank or edge supported by a bishop on the long diagonal.
- **Blackburne's mate**: two bishops + knight against a castled king.
- **Réti's mate**: a famous double-check bishop mate (Réti vs Tartakower, Vienna 1910).
- **Max Lange's mate**: queen + bishop mating patterns against the corner.
- **Corridor mate**: back-rank mate generalised to any "corridor" the king cannot leave.
- **Kill box**: rook + queen forming a 3×3 box around the king.

### 5.13 Légal's mate (Légal trap) [600-1200]
- **Moves**: 1.e4 e5 2.Bc4 d6 3.Nf3 Bg4 4.Nc3 g6? 5.Nxe5! Bxd1?? 6.Bxf7+ Ke7 7.Nd5#.
- **Pattern**: an apparently pinned knight moves, offering the queen; the minor pieces mate.
- **Practical note**: if Black declines with 5...dxe5 6.Qxg4, White has simply won a pawn with a fine position.

### 5.14 Scholar's mate and Fool's mate [100-600]
- **Fool's mate (fastest possible)**: 1.f3 e5 2.g4?? Qh4#. Lesson: don't weaken the e1–h4 / e8–h5 diagonal.
- **Scholar's mate**: 1.e4 e5 2.Bc4 Nc6 3.Qh5 Nf6?? 4.Qxf7#.
- **How to defend**: 3...g6 (or 2...Nf6 earlier); then 4.Qf3 Nf6 and Black develops with tempo by kicking the queen (e.g., ...Nd4 ideas). Lesson for beginners: early queen attacks only work against careless defence; learn to punish them by developing with tempo.

### 5.15 The Greek Gift sacrifice (Bxh7+) [1200-1600]
- **Pattern**: White sacrifices a bishop on h7 against a king castled short: Bxh7+ Kxh7, Ng5+, then Qh5 (or Qd3/Qc2), threatening mate on h7.
- **Classic prerequisites** (checklist):
  1. Bishop able to reach h7 (usually from d3, b1–h7 diagonal).
  2. Knight able to reach g5 safely (from f3), and Black can't easily capture it (no Be7/Qd8-covering g5, no ...f6 / ...Qxg5 resource).
  3. Queen able to reach the h-file quickly (Qh5) or the b1–h7 diagonal.
  4. **No black knight on f6** (it defends h7 and h5). A white pawn on e5 often drives it away.
  5. Black lacks quick defenders: no ...Bf5, ...Nf8 or ...Re8–f8 escape route.
  6. Ideally White can add a pawn (h4–h5) or rook lift (Re3–h3).
- **Black's main defences after Bxh7+ Kxh7 Ng5+**: ...Kg8 (then Qh5 threatens Qh7#; Black needs ...Re8/...Nf8 resources), ...Kg6 (the king walks forward; complex, often refuted by h4–h5+ or Qd3+), ...Kh6 (often met by Nxe6+ discovered attacks or Qd2/Qg4 ideas). Declining with ...Kh8 can also be dangerous (e.g., Ng5 followed by Qh5).
- **Rule**: the Greek Gift is a pattern, not a guarantee. Always calculate all three king moves. Typical openings that produce it: French (Advance and Tarrasch), Colle/London structures, some Sicilians.
- The motif goes back to Gioachino Greco's 17th-century manuscripts.

### 5.16 Other attacking sacrifices to know [1600-2000]
- **Double bishop sacrifice** (Lasker–Bauer, Amsterdam 1889): Bxh7+ followed by Bxg7 to strip the king completely, then a rook lift.
- **Nxf7 / Bxf7+ sacrifices** against the f7 point in open games.
- **Exchange sacrifices** (Rxf6, Rxc3 in the Sicilian) to wreck the enemy king's shelter or structure.
- **Rook lifts** (Re3–g3/h3) and the "h-pawn battering ram" (h4–h5–h6).

---

## 6. Opening Principles and Opening Encyclopedia

### 6.1 Opening principles [100-600 core]
1. **Fight for the centre** (e4, d4, e5, d5 and the squares they control). **Why**: pieces in the centre control more squares and can switch to either wing quickly. Capablanca's *Chess Fundamentals* has a whole section on "Control of the Centre."
2. **Develop knights and bishops quickly**, usually knights before bishops, toward the centre (Nf3/Nc3, Nf6/Nc6). **Why**: undeveloped pieces don't help in attack or defence.
3. **Castle early** (often by moves 7–10). **Why**: the king is safest behind pawns, and castling connects the rooks.
4. **Don't move the same piece twice without a reason** (tempo). **Why**: each wasted move is a free move for the opponent's development.
5. **Don't bring the queen out early.** **Why**: it can be chased by minor pieces, which develop with tempo.
6. **Don't grab pawns at the cost of development** unless you have calculated it is safe.
7. **Connect your rooks** and put them on open or half-open files.
8. **Make only the pawn moves you need**: usually the centre pawns and maybe one move to free a bishop. **Why**: every pawn move creates permanent weak squares.
9. **Hypermodern refinement** [1200+]: you can control the centre from a distance with pieces (fianchettoed bishops, knights) and attack the opponent's pawn centre later (Nimzowitsch, Réti). Capablanca argued that the Hypermodern Theory was only "the application… of the same old principles through the medium of somewhat new tactics."

**Exceptions**: gambits break rule 6 on purpose; some openings move a piece twice to gain a concrete advantage. Know the principle, then learn the specific justification.

### 6.2 Tempo, initiative and the cost of pawn grabs [1200-1600]
- A tempo is roughly worth a third of a pawn in open positions, a common rule of thumb in older literature. In open positions, a lead in development of three tempi often justifies a pawn sacrifice.
- **Initiative**: the ability to make threats that dictate the opponent's replies. Silman notes that development and initiative are *dynamic* advantages: use them quickly or they fade. Capablanca's chapter on "The Initiative" makes the same point.

### 6.3 How to study openings by rating
- [100-600]: principles only + traps (6.4). One first move as White (1.e4 recommended for open, tactical games) and one answer to 1.e4 and to 1.d4.
- [600-1200]: learn the first 5–8 moves of your openings *with the ideas*, plus the common traps on both sides.
- [1200-1600]: learn the typical pawn structures and plans that come out of your openings; review your games where the opening went wrong ("opening study from your own games", a core Heisman recommendation).
- [1600-2000]: build a repertoire file (Lichess Studies / Chessable / ChessBase) 10–15 moves deep in main lines, with model games for each structure.
- **Universal rule**: never memorise a line you don't understand. If you can't explain *why* a move is played, you won't know what to do when the opponent deviates.

### 6.4 Opening traps every player should know [600-1200]
| Trap | Moves | Lesson |
|---|---|---|
| Scholar's mate | 1.e4 e5 2.Bc4 Nc6 3.Qh5 Nf6?? 4.Qxf7# | Defend f7; punish early queens |
| Fool's mate | 1.f3 e5 2.g4?? Qh4# | Don't open your king's diagonal |
| Légal | 1.e4 e5 2.Bc4 d6 3.Nf3 Bg4 4.Nc3 g6? 5.Nxe5! Bxd1?? 6.Bxf7+ Ke7 7.Nd5# | Pins can be broken if mate follows |
| Blackburne Shilling | 1.e4 e5 2.Nf3 Nc6 3.Bc4 Nd4 4.Nxe5? Qg5! 5.Nxf7?? Qxg2 6.Rf1 Qxe4+ 7.Be2 Nf3# | Don't grab "free" pawns automatically; 4.Nxd4 or 4.O-O is fine |
| Fried Liver | 1.e4 e5 2.Nf3 Nc6 3.Bc4 Nf6 4.Ng5 d5 5.exd5 Nxd5? 6.Nxf7! Kxf7 7.Qf3+ Ke6 8.Nc3 | Black should play 5...Na5 (main line) |
| Petrov blunder | 1.e4 e5 2.Nf3 Nf6 3.Nxe5 Nxe4? 4.Qe2 Nf6?? 5.Nc6+ | Discovered check on the e-file; play 3...d6 first |
| Elephant trap (QGD) | 1.d4 d5 2.c4 e6 3.Nc3 Nf6 4.Bg5 Nbd7 5.cxd5 exd5 6.Nxd5?? Nxd5! 7.Bxd8 Bb4+ 8.Qd2 Bxd2+ 9.Kxd2 Kxd8 | The "pinned" Nf6 is not really pinned |
| Lasker trap (Albin) | 1.d4 d5 2.c4 e5 3.dxe5 d4 4.e3? Bb4+ 5.Bd2 dxe3! 6.Bxb4?? exf2+ 7.Ke2 fxg1=N+! | Underpromotion with check |
| Englund trap | 1.d4 e5 2.dxe5 Nc6 3.Nf3 Qe7 4.Bf4? Qb4+ 5.Bd2 Qxb2 6.Bc3? Bb4! 7.Qd2 Bxc3 8.Qxc3 Qc1# | Respect queen raids; 4.Qd5 or 4.Nc3 is safer |
| QGA pawn hold | 1.d4 d5 2.c4 dxc4 3.e3 b5? 4.a4 c6 5.axb5 cxb5 6.Qf3 | Holding the c4 pawn with ...b5 fails to the long diagonal |
| French Advance queen trap | 1.e4 e6 2.d4 d5 3.e5 c5 4.c3 Nc6 5.Nf3 Qb6 6.Bd3 cxd4 7.cxd4 Nxd4?? 8.Nxd4 Qxd4 9.Bb5+ | Discovered attack on the queen by Bb5+ and Qxd4 |
| Noah's Ark | (see 4.14) | Pawn chains can trap bishops |
| Stafford trap | 1.e4 e5 2.Nf3 Nf6 3.Nxe5 Nc6 4.Nxc6 dxc6 5.d3 Bc5 6.Bg5?? Nxe4! 7.Bxd8 Bxf2+ 8.Ke2 Bg4# | Against the Stafford, play 5.Nc3 or 5.d3 with care (e.g., 6.Be2); don't greedily pin |
| KGD trap | 1.e4 e5 2.f4 Bc5 3.fxe5?? Qh4+ 4.g3 Qxe4+ wins the h1 rook | Check what the opponent threatens before capturing |
| Fishing Pole (Ruy) | 1.e4 e5 2.Nf3 Nc6 3.Bb5 Nf6 4.O-O Ng4 5.h3 h5! 6.hxg4? hxg4 opens the h-file for ...Qh4 | Don't open lines against your own king |

### 6.5 Opening encyclopedia: 1.e4 e5 (Open Games)

#### 6.5.1 Italian Game (Giuoco Piano) [100-2000]
- **Moves**: 1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5.
- **Main branches**:
  - **Giuoco Pianissimo** (modern main line): 4.c3 Nf6 5.d3 d6 (or ...a6, ...O-O) 6.O-O O-O 7.Re1 a5/a6 8.Bb3 / Nbd2–f1–g3. Slow manoeuvring: White plays d3–d4 at the right moment, Nbd2–f1–g3, a4 against ...b5; Black plays ...a5, ...Ba7, ...Be6, ...h6.
  - **Classical centre**: 4.c3 Nf6 5.d4 exd4 6.cxd4 Bb4+ 7.Bd2 (solid; 7...Bxd2+ 8.Nbxd2 d5!) or 7.Nc3 Nxe4 8.O-O (Møller Attack, sharp).
  - **Evans Gambit**: 4.b4 Bxb4 5.c3 Ba5 6.d4: White gives a pawn for a fast centre and development (a Morphy-era favourite).
  - **Two Knights Defence**: 3...Nf6. After 4.Ng5 d5 5.exd5, the main line is 5...Na5 (6.Bb5+ c6 7.dxc6 bxc6 and Black has development for a pawn). 5...Nxd5? allows the Fried Liver (6.Nxf7) or 6.d4 (Lolli). 4...Bc5 is the Traxler/Wilkes-Barre counterattack (very sharp). 4.d3 is the quiet modern choice; 4.d4 leads to the Scotch Gambit / Max Lange.
- **Key ideas**: pressure on f7; the c3–d4 centre; the Ng5 jump when ...h6 hasn't been played; the a2/b3 bishop retreat to avoid ...Na5 trades.
- **Common mistakes**: Black: ...Nxe4 grabbing without calculation; early ...Bg4 pins allowing h3/g4 or Légal-type tricks. White: Ng5 attacks without support; forgetting ...d5 central counter-strikes.
- **Plans**: White: d4 break, kingside play with Nf1–g3–f5. Black: ...d5 break, queenside expansion, or ...Ng6 / ...f5 ideas in slow lines.

#### 6.5.2 Ruy Lopez (Spanish) [1200-2000]
- **Moves**: 1.e4 e5 2.Nf3 Nc6 3.Bb5.
- **Morphy Defence, Closed main line**: 3...a6 4.Ba4 Nf6 5.O-O Be7 6.Re1 b5 7.Bb3 d6 8.c3 O-O 9.h3, then 9...Na5 (Chigorin), 9...Nb8 (Breyer), 9...Bb7 (Zaitsev).
- **Marshall Attack**: 7...O-O 8.c3 d5!? Black gives a pawn for a long-term kingside attack. Anti-Marshall: 8.a4 or 8.h3.
- **Berlin Defence**: 3...Nf6 4.O-O Nxe4 5.d4 Nd6 6.Bxc6 dxc6 7.dxe5 Nf5 8.Qxd8+ Kxd8 — the "Berlin endgame". Black has the bishop pair and a solid structure; White has a kingside pawn majority and is better developed.
- **Exchange Variation**: 4.Bxc6 dxc6 5.O-O. White aims for an endgame where the healthy 4 vs 3 kingside majority can make a passed pawn; Black has the bishop pair.
- **Key ideas**: pressure on e5 indirectly via the c6 knight; the d4 break; the Nbd2–f1–g3 manoeuvre; the Spanish bishop on b3/c2 aiming at the kingside; Black's queenside expansion and ...c5/...d5 breaks.
- **Common mistakes**: White: playing 4.Bxc6 then 5.Nxe5? (5...Qd4! regains the pawn with a good game); forgetting the Noah's Ark trap. Black: grabbing e4 when the e-file opens against the uncastled king.

#### 6.5.3 Scotch Game [600-2000]
- **Moves**: 1.e4 e5 2.Nf3 Nc6 3.d4 exd4 4.Nxd4.
- **Main lines**: 4...Nf6 5.Nxc6 bxc6 6.e5 Qe7 7.Qe2 Nd5 8.c4 (Mieses: dynamic, unbalanced structure) or 4...Bc5 5.Be3 / 5.Nxc6 Qf6 6.Qd2 (or 6.Qf3).
- **Scotch Gambit**: 4.Bc4 (gives a pawn for development; can transpose to the Two Knights / Max Lange).
- **Key ideas**: immediate central clarity; White gets space and quick development; Black aims for ...d5 to free the game.
- **Good choice at [600-1600]**: fewer long theoretical lines than the Ruy, and positions are clear.

#### 6.5.4 Petrov (Russian) Defence [1200-2000]
- **Moves**: 1.e4 e5 2.Nf3 Nf6 3.Nxe5 d6! 4.Nf3 Nxe4 5.d4 d5 6.Bd3 (Classical), or 5.Nc3 Nxc3 6.dxc3 (castle long, attack).
- **Key idea**: symmetry and solidity; Black aims to neutralise. **Trap**: 3...Nxe4? 4.Qe2 (see 6.4).

#### 6.5.5 Vienna Game [600-1600]
- **Moves**: 1.e4 e5 2.Nc3.
- **Lines**: 2...Nf6 3.f4 d5! 4.fxe5 Nxe4 (Vienna Gambit); 3.Bc4 Nxe4!? 4.Qh5 Nd6 5.Bb3 Nc6 6.Nb5 g6 7.Qf3 f5 8.Qd5 Qe7 9.Nxc7+ Kd8 10.Nxa8 b6 (the "Frankenstein–Dracula" variation: wild and theory-heavy). 2...Nc6 3.Bc4 Bc5? 4.Qg4 (hitting g7, the "Copycat" problem) shows the danger of symmetrical play.
- **Key ideas**: delay Nf3 so the f-pawn can advance (f4); flexible, with attacking chances.

#### 6.5.6 King's Gambit [600-1600 for fun, risky above]
- **Moves**: 1.e4 e5 2.f4.
- **Accepted**: 2...exf4 3.Nf3 g5 (4.h4 g4 5.Ne5 Kieseritzky; 4.Bc4 g4 5.O-O Muzio Gambit), 3...d6, or 3...Nf6 (modern). **Declined**: 2...Bc5 (trap after 3.fxe5?? Qh4+), 2...d5 (Falkbeer).
- **Key ideas**: open the f-file, rapid development, an attack on f7. **Risk**: White's own king is loosened (e1–h4 diagonal).

#### 6.5.7 Other 1.e4 e5 lines to know about
- **Philidor Defence** (2...d6): solid but passive; watch for Légal-type tricks. **Bishop's Opening** (2.Bc4), **Centre Game** (2.d4 exd4 3.Qxd4), **Ponziani** (3.c3), **Four Knights** (2.Nf3 Nc6 3.Nc3 Nf6; 4.Bb5 Spanish Four Knights; 4.d4 Scotch Four Knights; 4...Nd4 Rubinstein).

### 6.6 1.e4 — Semi-Open Defences

#### 6.6.1 Sicilian Defence (1.e4 c5) [1200-2000]
**General character**: asymmetrical; Black trades a wing pawn (c-pawn) for White's centre pawn (d-pawn), getting the half-open c-file and a central pawn majority. White gets space and attacking chances. Opposite-side castling races are typical.

**Open Sicilian branches (after 2.Nf3 and 3.d4 cxd4 4.Nxd4):**
| Variation | ECO | Main moves | Key idea |
|---|---|---|---|
| Najdorf | B90–B99 | 2...d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 a6 | Flexible ...a6 (controls b5, prepares ...e5 or ...e6 and ...b5) |
| Najdorf 6.Bg5 | B94–B99 | 6.Bg5 e6 7.f4 (7...Qb6 Poisoned Pawn: 8.Qd2 Qxb2 9.Rb1 Qa3; 7...Be7 8.Qf3 Qc7 9.O-O-O Nbd7) | White prepares e5/f5 breaks |
| Najdorf English Attack | (under B90) | 6.Be3 e5 or e6, then f3, Qd2, g4, O-O-O | Kingside pawn storm vs Black's queenside play |
| Najdorf 6.Be2 | B92 | 6.Be2 e5 7.Nb3 Be7 8.O-O O-O | Positional fight over d5 |
| Dragon (Yugoslav Attack) | B75–B79 | 5...g6 6.Be3 Bg7 7.f3 O-O 8.Qd2 Nc6 9.O-O-O (or 9.Bc4) | Race: White's h4–h5 and Bh6 vs Black's c-file play, ...Rxc3 exchange sacrifices, the g7 bishop |
| Sveshnikov | B33 | 2...Nc6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 e5 6.Ndb5 d6 7.Bg5 a6 8.Na3 b5 (9.Bxf6 gxf6 10.Nd5 f5, or 9.Nd5) | Black accepts a d5 hole and a backward d-pawn for activity and the bishop pair |
| Taimanov | B44–B49 | 2...e6 3.d4 cxd4 4.Nxd4 Nc6 5.Nc3 Qc7 6.Be3 a6 7.Qd2 / 7.Qf3 | Flexible ...Nc6/...Qc7 without an early ...d6 |
| Scheveningen | B80–B85 | 2...d6 ... 5.Nc3 e6 (6.g4 Keres Attack; 6.Be2 a6 7.O-O Qc7 8.f4 Nc6 Classical) | "Small centre" d6/e6; often reached via the Najdorf |
| Accelerated Dragon / Maroczy | B36–B39 | 2...Nc6 3.d4 cxd4 4.Nxd4 g6 5.c4 (5...Bg7 6.Be3 Nf6 7.Nc3 Ng4 Breyer; or 5...Nf6 6.Nc3 Nxd4 7.Qxd4 d6 Gurgenidze) | White's c4/e4 bind restrains ...d5 and ...b5 |
| Kan | B41–B43 | 2...e6 3.d4 cxd4 4.Nxd4 a6 (5.Bd3 or 5.Nc3; 5.c4 Maroczy-style) | Flexible ...a6, ...Qc7, ...Nf6, ...b5 |
| Classical / Richter–Rauzer | B56–B69 | 2...d6 ... 5.Nc3 Nc6 6.Bg5 | Black develops naturally; White pins and castles long |

**Anti-Sicilians (good choices below 1800):**
- **Alapin (2.c3)**, B22: 2...Nf6 3.e5 Nd5 4.d4 cxd4 5.Nf3 (or 5.cxd4), or 2...d5 3.exd5 Qxd5 4.d4 Nf6 5.Nf3. Idea: build a full d4/e4 centre; avoids huge theory. It can transpose to the French Advance.
- **Rossolimo (2.Nf3 Nc6 3.Bb5)**, B30–B31: Bxc6 damages Black's pawns; avoids Open Sicilian theory.
- **Smith–Morra Gambit (2.d4 cxd4 3.c3 dxc3 4.Nxc3)**, usually given as B21 (some ECO references list B20): typical play is 4...Nc6 5.Nf3 d6 6.Bc4 e6 7.O-O. White gives a pawn for rapid development and the open c- and d-files. Dangerous at club level; objectively Black is fine with accurate play.
- **Closed Sicilian (2.Nc3 + g3, Bg2, d3, f4)** and **Grand Prix Attack (2.Nc3 + f4, Bc4/Bb5)**: kingside attacking setups.

**Common mistakes in the Sicilian**:
- Black: delaying development to play ...a6/...b5 too early while the king sits in the centre (watch for Nd5 and Bxb5 sacrifices); misjudging opposite-side castling races (count tempi!).
- White: retreating passively instead of attacking; allowing ...d5 freeing breaks for free; forgetting the Rxc3 exchange sacrifice in the Dragon.

**Structure note**: after ...e5 (Najdorf, Sveshnikov, Boleslavsky), the d5 square becomes a hole for White to occupy; Black compensates with activity and ...d5 or ...f5 breaks.

#### 6.6.2 French Defence (1.e4 e6 2.d4 d5) [600-2000]
- **Character**: solid, counter-attacking; the problem piece is Black's light-squared bishop (blocked by e6). Black's breaks: ...c5 (hits d4, the *base* of White's chain), ...f6 (hits e5).
- **Advance (3.e5)**, C02: 3...c5 4.c3 Nc6 5.Nf3 Qb6. Black piles on d4; White defends the base and may play Bd3, O-O with the queen-trap trick in 6.4.
- **Winawer (3.Nc3 Bb4)**, C15–C19: 4.e5 c5 5.a3 Bxc3+ 6.bxc3 Ne7 7.Qg4 (Poisoned Pawn: 7...Qc7 8.Qxg7 Rg8). Black accepts kingside weaknesses to damage White's pawns.
- **Tarrasch (3.Nd2)**, C03–C09: 3...Nf6 4.e5 Nfd7 5.Bd3 c5 6.c3 Nc6 7.Ne2 cxd4 8.cxd4 (C06), or 3...c5 4.exd5 exd5 (IQP positions; C08–C09). The knight on d2 avoids the ...Bb4 pin and keeps c3 available.
- **Classical (3.Nc3 Nf6)**: 4.Bg5 (Burn/MacCutcheon) or 4.e5 Nfd7 5.f4 (Steinitz).
- **Exchange (3.exd5 exd5)**: symmetrical, quiet; Black's light bishop is freed.
- **Plans**: Black: ...c5, ...Nc6, ...Qb6, ...f6; trade the bad bishop via ...b6/...Ba6 or ...Bd7–e8–h5. White: kingside attack (Greek Gift, f4–f5), space advantage.
- **Common mistakes**: Black: passive play without ...c5; letting the c8 bishop stay buried forever. White: overextending the e5/d4 chain without support.

#### 6.6.3 Caro-Kann Defence (1.e4 c6) [600-2000]
- **Character**: solid like the French, but the light bishop gets out *before* ...e6.
- **Advance (2.d4 d5 3.e5 Bf5)**, B12: 4.Nf3 e6 5.Be2 (Short system), or 4.Nc3 / 4.h4 (sharp: White hunts the bishop). Black plays ...c5, ...Nd7, ...Ne7 and later ...c5.
- **Classical (3.Nc3 dxe4 4.Nxe4 Bf5)**, B18–B19: 5.Ng3 Bg6 6.h4 h6 7.Nf3 Nd7 8.h5 Bh7 9.Bd3 Bxd3 10.Qxd3, often with opposite castling. Solid development; h4–h5 is White's lever.
- **Exchange (3.exd5 cxd5 4.Bd3)** and **Panov–Botvinnik (4.c4)**: the Panov leads to IQP positions (Section 7.1).
- **Two Knights (2.Nc3 d5 3.Nf3)**: flexible sideline.
- **Trap**: 4...Nd7 5.Qe2 Ngf6?? 6.Nd6# (5.2).
- **Good for**: [600-1600] players who want solid positions with clear plans.

#### 6.6.4 Scandinavian (Centre Counter) Defence (1.e4 d5) [100-1600]
- **Main line**: 2.exd5 Qxd5 3.Nc3 Qa5 4.d4 Nf6 5.Nf3 c6 6.Bc4 Bf5 7.Bd2 e6. Alternatives: 3...Qd6 (modern), 3...Qd8 (very solid).
- **Modern**: 2...Nf6 (3.d4 Nxd5; or 3.c4 c6 gambits).
- **Ideas**: an easy-to-learn structure similar to the Caro-Kann; the queen is exposed early but finds a safe square on a5/d6/d8.
- **Common mistakes**: Black: putting the queen on squares where Nb5/Bd2 tricks hit it (e.g., ...Qa5 with ...c6 not yet played and Nb5 ideas against c7). White: chasing the queen without developing.

#### 6.6.5 Pirc and Modern Defences (1.e4 d6 / 1.e4 g6) [1200-2000]
- **Pirc**: 1.e4 d6 2.d4 Nf6 3.Nc3 g6. **Austrian Attack**: 4.f4 Bg7 5.Nf3 O-O (or 5...c5), B09. White's big centre pushes for e5; Black counters with ...c5 or ...e5. **150 Attack**: 4.Be3 + Qd2, Bh6, h4–h5 (aggressive and simple).
- **Modern**: 1...g6 2.d4 Bg7 3.Nc3 d6: Black delays ...Nf6; similar ideas.
- **Hypermodern logic**: let White build the centre, then attack it. **Risk**: if Black is slow, White's centre and kingside attack crush.

#### 6.6.6 Alekhine's Defence (1.e4 Nf6) [1200-2000]
- Black invites e5 and attacks the advanced pawns: 2.e5 Nd5 3.d4 d6 4.Nf3 (Modern) or 4.c4 Nb6 5.f4 (Four Pawns Attack). Hypermodern provocation.

### 6.7 1.d4 Openings

#### 6.7.1 Queen's Gambit Declined (1.d4 d5 2.c4 e6) [600-2000]
- **Orthodox**, D60–D69: 3.Nc3 Nf6 4.Bg5 Be7 5.e3 O-O 6.Nf3 Nbd7 7.Rc1 c6 8.Bd3 dxc4 9.Bxc4 Nd5 (Capablanca's freeing manoeuvre) 10.Bxe7 Qxe7 11.O-O Nxc3 12.Rxc3 e5.
- **Tartakower**: 7...b6 (after ...h6 Bh4), solid fianchetto. **Lasker Defence**: ...h6, ...Ne4 trading pieces.
- **Exchange (Carlsbad structure)**, D35–D36: 3.Nc3 Nf6 4.cxd5 exd5 5.Bg5 c6 6.Qc2. White's plan: **minority attack** (b4–b5 vs Black's a7/b7/c6) or central e4 (after f3). Black's plan: kingside piece play (...Ne4, ...Nf8–g6, ...Qd6), sometimes ...c5.
- **5.Bf4** lines: a modern alternative.
- **Key ideas**: Black's main problem is the c8 bishop and freeing breaks (...c5 or ...e5). White uses space and the c-file.
- **Trap**: the Elephant trap (6.4).

#### 6.7.2 Queen's Gambit Accepted (1.d4 d5 2.c4 dxc4) [1200-2000]
- **Main line**: 3.Nf3 Nf6 4.e3 e6 5.Bxc4 c5 6.O-O a6. Often an IQP structure arises after ...cxd4 exd4.
- **3.e4** (central): White grabs the centre immediately; Black hits back with ...e5 or ...Nf6/...c5.
- **Key ideas**: Black gives up the centre temporarily for free development; don't try to keep the pawn with ...b5 (trap in 6.4).

#### 6.7.3 Slav Defence (1.d4 d5 2.c4 c6) [1200-2000]
- **Main line**, D15–D19: 3.Nf3 Nf6 4.Nc3 dxc4 5.a4 Bf5 6.e3 e6 7.Bxc4 Bb4 8.O-O O-O 9.Qe2. Alternative: 6.Ne5 (Krause).
- **Exchange Slav** (3.cxd5 cxd5): symmetrical, drawish but tricky.
- **Key idea**: support d5 with c6 so that the light-squared bishop can develop to f5/g4 *before* ...e6.

#### 6.7.4 Semi-Slav (…e6 + …c6) and Meran [1600-2000]
- **Meran**, D46–D49: 1.d4 d5 2.c4 c6 3.Nc3 Nf6 4.Nf3 e6 5.e3 Nbd7 6.Bd3 dxc4 7.Bxc4 b5 8.Bd3 Bb7 (modern main move; older 8...a6 9.e4 c5 10.e5 cxd4 11.Nxb5). Black expands with ...b5 and breaks with ...c5.
- **Anti-Meran / Botvinnik (5.Bg5 dxc4 6.e4 b5)**: extremely sharp; for advanced players only.

#### 6.7.5 London System (1.d4 + Bf4 + e3 + c3 + Nf3 + Nbd2 + Bd3) [600-1800]
- **Typical setup**: 1.d4 d5 2.Bf4 (or 2.Nf3 Nf6 3.Bf4) e6 4.e3 c5 5.c3 Nc6 6.Nbd2 Bd6 7.Bg3.
- **White's plans**: Ne5 + f4 (Stonewall-like attack), Qf3/h4–h5 against the kingside, Bd3 aiming at h7 (Greek Gift ideas), e3–e4 central break.
- **Black's best tries**: ...c5 with ...Qb6 hitting b2 (White often answers Qb3 or Qc2/Qc1); ...Bd6 to trade the f4 bishop; a King's Indian setup with ...g6, ...d6, ...e5.
- **Jobava London** (1.d4 d5 2.Nc3 Nf6 3.Bf4): more aggressive cousin.
- **Why popular at club level**: the same setup against almost everything; low theory. **Drawback**: it can be passive; players who only know the setup and not the plans stagnate around 1500–1700.
- **Common mistakes**: White: allowing ...Qb6 with b2 hanging; playing Ne5 without support so it gets traded off for nothing; not having a plan after development. Black: letting White's Bd3/Ne5/Qf3 build an automatic attack while Black castles into it.

#### 6.7.6 King's Indian Defence (1.d4 Nf6 2.c4 g6 3.Nc3 Bg7 4.e4 d6) [1600-2000]
- **Classical / Mar del Plata**, E97–E99: 5.Nf3 O-O 6.Be2 e5 7.O-O Nc6 8.d5 Ne7 9.Ne1 Nd7 10.f3 f5. White plays queenside (c5, b4, Nd3, Nb5); Black attacks with ...f5–f4, ...g5–g4, ...Rf6–h6. This is a pure *race*.
- **Sämisch (5.f3)**, **Four Pawns (5.f4)**, **Fianchetto (g3)**, **Averbakh (5.Be2 + Bg5)**.
- **Key ideas**: pawn-chain theory (Nimzowitsch): attack the chain at its base: White with c5 vs d6, Black with ...f5 vs e4. Black's g7 bishop often looks "bad" but defends the king and comes alive after ...f4 or ...c6/...exd4.
- **Common mistakes**: Black: passive play without ...f5; White: castling short and ignoring Black's kingside storm.

#### 6.7.7 Nimzo-Indian Defence (1.d4 Nf6 2.c4 e6 3.Nc3 Bb4) [1600-2000]
- **4.Qc2 (Classical)**, E32–E39: avoids doubled c-pawns; main lines 4...O-O 5.a3 Bxc3+ 6.Qxc3, or 4...d5 5.cxd5 exd5, or 4...c5.
- **4.e3 (Rubinstein)**, E40–E59: 4...O-O 5.Bd3 d5 6.Nf3 c5 7.O-O (then 7...dxc4 8.Bxc4 or 7...Nc6 8.a3 Bxc3 9.bxc3).
- **Key ideas**: Black controls e4 with the pin and the knight, often giving up the bishop for the knight to double White's pawns. White gets the bishop pair and the centre. The fight: bishops vs structure.
- **Pair with**: the Queen's Indian (3.Nf3 b6) or Bogo-Indian (3.Nf3 Bb4+) against 3.Nf3.

#### 6.7.8 Grünfeld Defence (1.d4 Nf6 2.c4 g6 3.Nc3 d5) [1600-2000]
- **Exchange**, D85–D89: 4.cxd5 Nxd5 5.e4 Nxc3 6.bxc3 Bg7, then 7.Nf3 (modern main line) or 7.Bc4 O-O 8.Ne2 c5 9.O-O Nc6 10.Be3 cxd4 11.cxd4 Bg4 12.f3 Na5 13.Bd3.
- **Russian System (5.Qb3)**, **4.Bf4**, **4.Nf3 + Bg5**.
- **Key ideas**: Black lets White build a big centre, then attacks it with ...c5, ...Nc6, ...Bg4 and the long-diagonal bishop. White aims for d5 or a kingside attack, or a passed d-pawn.
- **Theory-heavy**: recommended only for [1800+] players who enjoy concrete play.

#### 6.7.9 Dutch Defence (1.d4 f5) [1200-2000]
- **Leningrad**, A86–A89: 2.c4 Nf6 3.g3 g6 4.Bg2 Bg7 5.Nf3 O-O 6.O-O d6 7.Nc3 (7...c6 or 7...Nc6). The g7 bishop plus ...e5 or ...Qe8–h5 kingside ideas.
- **Stonewall**, A90–A95: 2.c4 Nf6 3.g3 e6 4.Bg2 Be7 (modern: ...Bd6) 5.Nf3 O-O 6.O-O d5 7.Nc3 c6 (A95), or 7.b3 c6 8.Ba3. Pawns on f5–e6–d5–c6 grip e4; the weakness is the e5 hole and the bad c8 bishop.
- **Anti-Dutch tries**: 2.Bg5, 2.Nc3, the Staunton Gambit 2.e4.
- **Danger**: the e8–h5 diagonal is weakened; watch for early Qh5+ ideas after ...g6 or ...g5 lunges.

#### 6.7.10 Other d4 systems (awareness level)
- **Catalan** (d4, c4, g3, Bg2): long-diagonal pressure; elite favourite.
- **Benoni** (1.d4 Nf6 2.c4 c5 3.d5 e6) and **Benko Gambit** (3...b5): dynamic, imbalanced.
- **Budapest Gambit** (1.d4 Nf6 2.c4 e5): tricky surprise weapon.
- **Trompowsky** (1.d4 Nf6 2.Bg5), **Colle System** (d4, e3, Bd3, c3, Nbd2, e4 break), **Torre Attack** (Nf3 + Bg5).

### 6.8 Flank Openings

#### 6.8.1 English Opening (1.c4) [1200-2000]
- **1...e5 (Reversed Sicilian)**: 2.Nc3 Nf6 3.Nf3 Nc6 4.g3 (White plays a Sicilian with an extra tempo).
- **1...c5 (Symmetrical)**: g3, Bg2, Nc3, Nf3 setups; manoeuvring.
- **1...Nf6 / 1...e6**: may transpose to d4 openings.
- **Botvinnik System**: c4, Nc3, g3, Bg2, e4, Nge2: a grip on d5.
- **Key ideas**: control d5 from the flank; the long-diagonal bishop on g2; queenside expansion with b4–b5.

#### 6.8.2 Réti (1.Nf3 d5 2.c4) and King's Indian Attack (Nf3, g3, Bg2, O-O, d3, Nbd2, e4)
- Hypermodern pressure on the centre from the flanks; the KIA is a "system" like the London, popular as an all-purpose weapon.

#### 6.8.3 Bird (1.f4), Larsen (1.b3), others
- Playable surprise options; learn the main ideas if you choose them, but they aren't recommended as a first repertoire.

### 6.9 Repertoire recommendations by rating band

| Band | As White | Black vs 1.e4 | Black vs 1.d4 | Why |
|---|---|---|---|---|
| [100-600] | 1.e4 + Italian (3.Bc4, 4.c3/d3) by principles | 1...e5 (develop, defend f7) | 1...d5 + ...Nf6, ...e6 (QGD setup) | Learn to develop, castle and avoid early traps; no memorisation |
| [600-1200] | Italian or Scotch; or the London if you prefer one system | 1...e5 (know the Fried Liver defence 5...Na5, and the Légal and Blackburne traps) or the Caro-Kann | QGD (know the Elephant trap) or Slav | Clear plans and natural development; the traps are where games are decided |
| [1200-1600] | Italian/Ruy (or Scotch) + an anti-Sicilian (Alapin or Rossolimo) and a plan vs French/Caro | Caro-Kann or French, or 1...e5 deeper | QGD/Slav, or Nimzo + Queen's Indian | Start learning structures (IQP, Carlsbad, French chains) |
| [1600-2000] | Open Sicilian (main lines), Ruy Lopez, or 1.d4 with QGD/Catalan main lines | Sicilian (Najdorf/Taimanov/Sveshnikov/Classical) or solid main-line Caro/French/e5 | Nimzo/QID, KID, Grünfeld, or Semi-Slav | Your opening should match your style; build model-game knowledge |

**General advice**: GothamChess's teaching (summarised from reviews of *How to Win at Chess*) stresses understanding *why* the first moves matter (centre, development, king safety) over memorising long lines, and recommends playing what you understand. Carlsen has argued that playing different kinds of positions broadens understanding. Our reconciliation: keep a **stable core repertoire** for competition below 1800, and **experiment in casual blitz** to broaden your understanding.

---

## 7. Middlegame Strategy [1200-2000 core; some ideas from 600]

### 7.1 Isolated Queen's Pawn (IQP) [1200-1600]
- **Definition**: a pawn on d4 (or d5) with no friendly pawns on the c- and e-files.
- **Arises from**: QGA, Tarrasch (French and QGD), Panov Caro-Kann, Nimzo 4.e3 lines, Alapin Sicilian.
- **For the IQP side (dynamic)**: keep pieces on (more pieces = more attacking potential); use outposts on e5 and c5; a battery Bd3/Bc2 + Qd3 aiming at h7; rook lift Re3/Rd3–h3; **the d4–d5 break** to open lines; kingside attack.
- **Against the IQP (static)**: **blockade** on the square in front of it (d5 for White's d4 pawn: a knight is the ideal blockader, as Nimzowitsch taught); trade pieces, especially attacking minor pieces; pressure the pawn with rooks on the d-file; head for an endgame where the pawn is a pure weakness.
- **Coach line**: "With the IQP, attack before the endgame. Against it, trade down and blockade."

### 7.2 Hanging pawns (c4 + d4 side by side, no b/e pawns) [1600-2000]
- **Dynamic strength**: they control many central squares; either can advance to open lines (d5 or c5 breaks).
- **Weakness**: once forced to advance or fix (one pushed, one left behind), they become targets; a pawn left behind may become backward or isolated.
- **Plans for the opponent**: pressure with pieces (...Rc8, ...Rd8, ...Qd6) to force one to advance, then blockade; ...b5 or ...e5 breaks to dissolve them.

### 7.3 Carlsbad structure [1200-2000]
- **Pawns**: White a2, b2, d4, e3, f2, g2, h2 (c-pawn gone); Black a7, b7, c6, d5, f7, g7, h7 (e-pawn gone). Typical of the QGD Exchange.
- **White plans**: (1) **minority attack**: b4–b5 to create a weak c6 pawn or an isolated d5 pawn; (2) central e3–e4 after f3 (Botvinnik's plan); (3) kingside attack after castling long.
- **Black plans**: kingside piece play (...Ne4, ...Nf8–g6, ...Qf6/...Qh4), ...a5 to slow b4, ...b5 to fix pawns (creates a hole on c5 but blocks the minority attack), ...c5 to dissolve.

### 7.4 Maroczy Bind [1600-2000]
- **Pawns**: White c4 + e4 (vs Sicilian-type ...d6/...g6). White restrains ...d5 and ...b5.
- **White plan**: squeeze; control d5 with Nc3 and pieces; queenside play (b4, c5 at the right moment); avoid trading pieces that help Black's breaks.
- **Black plan**: piece play; trade pieces (more space → fewer pieces = less advantage); ...a5/...Nc5 setups; the breaks ...b5 and ...f5, and ...d5 if prepared.
- **Principle**: **the side with less space should trade pieces; the side with more space should avoid trades** (a Silman-era maxim).

### 7.5 French and King's Indian pawn chains [1200-2000]
- **Nimzowitsch's chain principle**: attack a pawn chain at its **base**. For White's d4–e5 chain, d4 is the base: Black hits it with ...c5. Later Black may hit e5 with ...f6.
- **Closed centre → play on the wings**; each side attacks where its chain "points" (KID: White's chain d5/e4 points toward the queenside → White plays c4–c5; Black's chain d6/e5 points toward the kingside → ...f5).

### 7.6 Other structures
- **Stonewall** (d4/e3/f4 or ...d5/e6/f5): strong grip on e5/e4; weakness on e4/e5 and a bad bishop.
- **Hedgehog** (Black pawns a6, b6, d6, e6; White c4/e4): Black waits for ...b5 or ...d5 breaks; very elastic.
- **Benoni** (White d5/e4 vs Black d6/c5): Black's queenside majority and the e5 square vs White's central majority and e4–e5 break.
- **Boleslavsky hole / Sicilian ...e5 structures**: d5 hole vs Black's activity.
- **Doubled pawns**: weak when isolated and fixed; strong when they control key squares or open files (e.g., after ...Bxc3 bxc3 White gets the b-file and central control).
- **Backward pawn**: cannot be supported by an adjacent pawn; the square in front of it is a hole (classic: Black's d6 in the Sveshnikov, White's c3 in some Ruy lines; Capablanca discusses "the weakness of a backward Q B P" in a Ruy Lopez).
- **Passed pawns**: "must be pushed" when supported (a common maxim); for the opponent, **blockade** with a piece, ideally a knight (Nimzowitsch: "First restrain, next blockade, lastly destroy," a dictum from *My System*).
- **Pawn majorities**: a healthy queenside majority (e.g., 3 vs 2) creates an outside passed pawn in the endgame. This is one reason the Exchange Ruy and some Sicilian structures matter in the long run.

### 7.7 Squares: outposts, holes, weak squares, colour complexes [1200-1600]
- **Outpost**: a square in or near the enemy camp, protected by your pawn, that can't be attacked by enemy pawns. Knights love outposts (a knight on d5/e5/d6 can dominate).
- **Hole**: a square that can never again be defended by a pawn, created by pawn advances. Capablanca devotes a section to "The Influence of a 'Hole'."
- **Colour complexes**: if your pawns are on dark squares and your dark-squared bishop is gone, your light squares are weak (or vice versa); the opponent's bishop and queen invade on those squares.
- **Principle**: every pawn move creates weaknesses (squares it no longer guards). Prefer pawn moves that achieve something concrete.

### 7.8 Files, ranks and rooks [600-1600]
- **Open file** (no pawns): put rooks there; contest or double them. Nimzowitsch treated the open file as one of the "elements".
- **Half-open file**: pressure the enemy pawn on it (the c-file in the Sicilian, the b-file after bxc3).
- **The 7th rank** ("pigs on the seventh" when doubled): rooks attack pawns from the side and trap the king on the back rank.
- **Tarrasch's rule**: rooks belong **behind passed pawns** (yours or the opponent's).
- **Rook lifts** to the 3rd rank for kingside attacks.

### 7.9 Minor pieces: good and bad bishops, bishop vs knight, the bishop pair [1200-1600]
- **Bad bishop**: blocked by its own pawns fixed on its colour (the French c8 bishop). **Good bishop**: its pawns are on the opposite colour.
- **Knights** prefer closed positions and outposts; **bishops** prefer open positions and play on both wings.
- **Bishop pair**: IM Larry Kaufman's study of more than 300,000 games ("The Evaluation of Material Imbalances", *Chess Life*, 1999) puts its average value at half a pawn: less when most or all pawns are on the board, more once half or more of the pawns are gone. Open the position to use it; the opponent should keep it closed or trade one bishop.
- **Trade your bad pieces; keep your good ones.** Before every trade, ask "which piece is better, mine or his?"
- **Capablanca** discusses "The Relative Value of Knight and Bishop" in *Chess Fundamentals*. His general conclusion is that the bishop is usually the more valuable piece, especially in endgames with pawns on both wings.
- **Opposite-coloured bishops**: in the middlegame they favour the **attacker** (each side's bishop can't be opposed); in the endgame they are notoriously **drawish**.

### 7.10 Silman's imbalances (summary of *How to Reassess Your Chess*, original wording)
Jeremy Silman argues that every position contains **imbalances** (significant differences between the two sides) and that good plans make your favourable imbalances count. The fourth edition lists:
1. **Superior minor piece** (bishop vs knight; good vs bad pieces).
2. **Pawn structure** (weak pawns, passed pawns, majorities).
3. **Space** (territory controlled behind your pawn chain).
4. **Material**.
5. **Control of a key file**.
6. **Control of holes / weak squares**.
7. **Lead in development**.
8. **Initiative** (pushing your own agenda).
9. **King safety**.
10. **Statics vs dynamics** (long-term vs short-term factors).

**Silman's thinking technique, paraphrased**: identify the imbalances for both sides → decide where to play (wing or centre) → imagine a "fantasy position" where your pieces are ideally placed → find moves that move toward it → only then calculate candidate moves. **Important caveat** (raised by many readers, and our practical stance): always do a tactical scan *first*. Imbalance thinking applies when there are no immediate tactics.

**Practical imbalance rules**:
- Ahead in material → trade pieces (not pawns); behind → avoid trades and seek complications.
- More space → avoid trades; less space → trade pieces.
- Lead in development / initiative → open the position quickly before the advantage disappears.
- Bishop pair → open the position; knights → keep it closed and find outposts.

### 7.11 Steinitz's principles (public domain era, 1880s–1890s)
Wilhelm Steinitz (first official World Champion, 1886) founded positional chess:
- **Accumulation of small advantages**: in his own words, aim for steady development without any sacrifice of material, attention to the balance of forces on the whole board, and "the accumulation of small advantages if possible."
- **Equilibrium**: in an equal position, a correct attack is impossible; you must manoeuvre and gather advantages first.
- **The right to attack**: when you have a meaningful advantage, you are *obliged* to attack, or the advantage will slip away.
- **Defence**: a position without weaknesses can't be successfully attacked; defend accurately and economically.
- **The side to attack**: the position, not taste, decides whether to attack the king or the queenside.
- **Temporary vs permanent advantages**: convert temporary ones (development, initiative) into permanent ones (structure, material) before they fade.

### 7.12 Prophylaxis and Nimzowitsch's system [1600-2000]
- **Prophylaxis**: anticipate and prevent the opponent's plan before pursuing your own. **Habit**: after every opponent move ask "what does he want to do next if it were his move again?"
- **Overprotection**: defend key strong points (e.g., e5 in the French Advance) more than you need, so the defending pieces are naturally well placed.
- **Blockade**: stop passed or advanced pawns with a piece in front, ideally a knight.
- **Restrain, blockade, destroy**: the sequence for handling enemy pawn masses.
- **Status**: *My System* came out in German in five instalments from 1925 to 1927; the first English translation (Philip Hereford, G. Bell) appeared in 1929. Under US law the 1925 original and probably the 1929 translation are now in the public domain (published works enter the US public domain 95 years after publication). Modern translations (Sherwood, Adams, the "21st Century Edition") are copyrighted, so only ideas are summarised here.

### 7.13 Piece activity and improving your worst piece [1200-1600]
- **Principle**: when there's nothing tactical to do, find your **worst-placed piece** and improve it. This habit is central to Carlsen's positional style, as summarised by many commentators: improve the worst piece, limit the opponent's counterplay, and press small edges patiently.
- **Naroditsky's "kinetic vs potential energy"** (from his speedrun lessons, paraphrased): a piece may look inactive now but have big potential once the position opens; judge pieces by both their current and future scope.
- **Naroditsky's defensive economy**: let the *least valuable* piece do a defensive task (a pawn defending a knight is more stable than the queen doing it, because the queen can be chased away).

### 7.14 Planning [1200-2000]
- **Plans come from the pawn structure.** Ask: which breaks are available (e.g., c4–c5, f4–f5, ...d5)? Where is the enemy weakness? Where do my pawns point?
- **Two weaknesses principle**: one weakness can usually be defended; create a *second* on the other wing, then switch between them until the defence breaks.
- **"Don't hurry"** (endgame and manoeuvring principle): when the opponent has no counterplay, improve everything before committing.
- **Capablanca's "Danger of a Safe Position"**: complacency in a seemingly safe position loses games; keep checking the opponent's resources.

### 7.15 Attacking the king [1200-2000]
- **Prerequisites**: (1) more attackers than defenders near the king, (2) open lines or pawn levers to open them, (3) the opponent lacking central counterplay. Naroditsky's rule of thumb, paraphrased: before attacking, check whether the opponent has enough pieces ready to counter-attack *your* king.
- **Castled on the same side**: attack with pieces; pawn storms weaken your own king.
- **Opposite-side castling**: pawn storms (your pawns don't shelter your king), and *speed* matters more than material. Count tempi.
- **Typical tools**: pawn levers (h4–h5, g4–g5, f4–f5), sacrifices on h7/g7/f7/e6, rook lifts, removing the f6 knight (Bxf6 / Ne4xf6), opening the long diagonal.
- **Central rule**: a flank attack is best met by a counter-blow in the centre (an old principle, stated by Nimzowitsch and others). Before launching a wing attack, make sure the centre is closed or under your control.
- **Capablanca's chapters**: "Attacking without the aid of Knights", "Attacking with Knights as a Prominent Force", and "Direct Attacks en masse".

### 7.16 Defence [1200-2000]
- **Principles**: (1) trade attacking pieces; (2) bring defenders toward the king; (3) counter-attack in the centre; (4) don't push pawns in front of your king unless forced (each push creates hooks); (5) return material to break the initiative; (6) use the "best defence is a good offence" only when calculated.
- **Lasker** was famous for resourceful, practical defence; Steinitz taught that a well-defended position should hold.
- **Psychology of defence**: stay calm, look for the opponent's best attacking idea, and remember that many amateur attacks are unsound. Make the attacker prove it.

### 7.17 When to trade [all levels]
- **Trade when**: you're ahead in material; you're cramped (less space); you trade your bad piece for his good piece; you remove a key attacker or defender; you reach a winning endgame.
- **Avoid trades when**: you're behind in material; you have more space; you're attacking; the trade improves his structure or develops his pieces.
- **Pawn trades vs piece trades**: when ahead, **trade pieces, not pawns** (fewer pawns = more drawing chances for the defender; e.g., rook endings with all pawns on one side are often drawn).

---

## 8. Endgame Theory [600-2000; core list per band in Section 11]

**Why endgames early?** Capablanca's *Chess Fundamentals* deliberately starts with endings, then middlegames, then openings. The book teaches backwards from the ending on the principle that a player who can't win a won position should not yet be studying openings. Endgames teach the true power of each piece and the value of a single pawn.

### 8.1 General endgame principles [600-1200]
1. **Activate your king**: it's a strong piece once queens are off.
2. **Passed pawns must be pushed** (when safely supported); **outside passed pawns** decoy the enemy king.
3. **Rooks behind passed pawns** (Tarrasch).
4. **Trade pieces, not pawns, when ahead.**
5. **Two weaknesses**: stretch the defence across both wings.
6. **Don't hurry**: improve every piece before the decisive break.
7. **Think in schemes, not long variations** (Kotov's advice for endgames): know the target setup.
8. **Capablanca's pawn ending rules** (quoted from *Chess Fundamentals*): when there are pawns on both sides, "act immediately on the side where you have the superior forces"; follow the rule of "advancing the Pawn that has no Pawn opposing it."

### 8.2 King and pawn vs king [600-1200]
- **Capablanca's principle**: "the King should be in front of his Pawn, with at least one intervening square." Method: "advance the King as far as is compatible with the safety of the Pawn and never to advance the Pawn until it is essential to its own safety."
- **Opposition**: kings facing each other on a line with one square between; the side *not* to move "has the opposition". In K+P vs K, the defender draws by keeping the opposition in front of the pawn; the attacker wins by gaining it.
- **Key squares**: if the attacking king reaches any key square, the pawn promotes regardless of who moves.
  - Pawn on its 2nd–4th rank (e.g., e2/e3/e4): the key squares are the three squares **two ranks in front** of the pawn (for e4: d6, e6, f6).
  - Pawn on the 5th or 6th rank (e.g., e5): the three squares one rank in front, and those two ranks in front (for e5: d6, e6, f6 and d7, e7, f7).
  - **Rook pawn** (a/h): usually drawn if the defending king reaches the corner; key squares for an a-pawn are b7 and b8 (g7/g8 for an h-pawn).
- **Draw rule for the defender**: if the defending king gets in front of the pawn with the opposition, it's a draw (except with the attacking king already on a key square).
- **Stalemate trap**: with a pawn on the 7th and the defending king in front, pushing at the wrong moment gives stalemate.

### 8.3 Rule of the square [600-1200]
- Draw a square from the pawn to its promotion square (side length = squares to promote). If the defending king can step inside the square **on its move**, it catches the pawn. Remember: a pawn on its starting rank can move two squares, so count from the 3rd rank.

### 8.4 Triangulation and corresponding squares [1600-2000]
- **Triangulation**: the attacking king uses three squares in a triangle to "lose a move", while the defending king has only two available squares to shuttle between. This hands the move (and the zugzwang) to the opponent.
- **Corresponding squares**: a generalisation of opposition; for each attacking king square there is a defending square that holds. Use it in complex pawn endings.
- **Zugzwang**: any move worsens your position. It's common in pawn endings; spotting it is a key 1600+ skill.

### 8.5 Pawn endgame techniques [1200-1600]
- **Outside passed pawn**: decoy the enemy king to one side, then the king raids the other side (Capablanca's Example 10 shows exactly this).
- **Protected passed pawn**: very strong; the enemy king must always stay near it.
- **Breakthrough**: see 4.17.
- **Shouldering**: use your king to block the enemy king from approaching.
- **Distant opposition** and **counting tempi**: in races, count moves exactly; often the side that queens first *with check* wins.
- **Reserve tempi**: spare pawn moves that win zugzwang battles.
- **Rule**: pawn endings are the most concrete endings. Before trading into one, calculate it precisely.

### 8.6 Queen vs pawn [1200-1600]
- **Queen vs pawn on the 7th**: against a centre or knight pawn, the queen wins: check, force the king in front of its pawn, bring your king one step closer, repeat.
- **Bishop or rook pawn on the 7th**: usually a **draw** because of stalemate tricks (the defending king goes into the corner, and taking the pawn or blocking would stalemate), *unless* the attacking king is already close enough to help mate.

### 8.7 Rook endgames: the most important category [1200-2000]
Rook endings are the most common endings in practice. Learn these positions first.

#### 8.7.1 General rook endgame principles
- **Activity above all**: an active rook is often worth a pawn. Passive defence usually loses.
- **Rook behind passed pawns** (yours or the enemy's).
- **Cut off the enemy king** by a rank or file.
- **King to the pawn**: centralise and support.
- **"All rook endings are drawn"**: a famous half-joke (often attributed to Tartakower) that reflects how often the defender saves them. The defender should never give up early.
- **Rook + 4 vs 3 on the same side** is usually a draw with correct defence; **3 vs 2** and **2 vs 1** on the same side are also often drawn.

#### 8.7.2 Lucena position (winning) [1200-1600]
- **Setup**: the attacking king is in front of its pawn on the 7th rank, the defending king is cut off by at least one file, and the attacker's rook controls the cut-off file.
- **Technique, "building a bridge"** (the name is attributed to Nimzowitsch): bring the rook to the **4th rank**, walk the king out, and use the rook to block checks.
- **Example FEN**: `1K6/1P1k4/8/8/8/8/r7/2R5 w - - 0 1` (White: Kb8, Pb7, Rc1; Black: Kd7, Ra2).
  - 1.Rd1+ Ke7 2.Rd4! Ra1 3.Kc7 Rc1+ 4.Kb6 Rb1+ 5.Kc6 Rc1+ 6.Kb5 Rb1+ 7.Rb4 and the pawn promotes.
- **Why the 4th rank**: the king walks down to the 5th rank, so the rook on the 4th can interpose against the last check.

#### 8.7.3 Philidor position (drawing) [1200-1600]
- **Setup** (Philidor, 1777): the defending king is in front of the pawn, the pawn has not reached the defender's 3rd rank, and the defender's rook is on its **3rd rank** (the "third-rank defence").
- **Technique**: keep the rook on the 3rd rank (e.g., Black's rook on the 6th rank) to stop the enemy king advancing. **The moment the pawn advances to that rank, swing the rook to the back rank and check from behind**; the king has no shelter.
- **Common mistake**: passive defence on the back rank, which loses (the attacker reaches a Lucena-type win).
- **Variant**: against a less advanced pawn, the defending rook can use the 4th rank.

#### 8.7.4 Vančura position (rook pawn defence) [1600-2000]
- **Setup**: attacker has rook in front of an a-pawn on a6 (Ra8, Pa6), the defending king on g7 or h7, and the defending rook attacks the pawn **from the side** (e.g., Rf6).
- **Why it draws**: the attacking rook is tied to the pawn, the defending rook checks the king from behind or the side whenever it approaches, and the defending king stays near g7/h7 to avoid the Ra8 → Rh8+ skewer (or a7 + Rh8 tricks).
- **History**: named after Czech study composer Josef Vančura; his analysis was published posthumously in 1924.
- **Elite examples**: Nakamura drew a pawn-down rook ending against Radjabov with this setup, and Aronian saved a difficult ending against Carlsen with it after Carlsen's error 46.h6?? (both analysed by Karsten Müller on ChessBase).
- **Related key fact**: rook + rook pawn vs rook is often drawn even when the attacker gets "Lucena-like" setups.

#### 8.7.5 Other rook-ending must-knows
- **Short side / long side defence**: the defending king goes to the *short* side of the pawn; the rook goes to the *long* side to give checks from a distance (side checks need about three files of distance).
- **Rook vs pawns**: count whether the king can reach the pawn; a rook usually beats a single pawn if the king is close.
- **Rook + pawn vs rook with the king cut off** by a rank (a "perfect cut") is usually winning.

### 8.8 Minor-piece endings [1200-2000]
- **Bishop vs knight**: the bishop is better with pawns on both wings and in open positions; the knight is better with pawns on one wing or a blocked structure.
- **Same-coloured bishops**: the side with the better (active) bishop and pawns on the opposite colour usually presses.
- **Opposite-coloured bishops**: very drawish; even two extra pawns may not win if they can be blockaded on the bishop's colour.
- **Wrong rook pawn**: bishop + rook pawn whose promotion square is not the bishop's colour, vs a lone king in the corner, is a **draw**.
- **Knight endings**: like pawn endings (concrete); an outside passed pawn is decisive because knights struggle to stop distant pawns.
- **Good knight vs bad bishop**: classic winning setup for the knight side.

### 8.9 Material endings to know as facts [1600-2000]
- Queen vs rook: **win** (but technically hard; tablebases show a win within 31 moves from the worst positions; know the Philidor Q vs R position).
- Rook vs bishop: usually a **draw** (defend in the corner *not* of the bishop's colour).
- Rook vs knight: usually a **draw** if the knight stays close to its king.
- Two bishops vs knight: usually a win but long; bishop + knight vs king (see 2.8).
- Queen vs two rooks: often balanced; depends on king safety and coordination.
- Two minor pieces vs rook (with pawns): often favours the minors in the middlegame and is roughly equal in the endgame.

### 8.10 Fortresses [1600-2000]
- **Definition**: a defensive setup the stronger side can't break even with extra material (e.g., Q vs R+P on the 2nd/3rd rank with the king nearby; wrong-bishop rook pawn; blocked pawn chains with an opposite-coloured bishop).
- **Practical rule**: when much worse, ask "is there a structure where my pieces can't be broken through?" Engines may show a big advantage for a fortress that is actually a dead draw; coaches should explain this to students who see "+3" and despair.

### 8.11 Practical endgame technique [all levels]
- **Convert step by step**: (1) secure your king and your weaknesses, (2) activate, (3) create a passed pawn, (4) push it with support, (5) watch for stalemate and perpetual.
- **Avoid perpetual check** when ahead: shelter your king *before* pushing pawns.
- **Use the clock**: in practical play, simple safe moves beat complex "best" moves.
- **Silman's *Complete Endgame Course*** (summarised): its central idea is to learn endgames *by rating level*. Learn only what your level needs, in order, rather than everything at once. This document follows that approach in Section 11.
- **de la Villa's *100 Endgames You Must Know*** (summarised): a canonical list of theoretical positions (K+P, R+P vs R including Lucena/Philidor/Vančura, Q vs P, etc.) that every serious player should master by about 2000.

---

## 9. Calculation, Evaluation and Visualisation [1200-2000]

### 9.1 Candidate moves (Kotov) and the critique
- **Kotov's method** (*Think Like a Grandmaster*, 1971, translated by Bernard Cafferty): list candidate moves first; analyse each one *once* methodically, building an "analysis tree"; don't hop back and forth between lines.
- **Kotov syndrome**: after long, confused thinking a player suddenly makes an unanalysed move in time trouble, often a blunder. **Fix**: limit the depth, decide, and move.
- **Critique**: GM writers (Tisdall quoting Lein, "I don't think like a tree"; Nunn; Dvoretsky; Aagaard) note that strong players compare candidates, test ideas and backtrack, and that the hard part is *finding* the right candidates, not organising them. Our practical synthesis:
  1. Start with **forcing moves** (CCT) for both sides.
  2. Add **positional candidates** from your plan (imbalances).
  3. Look at the **opponent's best reply** to each candidate; amateurs often check only weak replies.
  4. **Compare final positions**, not move counts.
  5. Stop when one line is clearly best, or when time demands.

### 9.2 Calculation techniques
- **Forcing first**: checks → captures → threats; they shrink the tree.
- **"Comparison"** (Aagaard): when two lines look similar, find the difference that matters.
- **Elimination**: if all but one candidate fail, play the remaining one without full calculation.
- **Blunder-check the final position**: is there a counter-check, a back-rank issue, or a loose piece?
- **Prophylactic thinking**: "what does he want?" is also a calculation tool.
- **Quiet moves in combinations**: the hardest moves to see in calculation are non-forcing "quiet" moves; train them deliberately.

### 9.3 Visualisation training
- **Read games without a board**: start with short games (Opera Game, Légal), then longer ones.
- **Blindfold puzzles**: easy tactics solved without moving pieces (Lichess has a "blindfold" mode).
- **Square-colour and knight-route drills**: name the colour of a square instantly; find the shortest knight route between two squares.
- **Stoyko-style exercise**: take a complex position and write a full analysis before checking with an engine; compare your result with the engine's and correct it.
- **Calculate to the end before moving the pieces** when solving puzzles; "trial and error" on the board trains guessing, not calculation.

### 9.4 Evaluation
- **Material** first (1/3/3/5/9), then **king safety**, then **piece activity**, then **pawn structure**, then **space** (an order many coaches use; compare with Silman's imbalances).
- **Engine evaluations**: +1.0 is roughly a pawn's worth of advantage. A swing above +2 is usually decisive at club level; ±0.3 is "equal" for human purposes. A "+0.8 with best play" line that requires 15 exact moves may be worse *practically* than a simple +0.5. Coaches should translate these numbers (see 1.2).
- **Static vs dynamic**: a static plus (structure) lasts; a dynamic plus (development, initiative) must be used now.

### 9.5 Pattern recognition vs calculation
- Most strong-player "intuition" is stored patterns. Carlsen has said, as quoted by Chessable, that he usually does what his intuition tells him and spends most of his thinking time double-checking. The amateur takeaway: build patterns (tactics, endgames, model games) so intuition has something to draw on, *and* keep double-checking.

---

## 10. Psychology, Time Management and Practical Play [all levels]

### 10.1 Time controls
| Format | Typical control | What it trains | Advice |
|---|---|---|---|
| Bullet | 1+0, 2+1 | Speed, pre-moves, mouse | Not a training tool below ~1600. It builds bad habits (hope chess). Use sparingly |
| Blitz | 3+0, 3+2, 5+0 | Pattern recognition, opening familiarity | Good for testing openings; analyse the occasional game. Stick to known systems |
| Rapid | 10+0, 15+10 | Thinking process with some time | **Best main format for [100-1600] improvement** |
| Classical | 30+ min, 90+30 | Calculation, planning, real chess | Best for [1400+] serious improvement; play OTB if possible |

- **Universal advice**: to improve, mostly play time controls where you can actually do the blunder check. Many coaches and Heisman recommend slower games for improvement. Naroditsky's and Bartholomew's instructive series ("Speedrun", "Climbing the Rating Ladder") show strong players talking through their reasoning in rapid games; amateurs report that copying that verbal thought process improved their play.\[5\]
- **Increment**: always prefer games with increment when training; they reduce pure flag-races.

### 10.2 Time management
- **Opening**: play known moves quickly, but stop to think when the opponent deviates from your preparation.
- **Critical moments**: spend time when (a) tension is high, (b) the structure is about to change permanently, (c) a sacrifice is possible, (d) you're about to enter an endgame.
- **Budget**: in a 15+10 game, keep at least 5 minutes in reserve by move 30; in classical play, avoid having under 10 minutes for the last 10 moves before a time control.
- **Time trouble habit**: in your own time trouble, play safe, solid moves and keep pieces defended. In the opponent's time trouble, make the position complicated but don't rush yourself.

### 10.3 Tilt and emotional control
- **Tilt**: after a loss or a blunder, play quality drops and players go chasing rating. **Rules**: stop after two losses in a row in a session; never play "revenge" games immediately; take a short walk.
- **After a blunder in a game**: take a breath, re-evaluate from scratch ("what do I have now?") and set problems. Many games are saved because the opponent relaxes.
- **Confidence**: Carlsen has said (paraphrased from Chessable's collection of his quotes) that it is better to overestimate your prospects than underestimate them, and that a lack of self-belief leads to cowardly decisions at critical moments.\[6\] Play the board, not the rating.
- **Don't look at ratings**: Heisman notes it can help *not* to know the opponent's rating; fear and overconfidence both distort decisions.

### 10.4 Practical decision-making
- **Practical vs objective best**: choose moves that give the opponent the most chances to go wrong, especially in time trouble.
- **Don't resign too early** at club level; opponents miss wins. Resign when there is truly nothing left and the opponent is clearly competent.
- **Offer/accept draws** sensibly: consider tournament situation, clock and position.
- **Don't play for traps only**: traps should be a by-product of good moves.

### 10.5 Tournament and online habits
- **Over the board**: sleep well, eat light, hydrate; write the move before playing it (if allowed); keep a scoresheet tidy; use the opponent's time for general thinking (Kotov's advice: calculate concretely on your own time, think strategically on the opponent's).
- **Online**: turn off move confirmation only if you're careful; avoid premoving in non-forced positions; play in a quiet setting; use "zen mode" to hide ratings if they distract.
- **Post-game routine**: (1) annotate your thoughts *before* using the engine, (2) find the critical moments, (3) check with the engine, (4) write one lesson. This is the single highest-value habit, and Nimzo can automate step 3 and guide steps 1, 2 and 4.

---

## 11. Rating-Band Guides (100 to 2000)

### 11.1 [100-600] Absolute beginner
**What decides games**: hanging pieces, missing mates in one, stalemating, illegal or slow moves.
**Focus**:
1. Rules (especially check, castling, en passant, stalemate).
2. **Before every move: "Is my piece safe? What did he just attack?"**
3. Mates: K+Q, K+R, two rooks; mate-in-one puzzles.
4. Opening principles; defend against Scholar's mate.
5. Simple tactics: forks, pins, hanging pieces.
**Common mistakes**: early queen raids; moving pawns aimlessly; not capturing free pieces; stalemating with a huge advantage; not castling.
**Study plan (weekly, ~3–5 hours)**: 40% playing (rapid 10+5 or slower), 40% puzzles (mate-in-1/2, hanging pieces; Steps Method Step 1-level material), 20% basic mates and review of lost games ("where did I lose a piece?").
**Coach tone**: encouraging; one rule at a time. GothamChess's book is written for this audience (its first half targets 0–800).

### 11.2 [600-1200] Novice to club entry
**What decides games**: one-move and two-move tactics, back-rank mates, forks, unforced queen losses, poor king safety.
**Focus**:
1. **CCT blunder check every move.**
2. Tactics motifs: forks, pins, skewers, discovered attacks, removing the defender, back rank.
3. Checkmate patterns: back rank, smothered, Arabian, Opera, Légal, Anastasia, Damiano.
4. Openings: one system for White, one answer to e4 and d4, plus traps (6.4).
5. Endgames: K+P vs K (opposition, key squares), rule of the square, Q vs P basics.
**Common mistakes**: hope chess; moving fast in good positions; ignoring opponent threats; trading when behind; playing too much bullet.
**Study plan**: 35% playing (rapid 10+5 to 15+10), 35% tactics (themed, then mixed; consider Woodpecker-style repetition of an easy set), 15% endgames, 15% game review (Nimzo-assisted).
**Milestone tests**: solve mate-in-2s reliably; win K+P vs K with the opposition; play 20 games without hanging a piece to a one-move attack.
*GothamChess's book covers 0–800 in its first half and the next band in the second. The publisher describes that second half as 800–1300; some reviews say 800–1200.*

### 11.3 [1200-1600] Intermediate club player
**What decides games**: 2–4-move tactics, positional drift (no plan), mishandled endgames, time pressure.
**Focus**:
1. Calculation of forcing lines (3–5 ply); Woodpecker cycles on intermediate puzzles.
2. Middlegame planning: pawn structures (IQP, Carlsbad, French chains), outposts, good vs bad bishop, open files, improving the worst piece, when to trade.
3. Endgames: Lucena, Philidor, basic rook endings, outside passed pawn, Q vs P (rook/bishop pawn draw), wrong bishop.
4. Openings: understand the structures arising from your openings; study 3–5 model games per opening.
5. Thinking process: candidate moves + safety check; clock management.
**Common mistakes**: attacking without enough pieces; ignoring prophylaxis; refusing to defend; misjudging trades; memorising lines without plans; not converting won endgames.
**Study plan**: 30% playing (rapid 15+10 and some classical), 30% tactics/calculation, 20% endgames, 10% openings, 10% annotated master games ("Logical Chess: Move by Move" by Irving Chernev is a classic for this band: every move explained).
**Training methods**: annotate your own games first; play out typical endgames against an engine; play "thematic" training games from a chosen structure.

### 11.4 [1600-2000] Strong club player
**What decides games**: deeper tactics hidden in positional play, strategic understanding, endgame technique, opening preparation, practical nerves.
**Focus**:
1. Calculation depth and accuracy (quiet moves, opponent's best replies); visualisation drills.
2. Advanced strategy: prophylaxis, two weaknesses, colour complexes, the bishop pair, hanging pawns, Maroczy and Hedgehog structures, exchange sacrifices.
3. Endgames: Vančura, triangulation, corresponding squares, R vs B and R vs N defences, B+N mate, fortresses; de la Villa's list.
4. Openings: a coherent repertoire file 10–15 moves deep with understood plans.
5. Psychology: tournament routine, time trouble avoidance, handling higher-rated opponents.
**Common mistakes**: over-relying on the engine instead of thinking; strategic over-ambition; time trouble; ignoring endgame study; tilt.
**Study plan**: 30% classical games and analysis, 25% calculation (Yusupov series; Aagaard-style exercises; Steps 5–6), 20% endgames, 15% openings, 10% classics and annotated games (Capablanca, Nimzowitsch, Lasker, Réti, Karpov).
**Book track (summaries only)**: Silman *How to Reassess Your Chess*; Kotov *Think Like a Grandmaster*; Yusupov's nine-book series (Build Up / Boost / Evolution, three levels each, aimed at roughly 1500–2100 by some user reports);\[7\] Dvoretsky (advanced endgames and training); the Polgar brothers' tactics compendium (*Chess: 5334 Problems, Combinations and Games*) for volume solving; Naroditsky's *Mastering Positional Chess* (written as a teenager; praised for clear positional explanations).\[8\]

### 11.5 Cross-band training methods
- **Tactics puzzles**: themed → mixed → repetition (Woodpecker).
- **Game analysis**: self-annotate → engine check → extract one lesson → add to a personal "mistakes database".
- **Endgame study**: position-by-position mastery, played out against an engine.
- **Opening study**: from your own games; understand plans before moves.
- **Longer time controls**: real thinking needs time; rapid and classical over bullet.
- **Studying classics**: Carlsen has said, per Chessable's collection, that unlike many young colleagues he believes studying the classics makes sense.
- **Steps Method** for a structured curriculum (Section 4.20 rating table).
- **"80% practice, 20% study"**: one Chess.com coaching article argues amateurs should spend most of their time playing and analysing their own games rather than reading a hundred books.\[9\] Use it as a balance check, not a law.

---

## 12. Wisdom from Great Players and Classic Books (Attributed)

### 12.1 Public-domain classics (can be drawn on closely)
- **José Raúl Capablanca, *Chess Fundamentals* (1921; Project Gutenberg #33870)**:
  - Teaches endings first, then the middlegame, then openings.
  - "In chess the tactics may change but the strategic fundamental principles are always the same." (1934 preface)
  - K+Q mate in under ten moves; K+R under twenty; two bishops under thirty.
  - K+P: "the King should be in front of his Pawn, with at least one intervening square."
  - Pawn endings: "act immediately on the side where you have the superior forces."
  - Chapters on the initiative, the force of the threatened attack, cutting pieces off from the scene of action, and the influence of a hole. All are excellent source material for Nimzo's middlegame explanations.
  - Model games: Capablanca's wins over Marshall (QGD, 1909 match), Rubinstein (San Sebastián 1911), Lasker (St. Petersburg 1914), and others in Part II.
- **Emanuel Lasker, *Common Sense in Chess* (1896)** and ***Lasker's Manual of Chess*** (German 1925; strongly influenced by Steinitz's theories): principles of development, the combination, position play; Lasker criticised the hypermoderns for disregarding accepted positional principles.\[10\] Often attributed to him: "When you see a good move, look for a better one."
- **Wilhelm Steinitz**: accumulation of small advantages, equilibrium, the duty to attack when ahead, and solid defence (Section 7.11).
- **Aron Nimzowitsch, *My System* (1925–27)**: open files, the 7th rank, passed pawns and blockade, pins, pawn chains, prophylaxis, overprotection; "First restrain, next blockade, lastly destroy." (*Chess Praxis*, German 1929, applies the system; check copyright for English editions.)
- **Siegbert Tarrasch**: rooks behind passed pawns; the value of space and mobility; dogmatic but clear rules.
- **François-André Danican Philidor (*Analyse du jeu des Échecs*, 1749; the R+P vs R position is dated 1777)**: "pawns are the soul of chess" (a well-known paraphrase); the Philidor rook position.
- **Paul Morphy (1837–1884)**: model games of rapid development and open lines (the Opera Game, 5.9).
- **Richard Réti, *Modern Ideas in Chess* (1923)**: the history of chess ideas from Morphy through the hypermoderns.
- **James Mason, *Chess Strategy* (1913)** and **Edward Lasker, *Chess Strategy* (1915; on Project Gutenberg)**: classical strategic primers.
- **Howard Staunton, *The Chess-Player's Handbook* (1847)** and *The Blue Book of Chess* (on Gutenberg): historical opening knowledge.
- **Copyright note**: a work published in the US before 1931 is generally in the US public domain as of 2026 (works enter it 95 years after publication). Translations and later editions may carry their own copyrights, and other countries use life-plus-70-year terms. Check before reproducing text.

### 12.2 Modern players and teachers (ideas paraphrased)
- **Magnus Carlsen**: improve your worst piece, limit counterplay, press small edges; self-confidence matters; trust intuition but double-check; study the classics; amateur games are decided by blunders, so drill "what can be captured?" (that last remark's attribution is disputed).
- **Garry Kasparov**: credits Steinitz with dividing chess history into "pre-Steinitz" and "post-Steinitz" eras; preparation and dynamism.
- **Daniel Naroditsky** (speedrun lessons, as compiled by Listudy): use the least valuable piece for defensive tasks; you don't always have to react to the opponent's move; check whether the opponent has enough pieces to counter-attack before you attack; kinetic vs potential energy of pieces.
- **Levy Rozman (GothamChess)**: Checks–Captures–Attacks; principles over memorisation; practical, level-specific advice; psychology (tilt, time pressure, not resigning too early).\[11\] His *How to Win at Chess* (2023) has 500+ instructional diagrams; a follow-up, *How to Win at Chess, Next Level* (Ten Speed Press, described by the publisher as for midlevel players rated 1000–1600), is due out on 6 October 2026.
- **Dan Heisman**: hope chess vs real chess; "is it safe?"; board vision; candidate comparison; study openings from your own games.
- **Jeremy Silman**: imbalances; learn endgames by rating level.
- **Alexander Kotov**: candidate moves, the tree of analysis, the "Kotov syndrome"; think concretely on your own time, strategically on the opponent's.
- **John Bartholomew** ("Climbing the Rating Ladder"), **Hanging Pawns** (structure-focused opening videos), **Saint Louis Chess Club lectures**, **ChessNetwork**, **agadmator** (famous-game storytelling): recommended viewing to build understanding. Watch actively, pausing to predict moves.

---

## 13. Glossary

- **Adjust / j'adoube**: announcement before straightening a piece.
- **Backward pawn**: a pawn that can't be supported by adjacent pawns and sits on a half-open file.
- **Battery**: two pieces lined up on the same line (Q+B on a diagonal, R+R or Q+R on a file).
- **Blockade**: placing a piece directly in front of an enemy pawn to stop it.
- **Break (pawn break)**: a pawn advance that challenges the enemy structure (e.g., ...c5 in the French).
- **Candidate move**: a move worth considering seriously.
- **Centralisation**: placing pieces in the centre.
- **Combination**: a forcing sequence, often with a sacrifice, that achieves a goal.
- **Compensation**: non-material advantages for sacrificed material.
- **Connected rooks**: rooks defending each other on the back rank with nothing between.
- **Desperado**: a doomed piece that sells itself dearly.
- **Development**: bringing pieces into play from their starting squares.
- **Doubled pawns**: two pawns of the same colour on one file.
- **ECO**: the *Encyclopaedia of Chess Openings* classification (A00–E99).
- **Exchange (the)**: rook vs minor piece; "winning the exchange".
- **Fianchetto**: developing a bishop on b2/g2 (b7/g7) after a knight-pawn move.
- **Fortress**: an unbreakable defensive setup.
- **Gambit**: an opening pawn (or piece) sacrifice for development or initiative.
- **Hole**: a square that can no longer be defended by a pawn.
- **Hypermodern**: the school (Nimzowitsch, Réti) that controls the centre from a distance.
- **Initiative**: the ability to make threats that dictate play.
- **IQP**: isolated queen's pawn.
- **Key squares**: squares that guarantee promotion if the attacking king reaches them.
- **Luft**: an escape square for the king ("air"), e.g., h3.
- **Minority attack**: advancing fewer pawns against a pawn majority to create weaknesses (Carlsbad b4–b5).
- **Opposition**: kings facing each other with one square between; the side not to move "has" it.
- **Outpost**: a pawn-protected square that enemy pawns can't attack.
- **Overprotection**: defending a strong point more than necessary.
- **Passed pawn**: a pawn with no enemy pawns in front of it on its file or adjacent files.
- **Perpetual check**: endless checks, leading to a draw.
- **Prophylaxis**: preventing the opponent's plans.
- **Rule of the square**: test for whether a king catches a passed pawn.
- **Sacrifice**: deliberately giving up material.
- **Space**: territory controlled, usually measured by pawn advancement.
- **Tempo**: a unit of time (one move).
- **Triangulation**: losing a move with the king to transfer zugzwang.
- **Zugzwang**: an obligation to move that worsens your position.
- **Zwischenzug**: an in-between move.

---

## 14. Sources and Recommended Further Study

### 14.1 Free/public domain (use heavily)
- Capablanca, *Chess Fundamentals* (Project Gutenberg #33870).
- Edward Lasker, *Chess Strategy*; Staunton, *The Blue Book of Chess* (Project Gutenberg chess shelf).
- Nimzowitsch, *My System* (1925 original; an Internet Archive copy is labelled Public Domain Mark; check which edition).
- Lasker, *Common Sense in Chess*; Réti, *Modern Ideas in Chess*; Mason, *Chess Strategy* (Internet Archive and similar).
- Wikipedia articles on the Lucena, Philidor and Vančura positions, key squares, opposition, triangulation, the Greek gift, checkmate patterns, the fifty-move and threefold repetition rules, and individual openings; the "List of ECO codes" table.

### 14.2 Modern books (ideas summarised only)
- Silman: *How to Reassess Your Chess* (4th ed., 2010), *The Amateur's Mind*, *Complete Endgame Course*.
- Kotov: *Think Like a Grandmaster*, *Play Like a Grandmaster*, *Train Like a Grandmaster*.
- Heisman: *A Guide to Chess Improvement: The Best of Novice Nook*, *The Improving Chess Thinker*.
- Smith & Tikkanen: *The Woodpecker Method* (2018).
- Rozman: *How to Win at Chess* (2023); *How to Win at Chess, Next Level* (announced for October 2026).
- Yusupov series; Dvoretsky's *Endgame Manual*; de la Villa's *100 Endgames You Must Know*; Aagaard's calculation books; the Polgars' *Chess: 5334 Problems*; Chernev's *Logical Chess: Move by Move*; Naroditsky's *Mastering Positional Chess*; the Steps Method workbooks.

### 14.3 Online training
- **Lichess**: Practice (basic endgames, checkmates), Puzzle themes, Studies, Opening Explorer, free engine analysis.
- **Chess.com**: Lessons (including checkmate patterns), Drills (Lucena, Vančura, triangulation), Puzzles, game review.
- **Chessable**: spaced-repetition courses (including the official Woodpecker course).
- **ChessBase**: databases and Karsten Müller's endgame articles.
- **YouTube**: Naroditsky speedruns, John Bartholomew's "Climbing the Rating Ladder", Hanging Pawns, Saint Louis Chess Club, GothamChess, agadmator, ChessNetwork.

### 14.4 Caveats on this knowledge base
- **Opening move orders** follow the ECO-defining lines on Wikipedia's ECO table plus standard modern theory. ECO's defining lines date from the 1970s first edition and sometimes differ from today's most common choice (e.g., 7.Nf3 vs 7.Bc4 in the Grünfeld Exchange; 8...Bb7 vs 8...a6 in the Meran; 6.Be3 now more popular than 6.Bg5 in the Najdorf). Exact ECO sub-code boundaries vary slightly between editions. The Smith–Morra is listed as B21 by most databases, though some ECO references give B20.
- **Rating equivalences** (Steps Method, book bands, online vs OTB) are approximate. Online ratings commonly run higher than FIDE ratings at club level.
- **Quoted remarks** from Carlsen and others come from secondary collections (Chessable articles, forum reports of AMA answers) and are paraphrased; treat them as advice, not exact quotations.
- **Engines**: tablebase and engine evaluations can differ from practical results (fortresses, fifty-move limits, human difficulty). Nimzo should present them as such.

## Sources

1. [Items related to A Guide to Chess Improvement: The Best Of Novice Nook](https://www.abebooks.com/9781857446494/Guide-Chess-Improvement-Best-Novice-1857446496/plp)
2. [Book Review](https://www.chess.com/blog/vitualis/book-review-levy-rozman-gothamchess-how-to-win-at-chess)
3. [My Review Of Levy Rozman or 'Gotham Chess''s Book - 'How to Win at Chess?' - The Chess Advisor](https://thechessadvisor.com/book-review/how-to-win-at-chess-by-levy-rozman/)
4. [The Chess Step Method Explained - by GM Noël Studer](https://nextlevelchess.com/steps-method-explained/)
5. [Get Good -- Listen to the Masters Think - Chess Forums - Chess.com](https://www.chess.com/forum/view/for-beginners/get-good-listen-to-the-masters-think)
6. [Magnus Carlsen quotes: His most instructive advice about chess](https://www.chessable.com/blog/magnus-carlsen-quotes-chess/)
7. [Step Methods - Chess Forums - Chess.com](https://www.chess.com/forum/view/chess-equipment/step-methods)
8. [Jump to ratings and reviews](https://www.goodreads.com/book/show/7939414)
9. [How to Get Better at Chess](https://www.chess.com/article/view/getting-better-in-chess-critical-mistake-to-avoid)
10. [Lasker%27s Manual of Chess](https://en.wikipedia.org/wiki/Lasker%27s_Manual_of_Chess)
11. [I Read GothamChess's Book So You Don't Have To (But You Should)](https://www.pawnmasters.top/blog/b7/how-to-win-at-chess-levy-rozman-book-review-2026)
