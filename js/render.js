window.Schafkopf = window.Schafkopf || {};

(function (Schafkopf) {
    'use strict';

    const { Cards, Rules, Engine } = Schafkopf;
    const FAN_ANGLE_STEP = 5.5;
    const PIP_LAYOUTS = {
        7: [[30, 0], [70, 0], [50, 25], [30, 50], [70, 50], [30, 100], [70, 100]],
        8: [[30, 0], [70, 0], [30, 33.3], [70, 33.3], [30, 66.7], [70, 66.7], [30, 100], [70, 100]],
        9: [[30, 0], [70, 0], [30, 33.3], [70, 33.3], [50, 50], [30, 66.7], [70, 66.7], [30, 100], [70, 100]],
        10: [[30, 0], [70, 0], [50, 17], [30, 33.3], [70, 33.3], [30, 66.7], [70, 66.7], [50, 83], [30, 100], [70, 100]],
    };
    const PIP_AREA_TOP = 30.4;
    const PIP_AREA_SCALE = 0.392;
    const PIP_FLIP_THRESHOLD = 50;
    const FIGURE_POSES = {
        K: { rightArm: 'M66 73 L73 96', rightHand: [73, 98] },
        O: { rightArm: 'M66 73 L80 50', rightHand: [80, 47] },
        U: { rightArm: 'M66 73 L76 97', rightHand: [76, 99] },
    };
    const SEAT_POSITIONS = ['bottom', 'left', 'top', 'right'];

    function querySelectorRequired(selector, root) {
        const element = root.querySelector(selector);
        if (element === null) {
            throw new Error('Element fehlt: ' + selector);
        }
        return element;
    }

    function templateContent(id) {
        const template = document.getElementById(id);
        if (template === null) {
            throw new Error('Template fehlt: ' + id);
        }
        return template.content;
    }

    function format(text, values) {
        return text.replace(/\{(\w+)\}/g, (placeholder, key) => String(values[key] ?? placeholder));
    }

    function bySeat(elements) {
        return elements.reduce((seats, element) => ({ ...seats, [Number(element.dataset.seat)]: element }), {});
    }

    function createCardFactory() {
        const suitTemplates = Object.fromEntries(
            Cards.SUITS.map((suit) => [suit, templateContent('template-suit-' + suit)]),
        );
        const cardTemplate = templateContent('template-card');
        const backTemplate = templateContent('template-card-back');
        const aceTemplate = templateContent('template-card-ace');
        const figureTemplate = templateContent('template-card-figure');

        function createSuit(suit) {
            return suitTemplates[suit].firstElementChild.cloneNode(true);
        }

        function createPips(card) {
            return PIP_LAYOUTS[card.rank].map(([x, y]) => {
                const pip = document.createElement('div');
                pip.className = 'c-card__pip';
                pip.classList.toggle('c-card__pip--flipped', y > PIP_FLIP_THRESHOLD);
                pip.style.setProperty('--pip-x', x + '%');
                pip.style.setProperty('--pip-y', (PIP_AREA_TOP + y * PIP_AREA_SCALE) + '%');
                pip.append(createSuit(card.suit));
                return pip;
            });
        }

        function createAce(card) {
            const ace = aceTemplate.cloneNode(true);
            querySelectorRequired('.c-card__ace-suit', ace).append(createSuit(card.suit));
            return [ace];
        }

        function createFigure(card) {
            const figure = figureTemplate.cloneNode(true);
            const pose = FIGURE_POSES[card.rank];
            const rightArm = querySelectorRequired('.c-figure__arm--right', figure);
            const rightHand = querySelectorRequired('.c-figure__hand--right', figure);
            const held = querySelectorRequired('.c-card__held', figure);
            rightArm.setAttribute('d', pose.rightArm);
            rightHand.setAttribute('cx', String(pose.rightHand[0]));
            rightHand.setAttribute('cy', String(pose.rightHand[1]));
            figure.querySelectorAll('.c-figure__headwear').forEach((headwear) => {
                if (headwear.dataset.rank !== card.rank) {
                    headwear.remove();
                }
            });
            held.append(createSuit(card.suit));
            return [figure];
        }

        function createContent(card) {
            switch (card.rank) {
                case Cards.ACE:
                    return createAce(card);
                case 'K':
                case 'O':
                case 'U':
                    return createFigure(card);
                default:
                    return createPips(card);
            }
        }

        function createCard(card, { isDimmed = false, isGlowing = false } = {}) {
            const element = cardTemplate.firstElementChild.cloneNode(true);
            const content = querySelectorRequired('.c-card__content', element);
            element.dataset.suit = card.suit;
            element.dataset.rank = card.rank;
            element.classList.toggle('c-card--dim', isDimmed);
            element.classList.toggle('c-card--glow', isGlowing);
            element.querySelectorAll('.c-card__label').forEach((label) => {
                label.textContent = card.rank;
            });
            element.querySelectorAll('.c-card__corner-suit').forEach((corner) => {
                corner.append(createSuit(card.suit));
            });
            content.append(...createContent(card));
            return element;
        }

        function createCardBack() {
            const element = backTemplate.firstElementChild.cloneNode(true);
            element.querySelectorAll('.c-card__back-suit').forEach((slot) => {
                slot.append(createSuit(slot.dataset.suit));
            });
            return element;
        }

        return { createSuit, createCard, createCardBack };
    }

    function createView(root, handlers) {
        const texts = root.dataset;
        const suitNames = JSON.parse(texts.suitNames);
        const rankNames = JSON.parse(texts.rankNames);
        const factory = createCardFactory();
        const callOptionTemplate = templateContent('template-call-option');

        const table = querySelectorRequired('.c-table', root);
        const hand = querySelectorRequired('.js-hand', root);
        const trick = querySelectorRequired('.js-trick', root);
        const trickSlot = querySelectorRequired('.js-trick-slot', root);
        const hint = querySelectorRequired('.js-hint', root);
        const callInfo = querySelectorRequired('.js-call-info', root);
        const trickCounter = querySelectorRequired('.js-trick-counter', root);
        const trickPoints = querySelectorRequired('.js-trick-points', root);
        const teamPlayer = querySelectorRequired('.js-team-player', root);
        const teamOpponents = querySelectorRequired('.js-team-opponents', root);
        const pointsPlayer = querySelectorRequired('.js-points-player', root);
        const pointsOpponents = querySelectorRequired('.js-points-opponents', root);
        const barPlayer = querySelectorRequired('.js-bar-player', root);
        const barOpponents = querySelectorRequired('.js-bar-opponents', root);
        const callDialog = querySelectorRequired('.js-call-dialog', root);
        const callOptions = querySelectorRequired('.js-call-options', root);
        const redealNote = querySelectorRequired('.js-redeal-note', root);
        const resultDialog = querySelectorRequired('.js-result-dialog', root);
        const resultTitle = querySelectorRequired('.js-result-title', root);
        const resultTeamPlayer = querySelectorRequired('.js-result-team-player', root);
        const resultTeamOpponents = querySelectorRequired('.js-result-team-opponents', root);
        const resultPlayer = querySelectorRequired('.js-result-player', root);
        const resultOpponents = querySelectorRequired('.js-result-opponents', root);
        const resultPartner = querySelectorRequired('.js-result-partner', root);
        const newGameButtons = [...root.querySelectorAll('.js-new-game')];
        const surfaceButtons = [...root.querySelectorAll('.c-surface-switch__option')];
        const opponentHands = bySeat([...root.querySelectorAll('.js-opponent-hand')]);
        const badges = bySeat([...root.querySelectorAll('.js-seat-badge')]);
        const badgeStatuses = Object.fromEntries(
            Object.entries(badges).map(([seat, badge]) => [seat, querySelectorRequired('.js-seat-status', badge)]),
        );
        const seatNames = Object.fromEntries(Object.entries(badges).map(([seat, badge]) => [seat, badge.dataset.name]));

        let handKey = '';
        let handAbortController = new AbortController();
        let callKey = null;

        newGameButtons.forEach((button) => button.addEventListener('click', () => handlers.onNewGame()));
        surfaceButtons.forEach((button) => {
            button.addEventListener('click', () => handlers.onSurface(button.dataset.surface));
        });

        function cardName(card) {
            return suitNames[card.suit] + '-' + rankNames[card.rank];
        }

        function aceName(suit) {
            return format(texts.textAce, { suit: suitNames[suit] });
        }

        function isHumanTurn(game) {
            return game.phase === Engine.PHASE.PLAY && game.current === Engine.HUMAN_SEAT;
        }

        function teamName(game, isPlayerSide) {
            const seats = Object.keys(seatNames).map(Number)
                .filter((seat) => Engine.isPlayerTeam(game, seat) === isPlayerSide);
            return format(texts.textTeam, { first: seatNames[seats[0]], second: seatNames[seats[1]] });
        }

        function tricksText(count) {
            return count === 1 ? texts.textTricksOne : format(texts.textTricksMany, { count });
        }

        function renderHand(game) {
            const cards = Cards.sortForDisplay(game.hands[Engine.HUMAN_SEAT]);
            const isTurn = isHumanTurn(game);
            const legal = isTurn ? Engine.legalCardsFor(game, Engine.HUMAN_SEAT) : [];
            const nextKey = cards.map(Cards.cardId).join() + '|' + legal.map(Cards.cardId).join();
            if (nextKey === handKey) {
                return;
            }
            handKey = nextKey;
            handAbortController.abort();
            handAbortController = new AbortController();
            const center = (cards.length - 1) / 2;
            hand.replaceChildren(...cards.map((card, index) => {
                const isPlayable = legal.some((legalCard) => Cards.sameCard(legalCard, card));
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'c-hand__card';
                button.classList.toggle('is-playable', isPlayable);
                button.disabled = isPlayable === false;
                button.setAttribute('aria-label', cardName(card));
                button.style.setProperty('--fan-angle', ((index - center) * FAN_ANGLE_STEP) + 'deg');
                button.style.zIndex = String(isPlayable ? cards.length + index : index);
                button.append(factory.createCard(card, { isDimmed: isTurn && isPlayable === false, isGlowing: isPlayable }));
                if (isPlayable) {
                    button.addEventListener('click', () => handlers.onPlay(card), { signal: handAbortController.signal });
                }
                return button;
            }));
        }

        function renderOpponentHands(game) {
            Object.entries(opponentHands).forEach(([seat, container]) => {
                const count = game.hands[seat].length;
                if (container.childElementCount === count) {
                    return;
                }
                container.replaceChildren(...Array.from({ length: count }, () => {
                    const slot = document.createElement('div');
                    slot.className = 'c-opponent-hand__card';
                    slot.append(factory.createCardBack());
                    return slot;
                }));
            });
        }

        function renderTrick(game, collectingWinner) {
            const shownSeats = new Set(
                [...trick.querySelectorAll('.c-trick__card')].map((element) => Number(element.dataset.seat)),
            );
            if (game.trick.length === 0) {
                trick.querySelectorAll('.c-trick__card').forEach((element) => element.remove());
                shownSeats.clear();
            }
            game.trick
                .filter((play) => shownSeats.has(play.seat) === false)
                .forEach((play) => {
                    const element = document.createElement('div');
                    element.className = 'c-trick__card c-trick__card--' + SEAT_POSITIONS[play.seat];
                    element.dataset.seat = String(play.seat);
                    element.setAttribute('aria-label', seatNames[play.seat] + ': ' + cardName(play.card));
                    element.append(factory.createCard(play.card));
                    trick.append(element);
                });
            const hasHumanPlayed = game.trick.some((play) => play.seat === Engine.HUMAN_SEAT);
            trickSlot.hidden = isHumanTurn(game) === false || hasHumanPlayed;
            if (collectingWinner === null) {
                delete trick.dataset.collect;
                return;
            }
            trick.dataset.collect = SEAT_POSITIONS[collectingWinner];
        }

        function renderBadges(game) {
            Object.entries(badges).forEach(([seatKey, badge]) => {
                const seat = Number(seatKey);
                const isRevealedPartner = game.isPartnerRevealed && seat === game.partnerSeat;
                const isActive = game.phase === Engine.PHASE.PLAY && game.current === seat;
                const role = seat === Engine.HUMAN_SEAT ? texts.textRolePlayer
                    : isRevealedPartner ? texts.textRolePartner
                        : seat === game.forehand ? texts.textRoleForehand : '';
                const parts = [role, isActive ? texts.textRoleTurn : '', tricksText(game.tricksWon[seat])];
                badge.classList.toggle('is-active', isActive);
                badge.classList.toggle('is-player-team', seat === Engine.HUMAN_SEAT || isRevealedPartner);
                badgeStatuses[seat].textContent = parts.filter(Boolean).join(' · ');
            });
        }

        function renderCallInfo(game) {
            if (game.calledSuit === null) {
                callInfo.replaceChildren(document.createTextNode(texts.textCallPending));
                return;
            }
            const label = document.createElement('span');
            const icon = document.createElement('span');
            const ace = document.createElement('strong');
            label.className = 'c-panel__muted';
            label.textContent = texts.textCallInfo;
            icon.className = 'c-panel__suit';
            icon.append(factory.createSuit(game.calledSuit));
            ace.textContent = aceName(game.calledSuit);
            callInfo.replaceChildren(label, icon, ace);
        }

        function renderScore(game) {
            const playerPoints = game.isPartnerRevealed
                ? Engine.teamTotals(game).player
                : game.pointsWon[Engine.HUMAN_SEAT];
            const opponentPoints = game.pointsWon.reduce((sum, points) => sum + points, 0) - playerPoints;
            const visibleNumber = Math.min(game.trickNumber, Rules.CARDS_PER_PLAYER);
            teamPlayer.textContent = game.isPartnerRevealed ? teamName(game, true) : texts.textTeamSelf;
            teamOpponents.textContent = game.isPartnerRevealed ? teamName(game, false) : texts.textTeamOthers;
            pointsPlayer.textContent = String(playerPoints);
            pointsOpponents.textContent = String(opponentPoints);
            barPlayer.style.setProperty('--share', String(playerPoints / Rules.TOTAL_POINTS));
            barOpponents.style.setProperty('--share', String(opponentPoints / Rules.TOTAL_POINTS));
            trickCounter.textContent = format(texts.textTrickCounter, { number: visibleNumber });
            trickPoints.textContent = format(texts.textTrickPoints, { points: Rules.trickPoints(game.trick) });
        }

        function hintFor(game) {
            if (Engine.isTrickComplete(game)) {
                const winner = Rules.winningPlay(game.trick).seat;
                const points = Rules.trickPoints(game.trick);
                const text = winner === Engine.HUMAN_SEAT
                    ? format(texts.textHintTrickWonSelf, { points })
                    : format(texts.textHintTrickWon, { name: seatNames[winner], points });
                return { text, isTurn: false };
            }
            if (isHumanTurn(game) === false) {
                return { text: format(texts.textHintWaiting, { name: seatNames[game.current] }), isTurn: false };
            }
            if (game.trick.length === 0) {
                return { text: texts.textHintLead, isTurn: true };
            }
            const ledSuit = Cards.effectiveSuit(game.trick[0].card);
            const canFollow = game.hands[Engine.HUMAN_SEAT].some((card) => Cards.effectiveSuit(card) === ledSuit);
            if (canFollow === false) {
                return { text: texts.textHintFree, isTurn: true };
            }
            if (ledSuit === Cards.TRUMP) {
                return { text: texts.textHintFollowTrump, isTurn: true };
            }
            return { text: format(texts.textHintFollow, { suit: suitNames[ledSuit] }), isTurn: true };
        }

        function renderHint(game) {
            hint.hidden = game.phase !== Engine.PHASE.PLAY;
            if (hint.hidden) {
                hint.textContent = '';
                return;
            }
            const { text, isTurn } = hintFor(game);
            hint.classList.toggle('c-hint--turn', isTurn);
            hint.textContent = text;
        }

        function renderCallDialog(game) {
            callDialog.hidden = game.phase !== Engine.PHASE.CALL;
            if (callDialog.hidden || callKey === game) {
                return;
            }
            callKey = game;
            redealNote.hidden = game.redeals === 0;
            redealNote.textContent = game.redeals === 1
                ? texts.textRedealOne
                : format(texts.textRedealMany, { count: game.redeals });
            callOptions.replaceChildren(...Rules.callableSuits(game.hands[Engine.HUMAN_SEAT]).map((suit) => {
                const option = callOptionTemplate.firstElementChild.cloneNode(true);
                querySelectorRequired('.c-call-option__suit', option).append(factory.createSuit(suit));
                querySelectorRequired('.c-call-option__label', option).textContent = aceName(suit);
                option.addEventListener('click', () => handlers.onCall(suit));
                return option;
            }));
            callOptions.firstElementChild.focus({ preventScroll: true });
        }

        function renderResultDialog(game) {
            const isResult = game.phase === Engine.PHASE.RESULT;
            const wasHidden = resultDialog.hidden;
            resultDialog.hidden = isResult === false;
            if (isResult === false) {
                return;
            }
            const totals = Engine.teamTotals(game);
            const tricks = Engine.teamTricks(game);
            const isWon = Engine.isWon(game);
            resultDialog.classList.toggle('is-won', isWon);
            resultTitle.textContent = isWon ? texts.textResultWon : texts.textResultLost;
            resultTeamPlayer.textContent = teamName(game, true);
            resultTeamOpponents.textContent = teamName(game, false);
            resultPlayer.textContent = format(texts.textResultRow, {
                points: totals.player,
                tricks: tricksText(tricks.player),
            });
            resultOpponents.textContent = format(texts.textResultRow, {
                points: totals.opponents,
                tricks: tricksText(tricks.opponents),
            });
            resultPartner.textContent = format(texts.textResultPartner, { name: seatNames[game.partnerSeat] });
            if (wasHidden) {
                querySelectorRequired('.js-new-game', resultDialog).focus({ preventScroll: true });
            }
        }

        function render(game, collectingWinner) {
            renderHand(game);
            renderOpponentHands(game);
            renderTrick(game, collectingWinner);
            renderBadges(game);
            renderCallInfo(game);
            renderScore(game);
            renderHint(game);
            renderCallDialog(game);
            renderResultDialog(game);
        }

        function renderSurface(surface) {
            table.dataset.surface = surface;
            surfaceButtons.forEach((button) => {
                button.setAttribute('aria-pressed', String(button.dataset.surface === surface));
            });
        }

        return { render, renderSurface };
    }

    Schafkopf.View = { createView, format };
})(window.Schafkopf);
