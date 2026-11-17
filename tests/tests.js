window.Schafkopf = window.Schafkopf || {};

(function (Schafkopf) {
    'use strict';

    const { Cards, Rules, Engine, Ai } = Schafkopf;
    const SIMULATED_GAMES = 500;
    const results = [];

    function card(id) {
        const [suit, rank] = id.split('-');
        return { suit, rank };
    }

    function cards(ids) {
        return ids.map(card);
    }

    function ids(list) {
        return list.map(Cards.cardId).sort().join(',');
    }

    function trick(plays) {
        return plays.map(([seat, id]) => ({ seat, card: card(id) }));
    }

    function assert(condition, message) {
        if (condition === false) {
            throw new Error(message);
        }
    }

    function assertEqual(actual, expected, message) {
        assert(actual === expected, message + ' (erwartet: ' + expected + ', erhalten: ' + actual + ')');
    }

    function test(name, run) {
        try {
            run();
            results.push({ name, isPassed: true });
        } catch (error) {
            results.push({ name, isPassed: false, message: error.message });
        }
    }

    function seededRandom(seed) {
        let state = seed;
        return function () {
            state = (state + 0x6D2B79F5) | 0;
            let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
            mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
            return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
        };
    }

    function gameWith(handIds, calledSuit, overrides = {}) {
        const hands = handIds.map(cards);
        const partnerSeat = hands.findIndex((hand) => hand.some((held) => Cards.isAce(held, calledSuit)));
        return {
            phase: Engine.PHASE.PLAY,
            dealer: 0,
            redeals: 0,
            hands,
            calledSuit,
            partnerSeat,
            isPartnerRevealed: false,
            forehand: 1,
            leader: 1,
            current: 1,
            trick: [],
            trickNumber: 1,
            tricksWon: [0, 0, 0, 0],
            pointsWon: [0, 0, 0, 0],
            ...overrides,
        };
    }

    test('Das Blatt hat 32 verschiedene Karten und 120 Augen', () => {
        const deck = Cards.createDeck();
        assertEqual(deck.length, 32, 'Kartenzahl');
        assertEqual(new Set(deck.map(Cards.cardId)).size, 32, 'verschiedene Karten');
        assertEqual(Cards.sumPoints(deck), Rules.TOTAL_POINTS, 'Augensumme');
    });

    test('Trumpfreihenfolge: Eichel-Ober oben, Herz-Sieben unten', () => {
        const order = Cards.TRUMP_ORDER.map(card);
        assertEqual(order.length, 14, 'Anzahl Trümpfe');
        order.slice(1).forEach((lower, index) => {
            assert(Cards.beats(order[index], lower), Cards.cardId(order[index]) + ' sticht ' + Cards.cardId(lower));
            assert(Cards.beats(lower, order[index]) === false, Cards.cardId(lower) + ' sticht nicht höher');
        });
        assertEqual(Cards.TRUMP_ORDER[0], 'eichel-O', 'höchster Trumpf');
        assertEqual(Cards.TRUMP_ORDER[13], 'herz-7', 'niedrigster Trumpf');
    });

    test('Jeder Trumpf sticht jede Farbkarte', () => {
        assert(Cards.beats(card('herz-7'), card('eichel-A')), 'Herz-Sieben sticht Eichel-Sau');
        assert(Cards.beats(card('schellen-U'), card('gras-A')), 'Schellen-Unter sticht Gras-Sau');
    });

    test('Farbreihenfolge: Sau, Zehn, König, Neun, Acht, Sieben', () => {
        const order = cards(['gras-A', 'gras-10', 'gras-K', 'gras-9', 'gras-8', 'gras-7']);
        order.slice(1).forEach((lower, index) => {
            assert(Cards.beats(order[index], lower), Cards.cardId(order[index]) + ' vor ' + Cards.cardId(lower));
        });
    });

    test('Ober und Unter gehören nicht zu ihrer Farbe', () => {
        assertEqual(Cards.effectiveSuit(card('gras-O')), Cards.TRUMP, 'Gras-Ober');
        assertEqual(Cards.effectiveSuit(card('schellen-U')), Cards.TRUMP, 'Schellen-Unter');
        const legal = Rules.legalCards(cards(['gras-O', 'eichel-7']), trick([[1, 'gras-7']]), 'schellen');
        assertEqual(ids(legal), 'eichel-7,gras-O', 'Gras-Ober bedient Gras nicht, also freie Wahl');
    });

    test('Bedienpflicht bei Farbe', () => {
        const legal = Rules.legalCards(cards(['gras-O', 'gras-9', 'eichel-7']), trick([[1, 'gras-7']]), 'schellen');
        assertEqual(ids(legal), 'gras-9', 'nur Gras');
    });

    test('Bedienpflicht bei Trumpf: Herz, Ober und Unter bedienen', () => {
        const legal = Rules.legalCards(cards(['herz-K', 'eichel-U', 'gras-A']), trick([[1, 'schellen-O']]), 'gras');
        assertEqual(ids(legal), 'eichel-U,herz-K', 'nur Trümpfe');
    });

    test('Wer nicht bedienen kann, spielt eine beliebige Karte', () => {
        const legal = Rules.legalCards(cards(['herz-K', 'eichel-A']), trick([[1, 'gras-7']]), 'schellen');
        assertEqual(ids(legal), 'eichel-A,herz-K', 'freie Wahl');
    });

    test('Wird die Ruffarbe angespielt, muss die Sau kommen', () => {
        const legal = Rules.legalCards(cards(['gras-A', 'gras-10', 'eichel-O']), trick([[1, 'gras-7']]), 'gras');
        assertEqual(ids(legal), 'gras-A', 'nur die Gras-Sau');
    });

    test('Die gerufene Sau ist bei Trumpf nicht Pflicht', () => {
        const legal = Rules.legalCards(cards(['gras-A', 'herz-8']), trick([[1, 'herz-7']]), 'gras');
        assertEqual(ids(legal), 'herz-8', 'Trumpf bedienen');
    });

    test('Stichgewinner: höchste Karte der angespielten Farbe', () => {
        const winner = Rules.winningPlay(trick([[1, 'gras-7'], [2, 'gras-K'], [3, 'gras-10'], [0, 'eichel-A']]));
        assertEqual(winner.seat, 3, 'Gras-Zehn gewinnt');
    });

    test('Stichgewinner: höchster Trumpf', () => {
        const winner = Rules.winningPlay(trick([[1, 'gras-A'], [2, 'herz-7'], [3, 'schellen-U'], [0, 'gras-10']]));
        assertEqual(winner.seat, 3, 'Schellen-Unter gewinnt');
    });

    test('Rufbar ist eine Sau, wenn man die Farbe hat, aber nicht die Sau', () => {
        assertEqual(Rules.callableSuits(cards(['gras-7', 'eichel-O'])).join(), 'gras', 'Gras rufbar');
        assertEqual(Rules.callableSuits(cards(['gras-7', 'gras-A'])).join(), '', 'eigene Sau nicht rufbar');
        assertEqual(Rules.callableSuits(cards(['gras-O', 'gras-U'])).join(), '', 'Ober/Unter zählen nicht');
        assertEqual(Rules.callableSuits(cards(['herz-7'])).join(), '', 'Herz nie rufbar');
    });

    test('Neues Spiel: der Mensch kann immer rufen, der Partner hat die Sau', () => {
        const random = seededRandom(7);
        for (let round = 0; round < 50; round++) {
            const game = Engine.createGame(round % 4, random);
            const suits = Rules.callableSuits(game.hands[0]);
            assert(suits.length > 0, 'mindestens eine rufbare Sau');
            const called = Engine.callAce(game, suits[0]);
            assert(called.partnerSeat > 0, 'Partner ist ein Computer');
            assert(called.hands[called.partnerSeat].some((held) => Cards.isAce(held, suits[0])), 'Partner hat die Sau');
            assertEqual(called.current, Rules.nextSeat(round % 4), 'Vorhand spielt an');
        }
    });

    test('Unerlaubte Züge werden abgelehnt', () => {
        const game = gameWith([['gras-9'], ['gras-7'], ['gras-A', 'gras-K'], ['eichel-7']], 'gras', {
            current: 2,
            trick: trick([[1, 'gras-7']]),
        });
        let error = null;
        try {
            Engine.playCard(game, 2, card('gras-K'));
        } catch (thrown) {
            error = thrown;
        }
        assert(error instanceof Engine.IllegalMoveError, 'Gras-König statt Sau wird abgelehnt');
    });

    test('Computer: Partner muss die gerufene Sau spielen', () => {
        const game = gameWith([['gras-9'], ['gras-7'], ['gras-A', 'gras-K'], ['eichel-7']], 'gras', {
            current: 2,
            trick: trick([[1, 'gras-7']]),
        });
        assertEqual(Cards.cardId(Ai.chooseCard(game, 2)), 'gras-A', 'Gras-Sau');
    });

    test('Computer: sticht mit der niedrigsten möglichen Karte', () => {
        const game = gameWith([['eichel-A'], ['gras-K'], ['gras-A', 'gras-10', 'gras-9'], ['schellen-A']], 'eichel', {
            current: 2,
            trick: trick([[1, 'gras-K']]),
        });
        assertEqual(Cards.cardId(Ai.chooseCard(game, 2)), 'gras-10', 'Zehn reicht');
    });

    test('Computer: wirft die niedrigste Karte ab, wenn er nicht gewinnen kann', () => {
        const game = gameWith([['eichel-9'], ['gras-A'], ['gras-K', 'gras-7', 'gras-10'], ['eichel-A']], 'eichel', {
            current: 2,
            trick: trick([[1, 'gras-A']]),
        });
        assertEqual(Cards.cardId(Ai.chooseCard(game, 2)), 'gras-7', 'Sieben abwerfen');
    });

    test('Computer: gibt dem Partner Punkte zu', () => {
        const game = gameWith(
            [['eichel-O', 'schellen-7'], ['gras-A', 'eichel-7'], ['herz-A', 'herz-7'], ['schellen-A', 'gras-10']],
            'schellen',
            { current: 3, isPartnerRevealed: true, trick: trick([[1, 'gras-A'], [2, 'herz-7']]) },
        );
        assertEqual(game.partnerSeat, 3, 'Resi ist Partnerin');
        assertEqual(Ai.relationTo(game, 1, 2), Ai.RELATION.FRIEND, 'Sepp und Vroni spielen zusammen');
        const vroniTrick = { ...game, current: 2, trick: trick([[0, 'schellen-7'], [3, 'gras-10'], [1, 'eichel-7']]) };
        assertEqual(Cards.cardId(Ai.chooseCard(vroniTrick, 2)), 'herz-7', 'Vroni sticht den Gegner billig');
        const sepp = gameWith(
            [['eichel-O'], ['gras-10', 'gras-7', 'eichel-U'], ['gras-A'], ['schellen-A']],
            'schellen',
            { current: 1, isPartnerRevealed: true, trick: trick([[2, 'gras-A']]) },
        );
        assertEqual(Cards.cardId(Ai.chooseCard(sepp, 1)), 'gras-10', 'Sepp schmiert die Zehn zu Vroni');
    });

    test('Computer: kennt den fremden Partner nicht, bevor die Sau fällt', () => {
        const game = gameWith([['gras-7'], ['eichel-7'], ['eichel-K'], ['gras-A']], 'gras');
        assertEqual(Ai.relationTo(game, 1, 2), Ai.RELATION.UNKNOWN, 'Sepp weiß nichts über Vroni');
        assertEqual(Ai.relationTo(game, 1, 0), Ai.RELATION.FOE, 'der Mensch ist immer Gegner');
        assertEqual(Ai.relationTo(game, 3, 0), Ai.RELATION.FRIEND, 'die Partnerin kennt ihr Team');
    });

    test(SIMULATED_GAMES + ' simulierte Spiele enden regelkonform mit 120 Augen', () => {
        const random = seededRandom(42);
        for (let round = 0; round < SIMULATED_GAMES; round++) {
            let game = Engine.createGame(round % 4, random);
            game = Engine.callAce(game, Rules.callableSuits(game.hands[0])[0]);
            let plays = 0;
            while (game.phase === Engine.PHASE.PLAY) {
                if (Engine.isTrickComplete(game)) {
                    game = Engine.collectTrick(game);
                } else {
                    game = Engine.playCard(game, game.current, Ai.chooseCard(game, game.current));
                    plays++;
                }
            }
            assertEqual(plays, 32, 'Spiel ' + round + ': gespielte Karten');
            assertEqual(game.tricksWon.reduce((sum, count) => sum + count, 0), 8, 'Spiel ' + round + ': Stiche');
            const totals = Engine.teamTotals(game);
            assertEqual(totals.player + totals.opponents, Rules.TOTAL_POINTS, 'Spiel ' + round + ': Augen');
            assert(game.isPartnerRevealed, 'Spiel ' + round + ': die Sau ist gefallen');
        }
    });

    Schafkopf.TestResults = results;
})(window.Schafkopf);
