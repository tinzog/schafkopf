window.Schafkopf = window.Schafkopf || {};

(function (Schafkopf) {
    'use strict';

    const { Cards, Rules, Engine } = Schafkopf;
    const RELATION = { FRIEND: 'friend', FOE: 'foe', UNKNOWN: 'unknown' };

    function relationTo(game, observer, other) {
        const isKnown = game.isPartnerRevealed || observer === game.partnerSeat || other === Engine.HUMAN_SEAT;
        if (isKnown === false) {
            return RELATION.UNKNOWN;
        }
        return Engine.isPlayerTeam(game, observer) === Engine.isPlayerTeam(game, other) ? RELATION.FRIEND : RELATION.FOE;
    }

    function cheapest(cards) {
        return cards.reduce((best, card) => {
            const isCheaper = Cards.points(card) < Cards.points(best)
                || (Cards.points(card) === Cards.points(best) && Cards.strength(card) < Cards.strength(best));
            return isCheaper ? card : best;
        });
    }

    function mostValuable(cards) {
        return cards.reduce((best, card) => {
            const isMoreValuable = Cards.points(card) > Cards.points(best)
                || (Cards.points(card) === Cards.points(best) && Cards.strength(card) < Cards.strength(best));
            return isMoreValuable ? card : best;
        });
    }

    function chooseLead(game, seat, legal) {
        const isOpponent = Engine.isPlayerTeam(game, seat) === false;
        const calledSuitCards = legal.filter((card) => Cards.effectiveSuit(card) === game.calledSuit);
        if (isOpponent && game.isPartnerRevealed === false && calledSuitCards.length > 0) {
            return Cards.lowest(calledSuitCards);
        }
        const plainCards = legal.filter((card) => (
            Cards.isTrump(card) === false && (isOpponent || Cards.effectiveSuit(card) !== game.calledSuit)
        ));
        if (plainCards.length > 0) {
            return cheapest(plainCards);
        }
        const trumps = legal.filter(Cards.isTrump);
        if (trumps.length > 0) {
            return Cards.lowest(trumps);
        }
        return cheapest(legal);
    }

    function choosePointsForFriend(legal) {
        const withoutOberAndUnter = legal.filter((card) => Cards.isOberOrUnter(card) === false);
        if (withoutOberAndUnter.length === 0) {
            return Cards.lowest(legal);
        }
        return mostValuable(withoutOberAndUnter);
    }

    function chooseCard(game, seat) {
        const legal = Engine.legalCardsFor(game, seat);
        if (legal.length === 1) {
            return legal[0];
        }
        if (game.trick.length === 0) {
            return chooseLead(game, seat, legal);
        }
        const best = Rules.winningPlay(game.trick);
        if (relationTo(game, seat, best.seat) === RELATION.FRIEND) {
            return choosePointsForFriend(legal);
        }
        const winningCards = legal.filter((card) => Cards.beats(card, best.card));
        if (winningCards.length > 0) {
            return Cards.lowest(winningCards);
        }
        return cheapest(legal);
    }

    Schafkopf.Ai = { RELATION, relationTo, chooseCard };
})(window.Schafkopf);
