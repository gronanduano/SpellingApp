window.spellingSpeech = {

    currentAudio: null,

    // ========================================
    // SPEAK COMPLETE WORD
    // ========================================

    speak: function (text) {

        return new Promise((resolve) => {

            window.speechSynthesis.cancel();

            const utterance =
                new SpeechSynthesisUtterance(text);

            utterance.lang = "en-US";
            utterance.rate = 0.75;
            utterance.pitch = 1.0;

            utterance.onend = function () {
                resolve();
            };

            utterance.onerror = function () {
                resolve();
            };

            window.speechSynthesis.speak(
                utterance
            );
        });
    },

    // ========================================
    // SPEAK COMPLETE WORD TWICE
    // ========================================

    speakTwice: function (text) {

        return new Promise((resolve) => {

            window.speechSynthesis.cancel();

            const first =
                new SpeechSynthesisUtterance(text);

            first.lang = "en-US";

            first.rate = 0.75;
            first.pitch = 1.0;

            const second = new SpeechSynthesisUtterance(text);

            second.lang = "en-US";
            second.rate = 0.75;
            second.pitch = 1.0;

            first.onerror = function () {
                resolve();
            };

            second.onerror = function () {
                resolve();
            };

            second.onend = function () {
                resolve();
            };

            first.onend = function () {

                setTimeout(
                    function () {

                        window.speechSynthesis.speak(
                            second
                        );

                    },
                    1500
                );
            };

            window.speechSynthesis.speak(
                first
            );
        });
    },

    // ========================================
    // SPEAK INDIVIDUAL LETTER USING WAV
    // ========================================

    speakLetter: function (letter) {

        return new Promise((resolve) => {

            window.speechSynthesis.cancel();

            if (window.spellingSpeech.currentAudio) {

                try {

                    window.spellingSpeech
                        .currentAudio
                        .pause();

                }
                catch {
                }
            }

            const fileName =
                letter.toLowerCase();

            const audio =
                new Audio(
                    `audio/letters/${fileName}.wav`
                );

            window.spellingSpeech.currentAudio =
                audio;

            audio.onended = function () {

                window.spellingSpeech.currentAudio =
                    null;

                resolve();
            };

            audio.onerror = function () {

                window.spellingSpeech.currentAudio =
                    null;

                resolve();
            };

            audio.play().catch(function () {

                window.spellingSpeech.currentAudio =
                    null;

                resolve();
            });
        });
    },

    // ========================================
    // STOP EVERYTHING
    // ========================================

    stop: function () {

        window.speechSynthesis.cancel();

        if (window.spellingSpeech.currentAudio) {

            try {

                window.spellingSpeech
                    .currentAudio
                    .pause();

                window.spellingSpeech
                    .currentAudio
                    .currentTime = 0;

            }
            catch {
            }

            window.spellingSpeech.currentAudio =
                null;
        }
    }
};