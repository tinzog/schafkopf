window.Schafkopf = window.Schafkopf || {};

(function (Schafkopf) {
    'use strict';

    const { Cards, Rules } = Schafkopf;
    const HUMAN_SEAT = 0;
    const PHASE = { CALL: 'call', PLAY: 'play', RESULT: 'result' };

    class IllegalMoveError extends Error {
        constructor(message) {
            super(message);
            this.name = 'IllegalMoveError';
        }
    }

    function deal(random) {
        const deck = Cards.shuffle(Cards.createDeck(), random);
        return Array.from({ length: Rules.PLAYER_COUNT }, (_, seat) => {
            const start = seat * Rules.CARDS_PER_PLAYER;
            return deck.slice(start, start + Rules.CARDS_PER_PLAYER);
        });
    }

    function createGame(dealer, random = Math.random) {
        let redeals = 0;
        let hands = deal(random);
        while (Rules.callableSuits(hands[HUMAN_SEAT]).length === 0) {
            redeals++;
            hands = deal(random);
        }
        const leader = Rules.nextSeat(dealer);
        return {
            phase: PHASE.CALL,
            dealer,
            redeals,
            hands,
            calledSuit: null,
            partnerSeat: null,
            isPartnerRevealed: false,
            forehand: leader,
            leader,
            current: null,
            trick: [],
            trickNumber: 1,
            tricksWon: [0, 0, 0, 0],
            pointsWon: [0, 0, 0, 0],
        };
    }

    function callAce(game, suit) {
        if (game.phase !== PHASE.CALL || Rules.callableSuits(game.hands[HUMAN_SEAT]).includes(suit) === false) {
            throw new IllegalMoveError('Die ' + suit + '-Sau kann nicht gerufen werden.');
        }
        const partnerSeat = game.hands.findIndex((hand) => hand.some((card) => Cards.isAce(card, suit)));
        return { ...game, phase: PHASE.PLAY, calledSuit: suit, partnerSeat, current: game.leader };
    }

    function legalCardsFor(game, seat) {
        return Rules.legalCards(game.hands[seat], game.trick, game.calledSuit);
    }

    function isTrickComplete(game) {
        return game.trick.length === Rules.PLAYER_COUNT;
    }

    function playCard(game, seat, card) {
        if (game.phase !== PHASE.PLAY || game.current !== seat) {
            throw new IllegalMoveError('Spieler ' + seat + ' ist nicht am Zug.');
        }
        if (Rules.isLegal(card, game.hands[seat], game.trick, game.calledSuit) === false) {
            throw new IllegalMoveError(Cards.cardId(card) + ' darf nicht gespielt werden.');
        }
        const hands = game.hands.map((hand, index) => (
            index === seat ? hand.filter((held) => Cards.sameCard(held, card) === false) : hand
        ));
        const trick = [...game.trick, { seat, card }];
        const isPartnerRevealed = game.isPartnerRevealed || Cards.isAce(card, game.calledSuit);
        const current = trick.length === Rules.PLAYER_COUNT ? null : Rules.nextSeat(seat);
        return { ...game, hands, trick, isPartnerRevealed, current };
    }

    function collectTrick(game) {
        if (isTrickComplete(game) === false) {
            throw new IllegalMoveError('Der Stich ist noch nicht vollständig.');
        }
        const winner = Rules.winningPlay(game.trick).seat;
        const tricksWon = game.tricksWon.map((count, seat) => (seat === winner ? count + 1 : count));
        const pointsWon = game.pointsWon.map((sum, seat) => (
            seat === winner ? sum + Rules.trickPoints(game.trick) : sum
        ));
        const collected = { ...game, trick: [], tricksWon, pointsWon };
        if (game.trickNumber === Rules.CARDS_PER_PLAYER) {
            return { ...collected, phase: PHASE.RESULT, current: null };
        }
        return { ...collected, trickNumber: game.trickNumber + 1, leader: winner, current: winner };
    }

    function isPlayerTeam(game, seat) {
        return seat === HUMAN_SEAT || seat === game.partnerSeat;
    }

    function teamTotals(game) {
        return game.pointsWon.reduce((totals, points, seat) => {
            const team = isPlayerTeam(game, seat) ? 'player' : 'opponents';
            return { ...totals, [team]: totals[team] + points };
        }, { player: 0, opponents: 0 });
    }

    function teamTricks(game) {
        return game.tricksWon.reduce((totals, tricks, seat) => {
            const team = isPlayerTeam(game, seat) ? 'player' : 'opponents';
            return { ...totals, [team]: totals[team] + tricks };
        }, { player: 0, opponents: 0 });
    }

    function isWon(game) {
        return teamTotals(game).player >= Rules.WINNING_POINTS;
    }

    Schafkopf.Engine = {
        HUMAN_SEAT,
        PHASE,
        IllegalMoveError,
        createGame,
        callAce,
        legalCardsFor,
        isTrickComplete,
        playCard,
        collectTrick,
        isPlayerTeam,
        teamTotals,
        teamTricks,
        isWon,
    };
})(window.Schafkopf);
