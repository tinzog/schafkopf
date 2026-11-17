window.Schafkopf = window.Schafkopf || {};

(function (Schafkopf) {
    'use strict';

    function signal(initialValue) {
        let currentValue = initialValue;
        const subscribers = new Set();
        return {
            get value() {
                return currentValue;
            },
            set value(nextValue) {
                if (Object.is(nextValue, currentValue)) {
                    return;
                }
                currentValue = nextValue;
                subscribers.forEach((subscriber) => subscriber());
            },
            subscribe(subscriber) {
                subscribers.add(subscriber);
            },
        };
    }

    function effect(signals, callback) {
        const run = () => callback(...signals.map((source) => source.value));
        signals.forEach((source) => source.subscribe(run));
        run();
    }

    Schafkopf.Signal = { signal, effect };
})(window.Schafkopf);
