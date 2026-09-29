window.voiceTrainer = {

    baseRecognizer: null,
    transferRecognizer: null,

    transferName: "spelling-letters",

    dbName: "SpellingAppVoice",
    dbVersion: 1,
    storeName: "voiceData",
    datasetKey: "letterDataset",

    modelTrained: false,
    testing: false,

    async ensureBaseModel() {

        if (this.baseRecognizer) {
            return;
        }

        console.log("Loading TensorFlow Speech Commands...");

        this.baseRecognizer =
            speechCommands.create("BROWSER_FFT");

        await this.baseRecognizer.ensureModelLoaded();

        console.log("Base model loaded.");
    },

    async ensureTransferRecognizer() {

        await this.ensureBaseModel();

        if (this.transferRecognizer) {
            return;
        }

        this.transferRecognizer =
            this.baseRecognizer.createTransfer(
                this.transferName
            );

        console.log("Transfer recognizer created.");
    },

    openDatabase() {

        return new Promise((resolve, reject) => {

            const request =
                indexedDB.open(
                    this.dbName,
                    this.dbVersion
                );

            request.onupgradeneeded = event => {

                const db =
                    event.target.result;

                if (
                    !db.objectStoreNames.contains(
                        this.storeName
                    )
                ) {
                    db.createObjectStore(
                        this.storeName
                    );
                }
            };

            request.onsuccess = event => {
                resolve(event.target.result);
            };

            request.onerror = event => {
                reject(event.target.error);
            };
        });
    },

    async saveDataset() {

        if (!this.transferRecognizer) {
            return false;
        }

        const dataset =
            this.transferRecognizer
                .serializeExamples();

        const db =
            await this.openDatabase();

        return new Promise((resolve, reject) => {

            const transaction =
                db.transaction(
                    this.storeName,
                    "readwrite"
                );

            const store =
                transaction.objectStore(
                    this.storeName
                );

            store.put(
                dataset,
                this.datasetKey
            );

            transaction.oncomplete = () => {

                db.close();

                console.log(
                    "VOICE DATA SAVED TO INDEXEDDB"
                );

                resolve(true);
            };

            transaction.onerror = event => {

                db.close();

                reject(event.target.error);
            };
        });
    },

    async getSavedDataset() {

        const db =
            await this.openDatabase();

        return new Promise((resolve, reject) => {

            const transaction =
                db.transaction(
                    this.storeName,
                    "readonly"
                );

            const store =
                transaction.objectStore(
                    this.storeName
                );

            const request =
                store.get(
                    this.datasetKey
                );

            request.onsuccess = () => {

                const result =
                    request.result || null;

                db.close();

                resolve(result);
            };

            request.onerror = event => {

                db.close();

                reject(event.target.error);
            };
        });
    },

    async deleteSavedDataset() {

        const db =
            await this.openDatabase();

        return new Promise((resolve, reject) => {

            const transaction =
                db.transaction(
                    this.storeName,
                    "readwrite"
                );

            transaction
                .objectStore(this.storeName)
                .delete(this.datasetKey);

            transaction.oncomplete = () => {

                db.close();

                resolve(true);
            };

            transaction.onerror = event => {

                db.close();

                reject(event.target.error);
            };
        });
    },

    async hasSavedTrainingData() {

        try {

            const data =
                await this.getSavedDataset();

            return !!data;
        }
        catch (error) {

            console.error(
                "Unable to check saved voice data:",
                error
            );

            return false;
        }
    },

    async startTraining() {

        await this.stopTesting();

        await this.ensureTransferRecognizer();

        try {

            this.transferRecognizer
                .clearExamples();
        }
        catch (error) {

            console.warn(
                "Unable to clear examples:",
                error
            );
        }

        this.modelTrained = false;

        console.log(
            "FRESH VOICE TRAINING STARTED"
        );
    },

    async captureExample(label) {

        await this.ensureTransferRecognizer();

        console.log(
            "LISTENING FOR:",
            label
        );

        await this.transferRecognizer
            .collectExample(label);

        console.log(
            "RECORDED:",
            label
        );
    },

    getCounts() {

        if (!this.transferRecognizer) {
            return {};
        }

        return this.transferRecognizer
            .countExamples();
    },

    async train() {

        if (!this.transferRecognizer) {

            throw new Error(
                "No voice examples available."
            );
        }

        const counts =
            this.transferRecognizer
                .countExamples();

        console.log(
            "TRAINING WITH:",
            counts
        );

        try {

            await this.transferRecognizer.train({

                epochs: 30,

                callback: {

                    onEpochEnd:
                        async (epoch, logs) => {

                            console.log(
                                `Epoch ${epoch + 1}/30`,
                                logs
                            );
                        }
                }
            });

            this.modelTrained = true;

            console.log(
                "VOICE MODEL TRAINED SUCCESSFULLY"
            );

            return true;
        }
        catch (error) {

            console.error(
                "VOICE TRAINING FAILED:",
                error
            );

            throw error;
        }
    },

    async trainAndSave() {

        await this.train();

        await this.saveDataset();

        console.log(
            "TRAINING COMPLETE AND SAVED"
        );

        return true;
    },

    async loadSavedTraining() {

        const saved =
            await this.getSavedDataset();

        if (!saved) {

            console.log(
                "NO SAVED VOICE TRAINING"
            );

            return false;
        }

        await this.ensureTransferRecognizer();

        try {

            this.transferRecognizer
                .clearExamples();
        }
        catch {
        }

        this.transferRecognizer
            .loadExamples(saved);

        console.log(
            "VOICE DATA LOADED:",
            this.transferRecognizer
                .countExamples()
        );

        await this.train();

        return true;
    },

    async startTesting(dotNetHelper) {

        await this.stopTesting();

        if (!this.modelTrained) {

            const loaded =
                await this.loadSavedTraining();

            if (!loaded) {

                throw new Error(
                    "No saved voice training."
                );
            }
        }

        const labels =
            this.transferRecognizer
                .wordLabels();

        this.testing = true;

        console.log(
            "VOICE TEST STARTED:",
            labels
        );

        await this.transferRecognizer.listen(

            result => {

                if (!this.testing) {
                    return;
                }

                const scores =
                    Array.from(
                        result.scores
                    );

                const ranked =
                    scores
                        .map(
                            (score, index) => ({
                                label: labels[index],
                                score: score
                            })
                        )
                        .sort(
                            (a, b) =>
                                b.score - a.score
                        );

                const winner =
                    ranked[0];

                if (!winner) {
                    return;
                }

                if (
                    winner.label ===
                    "_background_noise_"
                ) {
                    return;
                }

                if (winner.score < 0.70) {
                    return;
                }

                const second =
                    ranked.find(
                        item =>
                            item.label !==
                            winner.label &&
                            item.label !==
                            "_background_noise_"
                    );

                console.log(
                    "HEARD:",
                    winner.label,
                    winner.score
                );

                if (!dotNetHelper) {
                    return;
                }

                dotNetHelper
                    .invokeMethodAsync(
                        "LetterRecognized",
                        winner.label,
                        winner.score,
                        second?.label ?? "",
                        second?.score ?? 0
                    )
                    .catch(error => {

                        console.warn(
                            "Blazor callback ignored:",
                            error
                        );
                    });
            },

            {
                probabilityThreshold: 0.70,
                overlapFactor: 0.25
            }
        );
    },

    async stopTesting() {

        this.testing = false;

        if (
            this.transferRecognizer &&
            this.transferRecognizer
                .isListening()
        ) {

            try {

                await this.transferRecognizer
                    .stopListening();
            }
            catch {
            }
        }
    },

    async resetTraining() {

        await this.stopTesting();

        this.modelTrained = false;

        if (this.transferRecognizer) {

            try {

                this.transferRecognizer
                    .clearExamples();
            }
            catch {
            }
        }

        await this.deleteSavedDataset();

        console.log(
            "VOICE TRAINING RESET"
        );

        return true;
    },

    async detachDotNetHelper() {

        await this.stopTesting();
    },

    async stop() {

        await this.stopTesting();
    }
};