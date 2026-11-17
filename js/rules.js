window.Schafkopf = window.Schafkopf || {};

(function (Schafkopf) {
    'use strict';

    const Cards = Schafkopf.Cards;
    const CALLABLE_SUITS = ['eichel', 'gras', 'schellen'];
    const TOTAL_POINTS = 120;
    const WINNING_POINTS = 61;
    const PLAYER_COUNT = 4;
    const CARDS_PER_PLAYER = 8;

    function callableSuits(hand) {
        return CALLABLE_SUITS.filter((suit) => {
            const hasSuitCard = hand.some((card) => Cards.effectiveSuit(card) === suit && card.rank !== Cards.ACE);
            const hasAce = hand.some((card) => Cards.isAce(card, suit));
            return hasSuitCard && hasAce === false;
        });
    }

    function legalCards(hand, trick, calledSuit) {
        if (trick.length === 0) {
            return hand.slice();
        }
        const ledSuit = Cards.effectiveSuit(trick[0].card);
        const calledAce = hand.find((card) => Cards.isAce(card, calledSuit));
        if (ledSuit === calledSuit && calledAce) {
            return [calledAce];
        }
        const following = hand.filter((card) => Cards.effectiveSuit(card) === ledSuit);
        return following.length > 0 ? following : hand.slice();
    }

    function isLegal(card, hand, trick, calledSuit) {
        return legalCards(hand, trick, calledSuit).some((legal) => Cards.sameCard(legal, card));
    }

    function winningPlay(trick) {
        return trick.reduce((best, play) => (Cards.beats(play.card, best.card) ? play : best));
    }

    function trickPoints(trick) {
        return Cards.sumPoints(trick.map((play) => play.card));
    }

    function nextSeat(seat) {
        return (seat + 1) % PLAYER_COUNT;
    }

    Schafkopf.Rules = {
        CALLABLE_SUITS,
        TOTAL_POINTS,
        WINNING_POINTS,
        PLAYER_COUNT,
        CARDS_PER_PLAYER,
        callableSuits,
        legalCards,
        isLegal,
        winningPlay,
        trickPoints,
        nextSeat,
    };
})(window.Schafkopf);
