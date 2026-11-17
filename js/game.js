window.Schafkopf = window.Schafkopf || {};

(function (Schafkopf) {
    'use strict';

    const { Signal, Engine, Ai, Rules, View } = Schafkopf;
    const COMPUTER_TURN_DELAY = 750;
    const TRICK_DISPLAY_DURATION = 1300;
    const TRICK_COLLECT_DURATION = 320;
    const SURFACES = ['filz', 'holz'];
    const SURFACE_STORAGE_KEY = 'schafkopf.surface';

    const root = document.querySelector('.l-app');
    if (root === null) {
        throw new Error('Element fehlt: .l-app');
    }

    const game = Signal.signal(null);
    const collectingWinner = Signal.signal(null);
    const surface = Signal.signal(readSurface());
    const timers = new Set();
    let nextDealer = 0;

    function readSurface() {
        try {
            const stored = window.localStorage.getItem(SURFACE_STORAGE_KEY);
            return SURFACES.includes(stored) ? stored : SURFACES[0];
        } catch (error) {
            return SURFACES[0];
        }
    }

    function storeSurface(value) {
        try {
            window.localStorage.setItem(SURFACE_STORAGE_KEY, value);
        } catch (error) {
            // Storage can be unavailable on file:// or in private windows; the switch still works per session.
        }
    }

    function schedule(callback, delay) {
        const timer = window.setTimeout(() => {
            timers.delete(timer);
            callback();
        }, delay);
        timers.add(timer);
    }

    function cancelScheduled() {
        timers.forEach((timer) => window.clearTimeout(timer));
        timers.clear();
    }

    function collectTrick() {
        collectingWinner.value = Rules.winningPlay(game.value.trick).seat;
        schedule(() => {
            game.value = Engine.collectTrick(game.value);
            collectingWinner.value = null;
            advance();
        }, TRICK_COLLECT_DURATION);
    }

    function advance() {
        const current = game.value;
        if (current.phase !== Engine.PHASE.PLAY) {
            return;
        }
        if (Engine.isTrickComplete(current)) {
            schedule(collectTrick, TRICK_DISPLAY_DURATION);
            return;
        }
        if (current.current === Engine.HUMAN_SEAT) {
            return;
        }
        schedule(() => {
            const seat = game.value.current;
            play(seat, Ai.chooseCard(game.value, seat));
        }, COMPUTER_TURN_DELAY);
    }

    function play(seat, card) {
        game.value = Engine.playCard(game.value, seat, card);
        advance();
    }

    function handlePlay(card) {
        const current = game.value;
        if (current.phase !== Engine.PHASE.PLAY || current.current !== Engine.HUMAN_SEAT) {
            return;
        }
        play(Engine.HUMAN_SEAT, card);
    }

    function handleCall(suit) {
        game.value = Engine.callAce(game.value, suit);
        advance();
    }

    function startGame() {
        cancelScheduled();
        collectingWinner.value = null;
        game.value = Engine.createGame(nextDealer);
        nextDealer = Rules.nextSeat(nextDealer);
    }

    function handleSurface(value) {
        surface.value = SURFACES.includes(value) ? value : SURFACES[0];
    }

    const view = View.createView(root, {
        onPlay: handlePlay,
        onCall: handleCall,
        onNewGame: startGame,
        onSurface: handleSurface,
    });

    startGame();

    Signal.effect([game, collectingWinner], (currentGame, winner) => view.render(currentGame, winner));
    Signal.effect([surface], (value) => {
        view.renderSurface(value);
        storeSurface(value);
    });
})(window.Schafkopf);
