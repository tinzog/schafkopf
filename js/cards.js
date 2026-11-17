window.Schafkopf = window.Schafkopf || {};

(function (Schafkopf) {
    'use strict';

    const SUITS = ['eichel', 'gras', 'herz', 'schellen'];
    const RANKS = ['A', '10', 'K', 'O', 'U', '9', '8', '7'];
    const TRUMP = 'trumpf';
    const TRUMP_SUIT = 'herz';
    const ACE = 'A';
    const OBER = 'O';
    const UNTER = 'U';
    const SUIT_RANK_ORDER = ['A', '10', 'K', '9', '8', '7'];
    const TRUMP_ORDER = [
        ...SUITS.map((suit) => suit + '-' + OBER),
        ...SUITS.map((suit) => suit + '-' + UNTER),
        ...SUIT_RANK_ORDER.map((rank) => TRUMP_SUIT + '-' + rank),
    ];
    const DISPLAY_SUIT_ORDER = ['eichel', 'gras', 'schellen'];
    const TRUMP_STRENGTH_OFFSET = 100;
    const POINTS = { A: 11, 10: 10, K: 4, O: 3, U: 2, 9: 0, 8: 0, 7: 0 };

    function cardId(card) {
        return card.suit + '-' + card.rank;
    }

    function isTrump(card) {
        return card.rank === OBER || card.rank === UNTER || card.suit === TRUMP_SUIT;
    }

    function isOberOrUnter(card) {
        return card.rank === OBER || card.rank === UNTER;
    }

    function effectiveSuit(card) {
        return isTrump(card) ? TRUMP : card.suit;
    }

    function points(card) {
        return POINTS[card.rank];
    }

    function sumPoints(cards) {
        return cards.reduce((sum, card) => sum + points(card), 0);
    }

    function strength(card) {
        if (isTrump(card)) {
            return TRUMP_STRENGTH_OFFSET + TRUMP_ORDER.length - TRUMP_ORDER.indexOf(cardId(card));
        }
        return SUIT_RANK_ORDER.length - SUIT_RANK_ORDER.indexOf(card.rank);
    }

    function beats(challenger, currentBest) {
        if (isTrump(challenger) !== isTrump(currentBest)) {
            return isTrump(challenger);
        }
        if (effectiveSuit(challenger) !== effectiveSuit(currentBest)) {
            return false;
        }
        return strength(challenger) > strength(currentBest);
    }

    function isAce(card, suit) {
        return card.rank === ACE && card.suit === suit;
    }

    function sameCard(first, second) {
        return first.suit === second.suit && first.rank === second.rank;
    }

    function createDeck() {
        return SUITS.flatMap((suit) => RANKS.map((rank) => ({ suit, rank })));
    }

    function shuffle(cards, random = Math.random) {
        const shuffled = cards.slice();
        for (let index = shuffled.length - 1; index > 0; index--) {
            const swapIndex = Math.floor(random() * (index + 1));
            [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
        }
        return shuffled;
    }

    function displayOrder(card) {
        if (isTrump(card)) {
            return TRUMP_ORDER.indexOf(cardId(card));
        }
        const suitBlock = TRUMP_ORDER.length + DISPLAY_SUIT_ORDER.indexOf(card.suit) * SUIT_RANK_ORDER.length;
        return suitBlock + SUIT_RANK_ORDER.indexOf(card.rank);
    }

    function sortForDisplay(cards) {
        return cards.slice().sort((first, second) => displayOrder(first) - displayOrder(second));
    }

    function lowest(cards) {
        return cards.reduce((best, card) => (strength(card) < strength(best) ? card : best));
    }

    Schafkopf.Cards = {
        SUITS,
        RANKS,
        TRUMP,
        ACE,
        TRUMP_ORDER,
        cardId,
        isTrump,
        isOberOrUnter,
        effectiveSuit,
        points,
        sumPoints,
        strength,
        beats,
        isAce,
        sameCard,
        createDeck,
        shuffle,
        sortForDisplay,
        lowest,
    };
})(window.Schafkopf);
